import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultAnalyticsRange, validateAnalyticsRange } from '../src/analyticsRange.js';

const now = new Date('2026-10-16T05:00:00Z');

test('Default analytics range includes the current UTC month and five earlier months', () => {
  assert.deepEqual(defaultAnalyticsRange(now), { startMonth: '2026-05', endMonth: '2026-10' });
  assert.deepEqual(defaultAnalyticsRange(new Date('2026-01-01T00:00:00Z')), { startMonth: '2025-08', endMonth: '2026-01' });
  assert.deepEqual(defaultAnalyticsRange(new Date('2024-02-29T23:59:59Z')), { startMonth: '2023-09', endMonth: '2024-02' });
});

test('Default range uses UTC across local month boundaries and preserves four-digit years', () => {
  assert.deepEqual(defaultAnalyticsRange(new Date('2026-03-01T00:15:00+14:00')), { startMonth: '2025-09', endMonth: '2026-02' });
  assert.deepEqual(defaultAnalyticsRange(new Date('0099-07-01T00:00:00Z')), { startMonth: '0099-02', endMonth: '0099-07' });
  assert.deepEqual(defaultAnalyticsRange(new Date('0001-01-01T00:00:00Z')), { startMonth: '0001-01', endMonth: '0001-01' });
});

test('A range requires both months', () => {
  for (const [startMonth, endMonth] of [['', ''], ['', '2026-10'], ['2026-05', ''], [undefined, '2026-10'], ['2026-05', null]]) {
    assert.match(validateAnalyticsRange(startMonth, endMonth, now), /both a start month and an end month/i);
  }
});

test('Range validation requires exact valid YYYY-MM values and a positive year', () => {
  for (const invalid of ['2026-0', '2026-1', '2026-00', '2026-13', '2026-010', '2026-10-01', '26-10', '10000-01', '0000-01', ' 2026-10', '2026-10 ', 'year-month', 202610, true]) {
    assert.match(validateAnalyticsRange(invalid, '2026-10', now), /valid months in YYYY-MM format/i, `Invalid start month ${invalid}`);
    assert.match(validateAnalyticsRange('2026-01', invalid, now), /valid months in YYYY-MM format/i, `Invalid end month ${invalid}`);
  }
  assert.equal(validateAnalyticsRange('0001-01', '0001-01', now), '');
});

test('Reversed dates and future months are rejected', () => {
  assert.match(validateAnalyticsRange('2026-10', '2026-09', now), /on or before/i);
  assert.match(validateAnalyticsRange('2026-10', '2026-11', now), /current month/i);
  assert.match(validateAnalyticsRange('2027-01', '2027-02', now), /current month/i);
  assert.match(validateAnalyticsRange('2026-03', '2026-03', new Date('2026-03-01T00:15:00+14:00')), /current month/i);
});

test('Single-month, rollover, and ranges longer than twelve months are valid', () => {
  assert.equal(validateAnalyticsRange('2026-10', '2026-10', now), '');
  assert.equal(validateAnalyticsRange('2025-12', '2026-01', now), '');
  assert.equal(validateAnalyticsRange('2025-01', '2026-10', now), '');
  assert.equal(validateAnalyticsRange('2026-02', '2026-02', new Date('2026-03-01T00:15:00+14:00')), '');
});

test('The maximum range is 120 calendar months inclusive', () => {
  assert.equal(validateAnalyticsRange('2016-11', '2026-10', now), '');
  assert.match(validateAnalyticsRange('2016-10', '2026-10', now), /10 years or less \(120 months\)/i);
  assert.equal(validateAnalyticsRange('0001-01', '0010-12', now), '');
  assert.match(validateAnalyticsRange('0001-01', '0011-01', now), /120 months/i);
});
