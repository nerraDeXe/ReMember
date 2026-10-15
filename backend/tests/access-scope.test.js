import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { config } from '../config/config.js';
import { User, Organisation, OrganisationMembership, Tier, Invoice, Event, ActivityLog } from '../models/index.js';
import adminRouter from '../routes/admin.js';
import memberRouter from '../routes/members.js';
import eventRouter from '../routes/events.js';
import paymentRouter from '../routes/payments.js';
import walletRouter from '../routes/wallet.js';
import { walletService } from '../services/walletService.js';
import { emailService } from '../services/emailService.js';

const models = { User, Organisation, OrganisationMembership, Tier, Invoice, Event, ActivityLog };
const originals = [];
let records, serial, walletCalls, mailCalls;
const clone = value => structuredClone(value);
function matches(record, filter = {}) {
  return Object.entries(filter).every(([key, expected]) => {
    if (key === '$or') return expected.some(branch => matches(record, branch));
    if (expected && typeof expected === 'object') {
      if ('$in' in expected) return expected.$in.includes(record[key]);
      if ('$ne' in expected) return record[key] !== expected.$ne;
    }
    return record[key] === expected;
  });
}
function update(record, operation) {
  Object.assign(record, operation.$set || (!Object.keys(operation).some(key => key.startsWith('$')) ? operation : {}));
  for (const key of Object.keys(operation.$unset || {})) delete record[key];
}
function document(value, modelName) {
  if (!value) return value;
  const result = clone(value);
  // Mongoose excludes select:false verification fields by default.
  if (modelName === 'User') for (const key of Object.keys(result)) if (key.startsWith('emailVerification')) delete result[key];
  Object.defineProperty(result, 'toObject', { value: () => clone(Object.fromEntries(Object.entries(result))) });
  Object.defineProperty(result, 'save', { value: async () => {
    const persisted = records[modelName].find(record => record._id === result._id);
    assert.ok(persisted, 'Saving an existing model document');
    Object.assign(persisted, clone(Object.fromEntries(Object.entries(result))));
    return result;
  } });
  return result;
}
function query(value, modelName) {
  let projected = value;
  const result = {
    select(fields) {
      if (modelName === 'User' && fields.includes('-password') && projected) {
        projected = clone(projected);
        if (Array.isArray(projected)) for (const item of projected) delete item.password;
        else delete projected.password;
      }
      return this;
    },
    sort(criteria) {
      if (Array.isArray(projected)) projected = [...projected].sort((a, b) => {
        for (const [key, direction] of Object.entries(criteria)) if (a[key] !== b[key]) return a[key] > b[key] ? direction : -direction;
        return 0;
      });
      return this;
    },
    async lean() { return clone(projected); },
    then(resolve, reject) {
      const data = Array.isArray(projected) ? projected.map(value => document(value, modelName)) : (projected && typeof projected === 'object' ? document(projected, modelName) : projected);
      return Promise.resolve(data).then(resolve, reject);
    }
  };
  return result;
}
function patch(target, method, replacement) {
  originals.push([target, method, target[method]]);
  target[method] = replacement;
}
before(() => {
  for (const [name, model] of Object.entries(models)) {
    const collection = () => records[name];
    patch(model, 'find', filter => query(collection().filter(record => matches(record, filter)), name));
    patch(model, 'findOne', filter => query(collection().find(record => matches(record, filter)) || null, name));
    patch(model, 'findById', id => query(collection().find(record => record._id === id) || null, name));
    patch(model, 'countDocuments', filter => query(collection().filter(record => matches(record, filter)).length, name));
    patch(model, 'exists', filter => query(collection().find(record => matches(record, filter)) ? { _id: 'exists' } : null, name));
    patch(model, 'create', async input => {
      const created = (Array.isArray(input) ? input : [input]).map(value => ({ _id: `${name}-${++serial}`, ...clone(value) }));
      collection().push(...created);
      return Array.isArray(input) ? created.map(value => document(value, name)) : document(created[0], name);
    });
    patch(model, 'findOneAndUpdate', (filter, operation) => {
      const record = collection().find(value => matches(value, filter));
      if (record) update(record, operation);
      return query(record || null, name);
    });
    patch(model, 'findByIdAndUpdate', (id, operation) => {
      const record = collection().find(value => value._id === id);
      if (record) update(record, operation);
      return query(record || null, name);
    });
    patch(model, 'findByIdAndDelete', id => {
      const index = collection().findIndex(value => value._id === id);
      return query(index < 0 ? null : collection().splice(index, 1)[0], name);
    });
  }
  patch(mongoose, 'startSession', async () => ({
    async withTransaction(callback) {
      const snapshot = clone(records);
      try { await callback(); }
      catch (error) { records = snapshot; throw error; }
    }, async endSession() {}
  }));
  patch(walletService, 'updateWalletObject', async user => {
    walletCalls.push(clone(user));
    return { success: true, objectId: `${user._id}_${user.organisationId}` };
  });
  patch(emailService, 'sendPaymentConfirmation', async (...args) => { mailCalls.push(['payment', ...args.map(value => clone(Object.fromEntries(Object.entries(value))))]); });
  patch(emailService, 'sendEventRsvpConfirmation', async (...args) => { mailCalls.push(['rsvp', ...args.map(value => clone(Object.fromEntries(Object.entries(value))))]); });
});
after(() => {
  for (const [target, method, original] of originals.reverse()) target[method] = original;
});

const account = (id, selectedOrg, role = 'member') => ({ _id: id, name: id, firstName: id, lastName: 'Account', email: `${id}@example.test`, password: 'HASH_MUST_NEVER_LEAK', emailVerificationHash: 'CODE_MUST_NEVER_LEAK', emailVerificationExpiresAt: '2099-01-01', emailVerified: true, membershipNumber: `MEM-${id}`, role, status: 'active', activeOrganisationId: selectedOrg, country: 'Malaysia' });
const membership = (userId, organisationId, role = 'member', status = 'active', tier = `${organisationId}-free`) => ({ _id: `${userId}-${organisationId}`, userId, organisationId, role, status, tierId: tier, tierName: tier.endsWith('paid') ? 'Supporter' : 'Community', joinedDate: '2026-10-14T00:00:00Z', expirationDate: '2099-01-01T00:00:00Z' });
beforeEach(() => {
  serial = 0;
  walletCalls = [];
  mailCalls = [];
  records = Object.fromEntries(Object.keys(models).map(name => [name, []]));
  records.User.push(account('ownerA', 'A', 'admin'), account('ownerB', 'B', 'admin'), account('member', 'A'), account('foreign', 'B'), account('unassociated', ''));
  records.Organisation.push({ _id: 'A', name: 'Organisation A', adminId: 'ownerA', isPublic: true, visibility: 'public' }, { _id: 'B', name: 'Organisation B', adminId: 'ownerB', isPublic: true, visibility: 'public' });
  records.OrganisationMembership.push(membership('ownerA', 'A', 'owner'), membership('ownerA', 'B'), membership('ownerB', 'B', 'owner'), membership('ownerB', 'A'), membership('member', 'A'), membership('member', 'B'), membership('foreign', 'B'));
  for (const organisationId of ['A', 'B']) records.Tier.push({ _id: `${organisationId}-free`, organisationId, name: 'Community', price: 0, interval: 'monthly', isActive: true }, { _id: `${organisationId}-paid`, organisationId, name: 'Supporter', price: 50, interval: 'yearly', isActive: true });
  records.Invoice.push(
    { _id: 'member-A-invoice', organisationId: 'A', userId: 'member', invoiceNumber: 'INV-A-MEMBER', tierName: 'Community', amount: 10, paymentStatus: 'paid' },
    { _id: 'ownerB-A-invoice', organisationId: 'A', userId: 'ownerB', invoiceNumber: 'INV-A-OTHER', tierName: 'Supporter', amount: 15, paymentStatus: 'paid' },
    { _id: 'member-B-invoice', organisationId: 'B', userId: 'member', invoiceNumber: 'INV-B-MEMBER', tierName: 'Supporter', amount: 99999, paymentStatus: 'paid' },
    { _id: 'foreign-B-invoice', organisationId: 'B', userId: 'foreign', invoiceNumber: 'INV-B-FOREIGN', tierName: 'Supporter', amount: 80000, paymentStatus: 'paid' }
  );
  records.Event.push(
    { _id: 'event-A', organisationId: 'A', title: 'A event', date: '2099-01-01', capacity: 20, allowedTiers: ['Community'], rsvps: [{ userId: 'member', userName: 'Member', userEmail: 'member@example.test' }, { userId: 'ownerB', userName: 'Other Member', userEmail: 'PRIVATE_OTHER_EMAIL' }] },
    { _id: 'event-B', organisationId: 'B', title: 'B event', date: '2099-01-01', capacity: 20, allowedTiers: ['Supporter'], rsvps: [{ userId: 'member', userName: 'Member', userEmail: 'member@example.test' }, { userId: 'foreign', userEmail: 'FOREIGN_EMAIL' }] }
  );
  records.ActivityLog.push({ _id: 'log-A', organisationId: 'A', action: 'ORG_A_ACTION', timestamp: '2026-10-14' }, { _id: 'log-B', organisationId: 'B', action: 'ORG_B_ACTION', timestamp: '2026-10-14' });
});

function request(router, method, path, { userId = 'member', body = {}, params = {}, query = {} } = {}) {
  const route = router.stack.find(layer => layer.route?.path === path && layer.route.methods[method.toLowerCase()])?.route;
  assert.ok(route, `Route ${method} ${path} exists`);
  // Include router.use() middleware; skipping it would miss the actual auth boundary.
  const handlers = [...router.stack.filter(layer => !layer.route).map(layer => layer.handle), ...route.stack.map(layer => layer.handle)];
  const req = { body, params, query, method, originalUrl: path, ip: '127.0.0.1', headers: userId ? { authorization: `Bearer ${jwt.sign({ id: userId }, config.JWT_SECRET)}` } : {} };
  return new Promise((resolve, reject) => {
    let status = 200;
    const response = value => resolve({ status, body: typeof value === 'string' ? value : JSON.parse(JSON.stringify(value)) });
    const res = { status(value) { status = value; return this; }, json: response, send: response, setHeader() {} };
    let index = 0;
    const next = error => {
      if (error) return reject(error);
      const handler = handlers[index++];
      if (!handler) return reject(new Error('Route completed without a response'));
      Promise.resolve(handler(req, res, next)).catch(reject);
    };
    next();
  });
}

test('Admin APIs reject members and owners acting as members of another organisation', async () => {
  assert.equal((await request(adminRouter, 'GET', '/members')).status, 403);
  records.User.find(user => user._id === 'ownerA').activeOrganisationId = 'B';
  assert.equal((await request(adminRouter, 'GET', '/members', { userId: 'ownerA' })).status, 403);
  assert.equal((await request(adminRouter, 'GET', '/members', { userId: null })).status, 401);
  records.User.find(user => user._id === 'ownerB').emailVerified = false;
  assert.equal((await request(adminRouter, 'GET', '/members', { userId: 'ownerB' })).status, 403);
});

test('Owner member directory and CSV contain only organisation members, including other organisation owners, without secrets', async () => {
  const result = await request(adminRouter, 'GET', '/members', { userId: 'ownerA' });
  assert.equal(result.status, 200);
  assert.deepEqual(new Set(result.body.members.map(member => member._id)), new Set(['ownerB', 'member']));
  assert.ok(result.body.members.every(member => member.organisationId === 'A' && member.role === 'member'));
  assert.ok(!JSON.stringify(result.body).includes('HASH_MUST_NEVER_LEAK'));
  assert.ok(!JSON.stringify(result.body).includes('CODE_MUST_NEVER_LEAK'));
  const csv = await request(adminRouter, 'GET', '/export-csv', { userId: 'ownerA' });
  assert.ok(csv.body.includes('member@example.test'));
  assert.ok(!csv.body.includes('foreign@example.test'));
  assert.ok(!csv.body.includes('unassociated@example.test'));
});

test('Status and tier administration affect only the selected organisation association', async () => {
  const foreignStatus = await request(adminRouter, 'PUT', '/members/:id/status', { userId: 'ownerA', params: { id: 'foreign' }, body: { status: 'revoked' } });
  assert.equal(foreignStatus.status, 404);
  const foreignTier = await request(adminRouter, 'PUT', '/members/:id/tier', { userId: 'ownerA', params: { id: 'member' }, body: { tierId: 'B-paid' } });
  assert.equal(foreignTier.status, 404);
  const status = await request(adminRouter, 'PUT', '/members/:id/status', { userId: 'ownerA', params: { id: 'member' }, body: { status: 'suspended' } });
  assert.equal(status.status, 200);
  assert.equal(records.OrganisationMembership.find(item => item._id === 'member-A').status, 'suspended');
  assert.equal(records.OrganisationMembership.find(item => item._id === 'member-B').status, 'active');
  assert.equal(records.User.find(user => user._id === 'member').status, 'active');
  assert.equal(walletCalls[0].organisationId, 'A');
});

test('Owner financial totals and audit logs exclude other organisations', async () => {
  const summary = await request(adminRouter, 'GET', '/financial-summary', { userId: 'ownerA' });
  assert.equal(summary.body.metrics.totalRevenue, 25);
  assert.equal(summary.body.metrics.totalTransactions, 2);
  assert.ok(summary.body.recentTransactions.every(invoice => invoice.organisationId === 'A'));
  const logs = await request(adminRouter, 'GET', '/activity-logs', { userId: 'ownerA' });
  assert.deepEqual(logs.body.logs.map(log => log._id), ['log-A']);
});

test('Member invoices and downloads require selected organisation and invoice ownership', async () => {
  const invoices = await request(memberRouter, 'GET', '/invoices');
  assert.deepEqual(invoices.body.invoices.map(invoice => invoice._id), ['member-A-invoice']);
  const otherMember = await request(memberRouter, 'GET', '/invoices/:id/download', { params: { id: 'ownerB-A-invoice' } });
  assert.equal(otherMember.status, 403);
  const otherOrganisation = await request(memberRouter, 'GET', '/invoices/:id/download', { params: { id: 'member-B-invoice' } });
  assert.equal(otherOrganisation.status, 403);
  const owner = await request(memberRouter, 'GET', '/invoices/:id/download', { userId: 'ownerA', params: { id: 'ownerB-A-invoice' } });
  assert.equal(owner.status, 200);
  records.User.find(user => user._id === 'ownerA').activeOrganisationId = 'B';
  const globalAdminAsMember = await request(memberRouter, 'GET', '/invoices/:id/download', { userId: 'ownerA', params: { id: 'foreign-B-invoice' } });
  assert.equal(globalAdminAsMember.status, 403);
});

test('Events reveal selected organisation events and enforce membership tier even for owners of another organisation', async () => {
  const events = await request(eventRouter, 'GET', '/');
  assert.deepEqual(events.body.events.map(event => event._id), ['event-A']);
  assert.deepEqual(events.body.events[0].rsvps, []);
  const foreignRsvp = await request(eventRouter, 'POST', '/:id/rsvp', { params: { id: 'event-B' } });
  assert.equal(foreignRsvp.status, 404);
  const foreignCancel = await request(eventRouter, 'POST', '/:id/cancel-rsvp', { params: { id: 'event-B' } });
  assert.equal(foreignCancel.status, 404);
  records.User.find(user => user._id === 'ownerA').activeOrganisationId = 'B';
  const asMember = await request(eventRouter, 'POST', '/:id/rsvp', { userId: 'ownerA', params: { id: 'event-B' } });
  assert.equal(asMember.status, 403, 'Global admin ownership of A must not bypass B tier eligibility');
  const create = await request(eventRouter, 'POST', '/', { userId: 'ownerA', body: { title: 'Hacked event', description: 'No', date: '2099-01-01' } });
  assert.equal(create.status, 403);
});

test('Event mutation and creation cannot target a foreign organisation', async () => {
  const update = await request(eventRouter, 'PUT', '/:id', { userId: 'ownerA', params: { id: 'event-B' }, body: { title: 'Hacked' } });
  assert.equal(update.status, 404);
  const remove = await request(eventRouter, 'DELETE', '/:id', { userId: 'ownerA', params: { id: 'event-B' } });
  assert.equal(remove.status, 404);
  const create = await request(eventRouter, 'POST', '/', { userId: 'ownerA', body: { title: 'A new event', description: 'Community event', date: '2099-02-01', organisationId: 'B' } });
  assert.equal(create.status, 201);
  assert.equal(create.body.event.organisationId, 'A');
});

test('Wallet passes belong to the selected organisation and members can sync only themselves', async () => {
  const own = await request(walletRouter, 'GET', '/pass');
  assert.equal(own.status, 200);
  assert.ok(own.body.passObject.id.endsWith('.member_A'));
  const other = await request(walletRouter, 'PUT', '/update-object/:memberId', { params: { memberId: 'ownerB' } });
  assert.equal(other.status, 403);
  const foreignOwnerSync = await request(walletRouter, 'PUT', '/update-object/:memberId', { userId: 'ownerA', params: { memberId: 'foreign' } });
  assert.equal(foreignOwnerSync.status, 404);
  records.User.find(user => user._id === 'ownerA').activeOrganisationId = 'B';
  const globalAdminAsMember = await request(walletRouter, 'PUT', '/update-object/:memberId', { userId: 'ownerA', params: { memberId: 'foreign' } });
  assert.equal(globalAdminAsMember.status, 403);
});

test('Payments reject foreign tiers and activate only the selected organisation membership', async () => {
  const crossTier = await request(paymentRouter, 'POST', '/renew', { body: { tierId: 'B-paid' } });
  assert.equal(crossTier.status, 400);
  assert.equal(records.Invoice.length, 4);
  records.OrganisationMembership.find(item => item._id === 'member-A').status = 'pending';
  const paid = await request(paymentRouter, 'POST', '/renew', { body: { tierId: 'A-paid', organisationId: 'B', userId: 'foreign', amount: 0.01 } });
  assert.equal(paid.status, 200);
  assert.equal(paid.body.invoice.organisationId, 'A');
  assert.equal(paid.body.invoice.userId, 'member');
  assert.equal(paid.body.invoice.amount, 50);
  assert.equal(records.OrganisationMembership.find(item => item._id === 'member-A').tierId, 'A-paid');
  assert.equal(records.OrganisationMembership.find(item => item._id === 'member-B').tierId, 'B-free');
  assert.equal(records.User.find(user => user._id === 'member').role, 'member');
  assert.equal(walletCalls[0].organisationId, 'A');
  assert.equal(mailCalls[0][0], 'payment');
});

test('Payment upgrades enforce tier capacity without counting the renewing member twice', async () => {
  records.Tier.find(tier => tier._id === 'A-paid').maxMembers = 1;
  records.OrganisationMembership.find(item => item._id === 'ownerB-A').tierId = 'A-paid';
  const full = await request(paymentRouter, 'POST', '/renew', { body: { tierId: 'A-paid' } });
  assert.equal(full.status, 409);
  assert.equal(records.Invoice.length, 4);
  records.OrganisationMembership.find(item => item._id === 'ownerB-A').tierId = 'A-free';
  records.OrganisationMembership.find(item => item._id === 'member-A').tierId = 'A-paid';
  const renewal = await request(paymentRouter, 'POST', '/renew', { body: { tierId: 'A-paid' } });
  assert.equal(renewal.status, 200);
});

test('Profile updates cannot edit another account, elevate roles, or assign organisation ownership', async () => {
  const profile = await request(memberRouter, 'PUT', '/profile', { body: { userId: 'ownerA', _id: 'ownerA', role: 'admin', emailVerified: true, activeOrganisationId: 'B', tierId: 'B-paid', bio: 'Updated own profile.' } });
  assert.equal(profile.status, 200);
  assert.equal(records.User.find(user => user._id === 'member').bio, 'Updated own profile.');
  assert.equal(records.User.find(user => user._id === 'member').role, 'member');
  assert.equal(records.User.find(user => user._id === 'member').activeOrganisationId, 'A');
  assert.equal(records.User.find(user => user._id === 'member').tierId, undefined);
  assert.equal(records.User.find(user => user._id === 'ownerA').bio, undefined);
  assert.ok(!JSON.stringify(profile.body).includes('HASH_MUST_NEVER_LEAK'));
  assert.ok(!JSON.stringify(profile.body).includes('CODE_MUST_NEVER_LEAK'));
});

test('Members with pending, suspended, expired or absent access cannot use active membership features', async () => {
  const selected = records.OrganisationMembership.find(item => item._id === 'member-A');
  selected.status = 'pending';
  assert.equal((await request(walletRouter, 'GET', '/pass')).status, 403);
  assert.equal((await request(eventRouter, 'GET', '/')).status, 403);
  selected.status = 'suspended';
  // Remove B fallback: a suspended association must never become an active context.
  records.OrganisationMembership = records.OrganisationMembership.filter(item => item._id !== 'member-B');
  assert.ok([400, 403].includes((await request(paymentRouter, 'POST', '/renew', { body: { tierId: 'A-paid' } })).status));
  selected.status = 'active';
  selected.expirationDate = '2000-01-01T00:00:00Z';
  assert.equal((await request(walletRouter, 'GET', '/pass')).status, 403);
  assert.equal((await request(eventRouter, 'GET', '/')).status, 403);
  assert.equal((await request(memberRouter, 'GET', '/invoices', { userId: 'unassociated' })).status, 400);
});

test('Member dashboard hides other members’ RSVP details and other organisation invoices', async () => {
  const dashboard = await request(memberRouter, 'GET', '/dashboard');
  assert.equal(dashboard.status, 200);
  assert.deepEqual(dashboard.body.recentInvoices.map(invoice => invoice._id), ['member-A-invoice']);
  assert.deepEqual(dashboard.body.upcomingRsvps.map(event => event._id), ['event-A']);
  assert.ok(!JSON.stringify(dashboard.body.upcomingRsvps).includes('PRIVATE_OTHER_EMAIL'));
});

test('RSVP mutation responses hide other members’ names and email addresses', async () => {
  records.User.find(user => user._id === 'ownerB').activeOrganisationId = 'A';
  const rsvp = await request(eventRouter, 'POST', '/:id/rsvp', { userId: 'ownerB', params: { id: 'event-A' } });
  // The owner of B is an ordinary member when participating in A.
  assert.equal(rsvp.status, 400);
  records.User.find(user => user._id === 'ownerA').activeOrganisationId = 'B';
  records.Event.find(event => event._id === 'event-B').allowedTiers = [];
  const joined = await request(eventRouter, 'POST', '/:id/rsvp', { userId: 'ownerA', params: { id: 'event-B' } });
  assert.equal(joined.status, 200);
  assert.ok(!JSON.stringify(joined.body.event).includes('FOREIGN_EMAIL'));
  const cancelled = await request(eventRouter, 'POST', '/:id/cancel-rsvp', { params: { id: 'event-A' } });
  assert.equal(cancelled.status, 200);
  assert.ok(!JSON.stringify(cancelled.body.event).includes('PRIVATE_OTHER_EMAIL'));
});

test('Expired active member dashboard does not issue a usable wallet save URL', async () => {
  records.OrganisationMembership.find(item => item._id === 'member-A').expirationDate = '2000-01-01T00:00:00Z';
  const dashboard = await request(memberRouter, 'GET', '/dashboard');
  assert.equal(dashboard.status, 200);
  assert.equal(dashboard.body.membership.googleWallet, null);
});
