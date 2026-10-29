import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { setImmediate as nextTick } from 'node:timers/promises';
import { Organisation, OrganisationMembership, User, Tier } from '../models/index.js';
import { dbManager } from '../models/db.js';
import { emailService } from '../services/emailService.js';
import { mailDelivery } from '../services/mailDelivery.js';
import { getRenewalEmailSchedule, runRenewalEmailScan, startRenewalScheduler } from '../services/renewalScheduler.js';

const now = new Date('2026-10-22T04:00:00.000Z');
const day = 86_400_000;
const dateAfter = days => new Date(now.getTime() + days * day).toISOString();
const clone = value => structuredClone(value);
let organisations, memberships, users, sent, claims;

function matches(record, filter) {
  return Object.entries(filter).every(([key, expected]) => {
    if (key === '$and') return expected.every(branch => matches(record, branch));
    if (key === '$or') return expected.some(branch => matches(record, branch));
    const value = key.split('.').reduce((parent, part) => parent?.[part], record);
    if (expected === null) return value == null;
    if (expected && typeof expected === 'object') {
      return Object.entries(expected).every(([operator, operand]) => {
        if (operator === '$exists') return (value !== undefined) === operand;
        if (operator === '$nin') return !operand.includes(value);
        if (operator === '$ne') return value !== operand;
        if (operator === '$lte') return value <= operand;
        assert.fail(`Unsupported query operator: ${operator}`);
      });
    }
    return value === expected;
  });
}

function query(value) {
  return { lean: async () => clone(value), then: (resolve, reject) => Promise.resolve(clone(value)).then(resolve, reject) };
}

function update(record, operation) {
  Object.assign(record, clone(operation.$set || {}));
  for (const field of Object.keys(operation.$unset || {})) delete record[field];
}

beforeEach(t => {
  organisations = [{ _id: 'org-a', adminId: 'owner', name: 'Organisation A', emailSettings: { renewal: { enabled: true, daysBefore: 30 } } }];
  memberships = [{ _id: 'membership-a', organisationId: 'org-a', userId: 'member', role: 'member', status: 'active', expirationDate: dateAfter(10), tierName: 'Gold' }];
  users = [{ _id: 'member', name: 'Member', email: 'member@example.test', emailVerified: true, status: 'active', notifications: { email: true } }];
  sent = [];
  claims = [];
  const connectedDescriptor = Object.getOwnPropertyDescriptor(dbManager, 'isConnected');
  Object.defineProperty(dbManager, 'isConnected', { configurable: true, value: true, writable: true });
  t.after(() => Object.defineProperty(dbManager, 'isConnected', connectedDescriptor));
  t.mock.method(mailDelivery, 'isConfigured', () => true);
  t.mock.method(Organisation, 'find', filter => query(organisations.filter(record => matches(record, filter))));
  t.mock.method(OrganisationMembership, 'find', filter => query(memberships.filter(record => matches(record, filter))));
  t.mock.method(User, 'findById', id => query(users.find(record => record._id === id) || null));
  t.mock.method(OrganisationMembership, 'findOneAndUpdate', (filter, operation) => {
    claims.push(clone(filter));
    const record = memberships.find(record => matches(record, filter));
    if (record) update(record, operation);
    return query(record || null);
  });
  t.mock.method(OrganisationMembership, 'updateOne', async (filter, operation) => {
    const record = memberships.find(record => matches(record, filter));
    if (record) update(record, operation);
    return { matchedCount: record ? 1 : 0 };
  });
  t.mock.method(emailService, 'sendOrganisationRenewal', async (user, membership, organisation) => {
    sent.push(clone({ user, membership, organisation }));
    return { status: 'sent', sentAt: now.toISOString() };
  });
});

test('Scheduled cancellations do not receive renewal reminders', async () => {
  memberships[0].cancelAtPeriodEnd = true;
  assert.equal(getRenewalEmailSchedule(memberships[0], { enabled: true, daysBefore: 30 }, now), null);
  assert.deepEqual(await runRenewalEmailScan({ now }), { sent: 0, failed: 0 });
  assert.equal(sent.length, 0);
  assert.equal(claims.length, 0);
});

test('Scheduled free downgrades receive no payment reminder and paid ones name the next tier', async t => {
  memberships[0].scheduledTierId = 'cheaper';
  const target = { _id: 'cheaper', organisationId: 'org-a', name: 'Lower tier', price: 0, isActive: true };
  t.mock.method(Tier, 'findOne', filter => query(matches(target, filter) ? target : null));
  assert.deepEqual(await runRenewalEmailScan({ now }), { sent: 0, failed: 0 });
  assert.equal(sent.length, 0);
  assert.equal(claims.length, 0);
  target.price = 10;
  assert.deepEqual(await runRenewalEmailScan({ now }), { sent: 1, failed: 0 });
  assert.equal(sent[0].membership.tierName, 'Lower tier');
  assert.equal(memberships[0].tierName, 'Gold', 'A reminder must not change current member access');
});

test('The reminder starts exactly X days before expiry and uses the expiry instant for deduplication', () => {
  const settings = { enabled: true, daysBefore: 30 };
  const member = { ...memberships[0], expirationDate: dateAfter(30) };
  assert.deepEqual(getRenewalEmailSchedule(member, settings, now), { cycleKey: dateAfter(30), dueAt: now.toISOString() });
  assert.equal(getRenewalEmailSchedule(member, settings, new Date(now.getTime() - 1)), null);
  const equivalentOffset = { ...member, expirationDate: '2026-11-21T12:00:00+08:00' };
  assert.equal(getRenewalEmailSchedule(equivalentOffset, settings, now).cycleKey, member.expirationDate);
  member.renewalEmailCycleKey = member.expirationDate;
  assert.equal(getRenewalEmailSchedule(member, { ...settings, daysBefore: 60 }, now), null);
});

test('Expired, invalid, disabled, and ineligible memberships have no schedule', () => {
  const settings = { enabled: true, daysBefore: 30 };
  for (const change of [
    { expirationDate: undefined }, { expirationDate: 'invalid-date' }, { expirationDate: now.toISOString() },
    { expirationDate: dateAfter(-1) }, { expirationDate: dateAfter(31) },
    { role: 'owner' }, { status: 'pending' }, { status: 'suspended' }, { status: 'revoked' }, { status: 'expired' }
  ]) assert.equal(getRenewalEmailSchedule({ ...memberships[0], ...change }, settings, now), null);
  for (const change of [{ enabled: false }, { daysBefore: 0 }, { daysBefore: 366 }, { daysBefore: 1.5 }]) {
    assert.equal(getRenewalEmailSchedule(memberships[0], { ...settings, ...change }, now), null);
  }
});

test('Each organisation uses its own timing, membership, and email settings', async () => {
  organisations.push(
    { _id: 'org-b', name: 'Organisation B', emailSettings: { renewal: { enabled: true, daysBefore: 5 } } },
    { _id: 'disabled-org', emailSettings: { renewal: { enabled: false, daysBefore: 30 } } }
  );
  memberships.push(
    { ...memberships[0], _id: 'membership-b', organisationId: 'org-b', tierName: 'Silver' },
    { ...memberships[0], _id: 'membership-disabled', organisationId: 'disabled-org' }
  );
  assert.deepEqual(await runRenewalEmailScan({ now }), { sent: 1, failed: 0 });
  assert.equal(sent[0].organisation._id, 'org-a');
  assert.equal(sent[0].membership.tierName, 'Gold');
  assert.equal(memberships[0].renewalEmailCycleKey, dateAfter(10));
  assert.equal(memberships[0].renewalEmailClaimToken, undefined);
  assert.equal(memberships[1].renewalEmailCycleKey, undefined);
  assert.equal(memberships[2].renewalEmailCycleKey, undefined);
  await runRenewalEmailScan({ now: new Date(now.getTime() + 5 * day) });
  assert.deepEqual(sent.map(message => message.organisation._id), ['org-a', 'org-b']);
  assert.equal(sent[1].membership.tierName, 'Silver');
});

test('Unverified, opted-out, disabled accounts, and owners receive no reminder', async () => {
  const changes = [
    { emailVerified: false }, { notifications: { email: false } }, { status: 'suspended' },
    { status: 'revoked' }, { email: '' }, { _id: 'owner' }
  ];
  users = changes.map((change, index) => ({ ...users[0], _id: `user-${index}`, ...change }));
  memberships = users.map((user, index) => ({ ...memberships[0], _id: `membership-${index}`, userId: user._id }));
  memberships.push({ ...memberships[0], _id: 'deleted-account', userId: 'missing' });
  assert.deepEqual(await runRenewalEmailScan({ now }), { sent: 0, failed: 0 });
  assert.equal(sent.length, 0);
  assert.equal(claims.length, 0);
});

test('Atomic claims prevent concurrent scans and repeated scans from sending duplicates', async () => {
  await Promise.all([runRenewalEmailScan({ now }), runRenewalEmailScan({ now })]);
  await runRenewalEmailScan({ now });
  assert.equal(sent.length, 1);
  assert.equal(memberships[0].renewalEmailCycleKey, dateAfter(10));
  assert.equal(claims.length, 2);
  for (const claim of claims) {
    assert.equal(claim.organisationId, 'org-a');
    assert.equal(claim.expirationDate, dateAfter(10));
    assert.equal(claim.renewalEmailCycleKey.$ne, dateAfter(10));
    assert.ok(Array.isArray(claim.$and));
  }
});

test('A new paid membership expiry allows one new reminder when its own window starts', async () => {
  await runRenewalEmailScan({ now });
  memberships[0].expirationDate = dateAfter(40);
  await runRenewalEmailScan({ now });
  assert.equal(sent.length, 1);
  const nextWindow = new Date(now.getTime() + 10 * day);
  await runRenewalEmailScan({ now: nextWindow });
  await runRenewalEmailScan({ now: nextWindow });
  assert.equal(sent.length, 2);
  assert.equal(memberships[0].renewalEmailCycleKey, dateAfter(40));
});

test('Failed SMTP deliveries retry after one hour without repeating each minute', async t => {
  let attempts = 0;
  t.mock.method(emailService, 'sendOrganisationRenewal', async () => ({ status: ++attempts === 1 ? 'failed' : 'sent' }));
  assert.deepEqual(await runRenewalEmailScan({ now }), { sent: 0, failed: 1 });
  assert.equal(memberships[0].renewalEmailCycleKey, undefined);
  assert.equal(memberships[0].renewalEmailClaimToken, undefined);
  assert.equal(memberships[0].renewalEmailRetryAt, new Date(now.getTime() + 3_600_000).toISOString());
  await runRenewalEmailScan({ now: new Date(now.getTime() + 60_000) });
  assert.equal(attempts, 1);
  assert.deepEqual(await runRenewalEmailScan({ now: new Date(now.getTime() + 3_600_000) }), { sent: 1, failed: 0 });
  assert.equal(attempts, 2);
  assert.equal(memberships[0].renewalEmailRetryAt, undefined);
});

test('An individual delivery exception does not stop other members and releases its claim with backoff', async t => {
  t.mock.method(console, 'error', () => {});
  users.push({ ...users[0], _id: 'other-member' });
  memberships.push({ ...memberships[0], _id: 'other-membership', userId: 'other-member' });
  t.mock.method(emailService, 'sendOrganisationRenewal', async user => {
    if (user._id === 'member') throw new Error('Temporary delivery failure');
    return { status: 'sent' };
  });
  assert.deepEqual(await runRenewalEmailScan({ now }), { sent: 1, failed: 1 });
  assert.ok(memberships[0].renewalEmailRetryAt);
  assert.equal(memberships[0].renewalEmailClaimToken, undefined);
  assert.equal(memberships[1].renewalEmailCycleKey, dateAfter(10));
});

test('A crashed worker lease can expire while a current worker claim stays exclusive', async () => {
  memberships[0].renewalEmailClaimToken = 'crashed-worker';
  memberships[0].renewalEmailClaimedAt = new Date(now.getTime() - 14 * 60_000).toISOString();
  await runRenewalEmailScan({ now });
  assert.equal(sent.length, 0);
  await runRenewalEmailScan({ now: new Date(now.getTime() + 60_000) });
  assert.equal(sent.length, 1);
  assert.equal(memberships[0].renewalEmailClaimToken, undefined);
});

test('A renewal during delivery prevents an old worker from changing the new membership cycle', async t => {
  t.mock.method(emailService, 'sendOrganisationRenewal', async () => {
    memberships[0].expirationDate = dateAfter(40);
    delete memberships[0].renewalEmailClaimedAt;
    delete memberships[0].renewalEmailClaimToken;
    return { status: 'sent' };
  });
  await runRenewalEmailScan({ now });
  assert.equal(memberships[0].expirationDate, dateAfter(40));
  assert.equal(memberships[0].renewalEmailCycleKey, undefined);
  assert.equal(memberships[0].renewalEmailSentAt, undefined);
});

test('Database disconnection and missing SMTP configuration prevent queries and sending', async t => {
  const find = t.mock.method(Organisation, 'find', () => assert.fail('A disconnected scan must not query MongoDB'));
  dbManager.isConnected = false;
  assert.deepEqual(await runRenewalEmailScan({ now }), { sent: 0, failed: 0 });
  dbManager.isConnected = true;
  t.mock.method(mailDelivery, 'isConfigured', () => false);
  assert.deepEqual(await runRenewalEmailScan({ now }), { sent: 0, failed: 0 });
  assert.equal(find.mock.calls.length, 0);
});

test('The scheduler starts immediately, runs every minute, skips overlap/disconnection, and stops cleanly', async t => {
  let callback, interval, unref = 0, cleared = null, connected = true, calls = 0, finish;
  const timer = { unref: () => { unref += 1; } };
  t.mock.method(globalThis, 'setInterval', (handler, milliseconds) => { callback = handler; interval = milliseconds; return timer; });
  t.mock.method(globalThis, 'clearInterval', value => { cleared = value; });
  const stop = startRenewalScheduler({
    isConnected: () => connected,
    scan: async () => { calls += 1; await new Promise(resolve => { finish = resolve; }); }
  });
  assert.equal(calls, 1);
  assert.equal(interval, 60_000);
  assert.equal(unref, 1);
  callback();
  assert.equal(calls, 1);
  finish();
  await nextTick();
  connected = false;
  callback();
  assert.equal(calls, 1);
  connected = true;
  callback();
  assert.equal(calls, 2);
  finish();
  await nextTick();
  stop();
  assert.equal(cleared, timer);
});

test('The scheduler recovers from a failed scan on its next interval', async t => {
  let callback, calls = 0;
  t.mock.method(console, 'error', () => {});
  t.mock.method(globalThis, 'setInterval', handler => { callback = handler; return { unref() {} }; });
  t.mock.method(globalThis, 'clearInterval', () => {});
  const stop = startRenewalScheduler({ isConnected: () => true, scan: async () => { calls += 1; if (calls === 1) throw new Error('Database temporarily unavailable'); } });
  await nextTick();
  callback();
  await nextTick();
  assert.equal(calls, 2);
  stop();
});
