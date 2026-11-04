import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import jwt from 'jsonwebtoken';
import { Notification, User, ActivityLog } from '../models/index.js';
import { config } from '../config/config.js';
import notificationRouter from '../routes/notifications.js';
import memberRouter from '../routes/members.js';
import { createNotificationService, eventReminderSchedule, normaliseNotificationSettings, startNotificationScheduler } from '../services/notifications.js';

const NOW = new Date('2026-11-04T02:00:00Z');
const clone = value => structuredClone(value);
function matches(record, filter = {}) {
  return Object.entries(filter).every(([key, condition]) => {
    const value = record[key];
    if (condition && typeof condition === 'object' && !(condition instanceof Date)) {
      if ('$in' in condition) return condition.$in.includes(value);
    }
    return condition === null ? value == null : condition instanceof Date ? new Date(value).getTime() === condition.getTime() : value === condition;
  });
}
function query(value) {
  let result = clone(value);
  return {
    select() { return this; },
    sort(criteria) {
      result.sort((a, b) => {
        for (const [key, direction] of Object.entries(criteria)) if (a[key] !== b[key]) return a[key] > b[key] ? direction : -direction;
        return 0;
      });
      return this;
    },
    skip(amount) { result = result.slice(amount); return this; },
    limit(amount) { result = result.slice(0, amount); return this; },
    async lean() { return clone(result); },
    then(resolve, reject) { return Promise.resolve(clone(result)).then(resolve, reject); },
  };
}
function memoryModels(records) {
  return Object.fromEntries(Object.entries(records).map(([name, rows]) => [name, {
    find(filter) { return query(rows.filter(row => matches(row, filter))); },
    findById(id) { return query(rows.find(row => row._id === id) || null); },
    async updateOne(filter, update, options = {}) {
      let row = rows.find(value => matches(value, filter));
      if (!row && options.upsert) { row = clone(update.$setOnInsert); rows.push(row); }
      if (row) Object.assign(row, clone(update.$set || {}));
      return { matchedCount: row ? 1 : 0 };
    },
  }]));
}
function fixtures() {
  return {
    Organisation: [{ _id: 'A', name: 'Art Society', adminId: 'owner' }, { _id: 'B', name: 'Book Club', adminId: 'other-owner' }],
    OrganisationMembership: [
      { _id: 'member-A', userId: 'member', organisationId: 'A', role: 'member', status: 'active', joinedDate: '2026-10-01T00:00:00Z', tierId: 'basic', tierName: 'Basic' },
      { _id: 'member-B', userId: 'member', organisationId: 'B', role: 'member', status: 'active', joinedDate: '2026-10-01T00:00:00Z', tierId: 'basic', tierName: 'Basic' },
    ],
    User: [{ _id: 'member', emailVerified: true, status: 'active', notifications: { events: true } }],
    Event: [], Tier: [], OrganisationPost: [], Notification: [],
  };
}
const eventAt = date => ({ _id: 'event-A', organisationId: 'A', title: 'Community meetup', date, timeZone: 'Asia/Kuala_Lumpur', tierAccess: 'all', schedule: [{ date, startTime: '10:00', endTime: '12:00' }] });

test('reminder defaults, configurable days, precise event zone and suppression after start', () => {
  const event = eventAt('2026-11-11');
  assert.equal(eventReminderSchedule(event, {}, new Date(NOW.getTime() - 1)), null);
  assert.equal(eventReminderSchedule(event, {}, NOW).daysBefore, 7);
  assert.equal(eventReminderSchedule(event, {}, new Date('2026-11-10T02:00:00Z')).daysBefore, 1);
  assert.equal(eventReminderSchedule(event, {}, new Date('2026-11-11T02:00:00Z')), null);
  assert.equal(eventReminderSchedule(event, { events: false }, NOW), null);
  assert.equal(eventReminderSchedule(event, { eventReminderDays: [] }, NOW), null);
  assert.equal(eventReminderSchedule(event, { eventReminderDays: [2] }, new Date('2026-11-09T02:00:00Z')).daysBefore, 2);
  assert.equal(eventReminderSchedule(event, {}, new Date('2026-11-10T05:00:00Z')).daysBefore, 1, 'late scan chooses only the closest due threshold');
});

test('notification settings validate input and preserve unrelated preferences', () => {
  assert.deepEqual(normaliseNotificationSettings({ eventReminderDays: [1, 7, 1], events: false }, { email: false, marketing: true }), { eventReminderDays: [7, 1], events: false, email: false, marketing: true });
  for (const input of [null, [], 'events', { events: 1 }, { email: 'false' }, { eventReminderDays: [0] }, { eventReminderDays: [366] }, { eventReminderDays: [1.5] }, { eventReminderDays: ['7'] }, { eventReminderDays: [1, 2, 3, 4, 5, 6] }]) assert.throws(() => normaliseNotificationSettings(input));
  assert.deepEqual(normaliseNotificationSettings({ eventReminderDays: [] }), { eventReminderDays: [] });
});

test('post fanout spans memberships, excludes unrelated and later joiners, retries idempotently', async () => {
  const rows = fixtures();
  rows.OrganisationMembership.push(
    { _id: 'outsider-B', userId: 'outsider', organisationId: 'B', role: 'member', status: 'active' },
    { _id: 'late-A', userId: 'late', organisationId: 'A', role: 'member', status: 'active', joinedDate: '2026-11-05T00:00:00Z' },
    { _id: 'revoked-A', userId: 'revoked', organisationId: 'A', role: 'member', status: 'revoked' },
    { _id: 'pending-A', userId: 'pending', organisationId: 'A', role: 'member', status: 'pending' },
  );
  const post = { _id: 'post-A', organisationId: 'A', title: 'New gallery', createdAt: NOW, notificationQueued: true };
  rows.OrganisationPost.push(post);
  const service = createNotificationService({ models: memoryModels(rows), isConnected: () => true });
  await service.notifyPost(post);
  await service.notifyPost(post);
  assert.equal(rows.Notification.length, 1);
  assert.equal(rows.Notification[0].userId, 'member');
  assert.equal(rows.Notification[0].organisationName, 'Art Society');
  assert.equal(rows.Notification[0].postId, 'post-A');
  assert.equal(post.notificationQueued, false);
  await service.notifyPost({ ...post, _id: 'post-B', organisationId: 'B' });
  assert.equal(rows.Notification.filter(row => row.userId === 'member').length, 2);
});

test('scan delivers eligible event reminders across organisations once per interval and respects preferences', async () => {
  const rows = fixtures();
  rows.Event.push(eventAt('2026-11-11'), { ...eventAt('2026-11-11'), _id: 'event-B', organisationId: 'B' }, { ...eventAt('2026-11-11'), _id: 'premium-A', allowedTiers: ['Premium'], tierAccess: undefined });
  const service = createNotificationService({ models: memoryModels(rows), isConnected: () => true });
  await service.scan({ now: NOW });
  await service.scan({ now: NOW });
  assert.equal(rows.Notification.filter(row => row.type === 'event').length, 2);
  assert.equal(rows.Notification.filter(row => row.type === 'membership').length, 2, 'initial snapshot seeds current membership status once');
  assert.ok(!rows.Notification.some(row => row.eventId === 'premium-A'));
  await service.scan({ now: new Date('2026-11-10T02:00:00Z') });
  assert.equal(rows.Notification.filter(row => row.type === 'event').length, 4);
  rows.User[0].notifications.events = false;
  rows.Event.push({ ...eventAt('2026-11-12'), _id: 'disabled' });
  await service.scan({ now: new Date('2026-11-11T02:00:00Z') });
  assert.equal(rows.Notification.filter(row => row.type === 'event').length, 4);
});

test('expiry, cancellation and status/tier changes are recovered durably without reminders for inactive members', async () => {
  const rows = fixtures();
  rows.OrganisationMembership = rows.OrganisationMembership.slice(0, 1);
  const membership = rows.OrganisationMembership[0];
  membership.expirationDate = '2026-11-05T02:00:00Z';
  rows.Event.push(eventAt('2026-11-11'));
  const service = createNotificationService({ models: memoryModels(rows), isConnected: () => true });
  await service.scan({ now: NOW });
  rows.Notification.length = 0;
  await service.scan({ now: new Date('2026-11-05T02:00:00Z') });
  await service.scan({ now: new Date('2026-11-05T03:00:00Z') });
  assert.equal(rows.Notification.length, 1);
  assert.match(rows.Notification[0].message, /expired/);
  membership.status = 'suspended';
  membership.updatedAt = new Date('2026-11-05T04:00:00Z');
  await service.scan({ now: new Date('2026-11-05T04:00:00Z') });
  assert.match(rows.Notification.at(-1).message, /suspended/);
  assert.equal(rows.Notification.filter(row => row.type === 'event').length, 0);
  const active = { ...membership, status: 'active', expirationDate: '2027-01-01T00:00:00Z', cancelAtPeriodEnd: true, updatedAt: new Date('2026-11-06T00:00:00Z') };
  await service.notifyMembershipChange(membership, active, { organisation: rows.Organisation[0], now: NOW });
  assert.match(rows.Notification.at(-1).message, /will end/);
});

test('post dispatch failure retains queue for restart recovery and read state survives repeat fanout', async () => {
  const rows = fixtures();
  const post = { _id: 'queued', organisationId: 'A', title: 'Queued post', createdAt: NOW, notificationQueued: true };
  rows.OrganisationPost.push(post);
  const models = memoryModels(rows);
  const write = models.Notification.updateOne;
  models.Notification.updateOne = async () => { throw new Error('temporary write failure'); };
  const service = createNotificationService({ models, isConnected: () => true });
  await assert.rejects(service.notifyPost(post));
  assert.equal(post.notificationQueued, true);
  models.Notification.updateOne = write;
  await service.scan({ now: NOW });
  assert.equal(post.notificationQueued, false);
  const notification = rows.Notification.find(row => row.type === 'post');
  notification.readAt = NOW;
  await service.notifyPost(post);
  assert.equal(rows.Notification.filter(row => row.type === 'post').length, 1);
  assert.deepEqual(notification.readAt, NOW);
});

test('membership delivery retries do not duplicate alerts when bookkeeping changes timestamps', async () => {
  const rows = fixtures();
  const membership = rows.OrganisationMembership[0];
  Object.assign(membership, { billingRevision: 3, updatedAt: NOW });
  const models = memoryModels(rows);
  const saveSnapshot = models.OrganisationMembership.updateOne;
  models.OrganisationMembership.updateOne = async () => { throw new Error('temporary snapshot write failure'); };
  const service = createNotificationService({ models, isConnected: () => true });
  await assert.rejects(service.notifyMembershipChange(null, membership, { now: NOW }));
  assert.equal(rows.Notification.length, 1);
  membership.updatedAt = new Date(NOW.getTime() + 1000);
  models.OrganisationMembership.updateOne = saveSnapshot;
  await service.notifyMembershipChange(null, membership, { now: NOW });
  assert.equal(rows.Notification.length, 1, 'same membership revision keeps its notification ID');
  assert.equal(membership.notificationSnapshot.status, 'active');
});

test('scheduler starts immediately, avoids overlap and stops cleanly', async () => {
  let calls = 0, release;
  const stop = startNotificationScheduler({ intervalMs: 2, isConnected: () => true, scan: async () => { calls += 1; await new Promise(resolve => { release = resolve; }); } });
  await new Promise(resolve => setTimeout(resolve, 15));
  assert.equal(calls, 1);
  stop(); release();
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(calls, 1);
});

let apiRows;
const originals = [];
function patch(model, method, replacement) { originals.push([model, method, model[method]]); model[method] = replacement; }
before(() => {
  patch(User, 'findById', id => query(apiRows.users.find(user => user._id === id) || null));
  patch(User, 'findByIdAndUpdate', async (id, update) => { const user = apiRows.users.find(user => user._id === id); Object.assign(user, clone(update.$set)); return clone(user); });
  patch(ActivityLog, 'create', async () => ({}));
  patch(Notification, 'find', filter => query(apiRows.notifications.filter(row => matches(row, filter))));
  patch(Notification, 'findOne', filter => query(apiRows.notifications.find(row => matches(row, filter)) || null));
  patch(Notification, 'countDocuments', async filter => apiRows.notifications.filter(row => matches(row, filter)).length);
  patch(Notification, 'findOneAndUpdate', async (filter, update) => { const row = apiRows.notifications.find(value => matches(value, filter)); if (row) Object.assign(row, clone(update.$set)); return clone(row || null); });
  patch(Notification, 'updateMany', async (filter, update) => { for (const row of apiRows.notifications.filter(value => matches(value, filter))) Object.assign(row, clone(update.$set)); });
});
after(() => { for (const [model, method, original] of originals.reverse()) model[method] = original; });
beforeEach(() => {
  apiRows = { users: [{ _id: 'member', name: 'Member', email: 'member@example.test', country: 'Malaysia', emailVerified: true, status: 'active', notifications: { email: false, marketing: true, events: true } }], notifications: [] };
  for (let index = 0; index < 5; index += 1) apiRows.notifications.push({ _id: `n${index}`, userId: index === 4 ? 'other' : 'member', type: 'post', title: `Post ${index}`, message: 'New post', organisationId: 'A', organisationName: 'Art Society', postId: `p${index}`, createdAt: `2026-11-0${index + 1}T00:00:00Z`, readAt: null });
});
function request(router, method, path, { userId = 'member', query: parameters = {}, body = {}, params = {} } = {}) {
  const route = router.stack.find(layer => layer.route?.path === path && layer.route.methods[method.toLowerCase()])?.route;
  assert.ok(route);
  const handlers = [...router.stack.filter(layer => !layer.route).map(layer => layer.handle), ...route.stack.map(layer => layer.handle)];
  const req = { method, body, params, query: parameters, ip: '127.0.0.1', headers: userId ? { authorization: `Bearer ${jwt.sign({ id: userId }, config.JWT_SECRET)}` } : {} };
  return new Promise((resolve, reject) => {
    let status = 200, index = 0;
    const res = { status(code) { status = code; return this; }, json(value) { resolve({ status, body: JSON.parse(JSON.stringify(value)) }); } };
    const next = error => { if (error) return reject(error); const handler = handlers[index++]; if (!handler) return reject(new Error('No response')); Promise.resolve(handler(req, res, next)).catch(reject); };
    next();
  });
}

test('notifications API is account-wide, newest-first, paginated and private to the authenticated member', async () => {
  const result = await request(notificationRouter, 'GET', '/', { query: { limit: '3' } });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.notifications.map(row => row.id), ['n3', 'n2', 'n1']);
  assert.equal(result.body.total, 4);
  assert.equal(result.body.unreadCount, 4);
  assert.equal(result.body.totalPages, 2);
  assert.ok(!JSON.stringify(result.body).includes('userId'));
  assert.deepEqual((await request(notificationRouter, 'GET', '/', { query: { limit: '3', page: '2' } })).body.notifications.map(row => row.id), ['n0']);
  for (const query of [{ limit: '0' }, { limit: '51' }, { limit: '1.5' }, { page: '-1' }, { page: '9007199254740991', limit: '3' }]) assert.equal((await request(notificationRouter, 'GET', '/', { query })).status, 400);
  assert.equal((await request(notificationRouter, 'GET', '/', { userId: null })).status, 401);
  apiRows.users[0].emailVerified = false;
  assert.equal((await request(notificationRouter, 'GET', '/')).status, 403);
});

test('read and read-all are idempotent and cannot mutate another account notifications', async () => {
  assert.equal((await request(notificationRouter, 'PATCH', '/:id/read', { params: { id: 'n4' } })).status, 404);
  const first = await request(notificationRouter, 'PATCH', '/:id/read', { params: { id: 'n0' } });
  const second = await request(notificationRouter, 'PATCH', '/:id/read', { params: { id: 'n0' } });
  assert.equal(first.body.notification.readAt, second.body.notification.readAt);
  assert.equal((await request(notificationRouter, 'GET', '/')).body.unreadCount, 3);
  assert.equal((await request(notificationRouter, 'PATCH', '/read-all')).body.unreadCount, 0);
  assert.equal((await request(notificationRouter, 'GET', '/')).body.unreadCount, 0);
  assert.equal(apiRows.notifications.find(row => row._id === 'n4').readAt, null);
});

test('profile saves reminder days, preserves preferences, and rejects malformed settings without writes', async () => {
  const result = await request(memberRouter, 'PUT', '/profile', { body: { notifications: { eventReminderDays: [1, 7], events: false } } });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.user.notifications, { email: false, marketing: true, events: false, eventReminderDays: [7, 1] });
  for (const notifications of [{ eventReminderDays: ['7'] }, { eventReminderDays: [0] }, { events: 'false' }, null]) assert.equal((await request(memberRouter, 'PUT', '/profile', { body: { notifications } })).status, 400);
  assert.deepEqual(apiRows.users[0].notifications, result.body.user.notifications);
});
