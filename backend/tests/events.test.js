import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import jwt from 'jsonwebtoken';
import { config } from '../config/config.js';
import { User, Organisation, OrganisationMembership, Event, Tier, ActivityLog } from '../models/index.js';
import eventRouter from '../routes/events.js';
import { emailService } from '../services/emailService.js';
import { eventLocationService, EventLocationError } from '../services/eventLocations.js';
import { normaliseEventInput } from '../services/eventInput.js';
import { getEventDates, getEventMapsUrl, getEventSchedule, formatEventTimeRange, formatEventDateRange, sortEventTiers, getEligibleEventTiers, isEventTierAllowed, hasEventCoordinates } from '../../shared/events.js';

const models = { User, Organisation, OrganisationMembership, Event, Tier, ActivityLog };
const originals = [];
const clone = value => structuredClone(value);
let records, serial, mutations;
const pngImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';
const validEvent = () => ({ title: 'Community weekend', description: 'A weekend with our members.', location: 'KL Convention Centre', locationPlaceId: 'ChIJ_sample-place', startDate: '2099-05-10', endDate: '2099-05-11', schedule: [{ date: '2099-05-10', startTime: '09:00', endTime: '17:00' }, { date: '2099-05-11', startTime: '10:00', endTime: '15:00' }], timeZone: 'Asia/Kuala_Lumpur', capacity: 30, tierAccess: 'all', imageUrl: '' });

function matches(record, filter = {}) {
  return Object.entries(filter).every(([key, expected]) => expected && typeof expected === 'object' && '$in' in expected ? expected.$in.includes(record[key]) : record[key] === expected);
}
function document(value) {
  if (!value) return value;
  const result = clone(value);
  Object.defineProperty(result, 'toObject', { value: () => clone(value) });
  return result;
}
function query(value) {
  return {
    select() { return this; },
    async lean() { return clone(value); },
    then(resolve, reject) { return Promise.resolve(Array.isArray(value) ? value.map(document) : (value && typeof value === 'object' ? document(value) : value)).then(resolve, reject); },
  };
}
function patch(target, method, replacement) {
  originals.push([target, method, target[method]]);
  target[method] = replacement;
}
before(() => {
  for (const [name, model] of Object.entries(models)) {
    const collection = () => records[name];
    patch(model, 'find', filter => query(collection().filter(record => matches(record, filter))));
    patch(model, 'findOne', filter => query(collection().find(record => matches(record, filter)) || null));
    patch(model, 'findById', id => query(collection().find(record => record._id === id) || null));
    patch(model, 'create', async input => {
      const record = { _id: `${name}-${++serial}`, ...clone(input) };
      collection().push(record);
      mutations.push({ model: name, method: 'create' });
      return document(record);
    });
    patch(model, 'findOneAndUpdate', (filter, update) => {
      const record = collection().find(value => matches(value, filter));
      if (record) Object.assign(record, clone(update.$set || update));
      mutations.push({ model: name, method: 'update', filter: clone(filter) });
      return query(record || null);
    });
    patch(model, 'findOneAndDelete', filter => {
      const index = collection().findIndex(value => matches(value, filter));
      mutations.push({ model: name, method: 'delete', filter: clone(filter) });
      return query(index < 0 ? null : collection().splice(index, 1)[0]);
    });
  }
  patch(emailService, 'sendEventRsvpConfirmation', async () => ({ status: 'sent' }));
  patch(eventLocationService, 'search', async query => {
    if (query === 'provider unavailable') throw new EventLocationError('Location search is busy. Please try again.', 429, 2);
    if (typeof query !== 'string' || query.trim().length < 3 || query.length > 200) throw new EventLocationError('Enter a valid search.', 400);
    return [{ id: 'way:42', label: 'Kuala Lumpur Convention Centre', latitude: 3.1538, longitude: 101.7138 }];
  });
});
after(() => { for (const [target, method, original] of originals.reverse()) target[method] = original; });
beforeEach(() => {
  serial = 0;
  mutations = [];
  records = Object.fromEntries(Object.keys(models).map(name => [name, []]));
  for (const [id, selected] of [['ownerA', 'A'], ['ownerB', 'B'], ['member', 'A'], ['outsider', '']]) records.User.push({ _id: id, name: id, email: `${id}@example.test`, password: 'PRIVATE', emailVerified: true, status: 'active', activeOrganisationId: selected });
  records.Organisation.push({ _id: 'A', name: 'A', adminId: 'ownerA' }, { _id: 'B', name: 'B', adminId: 'ownerB' });
  records.OrganisationMembership.push({ _id: 'member-A', organisationId: 'A', userId: 'member', role: 'member', status: 'active', tierId: 'A-low', tierName: 'Basic', expirationDate: '2099-01-01T00:00:00Z' });
  for (const organisationId of ['A', 'B']) {
    records.Tier.push(
      { _id: `${organisationId}-low`, organisationId, name: 'Basic', accessLevel: 1, price: 0, interval: 'monthly', isActive: true },
      { _id: `${organisationId}-mid`, organisationId, name: 'Supporter', accessLevel: 1, price: 120, interval: 'yearly', isActive: true },
      { _id: `${organisationId}-tie`, organisationId, name: 'Partner', accessLevel: 1, price: 10, interval: 'monthly', isActive: true },
      { _id: `${organisationId}-high`, organisationId, name: 'Patron', accessLevel: 2, price: 5, interval: 'monthly', isActive: true },
    );
    records.Event.push({ _id: `event-${organisationId}`, organisationId, ...validEvent(), allowedTiers: [], rsvps: [] });
  }
});

function request(method = 'GET', path = '/', { userId = 'member', body = {}, params = {}, query: parameters = {} } = {}) {
  const route = eventRouter.stack.find(layer => layer.route?.path === path && layer.route.methods[method.toLowerCase()])?.route;
  assert.ok(route);
  const handlers = [...eventRouter.stack.filter(layer => !layer.route).map(layer => layer.handle), ...route.stack.map(layer => layer.handle)];
  const req = { method, body, params, query: parameters, originalUrl: path, ip: '127.0.0.1', headers: userId ? { authorization: `Bearer ${jwt.sign({ id: userId }, config.JWT_SECRET)}` } : {} };
  return new Promise((resolve, reject) => {
    let status = 200, index = 0;
    const headers = {};
    const res = { status(value) { status = value; return this; }, setHeader(name, value) { headers[name] = value; }, json(value) { resolve({ status, headers, body: JSON.parse(JSON.stringify(value)) }); } };
    const next = error => {
      if (error) return reject(error);
      const handler = handlers[index++];
      if (!handler) return reject(new Error('Route completed without a response'));
      Promise.resolve(handler(req, res, next)).catch(reject);
    };
    next();
  });
}

test('Only verified owners can create events for their selected organisation', async () => {
  assert.equal((await request('POST', '/', { userId: null, body: validEvent() })).status, 401);
  assert.equal((await request('POST', '/', { body: validEvent() })).status, 403);
  records.User.find(user => user._id === 'ownerA').emailVerified = false;
  assert.equal((await request('POST', '/', { userId: 'ownerA', body: validEvent() })).status, 403);
  assert.equal(records.Event.length, 2);
});

test('Owners publish uploaded images, date schedules, and server-derived organisation and tier names', async () => {
  const result = await request('POST', '/', { userId: 'ownerA', body: { ...validEvent(), imageUrl: pngImage, title: '  Weekend  ', tierAccess: 'minimum', minimumTierId: 'A-mid', allowedTiers: ['Forged'], organisationId: 'A' } });
  assert.equal(result.status, 201);
  assert.equal(result.body.event.organisationId, 'A');
  assert.equal(result.body.event.title, 'Weekend');
  assert.equal(result.body.event.imageUrl, pngImage);
  assert.equal(result.body.event.date, '2099-05-10');
  assert.equal(result.body.event.schedule.length, 2);
  assert.deepEqual(new Set(result.body.event.allowedTiers), new Set(['Supporter', 'Partner', 'Patron']));
  assert.equal(result.body.event.minimumTierId, 'A-mid');
  assert.match(result.body.event.mapsUrl, /google.com\/maps\/search/);
  assert.equal(records.ActivityLog[0].action, 'EVENT_CREATED');
});

test('Single-day events require selectable start and end times, with end date defaulting to start', () => {
  const event = validEvent();
  delete event.endDate;
  event.schedule = [event.schedule[0]];
  const fields = normaliseEventInput(event);
  assert.equal(fields.endDate, event.startDate);
  assert.equal(fields.schedule.length, 1);
  assert.equal(fields.timeZone, 'Asia/Kuala_Lumpur');
});

test('Event dates reject calendar rollovers, reversed ranges and more than 31 days', () => {
  for (const [start, end] of [['2026-02-29', '2026-03-01'], ['2026-04-31', '2026-05-01'], ['2026-1-01', '2026-01-02'], ['2026-05-02', '2026-05-01'], ['2026-01-01', '2026-02-01']]) assert.throws(() => getEventDates(start, end));
  assert.deepEqual(getEventDates('2028-02-28', '2028-03-01'), ['2028-02-28', '2028-02-29', '2028-03-01']);
  assert.equal(getEventDates('2026-01-01', '2026-01-31').length, 31);
});

test('Schedules reject missing, duplicate, out-of-range and malformed day times without writes', async () => {
  const base = validEvent();
  const invalidSchedules = [[], [base.schedule[0]], [base.schedule[0], base.schedule[0]], [base.schedule[0], { ...base.schedule[1], date: '2099-05-12' }]];
  for (const invalid of [{ startTime: '9:00' }, { startTime: '24:00' }, { endTime: '10:60' }, { endTime: '08:00' }, { endTime: '09:00' }, { startTime: null }]) invalidSchedules.push([{ ...base.schedule[0], ...invalid }, base.schedule[1]]);
  for (const schedule of invalidSchedules) {
    const result = await request('POST', '/', { userId: 'ownerA', body: { ...base, schedule } });
    assert.equal(result.status, 400, JSON.stringify(schedule));
  }
  assert.equal(records.Event.length, 2);
});

test('New listings reject legacy free text time, malformed time zones, blank and excessive input', async () => {
  const invalid = [
    { ...validEvent(), startDate: undefined, endDate: undefined, schedule: undefined, date: '2099-01-01', time: 'evening' },
    ...['Mars/Olympus', '', {}, null].map(timeZone => ({ ...validEvent(), timeZone })),
    ...[{ title: '' }, { description: ' ' }, { location: '' }, { capacity: 0 }, { capacity: true }, { capacity: [10] }, { capacity: '1.5' }, { capacity: {} }, { title: 'x'.repeat(161) }, { locationPlaceId: 'bad & query=value' }, { tierAccess: null }].map(fields => ({ ...validEvent(), ...fields })),
  ];
  for (const body of invalid) assert.equal((await request('POST', '/', { userId: 'ownerA', body })).status, 400, JSON.stringify(body));
});

test('Uploaded header images reject URLs, SVGs and false image signatures', async () => {
  for (const imageUrl of ['https://example.test/image.png', 'javascript:alert(1)', 'data:image/svg+xml;base64,PHN2Zz4=', 'data:image/png;base64,bm90IGEgcG5n', {}, null]) {
    const result = await request('POST', '/', { userId: 'ownerA', body: { ...validEvent(), imageUrl } });
    assert.equal(result.status, 400, String(imageUrl));
  }
});

test('Legacy events retain their date/time and existing remote image during unrelated updates', async () => {
  const existing = records.Event[0];
  delete existing.startDate;
  delete existing.endDate;
  delete existing.schedule;
  delete existing.timeZone;
  delete existing.tierAccess;
  existing.date = '2026-12-01';
  existing.time = '18:00 - 21:00 EST';
  existing.imageUrl = 'https://example.test/legacy.jpg';
  existing.allowedTiers = ['Supporter'];
  const result = await request('PUT', '/:id', { userId: 'ownerA', params: { id: 'event-A' }, body: { title: 'Updated title', imageUrl: existing.imageUrl } });
  assert.equal(result.status, 200);
  assert.equal(result.body.event.date, '2026-12-01');
  assert.equal(result.body.event.time, '18:00 - 21:00 EST');
  assert.deepEqual(result.body.event.allowedTiers, ['Supporter']);
  assert.equal(result.body.event.imageUrl, existing.imageUrl);
  assert.equal((await request('PUT', '/:id', { userId: 'ownerA', params: { id: 'event-A' }, body: { imageUrl: 'https://example.test/changed.jpg' } })).status, 400);
  assert.equal((await request('PUT', '/:id', { userId: 'ownerA', params: { id: 'event-A' }, body: { imageUrl: '' } })).body.event.imageUrl, '');
});

test('Tier thresholds reject foreign, missing, and inactive tiers and ignore supplied tier names', async () => {
  for (const minimumTierId of ['B-high', 'missing', {}, '']) assert.equal((await request('POST', '/', { userId: 'ownerA', body: { ...validEvent(), tierAccess: 'minimum', minimumTierId } })).status, 400);
  records.Tier.find(tier => tier._id === 'A-mid').isActive = false;
  assert.equal((await request('POST', '/', { userId: 'ownerA', body: { ...validEvent(), tierAccess: 'minimum', minimumTierId: 'A-mid' } })).status, 400);
  const all = await request('POST', '/', { userId: 'ownerA', body: { ...validEvent(), allowedTiers: ['Private'] } });
  assert.deepEqual(all.body.event.allowedTiers, []);
});

test('Higher-tier access uses access levels then equivalent monthly prices, including ties', () => {
  const tiers = records.Tier.filter(tier => tier.organisationId === 'A');
  assert.deepEqual(sortEventTiers(tiers).map(tier => tier._id), ['A-low', 'A-tie', 'A-mid', 'A-high']);
  assert.deepEqual(new Set(getEligibleEventTiers(tiers, 'A-mid').map(tier => tier._id)), new Set(['A-mid', 'A-tie', 'A-high']));
  for (const [tierId, allowed] of [['A-low', false], ['A-mid', true], ['A-tie', true], ['A-high', true], ['B-high', false]]) assert.equal(isEventTierAllowed({ tierAccess: 'minimum', minimumTierId: 'A-mid' }, { tierId }, tiers), allowed);
});

test('Member views and RSVP enforce stable minimum tier IDs, even after tier names change', async () => {
  Object.assign(records.Event[0], { tierAccess: 'minimum', minimumTierId: 'A-mid', allowedTiers: ['Old supporter'] });
  const member = records.OrganisationMembership[0];
  assert.equal((await request()).body.events[0].isAllowedTier, false);
  assert.equal((await request('POST', '/:id/rsvp', { params: { id: 'event-A' } })).status, 403);
  member.tierId = 'A-mid';
  records.Tier.find(tier => tier._id === 'A-mid').name = 'Renamed supporter';
  assert.equal((await request()).body.events[0].isAllowedTier, true);
  assert.ok((await request()).body.events[0].allowedTiers.includes('Renamed supporter'));
  const rsvp = await request('POST', '/:id/rsvp', { params: { id: 'event-A' } });
  assert.equal(rsvp.status, 200);
  assert.equal(rsvp.body.event.isAllowedTier, true);
  assert.equal(rsvp.body.event.isRsvped, true);
  assert.deepEqual(rsvp.body.event.rsvps, []);
  assert.equal(records.Event[0].rsvps[0].userId, 'member');
});

test('Deactivated tiers retain existing membership eligibility, while deleted thresholds fail closed', async () => {
  Object.assign(records.Event[0], { tierAccess: 'minimum', minimumTierId: 'A-mid' });
  records.OrganisationMembership[0].tierId = 'A-high';
  records.Tier.find(tier => tier._id === 'A-mid').isActive = false;
  records.Tier.find(tier => tier._id === 'A-high').isActive = false;
  assert.equal((await request()).body.events[0].isAllowedTier, true);
  records.Tier = records.Tier.filter(tier => tier._id !== 'A-mid');
  assert.equal((await request()).body.events[0].isAllowedTier, false);
  assert.equal((await request('POST', '/:id/rsvp', { params: { id: 'event-A' } })).status, 403);
});

test('Legacy exact-name restrictions and all-tier listings retain their original behavior', async () => {
  const event = records.Event[0];
  delete event.tierAccess;
  event.allowedTiers = ['Supporter'];
  assert.equal((await request()).body.events[0].isAllowedTier, false);
  records.OrganisationMembership[0].tierName = 'Supporter';
  assert.equal((await request()).body.events[0].isAllowedTier, true);
  event.tierAccess = 'all';
  records.OrganisationMembership[0].tierName = 'Unknown';
  assert.equal((await request()).body.events[0].isAllowedTier, true);
});

test('Event reads and every mutation reject stale organisation selections and foreign IDs', async () => {
  assert.equal((await request('GET', '/', { query: { organisationId: 'B' } })).status, 409);
  for (const method of ['POST', 'PUT', 'DELETE']) {
    const options = { userId: 'ownerA', params: { id: 'event-A' }, body: { ...validEvent(), organisationId: 'B' }, query: { organisationId: 'B' } };
    assert.equal((await request(method, method === 'POST' ? '/' : '/:id', options)).status, 409);
  }
  for (const path of ['/:id/rsvp', '/:id/cancel-rsvp']) assert.equal((await request('POST', path, { params: { id: 'event-A' }, body: { organisationId: 'B' } })).status, 409);
  for (const method of ['PUT', 'DELETE']) assert.equal((await request(method, '/:id', { userId: 'ownerA', params: { id: 'event-B' }, body: { title: 'Foreign edit' } })).status, 404);
  for (const path of ['/:id/rsvp', '/:id/cancel-rsvp']) assert.equal((await request('POST', path, { params: { id: 'event-B' } })).status, 404);
  assert.equal(mutations.length, 0);
});

test('Suspended, pending, expired memberships and elapsed expiry dates cannot RSVP', async () => {
  const member = records.OrganisationMembership[0];
  for (const status of ['pending', 'expired', 'revoked', 'suspended']) {
    member.status = status;
    assert.ok([400, 403].includes((await request('POST', '/:id/rsvp', { params: { id: 'event-A' } })).status));
  }
  member.status = 'active';
  member.expirationDate = '2000-01-01';
  assert.equal((await request('POST', '/:id/rsvp', { params: { id: 'event-A' } })).status, 403);
});

test('Maps links are generated safely from the location and optional place ID', () => {
  const event = { location: 'A & B, Kuala Lumpur', locationPlaceId: 'ChIJ_test-place', mapsUrl: 'javascript:bad' };
  const url = new URL(getEventMapsUrl(event));
  assert.equal(url.origin, 'https://www.google.com');
  assert.equal(url.searchParams.get('query'), event.location);
  assert.equal(url.searchParams.get('query_place_id'), event.locationPlaceId);
  assert.equal(getEventMapsUrl({ location: '' }), '');
  assert.equal(new URL(getEventMapsUrl({ location: 'Test', locationPlaceId: 'bad&api=2' })).searchParams.has('query_place_id'), false);
});

test('Location search requires verified selected-organisation ownership and rejects stale contexts', async () => {
  assert.equal((await request('GET', '/locations/search', { userId: null, query: { q: 'Kuala Lumpur' } })).status, 401);
  assert.equal((await request('GET', '/locations/search', { query: { q: 'Kuala Lumpur' } })).status, 403);
  records.User.find(user => user._id === 'ownerA').emailVerified = false;
  assert.equal((await request('GET', '/locations/search', { userId: 'ownerA', query: { q: 'Kuala Lumpur' } })).status, 403);
  records.User.find(user => user._id === 'ownerA').emailVerified = true;
  assert.equal((await request('GET', '/locations/search', { userId: 'ownerA', query: { q: 'Kuala Lumpur', organisationId: 'B' } })).status, 409);
  const result = await request('GET', '/locations/search', { userId: 'ownerA', query: { q: 'Kuala Lumpur', organisationId: 'A' } });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.locations, [{ id: 'way:42', label: 'Kuala Lumpur Convention Centre', latitude: 3.1538, longitude: 101.7138 }]);
  assert.equal((await request('GET', '/locations/search', { userId: 'ownerA', query: { q: ['bad', 'query'] } })).status, 400);
  const busy = await request('GET', '/locations/search', { userId: 'ownerA', query: { q: 'provider unavailable' } });
  assert.equal(busy.status, 429);
  assert.equal(busy.headers['Retry-After'], '2');
});

test('Events store selected coordinates, preserve unrelated updates and clear stale map pins on location change', async () => {
  const created = await request('POST', '/', { userId: 'ownerA', body: { ...validEvent(), locationLatitude: 3.1538, locationLongitude: 101.7138 } });
  assert.equal(created.status, 201);
  assert.equal(created.body.event.locationLatitude, 3.1538);
  assert.equal(new URL(created.body.event.mapsUrl).searchParams.get('query'), '3.1538,101.7138');
  assert.equal(new URL(created.body.event.mapsUrl).searchParams.has('query_place_id'), false);
  const params = { id: created.body.event._id };
  const updated = await request('PUT', '/:id', { userId: 'ownerA', params, body: { title: 'Updated' } });
  assert.equal(updated.body.event.locationLatitude, 3.1538);
  const moved = await request('PUT', '/:id', { userId: 'ownerA', params, body: { location: 'Johor Bahru' } });
  assert.equal(moved.body.event.locationLatitude, null);
  assert.equal(moved.body.event.locationLongitude, null);
  assert.equal(new URL(moved.body.event.mapsUrl).searchParams.get('query'), 'Johor Bahru');
});

test('Coordinate validation requires paired finite numbers within latitude and longitude bounds', () => {
  for (const invalid of [{ locationLatitude: 3 }, { locationLongitude: 101 }, { locationLatitude: '3', locationLongitude: 101 }, { locationLatitude: null, locationLongitude: 101 }, { locationLatitude: NaN, locationLongitude: 101 }, { locationLatitude: Infinity, locationLongitude: 101 }, { locationLatitude: 91, locationLongitude: 101 }, { locationLatitude: 3, locationLongitude: -181 }]) {
    assert.throws(() => normaliseEventInput({ ...validEvent(), ...invalid }), /latitude and longitude/);
    assert.equal(hasEventCoordinates(invalid), false);
  }
  assert.equal(hasEventCoordinates({ locationLatitude: 0, locationLongitude: 0 }), true);
  assert.equal(hasEventCoordinates({ locationLatitude: -90, locationLongitude: 180 }), true);
  assert.equal(new URL(getEventMapsUrl({ locationLatitude: 0, locationLongitude: 0 })).searchParams.get('query'), '0,0');
  const cleared = normaliseEventInput({ ...validEvent(), locationLatitude: null, locationLongitude: null });
  assert.equal(cleared.locationLatitude, null);
  assert.equal(cleared.locationLongitude, null);
});

test('Calendar labels preserve dates across time zones and legacy time labels remain intact', () => {
  assert.equal(formatEventDateRange({ startDate: '2099-05-10', endDate: '2099-05-11' }), '10 May 2099 – 11 May 2099');
  assert.equal(formatEventDateRange({ date: '2099-05-10' }), '10 May 2099');
  assert.equal(formatEventTimeRange(getEventSchedule({ date: '2026-01-01', time: '18:00 - 21:00 EST' })[0]), '18:00 - 21:00 EST');
});
