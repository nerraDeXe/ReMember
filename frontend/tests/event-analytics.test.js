import assert from 'node:assert/strict';
import test from 'node:test';
import { buildEventAnalytics } from '../src/eventAnalytics.js';

const now = new Date('2026-03-01T00:30:00.000Z');
const event = (id, changes = {}) => ({ _id: id, title: id, date: '2026-03-02', capacity: 10, rsvps: [], ...changes });
const registrations = result => result.registrationTrend.map(month => [month.month, month.registrations]);

test('Empty and zero-RSVP events retain zero monthly buckets and independent upcoming counts', () => {
  const empty = buildEventAnalytics([], { now, months: 3 });
  assert.equal(empty.upcomingEvents, 0);
  assert.equal(empty.totalRsvps, 0);
  assert.equal(empty.undatedRegistrations, 0);
  assert.deepEqual(empty.eventTotals, []);
  assert.deepEqual(registrations(empty), [['2026-01', 0], ['2026-02', 0], ['2026-03', 0]]);
  const result = buildEventAnalytics([event('new')], { now, months: 3 });
  assert.equal(result.upcomingEvents, 1);
  assert.equal(result.eventTotals[0].rsvpCount, 0);
  assert.equal(result.eventTotals[0].remainingPlaces, 10);
});

test('The final schedule end time in the event time zone decides whether today is still upcoming', () => {
  const events = [
    event('ended', { date: '2026-03-01', schedule: [{ date: '2026-03-01', startTime: '07:00', endTime: '08:00' }] }),
    event('ongoing', { date: '2026-03-01', schedule: [{ date: '2026-03-01', startTime: '08:00', endTime: '09:00' }] }),
    event('New York', { date: '2026-02-28', timeZone: 'America/New_York', schedule: [{ date: '2026-02-28', startTime: '18:00', endTime: '20:00' }] }),
  ];
  const result = buildEventAnalytics(events, { now });
  assert.equal(result.upcomingEvents, 2);
  assert.equal(result.eventTotals.find(item => item.id === 'ended').upcoming, false);
  assert.equal(result.eventTotals.find(item => item.id === 'ongoing').upcoming, true);
  assert.equal(result.eventTotals.find(item => item.id === 'New York').upcoming, true);
  const exactEnd = buildEventAnalytics([events[1]], { now: new Date('2026-03-01T01:00:00Z') });
  assert.equal(exactEnd.upcomingEvents, 0);
});

test('Multi-day events remain upcoming while in progress until their final day finishes', () => {
  const multi = event('multi', { startDate: '2026-02-28', endDate: '2026-03-02', timeZone: 'Asia/Kuala_Lumpur', schedule: [
    { date: '2026-02-28', startTime: '09:00', endTime: '10:00' },
    { date: '2026-03-01', startTime: '09:00', endTime: '10:00' },
    { date: '2026-03-02', startTime: '09:00', endTime: '12:00' },
  ] });
  assert.equal(buildEventAnalytics([multi], { now }).upcomingEvents, 1);
  assert.equal(buildEventAnalytics([multi], { now: new Date('2026-03-02T03:59:59Z') }).upcomingEvents, 1);
  assert.equal(buildEventAnalytics([multi], { now: new Date('2026-03-02T04:00:00Z') }).upcomingEvents, 0);
});

test('Legacy free-text times use the end of the default local date without guessing their zone', () => {
  const legacy = event('legacy', { date: '2026-03-01', time: '09:00 - 10:00 EST' });
  assert.equal(buildEventAnalytics([legacy], { now: new Date('2026-03-01T15:59:59Z') }).upcomingEvents, 1);
  assert.equal(buildEventAnalytics([legacy], { now: new Date('2026-03-01T16:00:00Z') }).upcomingEvents, 0);
  const explicitZone = { ...legacy, timeZone: 'Asia/Kuala_Lumpur' };
  assert.equal(buildEventAnalytics([explicitZone], { now: new Date('2026-03-01T02:00:00Z') }).upcomingEvents, 0);
});

test('Invalid schedules, dates and zones do not crash or invent future event dates', () => {
  const result = buildEventAnalytics([
    event('bad-date', { date: '2026-02-30', rsvps: [{ userId: 'a', rsvpDate: '2026-02-20T12:00:00Z' }] }),
    event('bad-zone', { timeZone: 'Invalid/Zone', schedule: [null, { date: 42 }, { date: '2026-03-02', endTime: '25:00' }] }),
    null,
  ], { now });
  assert.equal(result.eventTotals.length, 2);
  assert.equal(result.upcomingEvents, 1);
  assert.equal(result.eventTotals.find(item => item.id === 'bad-date').startDate, null);
  assert.equal(result.eventTotals.find(item => item.id === 'bad-zone').timeZone, 'Asia/Kuala_Lumpur');
  assert.equal(result.totalRsvps, 1);
  assert.equal(buildEventAnalytics([event('unknown', { date: 'not-a-date' })], { now, scope: 'past' }).eventTotals.length, 0);
});

test('UTC registration buckets handle offset timestamps across month boundaries', () => {
  const result = buildEventAnalytics([event('offsets', { rsvps: [
    { userId: 'a', rsvpDate: '2026-03-01T00:15:00+08:00' },
    { userId: 'b', rsvpDate: '2026-02-28T22:30:00-02:00' },
  ] })], { now, months: 3 });
  assert.deepEqual(registrations(result), [['2026-01', 0], ['2026-02', 1], ['2026-03', 1]]);
  assert.equal(result.registrationTrend[2].label, 'Mar 2026');
  assert.equal(result.totalRsvps, 2);
});

test('Missing, invalid and future RSVP timestamps stay in totals and are excluded from trends', () => {
  const result = buildEventAnalytics([event('dates', { rsvps: [
    { userId: 'missing' }, { userId: 'invalid', rsvpDate: '2026-02-30T12:00:00Z' },
    { userId: 'future', rsvpDate: '2026-03-01T01:00:00Z' }, { userId: 'outside', rsvpDate: '2025-01-01T00:00:00Z' },
    { userId: 'valid', rsvpDate: '2026-02-01T00:00:00Z' },
  ] })], { now, months: 3 });
  assert.equal(result.totalRsvps, 5);
  assert.equal(result.undatedRegistrations, 3);
  assert.deepEqual(registrations(result), [['2026-01', 0], ['2026-02', 1], ['2026-03', 0]]);
});

test('Defensive RSVP deduplication counts a member once and preserves registrations without an ID', () => {
  const result = buildEventAnalytics([event('dedupe', { capacity: 2, rsvps: [
    { userId: 'a', rsvpDate: '2026-02-20T00:00:00Z' }, { userId: 'a', rsvpDate: '2026-01-20T00:00:00Z' },
    {}, { rsvpDate: '2026-02-21T00:00:00Z' }, null,
  ] })], { now, months: 3 });
  assert.equal(result.totalRsvps, 3);
  assert.equal(result.eventTotals[0].rsvpCount, 3);
  assert.equal(result.eventTotals[0].remainingPlaces, 0);
  assert.equal(result.undatedRegistrations, 1);
  assert.deepEqual(registrations(result), [['2026-01', 1], ['2026-02', 1], ['2026-03', 0]]);
});

test('Event scopes filter both current roster totals and trends while upcoming count stays global', () => {
  const events = [
    event('future', { rsvps: [{ userId: 'a', rsvpDate: '2026-02-01T00:00:00Z' }] }),
    event('past', { date: '2026-02-01', rsvps: [{ userId: 'b', rsvpDate: '2026-01-01T00:00:00Z' }, { userId: 'c' }] }),
  ];
  const upcoming = buildEventAnalytics(events, { now, scope: 'upcoming', months: 3 });
  const past = buildEventAnalytics(events, { now, scope: 'past', months: 3 });
  assert.equal(upcoming.upcomingEvents, 1);
  assert.equal(past.upcomingEvents, 1);
  assert.equal(upcoming.totalRsvps, 1);
  assert.equal(past.totalRsvps, 2);
  assert.equal(past.undatedRegistrations, 1);
  assert.deepEqual(upcoming.eventTotals.map(item => item.id), ['future']);
  assert.deepEqual(past.eventTotals.map(item => item.id), ['past']);
  assert.deepEqual(registrations(upcoming), [['2026-01', 0], ['2026-02', 1], ['2026-03', 0]]);
  assert.deepEqual(registrations(past), [['2026-01', 1], ['2026-02', 0], ['2026-03', 0]]);
});

test('Month windows support 3, 6 and 12 months, leap days and year rollover', () => {
  const leapNow = new Date('2024-03-01T00:00:00Z');
  const events = [event('leap', { rsvps: [{ userId: 'leap', rsvpDate: '2024-02-29T23:59:59Z' }] })];
  const three = buildEventAnalytics(events, { now: leapNow, months: 3 });
  assert.deepEqual(registrations(three), [['2024-01', 0], ['2024-02', 1], ['2024-03', 0]]);
  const twelve = buildEventAnalytics(events, { now: leapNow, months: 12 });
  assert.equal(twelve.registrationTrend.length, 12);
  assert.equal(twelve.registrationTrend[0].month, '2023-04');
  assert.equal(twelve.registrationTrend[11].month, '2024-03');
  for (const months of [0, 4, '3', NaN, null]) assert.equal(buildEventAnalytics([], { now, months }).registrationTrend.length, 6);
});

test('Roster cancellations are reflected by current records without inventing past history', () => {
  const listed = event('current', { rsvps: [{ userId: 'a', rsvpDate: '2026-02-01T00:00:00Z' }] });
  assert.equal(buildEventAnalytics([listed], { now }).totalRsvps, 1);
  const cancelled = { ...listed, rsvps: [] };
  assert.equal(buildEventAnalytics([cancelled], { now }).totalRsvps, 0);
  assert.equal(buildEventAnalytics([cancelled], { now }).registrationTrend.reduce((total, month) => total + month.registrations, 0), 0);
});

test('Results preserve source records, sort events by date and retain unknown capacity honestly', () => {
  const events = [event('later', { date: '2026-04-01', capacity: undefined }), event('first', { date: '2026-03-02' })];
  const original = structuredClone(events);
  const result = buildEventAnalytics(events, { now, scope: 'invalid' });
  assert.deepEqual(events, original);
  assert.deepEqual(result.eventTotals.map(item => item.id), ['first', 'later']);
  assert.equal(result.eventTotals[1].capacity, null);
  assert.equal(result.eventTotals[1].remainingPlaces, null);
});
