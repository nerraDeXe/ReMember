import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { once } from 'node:events';
import crypto from 'node:crypto';
import express from 'express';
import { User, Organisation, OrganisationMembership, ActivityLog, EmailNotification } from '../models/index.js';
import { mailDelivery } from '../services/mailDelivery.js';
import authRoutes from '../routes/auth.js';
import { authenticateToken, requireVerifiedEmail, requireRole } from '../middleware/auth.js';

// Mock only persistence and SMTP. The real router, validators, schema, bcrypt,
// JWT middleware, and organisation context execute through HTTP requests.
let users = [];
let messages = [];
let configured = true;
let failDelivery = false;
let notificationWrites = 0;
let organisations = [];
let memberships = [];
let codeSequence = 0;
let server;
let baseUrl;
const originals = [];
const hiddenFields = ['emailVerificationHash', 'emailVerificationExpiresAt', 'emailVerificationSentAt', 'emailVerificationAttempts'];
const validAccount = { firstName: 'Darren', lastName: 'Lim', email: 'darren@example.test', password: 'TestPassword123!', country: 'Malaysia', bio: 'A community member.' };

function replace(object, key, value) {
  originals.push([object, key, object[key]]);
  object[key] = value;
}

function matches(record, filter = {}) {
  return Object.entries(filter).every(([key, condition]) => {
    if (key === '$or') return condition.some(branch => matches(record, branch));
    const value = record[key];
    if (condition && typeof condition === 'object' && !(condition instanceof Date)) {
      return Object.entries(condition).every(([operator, expected]) => {
        if (operator === '$ne') return value !== expected;
        if (operator === '$exists') return expected ? value !== undefined : value === undefined;
        if (operator === '$lte') return value !== undefined && value <= expected;
        if (operator === '$lt') return value !== undefined && value < expected;
        if (operator === '$gt') return value !== undefined && value > expected;
        if (operator === '$in') return expected.includes(value);
        throw new Error(`Unsupported test filter ${operator}`);
      });
    }
    return condition === null ? value === null || value === undefined : value === condition;
  });
}

function update(record, change) {
  for (const [key, value] of Object.entries(change.$set || {})) record[key] = value;
  for (const key of Object.keys(change.$unset || {})) delete record[key];
  for (const [key, value] of Object.entries(change.$inc || {})) record[key] = (record[key] || 0) + value;
}

function query(operation) {
  let selected = '';
  const project = result => {
    if (Array.isArray(result)) return result.map(project);
    if (!result) return result;
    const record = structuredClone(result);
    for (const key of hiddenFields) if (!selected.includes(`+${key}`)) delete record[key];
    if (selected.includes('-password')) delete record.password;
    return record;
  };
  return {
    select(value) { selected = value; return this; },
    lean() { return this; },
    then(resolve, reject) { return Promise.resolve().then(operation).then(project).then(resolve, reject); }
  };
}

async function request(path, { token, body, method = body ? 'POST' : 'GET' } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  return { status: response.status, body: await response.json(), headers: response.headers };
}

function deliveredCode() {
  const code = messages.at(-1)?.text.match(/code is (\d{6})\./)?.[1];
  assert.match(code || '', /^\d{6}$/);
  return code;
}

function assertNoSecrets(user) {
  assert.equal(user.password, undefined);
  for (const key of hiddenFields) assert.equal(user[key], undefined);
}

before(async () => {
  replace(User, 'findOne', filter => query(() => users.find(record => matches(record, filter)) || null));
  replace(User, 'findById', id => query(() => users.find(record => record._id === id) || null));
  replace(User, 'create', async input => {
    const document = new User(input);
    await document.validate();
    users.push(document.toObject());
    return document;
  });
  replace(User, 'findOneAndUpdate', (filter, change) => query(() => {
    const record = users.find(item => matches(item, filter));
    if (!record) return null;
    update(record, change);
    return record;
  }));
  replace(User, 'updateOne', async (filter, change) => {
    const record = users.find(item => matches(item, filter));
    if (record) update(record, change);
    return { matchedCount: record ? 1 : 0 };
  });
  replace(Organisation, 'find', filter => query(() => organisations.filter(record => matches(record, filter))));
  replace(OrganisationMembership, 'find', filter => query(() => memberships.filter(record => matches(record, filter))));
  replace(ActivityLog, 'create', async input => ({ ...input, _id: 'test-activity' }));
  replace(EmailNotification, 'create', async () => { notificationWrites++; throw new Error('Verification emails must not be recorded in notifications.'); });
  replace(mailDelivery, 'isConfigured', () => configured);
  replace(mailDelivery, 'send', async message => {
    if (failDelivery) throw new Error('Test provider failure');
    messages.push(message);
    return { accepted: true };
  });
  // Fix code generation only in tests to keep resend assertions deterministic.
  replace(crypto, 'randomInt', () => ++codeSequence);
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.get('/verified-action', authenticateToken, requireVerifiedEmail, (req, res) => res.json({ success: true }));
  app.get('/owner-action', authenticateToken, requireRole('admin'), (req, res) => res.json({ success: true }));
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(() => { users = []; messages = []; organisations = []; memberships = []; configured = true; failDelivery = false; notificationWrites = 0; });

after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  for (const [object, key, value] of originals.reverse()) object[key] = value;
});

test('registration requires account fields, a real country, password length, and a 500 character bio', async () => {
  for (const key of ['firstName', 'lastName', 'email', 'password', 'country']) {
    const body = { ...validAccount };
    delete body[key];
    assert.equal((await request('/api/auth/register', { body })).status, 400);
  }
  for (const change of [{ email: 'invalid' }, { password: 'short' }, { password: 'é'.repeat(37) }, { country: 'Made-up Country' }, { bio: 'a'.repeat(501) }]) {
    assert.equal((await request('/api/auth/register', { body: { ...validAccount, ...change } })).status, 400);
  }
  assert.equal(users.length, 0);
  assert.equal(messages.length, 0);
});

test('registration creates an account without a tier, expiry, wallet pass, or placeholder avatar', async () => {
  const registration = await request('/api/auth/register', { body: { ...validAccount, tierId: 'ignored-tier', role: 'admin', bio: 'a'.repeat(500), email: 'DARREN@example.test' } });
  assert.equal(registration.status, 201);
  assert.equal(registration.body.user.name, 'Darren Lim');
  assert.equal(registration.body.user.role, 'member');
  assert.equal(registration.body.user.email, 'darren@example.test');
  assert.equal(registration.body.user.emailVerified, false);
  assert.equal(registration.body.user.onboardingCompleted, false);
  assert.equal(registration.body.user.activeOrganisationId, null);
  assert.equal(users[0].tierId, undefined);
  assert.equal(users[0].expirationDate, undefined);
  assert.equal(users[0].avatarUrl, undefined);
  assert.equal(users[0].googleWallet?.passObjectId, undefined);
  assert.notEqual(users[0].password, validAccount.password);
  assert.match(users[0].emailVerificationHash, /^[a-f0-9]{64}$/);
  assert.equal(registration.body.verification.delivery, 'sent');
  assert.equal(registration.body.code, undefined);
  assert.equal(registration.body.verification.code, undefined);
  assertNoSecrets(registration.body.user);
  assert.equal(notificationWrites, 0);
  assert.equal((await request('/api/auth/register', { body: validAccount })).status, 409);
});

test('a delivered code confirms email, removes its hash, and permits verified actions', async () => {
  const registration = await request('/api/auth/register', { body: validAccount });
  const token = registration.body.token;
  assert.equal((await request('/verified-action', { token })).status, 403);
  const verification = await request('/api/auth/verify-email', { token, body: { code: deliveredCode() } });
  assert.equal(verification.status, 200);
  assert.equal(verification.body.user.emailVerified, true);
  assert.equal(verification.body.user.onboardingCompleted, false);
  assert.equal(users[0].emailVerificationHash, undefined);
  assert.equal(users[0].emailVerificationExpiresAt, undefined);
  assertNoSecrets(verification.body.user);
  assert.equal((await request('/verified-action', { token: verification.body.token })).status, 200);
  const me = await request('/api/auth/me', { token });
  assert.equal(me.body.user.emailVerified, true);
  assertNoSecrets(me.body.user);
});

test('verification codes expire and lock after five wrong attempts', async () => {
  const registration = await request('/api/auth/register', { body: validAccount });
  const token = registration.body.token;
  const code = deliveredCode();
  const wrongCode = code === '000000' ? '000001' : '000000';
  for (let attempt = 0; attempt < 5; attempt++) {
    assert.equal((await request('/api/auth/verify-email', { token, body: { code: wrongCode } })).status, 400);
  }
  assert.equal(users[0].emailVerificationAttempts, 5);
  assert.equal((await request('/api/auth/verify-email', { token, body: { code } })).status, 400);
  users[0].emailVerificationAttempts = 0;
  users[0].emailVerificationExpiresAt = new Date(Date.now() - 1);
  assert.equal((await request('/api/auth/verify-email', { token, body: { code } })).status, 400);
  assert.equal(users[0].emailVerified, false);
});

test('resend observes a cooldown, invalidates the previous code, and restarts verification attempts', async () => {
  const registration = await request('/api/auth/register', { body: validAccount });
  const token = registration.body.token;
  const firstHash = users[0].emailVerificationHash;
  const cooldown = await request('/api/auth/resend-verification', { token, body: {} });
  assert.equal(cooldown.status, 429);
  assert.equal(cooldown.body.verification.delivery, 'cooldown');
  assert.ok(Number(cooldown.headers.get('retry-after')) > 0);
  assert.equal(messages.length, 1);
  users[0].emailVerificationSentAt = new Date(Date.now() - 61_000);
  users[0].emailVerificationAttempts = 5;
  const resend = await request('/api/auth/resend-verification', { token, body: {} });
  assert.equal(resend.status, 200);
  assert.equal(resend.body.verification.delivery, 'sent');
  assert.equal(users[0].emailVerificationAttempts, 0);
  assert.notEqual(users[0].emailVerificationHash, firstHash);
  assert.equal(messages.length, 2);
  assert.equal((await request('/api/auth/verify-email', { token, body: { code: deliveredCode() } })).status, 200);
});

test('missing SMTP preserves the pending account and explicitly reports unavailable verification', async () => {
  configured = false;
  const registration = await request('/api/auth/register', { body: validAccount });
  assert.equal(registration.status, 201);
  assert.equal(registration.body.verification.delivery, 'unavailable');
  assert.equal(registration.body.user.emailVerified, false);
  assert.equal(users[0].emailVerificationHash, undefined);
  assert.equal(messages.length, 0);
  const resend = await request('/api/auth/resend-verification', { token: registration.body.token, body: {} });
  assert.equal(resend.status, 503);
  assert.equal(resend.body.verification.delivery, 'unavailable');
  assert.equal((await request('/verified-action', { token: registration.body.token })).status, 403);
});

test('a failed SMTP delivery leaves no usable code and reports the saved pending account', async () => {
  failDelivery = true;
  const registration = await request('/api/auth/register', { body: validAccount });
  assert.equal(registration.status, 201);
  assert.equal(registration.body.verification.delivery, 'failed');
  assert.equal(registration.body.user.emailVerified, false);
  assert.equal(users[0].emailVerificationHash, undefined);
  assert.equal(users[0].emailVerificationExpiresAt, undefined);
  assert.equal(notificationWrites, 0);
  assert.equal((await request('/api/auth/verify-email', { token: registration.body.token, body: { code: '123456' } })).status, 400);
});

test('login and me omit secrets; expired codes get delivered again on login', async () => {
  await request('/api/auth/register', { body: validAccount });
  const login = await request('/api/auth/login', { body: { email: validAccount.email, password: validAccount.password } });
  assert.equal(login.status, 200);
  assert.equal(messages.length, 1);
  assert.equal(login.body.verification.delivery, 'sent');
  assertNoSecrets(login.body.user);
  const me = await request('/api/auth/me', { token: login.body.token });
  assertNoSecrets(me.body.user);
  assert.equal(me.body.verification.canResendAt, login.body.verification.canResendAt);
  users[0].emailVerificationExpiresAt = new Date(Date.now() - 1);
  users[0].emailVerificationSentAt = new Date(Date.now() - 61_000);
  const nextLogin = await request('/api/auth/login', { body: { email: validAccount.email, password: validAccount.password } });
  assert.equal(nextLogin.status, 200);
  assert.equal(nextLogin.body.verification.delivery, 'sent');
  assert.equal(messages.length, 2);
  assert.equal((await request('/api/auth/login', { body: { email: validAccount.email, password: 'wrong-password' } })).status, 401);
});

test('parallel resend and verification requests cannot bypass cooldown or the attempt limit', async () => {
  const registration = await request('/api/auth/register', { body: validAccount });
  const token = registration.body.token;
  users[0].emailVerificationSentAt = new Date(Date.now() - 61_000);
  const resends = await Promise.all(Array.from({ length: 4 }, () => request('/api/auth/resend-verification', { token, body: {} })));
  assert.equal(resends.filter(result => result.status === 200).length, 1);
  assert.equal(resends.filter(result => result.status === 429).length, 3);
  assert.equal(messages.length, 2);
  const wrongCode = deliveredCode() === '000000' ? '000001' : '000000';
  const attempts = await Promise.all(Array.from({ length: 10 }, () => request('/api/auth/verify-email', { token, body: { code: wrongCode } })));
  assert.ok(attempts.every(result => result.status === 400));
  assert.equal(users[0].emailVerificationAttempts, 5);
  assert.equal(users[0].emailVerified, false);
});

test('admin permissions require verified ownership in the selected organisation', async () => {
  const registration = await request('/api/auth/register', { body: validAccount });
  const token = registration.body.token;
  users[0].emailVerified = true;
  users[0].role = 'admin';
  assert.equal((await request('/owner-action', { token })).status, 403);
  organisations = [
    { _id: 'owned-org', name: 'Owned Organisation', adminId: users[0]._id, visibility: 'public', isPublic: true },
    { _id: 'joined-org', name: 'Joined Organisation', adminId: 'another-owner', visibility: 'public', isPublic: true }
  ];
  memberships = [{ _id: 'joined-membership', userId: users[0]._id, organisationId: 'joined-org', role: 'member', status: 'active' }];
  users[0].activeOrganisationId = 'joined-org';
  assert.equal((await request('/owner-action', { token })).status, 403);
  users[0].activeOrganisationId = 'owned-org';
  assert.equal((await request('/owner-action', { token })).status, 200);
  users[0].emailVerified = false;
  assert.equal((await request('/owner-action', { token })).status, 403);
});
