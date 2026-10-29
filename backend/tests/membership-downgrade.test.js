import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import jwt from 'jsonwebtoken';
import { Organisation, OrganisationMembership, Tier, Invoice, ActivityLog, User } from '../models/index.js';
import { config } from '../config/config.js';
import memberRouter from '../routes/members.js';
import { scheduleMembershipDowngrade, cancelMembershipDowngrade, changeMembershipCancellation, membershipDetails } from '../services/membershipManagement.js';
import { resolveDueFreeDowngrade } from '../services/scheduledDowngrade.js';
import { getAccountContext } from '../services/organisationAccess.js';

const clone = value => structuredClone(value);
const now = new Date('2026-10-28T12:00:00Z');
const user = { _id: 'member', name: 'Member', email: 'member@example.test', activeOrganisationId: 'A', joinedDate: '2020-01-01' };
let records, beforeUpdate;
const originals = [];
const models = { Organisation, OrganisationMembership, Tier, Invoice, ActivityLog, User };
const matches = (record, filter) => Object.entries(filter).every(([key, expected]) => {
  if (key === '$or') return expected.some(branch => matches(record, branch));
  if (expected && typeof expected === 'object') {
    if ('$exists' in expected) return Object.hasOwn(record, key) === expected.$exists;
    if ('$ne' in expected) return record[key] !== expected.$ne;
    if ('$in' in expected) return expected.$in.includes(record[key]);
  }
  return record[key] === expected;
});
function query(value) {
  return { select() { return this; }, lean: async () => clone(value), then: (resolve, reject) => Promise.resolve(clone(value)).then(resolve, reject) };
}
function patch(target, method, replacement) {
  originals.push([target, method, target[method]]);
  target[method] = replacement;
}
function update(record, operation) {
  Object.assign(record, clone(operation.$set || {}));
  for (const key of Object.keys(operation.$unset || {})) delete record[key];
  for (const [key, amount] of Object.entries(operation.$inc || {})) record[key] = (record[key] || 0) + amount;
}
before(() => {
  for (const [name, model] of Object.entries(models)) {
    patch(model, 'find', filter => query(records[name].filter(record => matches(record, filter))));
    patch(model, 'findOne', filter => query(records[name].find(record => matches(record, filter)) || null));
    patch(model, 'findById', id => query(records[name].find(record => record._id === id) || null));
    patch(model, 'countDocuments', filter => query(records[name].filter(record => matches(record, filter)).length));
    patch(model, 'findOneAndUpdate', (filter, operation) => {
      if (name === 'OrganisationMembership' && beforeUpdate) {
        const hook = beforeUpdate;
        beforeUpdate = null;
        hook();
      }
      const record = records[name].find(record => matches(record, filter));
      if (record) update(record, operation);
      return query(record || null);
    });
    patch(model, 'findByIdAndUpdate', (id, operation) => {
      const record = records[name].find(record => record._id === id);
      if (record) update(record, operation);
      return query(record || null);
    });
    patch(model, 'create', async value => {
      const result = { _id: `${name}-${records[name].length}`, ...clone(value) };
      records[name].push(result);
      return clone(result);
    });
  }
});
after(() => { for (const [target, method, original] of originals.reverse()) target[method] = original; });
beforeEach(() => {
  beforeUpdate = null;
  records = Object.fromEntries(Object.keys(models).map(name => [name, []]));
  records.User.push({ ...user, emailVerified: true, status: 'active' }, { _id: 'owner', activeOrganisationId: 'A', name: 'Owner', emailVerified: true, status: 'active' });
  records.Organisation.push({ _id: 'A', name: 'Organisation A', adminId: 'owner' }, { _id: 'B', name: 'Organisation B', adminId: 'foreign-owner' });
  records.Tier.push(
    { _id: 'premium', organisationId: 'A', name: 'Premium', price: 100, interval: 'monthly', isActive: true },
    { _id: 'basic', organisationId: 'A', name: 'Basic', price: 600, interval: 'yearly', isActive: true },
    { _id: 'free', organisationId: 'A', name: 'Community', price: 0, interval: 'monthly', isActive: true },
    { _id: 'foreign', organisationId: 'B', name: 'Foreign', price: 1, interval: 'monthly', isActive: true }
  );
  records.OrganisationMembership.push({ _id: 'membership', organisationId: 'A', userId: 'member', role: 'member', status: 'active',
    tierId: 'premium', tierName: 'Premium', joinedDate: '2020-02-01T00:00:00Z', firstSubscribedAt: '2020-02-01T00:00:00Z',
    expirationDate: '2026-11-01T12:00:00Z', cancelAtPeriodEnd: false, billingRevision: 3, creditBalanceCents: 250,
    billingPeriods: [{ tierId: 'premium', periodStart: '2026-10-01T12:00:00Z', periodEnd: '2026-11-01T12:00:00Z', valueCents: 10000, billingInterval: 'monthly' }] });
});
const membership = () => records.OrganisationMembership[0];
const organisation = () => records.Organisation[0];
const parameters = extra => ({ user, membership: clone(membership()), organisation: clone(organisation()), now, ...extra });
const schedule = tierId => scheduleMembershipDowngrade(parameters({ tierId }));
const pending = (tierId = 'free') => {
  Object.assign(membership(), { scheduledTierId: tierId, scheduledTierEffectiveAt: membership().expirationDate, scheduledTierRequestedAt: now.toISOString() });
};

test('schedules a cheaper equivalent monthly tier without changing paid access, dates, credit, or history', async () => {
  const original = clone(membership());
  const result = await schedule('basic');
  assert.equal(result.scheduledTierId, 'basic');
  assert.equal(result.scheduledTierEffectiveAt, original.expirationDate);
  assert.equal(result.scheduledTierRequestedAt, now.toISOString());
  assert.equal(result.billingRevision, 4);
  for (const key of ['tierId', 'tierName', 'status', 'expirationDate', 'joinedDate', 'firstSubscribedAt', 'creditBalanceCents', 'billingPeriods']) assert.deepEqual(result[key], original[key]);
  assert.equal(records.Invoice.length, 0);
  const details = await membershipDetails(user, result, organisation(), now);
  assert.equal(details.tier._id, 'premium');
  assert.equal(details.scheduledTier._id, 'basic');
  assert.equal(details.scheduledTierUnavailable, false);
  assert.equal(details.renewalMode, 'manual');
});

test('only strictly cheaper equivalent monthly prices qualify, including mixed billing intervals', async () => {
  for (const [price, interval] of [[1200, 'yearly'], [1201, 'yearly'], [100, 'monthly'], [101, 'monthly']]) {
    Object.assign(records.Tier[1], { price, interval });
    await assert.rejects(schedule('basic'), { status: 400 });
  }
  await assert.rejects(schedule('premium'), { status: 400 });
  assert.equal(membership().scheduledTierId, undefined);
  const free = await schedule('free');
  assert.equal(free.tierId, 'premium');
  assert.equal(free.scheduledTierId, 'free');
});

test('foreign, missing, inactive, and full targets cannot be scheduled', async () => {
  await assert.rejects(schedule('foreign'), { status: 404 });
  await assert.rejects(schedule('missing'), { status: 404 });
  records.Tier[1].isActive = false;
  await assert.rejects(schedule('basic'), { status: 404 });
  records.Tier[1].isActive = true;
  records.Tier[1].maxMembers = 1;
  records.OrganisationMembership.push({ _id: 'other', organisationId: 'A', userId: 'other', tierId: 'basic', status: 'active' });
  await assert.rejects(schedule('basic'), { status: 409 });
  records.OrganisationMembership[1].status = 'pending';
  await assert.rejects(schedule('basic'), { status: 409 });
  assert.equal(membership().billingRevision, 3);
});

test('only an active member with a paid period remaining can schedule a downgrade', async () => {
  for (const status of ['pending', 'expired', 'cancelled', 'suspended', 'revoked']) {
    membership().status = status;
    await assert.rejects(schedule('basic'), error => error.status === 403 || error.status === 409);
  }
  membership().status = 'active';
  membership().expirationDate = now.toISOString();
  await assert.rejects(schedule('basic'), { status: 409 });
  membership().expirationDate = 'invalid';
  await assert.rejects(schedule('basic'), { status: 409 });
  membership().expirationDate = '2026-11-01T12:00:00Z';
  membership().tierId = 'free';
  await assert.rejects(schedule('basic'), { status: 400 });
});

test('membership ownership and organisation boundaries apply to schedule and unschedule', async () => {
  for (const override of [{ user: { ...user, _id: 'foreign' } }, { organisation: { _id: 'B' } }, { membership: { ...membership(), role: 'owner' } }]) {
    await assert.rejects(scheduleMembershipDowngrade(parameters({ tierId: 'basic', ...override })), { status: 403 });
    pending();
    await assert.rejects(cancelMembershipDowngrade(parameters(override)), { status: 403 });
  }
});

test('a pending downgrade can be replaced or removed, and each edit invalidates older checkouts', async () => {
  await schedule('basic');
  const replaced = await schedule('free');
  assert.equal(replaced.billingRevision, 5);
  assert.equal(replaced.scheduledTierId, 'free');
  const cleared = await cancelMembershipDowngrade(parameters());
  assert.equal(cleared.billingRevision, 6);
  for (const key of ['scheduledTierId', 'scheduledTierEffectiveAt', 'scheduledTierRequestedAt']) assert.equal(cleared[key], undefined);
  assert.equal(cleared.tierId, 'premium');
  assert.equal(cleared.expirationDate, '2026-11-01T12:00:00Z');
  const unchanged = await cancelMembershipDowngrade(parameters());
  assert.equal(unchanged.billingRevision, 6);
});

test('subscription cancellation clears a downgrade; undo cancellation does not restore it', async () => {
  await schedule('basic');
  const cancelled = await changeMembershipCancellation(parameters());
  assert.equal(cancelled.cancelAtPeriodEnd, true);
  assert.equal(cancelled.status, 'active');
  assert.equal(cancelled.scheduledTierId, undefined);
  await assert.rejects(schedule('free'), { status: 409 });
  const resumed = await changeMembershipCancellation(parameters({ resume: true }));
  assert.equal(resumed.cancelAtPeriodEnd, false);
  assert.equal(resumed.scheduledTierId, undefined);
});

test('stale schedule and unschedule requests cannot overwrite a concurrent payment or cancellation', async () => {
  const original = clone(membership());
  beforeUpdate = () => { membership().billingRevision++; membership().expirationDate = '2026-12-01T12:00:00Z'; };
  await assert.rejects(scheduleMembershipDowngrade(parameters({ membership: original, tierId: 'basic' })), { status: 409 });
  assert.equal(membership().scheduledTierId, undefined);
  pending('basic');
  beforeUpdate = () => { membership().billingRevision++; membership().cancelAtPeriodEnd = true; };
  await assert.rejects(cancelMembershipDowngrade(parameters()), { status: 409 });
  assert.equal(membership().cancelAtPeriodEnd, true);
  assert.equal(records.ActivityLog.length, 0);
});

test('a free downgrade applies at the exact paid-period boundary, preserving subscription history and balances', async () => {
  pending();
  const original = clone(membership());
  const beforeEnd = await resolveDueFreeDowngrade(clone(membership()), organisation(), new Date('2026-11-01T11:59:59.999Z'));
  assert.equal(beforeEnd.tierId, 'premium');
  const result = await resolveDueFreeDowngrade(clone(membership()), organisation(), new Date('2026-11-01T12:00:00Z'));
  assert.equal(result.tierId, 'free');
  assert.equal(result.tierName, 'Community');
  assert.equal(result.status, 'active');
  assert.equal(result.expirationDate, undefined);
  assert.equal(result.scheduledTierId, undefined);
  assert.equal(result.billingRevision, original.billingRevision + 1);
  for (const key of ['joinedDate', 'firstSubscribedAt', 'creditBalanceCents', 'billingPeriods']) assert.deepEqual(result[key], original[key]);
  await resolveDueFreeDowngrade(result, organisation(), new Date('2026-11-02T12:00:00Z'));
  assert.equal(records.ActivityLog.filter(log => log.action === 'MEMBERSHIP_DOWNGRADE_APPLIED').length, 1);
  assert.equal(records.Invoice.length, 0);
});

test('paid downgrades stay on the old tier after expiry until the renewal payment succeeds', async () => {
  pending('basic');
  const result = await resolveDueFreeDowngrade(clone(membership()), organisation(), new Date('2026-11-02T12:00:00Z'));
  assert.equal(result.tierId, 'premium');
  assert.equal(result.scheduledTierId, 'basic');
  assert.equal(records.ActivityLog.length, 0);
});

test('missing, foreign, inactive, and full free targets never grant fallback access', async () => {
  pending();
  const due = new Date('2026-11-02T12:00:00Z');
  const free = records.Tier.find(tier => tier._id === 'free');
  for (const changes of [{ organisationId: 'B' }, { isActive: false }, { price: 1 }, { interval: 'invalid' }]) {
    const snapshot = clone(free);
    Object.assign(free, changes);
    const result = await resolveDueFreeDowngrade(clone(membership()), organisation(), due);
    assert.equal(result.tierId, 'premium');
    Object.assign(free, snapshot);
  }
  free.maxMembers = 1;
  records.OrganisationMembership.push({ _id: 'other', userId: 'other', organisationId: 'A', tierId: 'free', status: 'active' });
  assert.equal((await resolveDueFreeDowngrade(clone(membership()), organisation(), due)).tierId, 'premium');
  assert.equal((await membershipDetails(user, membership(), organisation(), due)).scheduledTierUnavailable, true);
  records.OrganisationMembership[1].status = 'pending';
  assert.equal((await resolveDueFreeDowngrade(clone(membership()), organisation(), due)).tierId, 'premium');
  assert.equal((await membershipDetails(user, membership(), organisation(), due)).scheduledTierUnavailable, true);
  records.Tier.splice(records.Tier.indexOf(free), 1);
  const details = await membershipDetails(user, membership(), organisation(), due);
  assert.equal(details.scheduledTier, null);
  assert.equal(details.scheduledTierUnavailable, true);
  assert.equal((await resolveDueFreeDowngrade(clone(membership()), organisation(), due)).tierId, 'premium');
});

test('due free downgrades do not restore suspended, revoked, cancelled, pending, or cancelled-at-period-end memberships', async () => {
  pending();
  const due = new Date('2026-11-02T12:00:00Z');
  for (const status of ['suspended', 'revoked', 'cancelled', 'pending']) {
    membership().status = status;
    assert.equal((await resolveDueFreeDowngrade(clone(membership()), organisation(), due)).tierId, 'premium');
  }
  membership().status = 'active';
  membership().cancelAtPeriodEnd = true;
  assert.equal((await resolveDueFreeDowngrade(clone(membership()), organisation(), due)).tierId, 'premium');
  membership().cancelAtPeriodEnd = false;
  membership().expirationDate = '2026-12-01T12:00:00Z';
  assert.equal((await resolveDueFreeDowngrade(clone(membership()), organisation(), due)).tierId, 'premium');
  assert.equal(records.ActivityLog.length, 0);
});

test('a concurrent cancellation wins over lazy free activation and the current state is returned', async () => {
  pending();
  beforeUpdate = () => { membership().status = 'cancelled'; membership().billingRevision++; };
  const result = await resolveDueFreeDowngrade(clone(membership()), organisation(), new Date('2026-11-02T12:00:00Z'));
  assert.equal(result.status, 'cancelled');
  assert.equal(result.tierId, 'premium');
  assert.equal(records.ActivityLog.length, 0);
});

test('a membership deleted during free activation is no longer an accessible organisation', async () => {
  membership().expirationDate = '2020-03-01T00:00:00Z';
  pending();
  beforeUpdate = () => { records.OrganisationMembership = []; };
  const context = await getAccountContext(user);
  assert.equal(context.activeOrganisationId, null);
  assert.equal(context.organisationRole, null);
  assert.equal(context.membershipStatus, null);
  assert.deepEqual(context.memberships, []);
  assert.equal(records.ActivityLog.length, 0);
});

test('authenticated account context activates a due free tier before reporting entitlements', async () => {
  membership().expirationDate = '2020-03-01T00:00:00Z';
  pending();
  const context = await getAccountContext(user);
  assert.equal(context.tierId, 'free');
  assert.equal(context.membershipStatus, 'active');
  assert.equal(context.expirationDate, null);
  assert.equal(context.scheduledTierId, null);
  assert.equal(context.memberships[0].tierId, 'free');
  assert.equal(context.memberships[0].firstSubscribedAt, '2020-02-01T00:00:00Z');
});

test('catalogue price and interval edits mark a pending downgrade unavailable and cannot activate a same-price free tier', async () => {
  pending('basic');
  for (const changes of [{ price: 1200 }, { price: 1201 }, { interval: 'invalid' }, { price: -1 }]) {
    const snapshot = clone(records.Tier[1]);
    Object.assign(records.Tier[1], changes);
    assert.equal((await membershipDetails(user, membership(), organisation(), now)).scheduledTierUnavailable, true);
    Object.assign(records.Tier[1], snapshot);
  }
  pending('free');
  records.Tier[0].price = 0;
  const result = await resolveDueFreeDowngrade(clone(membership()), organisation(), new Date('2026-11-02T12:00:00Z'));
  assert.equal(result.tierId, 'premium');
  assert.equal((await membershipDetails(user, membership(), organisation(), now)).scheduledTierUnavailable, true);
});

function request(path, { userId = 'member', body = {} } = {}) {
  const route = memberRouter.stack.find(layer => layer.route?.path === path && layer.route.methods.post)?.route;
  assert.ok(route, `POST ${path} exists`);
  const handlers = [...memberRouter.stack.filter(layer => !layer.route).map(layer => layer.handle), ...route.stack.map(layer => layer.handle)];
  const req = { body, params: {}, query: {}, method: 'POST', originalUrl: path, headers: userId ? { authorization: `Bearer ${jwt.sign({ id: userId }, config.JWT_SECRET)}` } : {} };
  return new Promise((resolve, reject) => {
    let status = 200, index = 0;
    const res = { status(value) { status = value; return this; }, json: value => resolve({ status, body: JSON.parse(JSON.stringify(value)) }) };
    const next = error => {
      if (error) return reject(error);
      const handler = handlers[index++];
      if (!handler) return reject(new Error('Route completed without responding'));
      Promise.resolve(handler(req, res, next)).catch(reject);
    };
    next();
  });
}

test('downgrade endpoints require authentication, verified email, selected organisation, and member ownership', async () => {
  const body = { organisationId: 'A', tierId: 'basic' };
  assert.equal((await request('/membership/downgrade', { userId: null, body })).status, 401);
  records.User[0].emailVerified = false;
  assert.equal((await request('/membership/downgrade', { body })).status, 403);
  records.User[0].emailVerified = true;
  assert.equal((await request('/membership/downgrade', { body: { ...body, organisationId: 'B' } })).status, 409);
  assert.equal((await request('/membership/downgrade', { userId: 'owner', body })).status, 403);
  assert.equal((await request('/membership/downgrade', { body: { ...body, tierId: 'foreign' } })).status, 404);
  assert.equal((await request('/membership/downgrade/cancel', { body: { organisationId: 'B' } })).status, 409);
  assert.equal(membership().scheduledTierId, undefined);
});

test('schedule and cancel endpoints return current and pending tiers separately and ignore forged member identities', async () => {
  membership().expirationDate = '2099-11-01T12:00:00Z';
  records.OrganisationMembership.push({ _id: 'foreign-member', organisationId: 'A', userId: 'foreign-member', role: 'member',
    status: 'active', tierId: 'premium', tierName: 'Premium', expirationDate: '2099-11-01T12:00:00Z', billingRevision: 0 });
  const scheduled = await request('/membership/downgrade', { body: { organisationId: 'A', tierId: 'basic', userId: 'foreign-member', effectiveAt: now.toISOString() } });
  assert.equal(scheduled.status, 200);
  assert.equal(scheduled.body.membership.tier._id, 'premium');
  assert.equal(scheduled.body.membership.scheduledTier._id, 'basic');
  assert.equal(scheduled.body.membership.scheduledTierEffectiveAt, '2099-11-01T12:00:00Z');
  assert.equal(records.OrganisationMembership[1].scheduledTierId, undefined);
  const cancelled = await request('/membership/downgrade/cancel', { body: { organisationId: 'A' } });
  assert.equal(cancelled.status, 200);
  assert.equal(cancelled.body.membership.scheduledTier, null);
  assert.equal(cancelled.body.membership.scheduledTierId, null);
  assert.equal(cancelled.body.membership.tier._id, 'premium');
});
