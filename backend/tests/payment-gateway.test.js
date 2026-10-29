import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import express from 'express';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { Organisation, OrganisationMembership, PaymentCheckout, Invoice, User, ActivityLog, Tier } from '../models/index.js';
import { config } from '../config/config.js';
import { createPaymentGateway, paymentGateway } from '../services/paymentGateway.js';
import { emailService } from '../services/emailService.js';
import { walletService } from '../services/walletService.js';
import paymentRouter from '../routes/payments.js';

const models = { Organisation, OrganisationMembership, PaymentCheckout, Invoice, User, ActivityLog, Tier };
const originals = [];
const clone = value => structuredClone(value);
let rows, service, nextId, receiptCalls, welcomeCalls, walletCalls, currentTime;

function matches(row, filter = {}) {
  return Object.entries(filter).every(([key, expected]) => {
    if (key === '$or') return expected.some(branch => matches(row, branch));
    if (expected && typeof expected === 'object') {
      if ('$exists' in expected && (row[key] !== undefined) !== expected.$exists) return false;
      if ('$ne' in expected && row[key] === expected.$ne) return false;
      if ('$in' in expected && !expected.$in.includes(row[key])) return false;
      if ('$gt' in expected && !(row[key] > expected.$gt)) return false;
      if ('$gte' in expected && !(row[key] >= expected.$gte)) return false;
      if ('$lt' in expected && !(row[key] < expected.$lt)) return false;
      if ('$lte' in expected && !(row[key] <= expected.$lte)) return false;
      return true;
    }
    return row[key] === expected;
  });
}
function update(row, operation, inserted = false) {
  if (inserted) Object.assign(row, clone(operation.$setOnInsert || {}));
  Object.assign(row, clone(operation.$set || (!Object.keys(operation).some(key => key.startsWith('$')) ? operation : {})));
  for (const [key, amount] of Object.entries(operation.$inc || {})) row[key] = (row[key] || 0) + amount;
  for (const key of Object.keys(operation.$unset || {})) delete row[key];
}
function doc(value, name) {
  if (!value || typeof value !== 'object') return value;
  const result = clone(value);
  Object.defineProperty(result, 'toObject', { value: () => clone({ ...result }) });
  Object.defineProperty(result, 'save', { value: async () => {
    const row = rows[name].find(item => item._id === result._id);
    assert.ok(row); Object.assign(row, clone({ ...result })); return result;
  } });
  return result;
}
function query(value, name) {
  return { session() { return this; }, select() { return this; }, sort() { return this; }, async lean() { return clone(value); }, then(resolve, reject) {
    return Promise.resolve(Array.isArray(value) ? value.map(row => doc(row, name)) : doc(value, name)).then(resolve, reject);
  } };
}
function patch(target, name, replacement) { originals.push([target, name, target[name]]); target[name] = replacement; }
before(() => {
  for (const [name, model] of Object.entries(models)) {
    patch(model, 'find', filter => query(rows[name].filter(row => matches(row, filter)), name));
    patch(model, 'findById', id => query(rows[name].find(row => row._id === id) || null, name));
    patch(model, 'findOne', filter => query(rows[name].find(row => matches(row, filter)) || null, name));
    patch(model, 'countDocuments', filter => query(rows[name].filter(row => matches(row, filter)).length, name));
    patch(model, 'findByIdAndUpdate', (id, operation) => {
      const row = rows[name].find(item => item._id === id); if (row) update(row, operation); return query(row || null, name);
    });
    patch(model, 'findOneAndUpdate', (filter, operation, options = {}) => {
      let row = rows[name].find(item => matches(item, filter));
      if (!row && options.upsert) { row = { _id: `${name}-${++nextId}`, ...clone(filter) }; rows[name].push(row); update(row, operation, true); }
      else if (row) update(row, operation);
      return query(row || null, name);
    });
    patch(model, 'create', async input => {
      const created = (Array.isArray(input) ? input : [input]).map(value => ({ _id: `${name}-${++nextId}`, ...clone(value) }));
      rows[name].push(...created); return Array.isArray(input) ? created.map(row => doc(row, name)) : doc(created[0], name);
    });
  }
  patch(mongoose, 'startSession', async () => ({ async withTransaction(callback) {
    const snapshot = clone(rows);
    try { return await callback(); } catch (error) { rows = snapshot; throw error; }
  }, async endSession() {} }));
  patch(emailService, 'sendPaymentConfirmation', async () => { receiptCalls++; return { status: 'sent' }; });
  patch(emailService, 'sendOrganisationWelcome', async () => { welcomeCalls++; return { status: 'sent' }; });
  patch(walletService, 'updateWalletObject', async () => { walletCalls++; });
});
after(() => { for (const [target, key, value] of originals.reverse()) target[key] = value; });
beforeEach(() => {
  nextId = receiptCalls = welcomeCalls = walletCalls = 0;
  currentTime = new Date('2026-01-15T12:00:00.000Z');
  rows = Object.fromEntries(Object.keys(models).map(name => [name, []]));
  rows.Organisation.push({ _id: 'org', name: 'Local Community', adminId: 'owner', isPublic: true, visibility: 'public' }, { _id: 'other', name: 'Other', adminId: 'other-owner' });
  rows.User.push({ _id: 'user', name: 'Member', email: 'member@example.test', emailVerified: true, status: 'active', activeOrganisationId: 'org' }, { _id: 'owner', name: 'Owner', email: 'owner@example.test', emailVerified: true, status: 'active', activeOrganisationId: 'org' });
  rows.OrganisationMembership.push({ _id: 'membership', organisationId: 'org', userId: 'user', role: 'member', status: 'pending', tierId: 'tier', tierName: 'Supporter', welcomeEmailEligible: true });
  rows.Tier.push({ _id: 'tier', organisationId: 'org', name: 'Supporter', price: 49, interval: 'monthly', isActive: true });
  service = createPaymentGateway({ now: () => new Date(currentTime) });
});
const membership = () => doc(rows.OrganisationMembership[0], 'OrganisationMembership');
const inputs = () => ({ user: doc(rows.User[0], 'User'), organisation: doc(rows.Organisation[0], 'Organisation'), membership: membership(), tier: doc(rows.Tier[0], 'Tier') });
async function checkout() { return (await service.createCheckout(inputs())).checkout; }
const confirmation = (sessionId, changes = {}) => ({ sessionId, userId: 'user', organisationId: 'org', paymentMethod: 'card', scenario: 'approved', verificationCode: '123456', ...changes });

test('Gateway sessions snapshot the server MYR price without activating paid membership', async () => {
  const result = await service.createCheckout({ ...inputs(), amount: 0.01, paymentStatus: 'paid' });
  assert.equal(result.paymentStatus, 'pending');
  assert.equal(result.checkout.amountCents, 4900);
  assert.equal(result.checkout.currency, 'MYR');
  assert.equal(result.checkout.organisationId, 'org');
  assert.equal(result.checkout.tierId, 'tier');
  assert.equal(result.checkout.billingInterval, 'monthly');
  assert.equal(membership().status, 'pending');
  assert.equal(rows.Invoice.length, 0);
  assert.equal(receiptCalls + welcomeCalls + walletCalls, 0);
});

test('Free, unsupported, invalid and unjoined paid tiers cannot create a gateway session', async () => {
  for (const price of [0, -1, NaN, Infinity, Number.MAX_SAFE_INTEGER]) {
    rows.Tier[0].price = price;
    await assert.rejects(service.createCheckout(inputs()), error => error.status === 400);
  }
  rows.Tier[0].price = 49; rows.Tier[0].interval = 'weekly';
  await assert.rejects(service.createCheckout(inputs()), error => error.status === 400);
  rows.Tier[0].interval = 'monthly'; rows.Tier[0]._id = 'unjoined-tier';
  await assert.rejects(service.createCheckout(inputs()), error => error.status === 400);
  assert.equal(rows.PaymentCheckout.length, 0);
});

test('Viewing an open session leaves the member locked and does not create payment records', async () => {
  const session = await checkout();
  const result = await service.checkoutStatus(session.id, 'user', 'org');
  assert.equal(result.paymentStatus, 'pending');
  assert.equal(membership().status, 'pending');
  assert.equal(rows.Invoice.length, 0);
});

test('Tier capacity excludes the paying member and is checked again before confirmation', async () => {
  rows.Tier[0].maxMembers = 1;
  const session = await checkout();
  rows.OrganisationMembership.push({ _id: 'other-member', organisationId: 'org', userId: 'another-user', role: 'member', status: 'active', tierId: 'tier' });
  await assert.rejects(service.createCheckout(inputs()), error => error.status === 409);
  await assert.rejects(service.confirmCheckout(confirmation(session.id)), error => error.status === 409);
  assert.equal(membership().status, 'pending');
  assert.equal(rows.Invoice.length, 0);
});

test('The explicit demo verification code is required before approval', async () => {
  const session = await checkout();
  for (const verificationCode of ['', '000000', '12345', '1234567']) {
    await assert.rejects(service.confirmCheckout(confirmation(session.id, { verificationCode })), error => error.status === 400);
  }
  assert.equal(membership().status, 'pending');
  assert.equal(rows.Invoice.length, 0);
});

test('Invalid gateway methods and outcomes cannot authorize a payment', async () => {
  const session = await checkout();
  await assert.rejects(service.confirmCheckout(confirmation(session.id, { paymentMethod: 'cash' })), error => error.status === 400);
  await assert.rejects(service.confirmCheckout(confirmation(session.id, { scenario: 'paid' })), error => error.status === 400);
  assert.equal(membership().status, 'pending');
  assert.equal(rows.Invoice.length, 0);
});

for (const paymentMethod of ['card', 'online_banking', 'ewallet']) {
  test(`Verified demo ${paymentMethod} approval activates a membership and records one MYR invoice`, async () => {
    const session = await checkout();
    const result = await service.confirmCheckout(confirmation(session.id, { paymentMethod }));
    assert.equal(result.paymentStatus, 'paid');
    assert.equal(membership().status, 'active');
    assert.equal(membership().expirationDate, '2026-02-15T12:00:00.000Z');
    assert.equal(rows.Invoice.length, 1);
    assert.equal(rows.Invoice[0].paymentCheckoutId, session.id);
    assert.equal(rows.Invoice[0].paymentStatus, 'paid');
    assert.equal(rows.Invoice[0].currency, 'MYR');
    assert.equal(rows.Invoice[0].amount, 49);
    assert.equal(receiptCalls, 1);
    assert.equal(welcomeCalls, 1);
    assert.equal(walletCalls, 1);
  });
}

test('Repeated approved confirmation reuses its invoice and never extends access twice', async () => {
  const session = await checkout();
  await service.confirmCheckout(confirmation(session.id));
  const expirationDate = membership().expirationDate;
  const repeated = await service.confirmCheckout(confirmation(session.id));
  assert.equal(repeated.paymentStatus, 'paid');
  assert.equal(membership().expirationDate, expirationDate);
  assert.equal(rows.Invoice.length, 1);
  assert.equal(receiptCalls, 1);
  assert.equal(welcomeCalls, 1);
  assert.equal(walletCalls, 1);
});

test('A declined demo payment stays locked and records a failed invoice once', async () => {
  const session = await checkout();
  const result = await service.confirmCheckout(confirmation(session.id, { scenario: 'declined' }));
  assert.equal(result.paymentStatus, 'failed');
  assert.equal(membership().status, 'pending');
  assert.equal(rows.Invoice.length, 1);
  assert.equal(rows.Invoice[0].paymentStatus, 'failed');
  await service.confirmCheckout(confirmation(session.id, { scenario: 'declined' }));
  assert.equal(rows.Invoice.length, 1);
  assert.equal(receiptCalls + welcomeCalls + walletCalls, 0);
});

test('Cancellation leaves paid membership pending and prevents later confirmation', async () => {
  const session = await checkout();
  assert.equal((await service.cancelCheckout(session.id, 'user', 'org')).paymentStatus, 'cancelled');
  await assert.rejects(service.confirmCheckout(confirmation(session.id)), error => error.status === 409);
  assert.equal(membership().status, 'pending');
  assert.equal(rows.Invoice.length, 0);
});

test('Expired checkout sessions cannot activate membership', async () => {
  const session = await checkout();
  currentTime = new Date('2026-01-15T12:16:00.000Z');
  assert.equal((await service.checkoutStatus(session.id, 'user', 'org')).paymentStatus, 'expired');
  await assert.rejects(service.confirmCheckout(confirmation(session.id)), error => [409, 410].includes(error.status));
  assert.equal(membership().status, 'pending');
  assert.equal(rows.Invoice.length, 0);
});

test('Checkout lookup, confirmation and cancellation are isolated by both member and organisation', async () => {
  const session = await checkout();
  for (const [userId, organisationId] of [['other-user', 'org'], ['user', 'other']]) {
    await assert.rejects(service.checkoutStatus(session.id, userId, organisationId), error => error.status === 404);
    await assert.rejects(service.cancelCheckout(session.id, userId, organisationId), error => error.status === 404);
    await assert.rejects(service.confirmCheckout(confirmation(session.id, { userId, organisationId })), error => error.status === 404);
  }
  assert.equal(membership().status, 'pending');
  assert.equal(rows.Invoice.length, 0);
});

test('A session uses its original server price even if the tier is edited before confirmation', async () => {
  const session = await checkout();
  rows.Tier[0].price = 990;
  await service.confirmCheckout(confirmation(session.id));
  assert.equal(rows.Invoice[0].amount, 49);
});

test('A manual renewal extends existing paid access once and does not repeat the welcome email', async () => {
  const first = await checkout();
  await service.confirmCheckout(confirmation(first.id));
  const next = await checkout();
  assert.notEqual(next.id, first.id);
  await service.confirmCheckout(confirmation(next.id));
  await service.confirmCheckout(confirmation(next.id));
  assert.equal(membership().expirationDate, '2026-03-15T12:00:00.000Z');
  assert.equal(rows.Invoice.length, 2);
  assert.equal(welcomeCalls, 1);
});

test('Monthly renewal clamps the last day of shorter months', async () => {
  currentTime = new Date('2026-01-31T12:00:00.000Z');
  const session = await checkout();
  await service.confirmCheckout(confirmation(session.id));
  assert.equal(membership().expirationDate, '2026-02-28T12:00:00.000Z');
});

test('Yearly membership clamps leap day and expired renewal begins at the current time', async () => {
  currentTime = new Date('2028-02-29T12:00:00.000Z');
  rows.Tier[0].interval = 'yearly';
  rows.OrganisationMembership[0].status = 'expired';
  rows.OrganisationMembership[0].expirationDate = '2020-01-01T00:00:00.000Z';
  const session = await checkout();
  await service.confirmCheckout(confirmation(session.id));
  assert.equal(membership().expirationDate, '2029-02-28T12:00:00.000Z');
});

test('Failed manual renewal never extends the previously paid membership period', async () => {
  rows.OrganisationMembership[0].status = 'active';
  rows.OrganisationMembership[0].expirationDate = '2026-02-15T12:00:00.000Z';
  const session = await checkout();
  await service.confirmCheckout(confirmation(session.id, { scenario: 'declined' }));
  assert.equal(membership().expirationDate, '2026-02-15T12:00:00.000Z');
  assert.equal(membership().status, 'active');
});

test('Administrative suspension after session creation cannot be undone by approval', async () => {
  const session = await checkout();
  rows.OrganisationMembership[0].status = 'suspended';
  await assert.rejects(service.confirmCheckout(confirmation(session.id)), error => [403, 409].includes(error.status));
  assert.equal(membership().status, 'suspended');
  assert.equal(rows.Invoice.length, 0);
});

test('A failed transaction rolls back invoice and activation so confirmation can be retried', async t => {
  const session = await checkout();
  const original = ActivityLog.create;
  t.mock.method(ActivityLog, 'create', async () => { throw new Error('Database write failed'); });
  await assert.rejects(service.confirmCheckout(confirmation(session.id)));
  assert.equal(membership().status, 'pending');
  assert.equal(rows.Invoice.length, 0);
  assert.equal(receiptCalls + welcomeCalls + walletCalls, 0);
  ActivityLog.create = original;
  assert.equal((await service.confirmCheckout(confirmation(session.id))).paymentStatus, 'paid');
});

test('Notification failure does not undo an approved demo payment', async t => {
  const session = await checkout();
  t.mock.method(console, 'error', () => {});
  t.mock.method(emailService, 'sendPaymentConfirmation', async () => { throw new Error('Mail unavailable'); });
  assert.equal((await service.confirmCheckout(confirmation(session.id))).paymentStatus, 'paid');
  assert.equal(membership().status, 'active');
  assert.equal(rows.Invoice[0].paymentStatus, 'paid');
});

test('Invoices enforce one checkout reference and checkout schemas have no payment credential fields', () => {
  assert.ok(Invoice.schema.indexes().some(([fields, options]) => fields.paymentCheckoutId === 1 && options.unique));
  for (const schema of [PaymentCheckout.schema, Invoice.schema]) {
    for (const field of ['cardNumber', 'pan', 'cvc', 'cvv', 'bankPassword', 'verificationCode']) assert.equal(schema.path(field), undefined);
  }
});

async function serve(callback) {
  const app = express(); app.use(express.json()); app.use('/payments', paymentRouter);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try { await callback(`http://127.0.0.1:${server.address().port}`); }
  finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}
const headers = (id = 'user') => ({ 'Content-Type': 'application/json', ...(id ? { Authorization: `Bearer ${jwt.sign({ id }, config.JWT_SECRET)}` } : {}) });

test('Payment routes reject missing authentication, owner checkout and stale organisation submissions', async t => {
  t.mock.method(paymentGateway, 'createCheckout', async () => { throw new Error('Invalid scope reached gateway'); });
  await serve(async base => {
    for (const [id, organisationId, expected] of [[null, 'org', 401], ['owner', 'org', 400], ['user', 'other', 409]]) {
      const response = await fetch(`${base}/payments/checkout`, { method: 'POST', headers: headers(id), body: JSON.stringify({ tierId: 'tier', organisationId }) });
      assert.equal(response.status, expected);
    }
  });
});

test('Gateway routes derive identity and price on the server and discard card credentials', async t => {
  const session = await checkout();
  t.mock.method(paymentGateway, 'createCheckout', value => service.createCheckout(value));
  t.mock.method(paymentGateway, 'confirmCheckout', value => service.confirmCheckout(value));
  const cardNumber = '4242424242424242';
  await serve(async base => {
    const createResponse = await fetch(`${base}/payments/checkout`, { method: 'POST', headers: headers(), body: JSON.stringify({ tierId: 'tier', organisationId: 'org', amount: 1, userId: 'owner', cardNumber, cvc: '789' }) });
    assert.equal(createResponse.status, 200);
    assert.equal((await createResponse.json()).checkout.amountCents, 4900);
    const response = await fetch(`${base}/payments/checkout/${session.id}/confirm`, { method: 'POST', headers: headers(), body: JSON.stringify({ organisationId: 'org', paymentMethod: 'card', scenario: 'approved', verificationCode: '123456', userId: 'owner', amount: 1, cardNumber, cvc: '789', bankPassword: 'private-bank-password' }) });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).paymentStatus, 'paid');
  });
  const stored = JSON.stringify(rows);
  assert.equal(stored.includes(cardNumber), false);
  assert.equal(stored.includes('private-bank-password'), false);
  for (const row of [...rows.PaymentCheckout, ...rows.Invoice]) {
    for (const field of ['cardNumber', 'cvc', 'bankPassword', 'verificationCode']) assert.equal(Object.hasOwn(row, field), false);
  }
  assert.equal(rows.Invoice[0].userId, 'user');
  assert.equal(rows.Invoice[0].amount, 49);
});

function existingPaidMembership({ price = 100, interval = 'monthly', amount = 100,
  periodStart = '2026-01-01T00:00:00.000Z', periodEnd = '2026-01-31T00:00:00.000Z' } = {}) {
  currentTime = new Date('2026-01-16T00:00:00.000Z');
  Object.assign(rows.Tier[0], { price, interval });
  Object.assign(rows.OrganisationMembership[0], { status: 'active', expirationDate: periodEnd });
  rows.Invoice.push({ _id: 'original-invoice', invoiceNumber: 'ORIGINAL', userId: 'user', organisationId: 'org',
    tierId: 'tier', tierName: 'Supporter', paymentStatus: 'paid', currency: 'MYR', amount,
    billingInterval: interval, periodStart, periodEnd, paidAt: periodStart });
  rows.Tier.push({ _id: 'premium', organisationId: 'org', name: 'Premium', price: 200, interval: 'monthly', isActive: true });
}
const upgradeInputs = (tierId = 'premium') => ({ ...inputs(), intent: 'upgrade', tier: doc(rows.Tier.find(tier => tier._id === tierId), 'Tier') });

test('Upgrade quotes credit unused paid days and start a new full billing period without mutating membership', async () => {
  existingPaidMembership();
  const result = await service.quoteCheckout({ ...upgradeInputs(), amountCents: 1, creditCents: 999999 });
  assert.equal(result.quote.subtotalCents, 20000);
  assert.equal(result.quote.unusedCreditCents, 5000);
  assert.equal(result.quote.creditCents, 5000);
  assert.equal(result.quote.amountCents, 15000);
  assert.equal(result.quote.remainingDays, 15);
  assert.equal(result.quote.totalDays, 30);
  assert.equal(result.quote.periodStart, '2026-01-16T00:00:00.000Z');
  assert.equal(result.quote.periodEnd, '2026-02-16T00:00:00.000Z');
  assert.equal(result.quote.previousPeriodEnd, '2026-01-31T00:00:00.000Z');
  assert.equal(membership().tierId, 'tier');
  assert.equal(membership().expirationDate, '2026-01-31T00:00:00.000Z');
  assert.equal(rows.PaymentCheckout.length, 0);
  assert.equal(rows.Invoice.length, 1);
});

test('Upgrade confirmation persists the credit breakdown, service value and first known subscription date once', async () => {
  existingPaidMembership();
  const session = (await service.createCheckout(upgradeInputs())).checkout;
  await service.confirmCheckout(confirmation(session.id));
  await service.confirmCheckout(confirmation(session.id));
  assert.equal(membership().tierId, 'premium');
  assert.equal(membership().expirationDate, '2026-02-16T00:00:00.000Z');
  assert.equal(membership().firstSubscribedAt, '2026-01-01T00:00:00.000Z');
  assert.equal(membership().billingRevision, 1);
  assert.equal(membership().billingPeriods.length, 1);
  assert.equal(membership().billingPeriods[0].valueCents, 20000);
  const invoice = rows.Invoice.find(row => row.paymentCheckoutId === session.id);
  assert.equal(invoice.amount, 150);
  assert.equal(invoice.subtotalCents, 20000);
  assert.equal(invoice.creditCents, 5000);
  assert.equal(invoice.coverageValueCents, 20000);
  assert.equal(invoice.intent, 'upgrade');
  assert.equal(rows.Invoice.length, 2);
  assert.equal(receiptCalls, 1);
});

test('A second upgrade transfers the remaining service value rather than only the previous net cash payment', async () => {
  existingPaidMembership();
  const first = (await service.createCheckout(upgradeInputs())).checkout;
  await service.confirmCheckout(confirmation(first.id));
  rows.Tier.push({ _id: 'gold', organisationId: 'org', name: 'Gold', price: 300, interval: 'monthly', isActive: true });
  currentTime = new Date('2026-01-31T12:00:00.000Z');
  const quote = (await service.quoteCheckout(upgradeInputs('gold'))).quote;
  assert.equal(quote.unusedCreditCents, 10000);
  assert.equal(quote.amountCents, 20000);
  assert.equal(quote.periodEnd, '2026-02-28T12:00:00.000Z');
});

test('Legacy credit comes from the actual paid invoice even if an administrator changed the tier price', async () => {
  existingPaidMembership({ price: 1000, amount: 100 });
  rows.Tier[1].price = 2000;
  assert.equal((await service.quoteCheckout(upgradeInputs())).quote.creditCents, 5000);
  rows.Invoice.length = 0;
  assert.equal((await service.quoteCheckout(upgradeInputs())).quote.creditCents, 0);
});

test('Foreign currency and failed invoices cannot create unused credit for legacy active memberships', async () => {
  existingPaidMembership();
  rows.Invoice[0].currency = 'USD';
  assert.equal((await service.quoteCheckout(upgradeInputs())).quote.creditCents, 0);
  rows.Invoice[0].currency = 'MYR'; rows.Invoice[0].paymentStatus = 'failed';
  assert.equal((await service.quoteCheckout(upgradeInputs())).quote.creditCents, 0);
});

test('Event ticket invoices cannot create upgrade credit or establish the first subscription date', async () => {
  existingPaidMembership();
  rows.Invoice[0].category = 'event_ticket';
  const quote = (await service.quoteCheckout(upgradeInputs())).quote;
  assert.equal(quote.creditCents, 0);
  assert.equal(quote.creditUnavailable, true);
  const session = (await service.createCheckout(upgradeInputs())).checkout;
  await service.confirmCheckout(confirmation(session.id));
  assert.equal(membership().firstSubscribedAt, '2026-01-16T00:00:00.000Z');
});

test('Upgrade requires explicit intent and a strictly higher equivalent monthly price', async () => {
  existingPaidMembership();
  await assert.rejects(service.createCheckout({ ...upgradeInputs(), intent: undefined }), error => error.status === 400);
  await assert.rejects(service.createCheckout({ ...upgradeInputs(), intent: 'renew' }), error => error.status === 400);
  await assert.rejects(service.createCheckout({ ...upgradeInputs(), tier: inputs().tier }), error => error.status === 400);
  rows.Tier[1].interval = 'yearly'; rows.Tier[1].price = 1200;
  await assert.rejects(service.createCheckout(upgradeInputs()), error => error.status === 400);
  rows.Tier[1].price = 1200.12;
  assert.equal((await service.createCheckout(upgradeInputs())).checkout.intent, 'upgrade');
});

test('Free active members can upgrade for the full new period without invented credit', async () => {
  existingPaidMembership({ price: 0 });
  rows.Invoice.length = 0;
  delete rows.OrganisationMembership[0].expirationDate;
  const session = (await service.createCheckout(upgradeInputs())).checkout;
  assert.equal(session.creditCents, 0);
  assert.equal(session.amountCents, 20000);
  await service.confirmCheckout(confirmation(session.id));
  assert.equal(membership().expirationDate, '2026-02-16T00:00:00.000Z');
});

test('Paused, expired, suspended and pending memberships cannot bypass the upgrade policy', async () => {
  existingPaidMembership();
  for (const status of ['pending', 'expired', 'suspended', 'revoked', 'cancelled']) {
    rows.OrganisationMembership[0].status = status;
    await assert.rejects(service.quoteCheckout(upgradeInputs()), error => [400, 403, 409].includes(error.status));
  }
  rows.OrganisationMembership[0].status = 'active';
  rows.OrganisationMembership[0].expirationDate = '2026-01-15T00:00:00.000Z';
  await assert.rejects(service.quoteCheckout(upgradeInputs()), error => error.status === 409);
  rows.OrganisationMembership[0].expirationDate = 'invalid';
  await assert.rejects(service.quoteCheckout(upgradeInputs()), error => error.status === 409);
});

test('Scheduled cancellation and later cancellation changes invalidate an existing upgrade quote', async () => {
  existingPaidMembership();
  const session = (await service.createCheckout(upgradeInputs())).checkout;
  rows.OrganisationMembership[0].cancelAtPeriodEnd = true;
  await assert.rejects(service.createCheckout(upgradeInputs()), error => error.status === 409);
  await assert.rejects(service.confirmCheckout(confirmation(session.id)), error => error.status === 409);
  rows.OrganisationMembership[0].cancelAtPeriodEnd = false;
  rows.OrganisationMembership[0].billingRevision = 2;
  await assert.rejects(service.confirmCheckout(confirmation(session.id)), error => error.status === 409);
  assert.equal(membership().tierId, 'tier');
});

for (const status of ['active', 'cancelled']) {
  test(`A ${status} membership whose cancellation has taken effect can renew its existing tier`, async () => {
    existingPaidMembership();
    Object.assign(rows.OrganisationMembership[0], { status, cancelAtPeriodEnd: true,
      cancelledAt: '2026-01-10T00:00:00.000Z', expirationDate: '2026-01-15T00:00:00.000Z' });
    const session = (await service.createCheckout({ ...inputs(), intent: 'renew' })).checkout;
    assert.equal(session.intent, 'renew');
    assert.equal(session.periodStart, '2026-01-16T00:00:00.000Z');
    await service.confirmCheckout(confirmation(session.id));
    assert.equal(membership().status, 'active');
    assert.equal(membership().cancelAtPeriodEnd, false);
    assert.equal(membership().cancelledAt, undefined);
    assert.equal(membership().expirationDate, '2026-02-16T00:00:00.000Z');
    assert.equal(membership().tierId, 'tier');
  });
}

test('Only one of two competing upgrade checkouts can consume the same credit', async () => {
  existingPaidMembership();
  rows.Tier.push({ _id: 'gold', organisationId: 'org', name: 'Gold', price: 300, interval: 'monthly', isActive: true });
  const first = (await service.createCheckout(upgradeInputs())).checkout;
  const second = (await service.createCheckout(upgradeInputs('gold'))).checkout;
  await service.confirmCheckout(confirmation(first.id));
  await assert.rejects(service.confirmCheckout(confirmation(second.id)), error => error.status === 409);
  assert.equal(rows.Invoice.length, 2);
  assert.equal(membership().billingRevision, 1);
});

test('Declined and cancelled upgrades preserve existing access, credit and the current tier', async () => {
  existingPaidMembership();
  const first = (await service.createCheckout(upgradeInputs())).checkout;
  await service.confirmCheckout(confirmation(first.id, { scenario: 'declined' }));
  assert.equal(membership().tierId, 'tier');
  assert.equal(membership().expirationDate, '2026-01-31T00:00:00.000Z');
  assert.equal((await service.quoteCheckout(upgradeInputs())).quote.creditCents, 5000);
  const second = (await service.createCheckout(upgradeInputs())).checkout;
  await service.cancelCheckout(second.id, 'user', 'org');
  assert.equal((await service.quoteCheckout(upgradeInputs())).quote.creditCents, 5000);
  assert.equal(membership().creditBalanceCents, undefined);
  assert.equal(membership().billingRevision, undefined);
});

test('Yearly to monthly upgrades preserve excess credit and zero-charge confirmations do not lose it', async () => {
  existingPaidMembership({ price: 1200, amount: 1200, interval: 'yearly',
    periodStart: '2025-07-16T00:00:00.000Z', periodEnd: '2026-07-16T00:00:00.000Z' });
  const quote = (await service.quoteCheckout(upgradeInputs())).quote;
  assert.equal(quote.subtotalCents, 20000);
  assert.equal(quote.unusedCreditCents, 59507);
  assert.equal(quote.amountCents, 0);
  assert.equal(quote.carryForwardCents, 39507);
  const session = (await service.createCheckout(upgradeInputs())).checkout;
  await service.confirmCheckout(confirmation(session.id));
  assert.equal(membership().creditBalanceCents, 39507);
  assert.equal(membership().billingPeriods[0].valueCents, 20000);
  assert.equal(rows.Invoice.at(-1).amount, 0);
  // A manual renewal consumes only the carried balance; the current service
  // value stays available until it is used or transferred by another upgrade.
  const renewal = (await service.createCheckout({ ...inputs(), tier: upgradeInputs().tier, intent: 'renew' })).checkout;
  assert.equal(renewal.creditCents, 20000);
  assert.equal(renewal.unusedCreditCents, 0);
  assert.equal(renewal.carryForwardCents, 19507);
  await service.confirmCheckout(confirmation(renewal.id));
  assert.equal(membership().creditBalanceCents, 19507);
  assert.equal(membership().billingPeriods.length, 2);
  assert.equal(membership().expirationDate, '2026-03-16T00:00:00.000Z');
});

test('Multiple prepaid renewal periods are transferred into an upgrade without losing future paid access value', async () => {
  existingPaidMembership();
  rows.OrganisationMembership[0].expirationDate = '2026-02-28T00:00:00.000Z';
  rows.Invoice.push({ ...rows.Invoice[0], _id: 'future-invoice', invoiceNumber: 'FUTURE',
    periodStart: '2026-01-31T00:00:00.000Z', periodEnd: '2026-02-28T00:00:00.000Z' });
  const quote = (await service.quoteCheckout(upgradeInputs())).quote;
  assert.equal(quote.unusedCreditCents, 15000);
  assert.equal(quote.amountCents, 5000);
  const session = (await service.createCheckout(upgradeInputs())).checkout;
  await service.confirmCheckout(confirmation(session.id));
  assert.equal(membership().billingPeriods.length, 1);
  assert.equal(membership().expirationDate, '2026-02-16T00:00:00.000Z');
});

test('A quote request is read-only, owner-scoped and disregards client-supplied prices and credits', async t => {
  existingPaidMembership();
  t.mock.method(paymentGateway, 'quoteCheckout', value => service.quoteCheckout(value));
  await serve(async base => {
    const response = await fetch(`${base}/payments/quote`, { method: 'POST', headers: headers(), body: JSON.stringify({
      tierId: 'premium', intent: 'upgrade', organisationId: 'org', amountCents: 1, creditCents: 999999, userId: 'owner' }) });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).quote.amountCents, 15000);
    const stale = await fetch(`${base}/payments/quote`, { method: 'POST', headers: headers(), body: JSON.stringify({ tierId: 'premium', intent: 'upgrade', organisationId: 'other' }) });
    assert.equal(stale.status, 409);
  });
  assert.equal(rows.PaymentCheckout.length, 0);
  assert.equal(rows.Invoice.length, 1);
});

function scheduledPaidDowngrade({ interval = 'monthly', price = 50 } = {}) {
  existingPaidMembership({ price: 200, amount: 200 });
  rows.Tier.push({ _id: 'cheaper', organisationId: 'org', name: 'Basic', price, interval, isActive: true });
  Object.assign(rows.OrganisationMembership[0], { scheduledTierId: 'cheaper',
    scheduledTierEffectiveAt: '2026-01-31T00:00:00.000Z', scheduledTierRequestedAt: '2026-01-16T00:00:00.000Z', billingRevision: 3 });
}
const downgradeRenewal = () => ({ ...inputs(), intent: 'renew', tier: doc(rows.Tier.find(tier => tier._id === 'cheaper'), 'Tier') });

test('A scheduled downgrade cannot be paid early or bypassed by renewing the expensive tier', async () => {
  scheduledPaidDowngrade();
  for (const timestamp of ['2026-01-16T00:00:00.000Z', '2026-01-30T23:59:59.999Z']) {
    currentTime = new Date(timestamp);
    await assert.rejects(service.quoteCheckout(downgradeRenewal()), error => error.status === 409);
    await assert.rejects(service.createCheckout(downgradeRenewal()), error => error.status === 409);
    await assert.rejects(service.createCheckout({ ...inputs(), intent: 'renew' }), error => error.status === 409);
    assert.equal(membership().tierId, 'tier');
    assert.equal(membership().status, 'active');
    assert.equal(membership().expirationDate, '2026-01-31T00:00:00.000Z');
  }
  assert.equal(rows.PaymentCheckout.length, 0);
  assert.equal(rows.Invoice.length, 1);
});

test('At the exact period boundary a paid downgrade renews only the scheduled tier without unused-period credit', async () => {
  scheduledPaidDowngrade();
  currentTime = new Date('2026-01-31T00:00:00.000Z');
  Object.assign(rows.OrganisationMembership[0], { status: 'expired', creditBalanceCents: 1200 });
  const quote = (await service.quoteCheckout(downgradeRenewal())).quote;
  assert.equal(quote.scheduledDowngrade, true);
  assert.equal(quote.intent, 'renew');
  assert.equal(quote.amountCents, 3800);
  assert.equal(quote.unusedCreditCents, 0);
  assert.equal(quote.creditBalanceCents, 1200);
  assert.equal(quote.periodStart, '2026-01-31T00:00:00.000Z');
  assert.equal(quote.periodEnd, '2026-02-28T00:00:00.000Z');
  assert.equal(membership().tierId, 'tier');
  const session = (await service.createCheckout(downgradeRenewal())).checkout;
  assert.equal(session.scheduledDowngrade, true);
  assert.equal(rows.PaymentCheckout[0].sourceScheduledTierId, 'cheaper');
  assert.equal(rows.PaymentCheckout[0].sourceScheduledTierEffectiveAt, '2026-01-31T00:00:00.000Z');
  await service.confirmCheckout(confirmation(session.id));
  await service.confirmCheckout(confirmation(session.id));
  assert.equal(membership().tierId, 'cheaper');
  assert.equal(membership().tierName, 'Basic');
  assert.equal(membership().status, 'active');
  assert.equal(membership().expirationDate, '2026-02-28T00:00:00.000Z');
  assert.equal(membership().scheduledTierId, undefined);
  assert.equal(membership().scheduledTierEffectiveAt, undefined);
  assert.equal(membership().scheduledTierRequestedAt, undefined);
  assert.equal(membership().billingRevision, 4);
  assert.equal(membership().creditBalanceCents, 0);
  assert.deepEqual(membership().billingPeriods, [{ tierId: 'cheaper', periodStart: '2026-01-31T00:00:00.000Z',
    periodEnd: '2026-02-28T00:00:00.000Z', valueCents: 5000, billingInterval: 'monthly' }]);
  const invoice = rows.Invoice.find(row => row.paymentCheckoutId === session.id);
  assert.equal(invoice.scheduledDowngrade, true);
  assert.equal(invoice.amount, 38);
  assert.equal(rows.Invoice.length, 2);
  assert.equal(receiptCalls, 1);
});

test('Late scheduled renewal begins when paid and uses the cheaper tier billing interval', async () => {
  scheduledPaidDowngrade({ interval: 'yearly', price: 600 });
  currentTime = new Date('2026-02-03T09:00:00.000Z');
  const session = (await service.createCheckout(downgradeRenewal())).checkout;
  assert.equal(session.billingInterval, 'yearly');
  assert.equal(session.periodStart, '2026-02-03T09:00:00.000Z');
  assert.equal(session.periodEnd, '2027-02-03T09:00:00.000Z');
  assert.equal(session.amountCents, 60000);
  await service.confirmCheckout(confirmation(session.id));
  assert.equal(membership().expirationDate, '2027-02-03T09:00:00.000Z');
  assert.equal(membership().tierId, 'cheaper');
});

test('A failed or cancelled downgrade renewal preserves the pending choice and original paid-period end', async () => {
  scheduledPaidDowngrade();
  currentTime = new Date('2026-01-31T00:00:00.000Z');
  const failed = (await service.createCheckout(downgradeRenewal())).checkout;
  await service.confirmCheckout(confirmation(failed.id, { scenario: 'declined' }));
  await service.confirmCheckout(confirmation(failed.id));
  const cancelled = (await service.createCheckout(downgradeRenewal())).checkout;
  await service.cancelCheckout(cancelled.id, 'user', 'org');
  await assert.rejects(service.confirmCheckout(confirmation(cancelled.id)), error => error.status === 409);
  assert.equal(membership().tierId, 'tier');
  assert.equal(membership().expirationDate, '2026-01-31T00:00:00.000Z');
  assert.equal(membership().scheduledTierId, 'cheaper');
  assert.equal(membership().scheduledTierEffectiveAt, '2026-01-31T00:00:00.000Z');
  assert.equal(membership().billingRevision, 3);
  assert.equal(rows.Invoice.filter(invoice => invoice.paymentStatus === 'paid').length, 1);
  assert.equal(receiptCalls + walletCalls, 0);
});

test('Cancelling or replacing a scheduled change invalidates its existing checkout, even without a revision update', async () => {
  for (const change of [
    { scheduledTierId: undefined, scheduledTierEffectiveAt: undefined },
    { scheduledTierId: 'different-tier' },
    { scheduledTierEffectiveAt: '2026-02-01T00:00:00.000Z' },
    { billingRevision: 4 },
  ]) {
    scheduledPaidDowngrade();
    currentTime = new Date('2026-01-31T00:00:00.000Z');
    const session = (await service.createCheckout(downgradeRenewal())).checkout;
    Object.assign(rows.OrganisationMembership[0], change);
    await assert.rejects(service.confirmCheckout(confirmation(session.id)), error => error.status === 409);
    assert.equal(membership().tierId, 'tier');
    assert.equal(rows.Invoice.some(invoice => invoice.paymentCheckoutId === session.id), false);
    rows.Tier.splice(1);
    rows.Invoice.splice(1);
    rows.PaymentCheckout.length = 0;
  }
});

test('A scheduled renewal requires a currently available cheaper tier and capacity again at confirmation', async () => {
  scheduledPaidDowngrade();
  currentTime = new Date('2026-01-31T00:00:00.000Z');
  const session = (await service.createCheckout(downgradeRenewal())).checkout;
  const target = () => rows.Tier.find(tier => tier._id === 'cheaper');
  target().isActive = false;
  await assert.rejects(service.confirmCheckout(confirmation(session.id)), error => error.status === 409);
  Object.assign(target(), { isActive: true, price: 200 });
  await assert.rejects(service.quoteCheckout(downgradeRenewal()), error => error.status === 409);
  await assert.rejects(service.confirmCheckout(confirmation(session.id)), error => error.status === 409);
  Object.assign(target(), { price: 50, maxMembers: 1 });
  rows.OrganisationMembership.push({ _id: 'other-cheaper-member', organisationId: 'org', userId: 'other-user', role: 'member', status: 'active', tierId: 'cheaper' });
  await assert.rejects(service.quoteCheckout(downgradeRenewal()), error => error.status === 409);
  await assert.rejects(service.confirmCheckout(confirmation(session.id)), error => error.status === 409);
  assert.equal(membership().tierId, 'tier');
  assert.equal(membership().scheduledTierId, 'cheaper');
  assert.equal(rows.Invoice.length, 1);
});

test('An approved immediate upgrade clears a pending downgrade, while a decline leaves it scheduled', async () => {
  scheduledPaidDowngrade();
  rows.Tier.push({ _id: 'gold', organisationId: 'org', name: 'Gold', price: 300, interval: 'monthly', isActive: true });
  const failed = (await service.createCheckout(upgradeInputs('gold'))).checkout;
  await service.confirmCheckout(confirmation(failed.id, { scenario: 'declined' }));
  assert.equal(membership().scheduledTierId, 'cheaper');
  const approved = (await service.createCheckout(upgradeInputs('gold'))).checkout;
  assert.equal(approved.scheduledDowngrade, false);
  assert.equal(approved.creditCents, 10000);
  await service.confirmCheckout(confirmation(approved.id));
  assert.equal(membership().tierId, 'gold');
  assert.equal(membership().scheduledTierId, undefined);
  assert.equal(membership().scheduledTierEffectiveAt, undefined);
  assert.equal(membership().scheduledTierRequestedAt, undefined);
  assert.equal(membership().expirationDate, '2026-02-16T00:00:00.000Z');
});

test('A newly scheduled downgrade invalidates an existing expensive-tier renewal before it can extend access', async () => {
  existingPaidMembership({ price: 200, amount: 200 });
  const session = (await service.createCheckout({ ...inputs(), intent: 'renew' })).checkout;
  Object.assign(rows.OrganisationMembership[0], { scheduledTierId: 'cheaper',
    scheduledTierEffectiveAt: '2026-01-31T00:00:00.000Z' });
  await assert.rejects(service.confirmCheckout(confirmation(session.id)), error => error.status === 409);
  assert.equal(membership().expirationDate, '2026-01-31T00:00:00.000Z');
  assert.equal(rows.Invoice.length, 1);
});

test('Payment routes permit only the selected organisation scheduled target after its paid period ends', async t => {
  scheduledPaidDowngrade();
  t.mock.method(paymentGateway, 'quoteCheckout', value => service.quoteCheckout(value));
  await serve(async base => {
    const send = body => fetch(`${base}/payments/quote`, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
    const early = await send({ tierId: 'cheaper', intent: 'renew', organisationId: 'org', scheduledTierEffectiveAt: '2020-01-01' });
    assert.equal(early.status, 409);
    currentTime = new Date('2026-01-31T00:00:00.000Z');
    const due = await send({ tierId: 'cheaper', intent: 'renew', organisationId: 'org' });
    assert.equal(due.status, 200);
    const body = await due.json();
    assert.equal(body.quote.scheduledDowngrade, true);
    assert.equal(body.quote.amountCents, 5000);
    const expensive = await send({ tierId: 'tier', intent: 'renew', organisationId: 'org' });
    assert.equal(expensive.status, 409);
    const staleOrg = await send({ tierId: 'cheaper', intent: 'renew', organisationId: 'other' });
    assert.equal(staleOrg.status, 409);
  });
  assert.equal(rows.Invoice.length, 1);
  assert.equal(rows.PaymentCheckout.length, 0);
});
