import assert from 'node:assert/strict';
import test from 'node:test';
import { earliestEventDate, eventLocalDate, eventTimeInstant, getEventTiming } from '../../shared/eventTiming.js';

const event = (changes = {}) => ({ startDate: '2026-10-29', endDate: '2026-10-29', timeZone: 'Asia/Kuala_Lumpur',
  schedule: [{ date: '2026-10-29', startTime: '09:00', endTime: '17:00' }], ...changes });

test('Earliest creation date is tomorrow on the selected calendar across UTC and year boundaries', () => {
  const now = new Date('2026-12-31T16:00:00Z');
  assert.equal(eventLocalDate(now, 'Asia/Kuala_Lumpur'), '2027-01-01');
  assert.equal(earliestEventDate('Asia/Kuala_Lumpur', now), '2027-01-02');
  assert.equal(earliestEventDate('America/New_York', now), '2027-01-01');
  assert.equal(earliestEventDate('UTC', new Date('2028-02-28T12:00:00Z')), '2028-02-29');
});

test('Registration closes at the exact first start and the event ends at the exact final end', () => {
  assert.equal(getEventTiming(event(), '2026-10-29T00:59:59.999Z').rsvpOpen, true);
  const start = getEventTiming(event(), '2026-10-29T01:00:00Z');
  assert.equal(start.status, 'in_progress');
  assert.equal(start.rsvpOpen, false);
  assert.equal(getEventTiming(event(), '2026-10-29T08:59:59.999Z').status, 'in_progress');
  assert.equal(getEventTiming(event(), '2026-10-29T09:00:00Z').status, 'ended');
});

test('Multi-day events keep registration closed between sessions and end on their final day', () => {
  const multi = event({ endDate: '2026-10-31', schedule: [
    { date: '2026-10-31', startTime: '10:00', endTime: '12:00' },
    { date: '2026-10-29', startTime: '09:00', endTime: '17:00' }
  ] });
  assert.equal(getEventTiming(multi, '2026-10-30T00:00:00Z').status, 'in_progress');
  assert.equal(getEventTiming(multi, '2026-10-30T00:00:00Z').rsvpOpen, false);
  assert.equal(getEventTiming(multi, '2026-10-31T04:00:00Z').status, 'ended');
  assert.equal(multi.schedule[0].date, '2026-10-31', 'Computing times must not sort the original schedule');
});

test('Quarter-hour offsets and daylight saving gaps resolve to real instants', () => {
  assert.equal(eventTimeInstant('2026-10-29', '09:00', 'Asia/Kathmandu'), '2026-10-29T03:15:00.000Z');
  assert.equal(eventTimeInstant('2026-03-08', '02:30', 'America/New_York'), null);
  assert.equal(eventTimeInstant('2026-03-08', '03:30', 'America/New_York'), '2026-03-08T07:30:00.000Z');
});

test('A repeated DST hour cannot reopen RSVP after its earliest start', () => {
  assert.equal(eventTimeInstant('2026-11-01', '01:30', 'America/New_York'), '2026-11-01T05:30:00.000Z');
  assert.equal(eventTimeInstant('2026-11-01', '01:30', 'America/New_York', true), '2026-11-01T06:30:00.000Z');
  const repeated = event({ startDate: '2026-11-01', endDate: '2026-11-01', timeZone: 'America/New_York', schedule: [{ date: '2026-11-01', startTime: '01:30', endTime: '01:45' }] });
  assert.equal(getEventTiming(repeated, '2026-11-01T06:00:00Z').status, 'in_progress');
  assert.equal(getEventTiming(repeated, '2026-11-01T06:45:00Z').status, 'ended');
});

test('Legacy unknown-zone events close by the start of their date and end after that date', () => {
  const legacy = { date: '2026-10-29', time: '18:00 - 21:00 EST' };
  assert.equal(getEventTiming(legacy, '2026-10-28T16:00:00Z').status, 'in_progress');
  assert.equal(getEventTiming(legacy, '2026-10-29T16:00:00Z').status, 'ended');
  assert.equal(getEventTiming({ ...legacy, timeZone: 'UTC' }, '2026-10-29T17:59:59Z').status, 'upcoming');
  assert.equal(getEventTiming({ ...legacy, timeZone: 'UTC' }, '2026-10-29T18:00:00Z').status, 'in_progress');
});

test('Invalid dates, reversed periods and nonexistent local times cannot open registration', () => {
  for (const value of [{ date: '2026-02-30' }, event({ endDate: '2026-10-28' }), event({ startDate: '2026-03-08', endDate: '2026-03-08', timeZone: 'America/New_York', schedule: [{ date: '2026-03-08', startTime: '02:30', endTime: '04:00' }] })]) {
    assert.equal(getEventTiming(value).status, 'unknown');
    assert.equal(getEventTiming(value).rsvpOpen, false);
  }
  assert.equal(getEventTiming(event({ timeZone: 'Invalid/Zone' }), '2026-10-29T01:00:00Z').status, 'in_progress');
});
