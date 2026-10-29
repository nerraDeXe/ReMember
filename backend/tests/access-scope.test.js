import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { config } from '../config/config.js';
import { User, Organisation, OrganisationMembership, Tier, Invoice, Event, ActivityLog, EmailNotification } from '../models/index.js';
import adminRouter from '../routes/admin.js';
import memberRouter from '../routes/members.js';
import eventRouter from '../routes/events.js';
import paymentRouter from '../routes/payments.js';
import walletRouter from '../routes/wallet.js';
import emailRouter from '../routes/emails.js';
import { paymentGateway } from '../services/paymentGateway.js';
import { walletService } from '../services/walletService.js';
import { emailService } from '../services/emailService.js';

const models = { User, Organisation, OrganisationMembership, Tier, Invoice, Event, ActivityLog, EmailNotification };
const originals = [];
let records, serial, walletCalls, mailCalls, findCalls;
const clone = value => structuredClone(value);
function matches(record, filter = {}) {
  return Object.entries(filter).every(([key, expected]) => {
    if (key === '$expr') { assert.equal(expected.$lt[0], '$$NOW'); return Date.now() < new Date(expected.$lt[1]).getTime(); }
    if (key === '$or') return expected.some(branch => matches(record, branch));
    if (key.includes('.')) {
      const values = key.split('.').reduce((items, part) => items.flatMap(item => item?.[part] ?? []), [record]);
      return values.includes(expected);
    }
    if (expected && typeof expected === 'object') {
      if ('$exists' in expected) return Object.hasOwn(record, key) === expected.$exists;
      if ('$in' in expected) return expected.$in.includes(record[key]);
      if ('$ne' in expected) return record[key] !== expected.$ne;
    }
    return record[key] === expected;
  });
}
function update(record, operation) {
  Object.assign(record, operation.$set || (!Object.keys(operation).some(key => key.startsWith('$')) ? operation : {}));
  for (const [key, amount] of Object.entries(operation.$inc || {})) record[key] = (record[key] || 0) + amount;
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
function query(value, modelName, recordedQuery) {
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
      if (recordedQuery) recordedQuery.sort = clone(criteria);
      if (Array.isArray(projected)) projected = [...projected].sort((a, b) => {
        for (const [key, direction] of Object.entries(criteria)) if (a[key] !== b[key]) {
          if (a[key] == null) return -direction;
          if (b[key] == null) return direction;
          return a[key] > b[key] ? direction : -direction;
        }
        return 0;
      });
      return this;
    },
    limit(amount) {
      if (recordedQuery) recordedQuery.limit = amount;
      projected = projected.slice(0, amount);
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
    patch(model, 'find', filter => {
      const recordedQuery = { model: name, filter: clone(filter) };
      findCalls.push(recordedQuery);
      return query(collection().filter(record => matches(record, filter)), name, recordedQuery);
    });
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
    patch(model, 'findOneAndDelete', filter => {
      const index = collection().findIndex(value => matches(value, filter));
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
  patch(emailService, 'sendPaymentConfirmation', async (...args) => { mailCalls.push(['payment', ...args.map(value => clone(Object.fromEntries(Object.entries(value))))]); return { status: 'sent' }; });
  patch(emailService, 'sendEventRsvpConfirmation', async (...args) => { mailCalls.push(['rsvp', ...args.map(value => clone(Object.fromEntries(Object.entries(value))))]); return { status: 'sent' }; });
  patch(emailService, 'sendOrganisationWelcome', async (...args) => { mailCalls.push(['welcome', ...args.map(value => clone(Object.fromEntries(Object.entries(value))))]); return { status: 'sent', sentAt: new Date().toISOString() }; });
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
  findCalls = [];
  records = Object.fromEntries(Object.keys(models).map(name => [name, []]));
  records.User.push(account('ownerA', 'A', 'admin'), account('ownerB', 'B', 'admin'), account('member', 'A'), account('foreign', 'B'), account('unassociated', ''));
  records.Organisation.push({ _id: 'A', name: 'Organisation A', adminId: 'ownerA', isPublic: true, visibility: 'public' }, { _id: 'B', name: 'Organisation B', adminId: 'ownerB', isPublic: true, visibility: 'public' });
  records.OrganisationMembership.push(membership('ownerA', 'A', 'owner'), membership('ownerA', 'B'), membership('ownerB', 'B', 'owner'), membership('ownerB', 'A'), membership('member', 'A'), membership('member', 'B'), membership('foreign', 'B'));
  for (const organisationId of ['A', 'B']) records.Tier.push({ _id: `${organisationId}-free`, organisationId, name: 'Community', price: 0, interval: 'monthly', isActive: true }, { _id: `${organisationId}-paid`, organisationId, name: 'Supporter', price: 50, interval: 'yearly', isActive: true });
  records.Invoice.push(
    { _id: 'member-A-invoice', organisationId: 'A', userId: 'member', invoiceNumber: 'INV-A-MEMBER', tierName: 'Community', amount: 10, currency: 'MYR', paymentStatus: 'paid' },
    { _id: 'ownerB-A-invoice', organisationId: 'A', userId: 'ownerB', invoiceNumber: 'INV-A-OTHER', tierName: 'Supporter', amount: 15, currency: 'MYR', paymentStatus: 'paid' },
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

test('Administrative tier and status changes invalidate scheduled downgrades and old billing quotes', async () => {
  const selected = records.OrganisationMembership.find(item => item._id === 'member-A');
  Object.assign(selected, { scheduledTierId: 'A-free', scheduledTierEffectiveAt: selected.expirationDate, scheduledTierRequestedAt: '2026-01-01T00:00:00Z' });
  const foreignBefore = clone(records.OrganisationMembership.find(item => item._id === 'member-B'));
  const tier = await request(adminRouter, 'PUT', '/members/:id/tier', { userId: 'ownerA', params: { id: 'member' }, body: { tierId: 'A-paid' } });
  assert.equal(tier.status, 200);
  assert.equal(selected.scheduledTierId, undefined);
  assert.equal(selected.scheduledTierEffectiveAt, undefined);
  assert.equal(selected.billingRevision, 1);
  selected.scheduledTierId = 'A-free';
  selected.scheduledTierEffectiveAt = selected.expirationDate;
  const status = await request(adminRouter, 'PUT', '/members/:id/status', { userId: 'ownerA', params: { id: 'member' }, body: { status: 'suspended' } });
  assert.equal(status.status, 200);
  assert.equal(selected.scheduledTierId, undefined);
  assert.equal(selected.billingRevision, 2);
  assert.deepEqual(records.OrganisationMembership.find(item => item._id === 'member-B'), foreignBefore);
});

test('Concurrent membership changes cannot bypass admin payment checks or revive an incompatible downgrade', async t => {
  const selected = records.OrganisationMembership.find(item => item._id === 'member-A');
  const original = OrganisationMembership.findOneAndUpdate;
  let race = true;
  t.mock.method(OrganisationMembership, 'findOneAndUpdate', (filter, operation, options) => {
    if (filter._id === selected._id && race) {
      race = false;
      selected.billingRevision = (selected.billingRevision || 0) + 1;
      selected.tierId = 'A-paid';
      selected.status = 'pending';
      selected.scheduledTierId = 'A-free';
      selected.scheduledTierEffectiveAt = selected.expirationDate;
    }
    return original(filter, operation, options);
  });
  const status = await request(adminRouter, 'PUT', '/members/:id/status', { userId: 'ownerA', params: { id: 'member' }, body: { status: 'active' } });
  assert.equal(status.status, 409);
  assert.equal(selected.status, 'pending');
  assert.equal(selected.tierId, 'A-paid');
  // A request prepared against the free tier must also reject a later change.
  selected.status = 'active';
  selected.tierId = 'A-free';
  race = true;
  const tier = await request(adminRouter, 'PUT', '/members/:id/tier', { userId: 'ownerA', params: { id: 'member' }, body: { tierId: 'A-free' } });
  assert.equal(tier.status, 409);
  assert.equal(selected.tierId, 'A-paid');
  assert.equal(selected.scheduledTierId, 'A-free');
});

test('Direct member links require ownership and return only a member of the selected organisation', async () => {
  const result = await request(adminRouter, 'GET', '/members/:id', { userId: 'ownerA', params: { id: 'member' } });
  assert.equal(result.status, 200);
  assert.equal(result.body.member._id, 'member');
  assert.equal(result.body.member.organisationId, 'A');
  assert.equal(result.body.member.tierId, 'A-free');
  assert.ok(!JSON.stringify(result.body).includes('HASH_MUST_NEVER_LEAK'));
  assert.ok(!JSON.stringify(result.body).includes('CODE_MUST_NEVER_LEAK'));
  for (const id of ['foreign', 'ownerA', 'missing', '$invalid']) {
    assert.equal((await request(adminRouter, 'GET', '/members/:id', { userId: 'ownerA', params: { id } })).status, 404);
  }
  assert.equal((await request(adminRouter, 'GET', '/members/:id', { params: { id: 'member' } })).status, 403);
  assert.equal((await request(adminRouter, 'GET', '/members/:id', { userId: null, params: { id: 'member' } })).status, 401);
  records.User.find(user => user._id === 'ownerA').activeOrganisationId = 'B';
  assert.equal((await request(adminRouter, 'GET', '/members/:id', { userId: 'ownerA', params: { id: 'member' } })).status, 403);
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
  assert.equal(create.status, 409, 'A stale page cannot create an event in a newly selected organisation');
  const ownCreate = await request(eventRouter, 'POST', '/', { userId: 'ownerA', body: { title: 'A new event', description: 'Community event', startDate: '2099-02-01', endDate: '2099-02-01', schedule: [{ date: '2099-02-01', startTime: '09:00', endTime: '17:00' }], location: 'Kuala Lumpur', organisationId: 'A' } });
  assert.equal(ownCreate.status, 201);
  assert.equal(ownCreate.body.event.organisationId, 'A');
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

test('Member dashboard, wallet download and sync use the selected organisation badge accent', async () => {
  records.Organisation.find(item => item._id === 'A').badgeColor = '#123456';
  records.Organisation.find(item => item._id === 'B').badgeColor = '#ABCDEF';
  for (const [organisationId, color] of [['A', '#123456'], ['B', '#ABCDEF']]) {
    records.User.find(item => item._id === 'member').activeOrganisationId = organisationId;
    const dashboard = await request(memberRouter, 'GET', '/dashboard');
    assert.equal(dashboard.status, 200);
    assert.equal(dashboard.body.membership.organisation.badgeColor, color);
    assert.equal(dashboard.body.membership.googleWallet.passObject.hexBackgroundColor, color);
    const download = await request(walletRouter, 'GET', '/pass');
    assert.equal(download.body.passObject.hexBackgroundColor, color);
    const sync = await request(walletRouter, 'PUT', '/update-object/:memberId', { params: { memberId: 'member' } });
    assert.equal(sync.status, 200);
    assert.equal(walletCalls.at(-1).organisation.badgeColor, color);
  }
});

test('Membership overview shows recorded subscription dates and rejects stale organisation context', async () => {
  const association = records.OrganisationMembership.find(item => item._id === 'member-A');
  association.firstSubscribedAt = '2025-03-10T12:00:00Z';
  association.billingPeriods = [{ tierId: 'A-free', periodStart: '2026-01-01T00:00:00Z', periodEnd: '2099-01-01T00:00:00Z', valueCents: 1000 }];
  const result = await request(memberRouter, 'GET', '/membership', { query: { organisationId: 'A' } });
  assert.equal(result.status, 200);
  assert.equal(result.body.membership.firstSubscribedAt, association.firstSubscribedAt);
  assert.equal(result.body.membership.currentPeriodEnd, association.expirationDate);
  assert.equal(result.body.membership.currentPeriodStart, '2026-01-01T00:00:00Z');
  assert.equal(result.body.membership.organisation._id, 'A');
  assert.equal(result.body.membership.tier._id, 'A-free');
  assert.equal((await request(memberRouter, 'GET', '/membership', { query: { organisationId: 'B' } })).status, 409);
  assert.equal((await request(memberRouter, 'GET', '/membership', { userId: 'ownerA', query: { organisationId: 'A' } })).status, 403);
});

test('Legacy prepaid renewals do not show a future invoice as the current membership period', async () => {
  records.Invoice.push(
    { _id: 'current', organisationId: 'A', userId: 'member', tierId: 'A-free', paymentStatus: 'paid', periodStart: '2020-01-01T00:00:00Z', periodEnd: '2080-01-01T00:00:00Z' },
    { _id: 'prepaid', organisationId: 'A', userId: 'member', tierId: 'A-free', paymentStatus: 'paid', periodStart: '2080-01-01T00:00:00Z', periodEnd: '2099-01-01T00:00:00Z' }
  );
  const result = await request(memberRouter, 'GET', '/membership', { query: { organisationId: 'A' } });
  assert.equal(result.status, 200);
  assert.equal(result.body.membership.currentPeriodStart, '2020-01-01T00:00:00Z');
});

test('Paid cancellation keeps access until expiry, can be undone, and cannot affect another membership', async () => {
  const association = records.OrganisationMembership.find(item => item._id === 'member-A');
  association.tierId = 'A-paid';
  const foreignBefore = clone(records.OrganisationMembership.find(item => item._id === 'member-B'));
  const originalExpiry = association.expirationDate;
  const stale = await request(memberRouter, 'POST', '/membership/cancel', { body: { organisationId: 'B' } });
  assert.equal(stale.status, 409);
  const cancelled = await request(memberRouter, 'POST', '/membership/cancel', { body: { organisationId: 'A', userId: 'foreign' } });
  assert.equal(cancelled.status, 200);
  assert.equal(association.status, 'active');
  assert.equal(association.cancelAtPeriodEnd, true);
  assert.equal(association.expirationDate, originalExpiry);
  assert.equal(association.billingRevision, 1);
  assert.equal((await request(walletRouter, 'GET', '/pass')).status, 200);
  const repeated = await request(memberRouter, 'POST', '/membership/cancel', { body: { organisationId: 'A' } });
  assert.equal(repeated.status, 200);
  assert.equal(association.billingRevision, 1);
  const resumed = await request(memberRouter, 'POST', '/membership/resume', { body: { organisationId: 'A' } });
  assert.equal(resumed.status, 200);
  assert.equal(association.cancelAtPeriodEnd, false);
  assert.equal(association.cancelledAt, undefined);
  assert.equal(association.billingRevision, 2);
  assert.deepEqual(records.OrganisationMembership.find(item => item._id === 'member-B'), foreignBefore);
});

test('Admin cancelled status, filters, member details and CSV follow a paid member cancellation and undo', async () => {
  const selected = records.OrganisationMembership.find(item => item._id === 'member-A');
  selected.tierId = 'A-paid';
  const cancelled = await request(memberRouter, 'POST', '/membership/cancel', { body: { organisationId: 'A' } });
  assert.equal(cancelled.status, 200);
  const directory = await request(adminRouter, 'GET', '/members', { userId: 'ownerA', query: { status: 'cancelled' } });
  assert.equal(directory.status, 200);
  assert.deepEqual(directory.body.members.map(member => member._id), ['member']);
  assert.equal(directory.body.members[0].status, 'cancelled');
  assert.equal(directory.body.members[0].accessStatus, 'active');
  assert.equal(directory.body.members[0].cancellationScheduled, true);
  assert.equal((await request(walletRouter, 'GET', '/pass')).status, 200, 'Reporting cancellation does not remove paid access early');
  const details = await request(adminRouter, 'GET', '/members/:id', { userId: 'ownerA', params: { id: 'member' } });
  assert.equal(details.body.member.status, 'cancelled');
  const active = await request(adminRouter, 'GET', '/members', { userId: 'ownerA', query: { status: 'active' } });
  assert.ok(!active.body.members.some(member => member._id === 'member'));
  const csv = await request(adminRouter, 'GET', '/export-csv', { userId: 'ownerA', query: { status: 'cancelled' } });
  assert.ok(csv.body.includes('"cancelled"'));
  assert.ok(!csv.body.includes('"ownerB"'));
  const summary = await request(adminRouter, 'GET', '/financial-summary', { userId: 'ownerA' });
  assert.equal(summary.body.metrics.activeMembersCount, 1);
  const approve = await request(adminRouter, 'PUT', '/members/:id/status', { userId: 'ownerA', params: { id: 'member' }, body: { status: 'active' } });
  assert.equal(approve.status, 409, 'Admin approval cannot silently undo a member cancellation');
  const resumed = await request(memberRouter, 'POST', '/membership/resume', { body: { organisationId: 'A' } });
  assert.equal(resumed.status, 200);
  assert.equal((await request(adminRouter, 'GET', '/members', { userId: 'ownerA', query: { status: 'cancelled' } })).body.pagination.totalMembers, 0);
  assert.equal((await request(adminRouter, 'GET', '/members/:id', { userId: 'ownerA', params: { id: 'member' } })).body.member.status, 'active');
  await request(memberRouter, 'POST', '/membership/cancel', { body: { organisationId: 'A' } });
  selected.expirationDate = '2020-01-01T00:00:00Z';
  const ended = await request(adminRouter, 'GET', '/members/:id', { userId: 'ownerA', params: { id: 'member' } });
  assert.equal(ended.body.member.status, 'cancelled');
  assert.equal(ended.body.member.accessStatus, 'cancelled');
  assert.equal(ended.body.member.cancellationScheduled, false);
  assert.equal((await request(walletRouter, 'GET', '/pass')).status, 403);
});

test('Free member cancellations show as cancelled in only their organisation admin directory', async () => {
  const selected = records.OrganisationMembership.find(item => item._id === 'member-A');
  delete selected.expirationDate;
  const result = await request(memberRouter, 'POST', '/membership/cancel', { body: { organisationId: 'A' } });
  assert.equal(result.status, 200);
  const own = await request(adminRouter, 'GET', '/members', { userId: 'ownerA', query: { status: 'cancelled' } });
  assert.equal(own.body.members.length, 1);
  assert.equal(own.body.members[0].status, 'cancelled');
  assert.equal(own.body.members[0].cancellationScheduled, false);
  const other = await request(adminRouter, 'GET', '/members', { userId: 'ownerB', query: { status: 'cancelled' } });
  assert.equal(other.body.members.length, 0);
});

test('Free cancellation ends access immediately while leaving membership history available', async () => {
  const association = records.OrganisationMembership.find(item => item._id === 'member-A');
  // A past admin tier change can leave a future expiry on a free membership.
  const cancelled = await request(memberRouter, 'POST', '/membership/cancel', { body: { organisationId: 'A' } });
  assert.equal(cancelled.status, 200);
  assert.equal(association.status, 'cancelled');
  assert.equal(association.cancelAtPeriodEnd, false);
  assert.equal((await request(walletRouter, 'GET', '/pass')).status, 403);
  const overview = await request(memberRouter, 'GET', '/membership', { query: { organisationId: 'A' } });
  assert.equal(overview.status, 200);
  assert.equal(overview.body.membership.status, 'cancelled');
  assert.equal((await request(memberRouter, 'POST', '/membership/resume', { body: { organisationId: 'A' } })).status, 409);
});

test('Cancelled paid memberships stop access at expiry and retain their overview', async () => {
  const association = records.OrganisationMembership.find(item => item._id === 'member-A');
  association.cancelAtPeriodEnd = true;
  association.expirationDate = '2020-01-01T00:00:00Z';
  const overview = await request(memberRouter, 'GET', '/membership', { query: { organisationId: 'A' } });
  assert.equal(overview.status, 200);
  assert.equal(overview.body.membership.status, 'cancelled');
  assert.equal((await request(walletRouter, 'GET', '/pass')).status, 403);
  assert.equal((await request(memberRouter, 'POST', '/membership/resume', { body: { organisationId: 'A' } })).status, 409);
});

test('Creating a payment session ignores client prices and cannot activate a membership', async t => {
  const selected = records.OrganisationMembership.find(item => item._id === 'member-A');
  selected.status = 'pending';
  selected.tierId = 'A-paid';
  t.mock.method(paymentGateway, 'createCheckout', async ({ user, organisation, membership, tier }) => {
    assert.equal(user._id, 'member');
    assert.equal(organisation._id, 'A');
    assert.equal(membership._id, 'member-A');
    assert.equal(tier.price, 50);
    return { paymentStatus: 'pending', checkout: { id: 'pay_fixture', amountCents: 5000 } };
  });
  const foreign = await request(paymentRouter, 'POST', '/renew', { body: { tierId: 'B-paid' } });
  assert.equal(foreign.status, 400);
  const stale = await request(paymentRouter, 'POST', '/renew', { body: { tierId: 'A-paid', organisationId: 'B' } });
  assert.equal(stale.status, 409);
  const result = await request(paymentRouter, 'POST', '/renew', { body: { tierId: 'A-paid', userId: 'foreign', amount: 0.01, simulateFailure: false, paymentMethod: 'Pretend paid' } });
  assert.equal(result.status, 200);
  assert.equal(result.body.paymentStatus, 'pending');
  assert.equal(result.body.checkout.amountCents, 5000);
  assert.equal(result.body.invoice, undefined);
  assert.equal(selected.status, 'pending');
  assert.equal(records.Invoice.length, 4);
  assert.equal(walletCalls.length, 0);
  assert.equal(mailCalls.length, 0);
});

test('Pending paid memberships cannot be activated through the administrative status shortcut', async () => {
  const selected = records.OrganisationMembership.find(item => item._id === 'member-A');
  selected.status = 'pending'; selected.tierId = 'A-paid';
  const result = await request(adminRouter, 'PUT', '/members/:id/status', { userId: 'ownerA', params: { id: 'member' }, body: { status: 'active' } });
  assert.equal(result.status, 409);
  assert.equal(selected.status, 'pending');
});

test('Monthly membership revenue counts the latest paid period once and excludes legacy USD amounts', async () => {
  const selected = records.OrganisationMembership.find(item => item._id === 'member-A');
  selected.tierId = 'A-paid'; selected.tierName = 'Supporter';
  records.OrganisationMembership.find(item => item._id === 'ownerB-A').expirationDate = '2000-01-01';
  records.Invoice.push(
    { _id: 'cycle1', organisationId: 'A', userId: 'member', paymentCheckoutId: 'pay_first', currency: 'MYR', amount: 49, billingInterval: 'monthly', paymentStatus: 'paid', periodEnd: '2098-01-01', createdAt: '2098-01-01' },
    { _id: 'cycle2', organisationId: 'A', userId: 'member', paymentCheckoutId: 'pay_second', currency: 'MYR', amount: 49, billingInterval: 'monthly', paymentStatus: 'paid', periodEnd: '2099-01-01', createdAt: '2099-01-01' },
    { _id: 'legacy-usd', organisationId: 'A', userId: 'member', currency: 'USD', amount: 99999, paymentStatus: 'paid' }
  );
  const summary = await request(adminRouter, 'GET', '/financial-summary', { userId: 'ownerA' });
  assert.equal(summary.body.metrics.monthlyRecurringRevenue, 49);
  assert.equal(summary.body.metrics.annualRunRate, 49 * 12);
  assert.equal(summary.body.metrics.totalRevenue, 25 + 98);
  selected.expirationDate = '2000-01-01';
  assert.equal((await request(adminRouter, 'GET', '/financial-summary', { userId: 'ownerA' })).body.metrics.monthlyRecurringRevenue, 0);
});

test('Event ticket purchases cannot replace the latest membership period in monthly revenue', async () => {
  const selected = records.OrganisationMembership.find(item => item._id === 'member-A');
  selected.tierId = 'A-paid'; selected.tierName = 'Supporter';
  records.OrganisationMembership.find(item => item._id === 'ownerB-A').expirationDate = '2000-01-01';
  records.Invoice.push(
    { _id: 'membership-period', organisationId: 'A', userId: 'member', currency: 'MYR', amount: 600, billingInterval: 'yearly', paymentStatus: 'paid', periodEnd: '2099-01-01' },
    { _id: 'latest-ticket', organisationId: 'A', userId: 'member', currency: 'MYR', amount: 999, category: 'event_ticket', paymentStatus: 'paid', createdAt: '2100-01-01' },
  );
  const summary = await request(adminRouter, 'GET', '/financial-summary', { userId: 'ownerA' });
  assert.equal(summary.body.metrics.monthlyRecurringRevenue, 50);
  assert.equal(summary.body.metrics.totalEventTicketingRevenue, 999);
  assert.equal(summary.body.metrics.totalRevenue, 25 + 600 + 999);
});

test('Prorated upgrade credit reduces received revenue while the new plan retains its full monthly value', async () => {
  records.OrganisationMembership.find(item => item._id === 'ownerB-A').expirationDate = '2000-01-01';
  records.Invoice.push({ _id: 'upgrade', organisationId: 'A', userId: 'member', currency: 'MYR',
    tierName: 'Higher tier', amount: 150, coverageValueCents: 20000, billingInterval: 'monthly', paymentStatus: 'paid', periodEnd: '2099-01-01' });
  const result = await request(adminRouter, 'GET', '/financial-summary', { userId: 'ownerA' });
  assert.equal(result.body.metrics.monthlyRecurringRevenue, 200);
  assert.equal(result.body.metrics.totalRevenue, 175);
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
  assert.equal((await request(memberRouter, 'GET', '/dashboard')).status, 403);
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

test('Ended events remain visible with their status but leave the dashboard upcoming list', async () => {
  const selected = records.Event.find(event => event._id === 'event-A');
  selected.date = '2020-01-01';
  const dashboard = await request(memberRouter, 'GET', '/dashboard');
  assert.equal(dashboard.status, 200);
  assert.equal(dashboard.body.upcomingRsvps.length, 0);
  const events = await request(eventRouter, 'GET', '/');
  assert.equal(events.body.events.length, 1);
  assert.equal(events.body.events[0].eventStatus, 'ended');
  assert.equal(events.body.events[0].rsvpOpen, false);
});

test('Member dashboard returns personal RSVPs and five latest invoices while invoice history keeps all personal invoices', async () => {
  records.Event.push({ _id: 'unjoined-event-A', organisationId: 'A', rsvps: [{ userId: 'ownerB' }] });
  for (const day of [3, 7, 1, 6, 2, 5, 4]) {
    records.Invoice.push({ _id: `recent-${day}`, organisationId: 'A', userId: 'member', createdAt: `2026-10-0${day}T00:00:00Z` });
  }
  records.Invoice.find(invoice => invoice._id === 'ownerB-A-invoice').createdAt = '2099-01-01T00:00:00Z';
  records.Invoice.find(invoice => invoice._id === 'member-B-invoice').createdAt = '2099-01-01T00:00:00Z';

  const dashboard = await request(memberRouter, 'GET', '/dashboard');
  assert.equal(dashboard.status, 200);
  assert.deepEqual(dashboard.body.upcomingRsvps.map(event => event._id), ['event-A']);
  assert.deepEqual(dashboard.body.recentInvoices.map(invoice => invoice._id), [7, 6, 5, 4, 3].map(day => `recent-${day}`));
  assert.deepEqual(findCalls.find(call => call.model === 'Event'), { model: 'Event', filter: { organisationId: 'A', 'rsvps.userId': 'member' } });
  assert.deepEqual(findCalls.find(call => call.model === 'Invoice'), { model: 'Invoice', filter: { userId: 'member', organisationId: 'A' }, sort: { createdAt: -1 }, limit: 5 });

  const history = await request(memberRouter, 'GET', '/invoices');
  assert.equal(history.status, 200);
  assert.deepEqual(history.body.invoices.map(invoice => invoice._id), [...[7, 6, 5, 4, 3, 2, 1].map(day => `recent-${day}`), 'member-A-invoice']);
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

test('RSVP reports SMTP acceptance and preserves the reservation on delivery failures', async t => {
  t.mock.method(console, 'error', () => {});
  for (const delivery of ['sent', 'failed', 'unavailable', 'record_failure']) {
    const target = records.Event.find(event => event._id === 'event-A');
    target.rsvps = [];
    t.mock.method(emailService, 'sendEventRsvpConfirmation', async () => {
      if (delivery === 'record_failure') throw new Error('Notification storage unavailable');
      return { status: delivery };
    });
    const response = await request(eventRouter, 'POST', '/:id/rsvp', { params: { id: 'event-A' } });
    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.equal(response.body.emailDelivery, delivery === 'record_failure' ? 'failed' : delivery);
    assert.equal(target.rsvps.some(rsvp => rsvp.userId === 'member'), true);
    if (delivery === 'sent') assert.match(response.body.message, /sent to your email provider/);
    else assert.match(response.body.message, /reservation is saved.*could not be sent/);
  }
});

test('Email center reports historical records honestly and keeps unsent records in date order', async () => {
  records.EmailNotification.push(
    { _id: 'old', recipientEmail: 'member@example.test', status: 'sent', sentAt: '2026-10-01T00:00:00Z' },
    { _id: 'gmail', recipientEmail: 'member@example.test', status: 'sent', deliveryMethod: 'gmail-api', sentAt: '2026-10-22T00:00:00Z' },
    { _id: 'unconfigured', recipientEmail: 'member@example.test', status: 'unavailable', createdAt: '2026-10-23T00:00:00Z' },
    { _id: 'new', recipientEmail: 'member@example.test', status: 'failed', deliveryMethod: 'smtp', createdAt: '2026-10-20T00:00:00Z' },
    { _id: 'foreign', recipientEmail: 'foreign@example.test', status: 'sent', deliveryMethod: 'smtp', sentAt: '2026-10-21T00:00:00Z' }
  );
  const response = await request(emailRouter, 'GET', '/');
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.emails.map(email => [email._id, email.status]), [['unconfigured', 'unavailable'], ['gmail', 'sent'], ['new', 'failed'], ['old', 'recorded']]);
  assert.equal(records.EmailNotification[0].status, 'sent', 'Historical data is not overwritten');
  assert.equal((await request(emailRouter, 'GET', '/', { userId: null })).status, 401);
});
