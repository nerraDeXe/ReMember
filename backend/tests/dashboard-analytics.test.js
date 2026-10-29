import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import jwt from 'jsonwebtoken';
import { buildDashboardAnalytics, dashboardMonths, dashboardPeriod } from '../services/dashboardAnalytics.js';
import { config } from '../config/config.js';
import { User, Organisation, OrganisationMembership, Invoice } from '../models/index.js';
import adminRouter from '../routes/admin.js';

const now = new Date('2026-01-15T12:00:00Z');
const member = (joinedDate, fields = {}) => ({ role: 'member', userId: 'member', status: 'active', tierName: 'Community', joinedDate, ...fields });
const paid = (createdAt, amount, fields = {}) => ({ paymentStatus: 'paid', currency: 'MYR', createdAt, amount, ...fields });

test('Analytics periods validate exact supported month values and default to six', () => {
  assert.equal(dashboardMonths(), 6);
  for (const months of [3, 6, 12]) {
    assert.equal(dashboardMonths(months), months);
    assert.equal(dashboardMonths(String(months)), months);
  }
  for (const invalid of ['', null, '6x', '6.0', '06', ' 6 ', 1, 24, [], ['6'], {}]) assert.equal(dashboardMonths(invalid), null);
});

test('Empty analytics zero-fill periods across year boundaries', () => {
  const result = buildDashboardAnalytics({ months: 3, now });
  assert.deepEqual(result.period, { months: 3, start: '2025-11-01T00:00:00.000Z', end: now.toISOString(), timeZone: 'UTC' });
  assert.deepEqual(result.membershipTrend, [
    { month: '2025-11', label: 'Nov', newMembers: 0, totalMembers: 0 },
    { month: '2025-12', label: 'Dec', newMembers: 0, totalMembers: 0 },
    { month: '2026-01', label: 'Jan', newMembers: 0, totalMembers: 0 }
  ]);
  assert.ok(result.paymentTrend.every(month => month.revenue === 0 && month.paidPayments === 0 && month.failedPayments === 0));
  assert.deepEqual(result.demographics, { countries: [], tiers: [], statuses: [] });
  for (const months of [6, 12]) assert.equal(buildDashboardAnalytics({ months, now }).membershipTrend.length, months);
});

test('Explicit month ranges include single months, year boundaries, and up to 120 months', () => {
  const single = buildDashboardAnalytics({ startMonth: '2025-11', endMonth: '2025-11', now });
  assert.deepEqual(single.period, { months: 1, start: '2025-11-01T00:00:00.000Z', end: '2025-11-30T23:59:59.999Z', timeZone: 'UTC' });
  assert.deepEqual(single.membershipTrend, [{ month: '2025-11', label: 'Nov', newMembers: 0, totalMembers: 0 }]);
  const longer = buildDashboardAnalytics({ startMonth: '2024-10', endMonth: '2025-12', now });
  assert.equal(longer.period.months, 15);
  assert.equal(longer.membershipTrend.length, 15);
  assert.equal(longer.paymentTrend.length, 15);
  assert.equal(longer.membershipTrend[0].month, '2024-10');
  assert.equal(longer.membershipTrend.at(-1).month, '2025-12');
  assert.equal(longer.period.end, '2025-12-31T23:59:59.999Z');
  const maximum = buildDashboardAnalytics({ startMonth: '2016-02', endMonth: '2026-01', now });
  assert.equal(maximum.period.months, 120);
  assert.equal(maximum.membershipTrend.length, 120);
  assert.equal(maximum.period.end, now.toISOString());
  assert.equal(dashboardPeriod({ startMonth: '2024-02', endMonth: '2024-02' }, now).end, '2024-02-29T23:59:59.999Z');
  assert.equal(dashboardPeriod({ startMonth: '0001-01', endMonth: '0001-01' }, now).start, '0001-01-01T00:00:00.000Z');
});

test('Month ranges reject missing, malformed, reversed, future, oversized, and ambiguous selections', () => {
  for (const selection of [
    { startMonth: '2025-01' }, { endMonth: '2025-01' },
    { startMonth: '', endMonth: '' }, { startMonth: null, endMonth: null },
    { startMonth: '2025-00', endMonth: '2025-01' }, { startMonth: '2025-01', endMonth: '2025-13' },
    { startMonth: '2025-1', endMonth: '2025-02' }, { startMonth: '2025-01-01', endMonth: '2025-02' },
    { startMonth: '2025-01', endMonth: '2025-02 ' }, { startMonth: '0000-01', endMonth: '0000-02' },
    { startMonth: ['2025-01'], endMonth: '2025-02' }, { startMonth: {}, endMonth: '2025-02' }
  ]) assert.throws(() => dashboardPeriod(selection, now), RangeError);
  assert.throws(() => dashboardPeriod({ startMonth: '2025-12', endMonth: '2025-11' }, now), /on or before/);
  assert.throws(() => dashboardPeriod({ startMonth: '2026-01', endMonth: '2026-02' }, now), /future/);
  assert.throws(() => dashboardPeriod({ startMonth: '2026-02', endMonth: '2026-02' }, now), /future/);
  assert.throws(() => dashboardPeriod({ startMonth: '2016-01', endMonth: '2026-01' }, now), /120 months/);
  assert.throws(() => dashboardPeriod({ months: 6, startMonth: '2025-01', endMonth: '2025-02' }, now), /not both/);
  assert.throws(() => dashboardPeriod({ months: 6, startMonth: '2025-01' }, now), /not both/);
  assert.throws(() => buildDashboardAnalytics({ startMonth: '2025-01', endMonth: '2025-13', now }), RangeError);
});

test('Historical range ends include the final millisecond and exclude later joins and payments', () => {
  const memberships = [
    member('2025-09-30T23:59:59.999Z'),
    member('2025-10-01T00:00:00Z'),
    member('2025-10-31T23:59:59.999Z'),
    member('2025-11-01T00:00:00Z'),
    member('2025-11-30T23:59:59.999Z'),
    member('2025-12-01T00:00:00Z')
  ];
  const invoices = [
    paid('2025-09-30T23:59:59.999Z', 99),
    paid('2025-10-01T00:00:00Z', 3),
    paid('2025-10-31T23:59:59.999Z', 4),
    paid('2025-11-01T00:00:00Z', 5),
    paid('2025-11-30T23:59:59.999Z', 6),
    paid('2025-12-01T00:00:00Z', 999),
    paid('2025-11-20', 999, { paidAt: '2025-12-01' }),
    { paymentStatus: 'failed', createdAt: '2025-11-30T23:59:59.999Z' },
    { paymentStatus: 'failed', createdAt: '2025-12-01T00:00:00Z' }
  ];
  const result = buildDashboardAnalytics({ memberships, invoices, startMonth: '2025-11', endMonth: '2025-11', now });
  assert.deepEqual(result.membershipTrend, [{ month: '2025-11', label: 'Nov', newMembers: 2, totalMembers: 5 }]);
  assert.deepEqual(result.paymentTrend, [{ month: '2025-11', label: 'Nov', revenue: 11, paidPayments: 2, failedPayments: 1 }]);
  assert.deepEqual(result.summary, { newMembers: 2, previousNewMembers: 2, revenue: 11, previousRevenue: 7, paidPayments: 2, previousPaidPayments: 2 });
  assert.deepEqual(result.demographics.statuses, [{ name: 'active', value: 6 }]);
});

test('Explicit ranges ending this month stop at now and use equally long previous month windows', () => {
  const result = buildDashboardAnalytics({
    startMonth: '2025-12', endMonth: '2026-01', now,
    memberships: [member('2025-10-01'), member('2025-11-30T23:59:59.999Z'), member('2025-12-01'), member(now.toISOString()), member('2026-01-15T12:00:00.001Z')],
    invoices: [paid('2025-10-01', 2), paid('2025-11-30T23:59:59.999Z', 3), paid('2025-12-01', 4), paid(now.toISOString(), 5), paid('2026-01-15T12:00:00.001Z', 999)]
  });
  assert.equal(result.period.end, now.toISOString());
  assert.equal(result.period.months, 2);
  assert.deepEqual(result.membershipTrend.map(month => [month.newMembers, month.totalMembers]), [[1, 3], [1, 4]]);
  assert.deepEqual(result.summary, { newMembers: 2, previousNewMembers: 2, revenue: 9, previousRevenue: 5, paidPayments: 2, previousPaidPayments: 2 });
});

test('Membership trends use organisation join dates, retain earlier roster counts, and exclude owners and future joins', () => {
  const memberships = [
    member('2025-01-01'),
    member('2025-10-31T23:59:59.999Z'),
    member('2025-11-01T00:00:00Z', { status: 'pending' }),
    member('2025-12-10', { status: 'expired' }),
    member('2026-01-15T12:00:00Z'),
    member('2026-01-15T12:00:00.001Z'),
    member('2025-11-15', { role: 'owner' }),
    member('invalid', { createdAt: new Date('2025-12-20T00:00:00Z') }),
    member('', { createdAt: '2026-01-02T00:00:00Z' }),
    member('invalid')
  ];
  const result = buildDashboardAnalytics({ memberships, months: 3, now });
  assert.deepEqual(result.membershipTrend.map(month => [month.newMembers, month.totalMembers]), [[1, 3], [2, 5], [2, 7]]);
  assert.equal(result.summary.newMembers, 5);
  assert.equal(result.summary.previousNewMembers, 1);
  assert.equal(result.demographics.statuses.reduce((sum, row) => sum + row.value, 0), 9);
});

test('Payments use settlement date with creation fallback, track failures, and respect period boundaries', () => {
  const invoices = [
    paid('2025-10-30', 25, { paidAt: '2025-11-01T00:00:00Z' }),
    paid('2025-12-01', 10),
    paid('2025-12-02', '0.10', { paidAt: 'invalid' }),
    paid('2025-12-03', 0.2),
    paid('2026-01-15T12:00:00Z', 4),
    paid('2026-01-15T12:00:00.001Z', 500),
    paid('2026-01-02', 500, { paidAt: '2026-02-01' }),
    paid('2025-08-01T00:00:00Z', 12),
    paid('2025-10-31T23:59:59.999Z', 8),
    paid('2025-07-31T23:59:59.999Z', 800),
    { paymentStatus: 'failed', createdAt: '2025-11-10', paidAt: '2025-12-10', amount: 90 },
    { paymentStatus: 'pending', createdAt: '2025-11-10', amount: 90 },
    paid('invalid', 900)
  ];
  const result = buildDashboardAnalytics({ invoices, months: 3, now });
  assert.deepEqual(result.paymentTrend.map(month => [month.revenue, month.paidPayments, month.failedPayments]), [[25, 1, 1], [10.3, 3, 0], [4, 1, 0]]);
  assert.deepEqual(result.summary, { newMembers: 0, previousNewMembers: 0, revenue: 39.3, previousRevenue: 20, paidPayments: 5, previousPaidPayments: 2 });
});

test('Analytics use UTC for offset and timezone-less ISO timestamps', () => {
  const result = buildDashboardAnalytics({ now, months: 3, memberships: [member('2025-11-01T01:00:00+08:00'), member('2025-11-30T23:30:00-02:00'), member('2025-12-01T00:30:00')], invoices: [paid('2025-11-30T23:30:00-02:00', 5)] });
  assert.deepEqual(result.membershipTrend.map(month => month.newMembers), [0, 2, 0]);
  assert.equal(result.summary.previousNewMembers, 1);
  assert.equal(result.paymentTrend[1].revenue, 5);
});

test('Malformed calendar dates and non-ISO strings do not create phantom trend entries', () => {
  const invalidDates = ['2025-11-31', '2025-12-32', '2025-12-00', '2025-00-01', '2025-12-01T24:00:00', '0', 'Nov 30 2025', new Date(NaN)];
  const result = buildDashboardAnalytics({ memberships: invalidDates.map(date => member(date)), invoices: invalidDates.map(date => paid(date, 999)), months: 3, now });
  assert.equal(result.summary.newMembers, 0);
  assert.equal(result.summary.previousNewMembers, 0);
  assert.equal(result.summary.paidPayments, 0);
  assert.equal(result.summary.revenue, 0);
});

test('Revenue ignores malformed amounts and foreign currencies while counts retain paid invoices', () => {
  const invoices = [NaN, Infinity, -5, 'invalid', null, '', {}, true, Number.MAX_VALUE].map(amount => paid('2025-12-10', amount));
  invoices.push(paid('2025-12-10', 999, { currency: 'USD' }), paid('2025-12-10', 2.5, { currency: 'myr' }), paid('2025-12-10', 1.25, { currency: undefined }));
  const result = buildDashboardAnalytics({ invoices, months: 3, now });
  assert.equal(result.summary.revenue, 2.5);
  assert.equal(result.summary.paidPayments, invoices.length);
  assert.equal(result.currency, 'MYR');
  assert.equal(result.excludedCurrencyPayments, 2);
  assert.ok(!JSON.stringify(result).includes('null'));
});

test('Admin status analytics count cancellation decisions without changing remaining member access', () => {
  const memberships = [
    member('2026-01-01', { status: 'active', cancelAtPeriodEnd: true, expirationDate: '2099-01-01T00:00:00Z' }),
    member('2026-01-01', { status: 'active', cancelAtPeriodEnd: true, expirationDate: '2020-01-01T00:00:00Z' }),
    member('2026-01-01', { status: 'cancelled' }), member('2026-01-01'),
    member('2026-01-01', { status: 'suspended', cancelAtPeriodEnd: true })
  ];
  const result = buildDashboardAnalytics({ memberships, now: new Date('2026-10-28T00:00:00Z') });
  assert.deepEqual(result.demographics.statuses, [{ name: 'cancelled', value: 3 }, { name: 'active', value: 1 }, { name: 'suspended', value: 1 }]);
  assert.equal(memberships[0].status, 'active');
});

test('Demographics use current organisation tier and status, country fallback, and explicit unknown values', () => {
  const memberships = [member('2025-01-01', { userId: 'a' }), member('2025-01-01', { userId: 'b', status: 'pending', tierName: 'Supporter' }), member('invalid', { userId: 'c', status: '', tierName: ' ' }), member('2025-01-01', { userId: 'missing' }), member('2025-01-01', { userId: 'owner', role: 'owner' })];
  const users = [
    { _id: 'a', country: ' Malaysia ', address: { country: 'Ignored' }, email: 'PRIVATE_EMAIL', name: 'PRIVATE_NAME' },
    { _id: 'b', country: ' ', address: { country: 'Singapore' }, tierName: 'Wrong account tier', status: 'revoked' },
    { _id: 'c' }, { _id: 'owner', country: 'Excluded owner country' }
  ];
  const result = buildDashboardAnalytics({ memberships, users, months: 3, now });
  assert.deepEqual(result.demographics.countries, [{ name: 'Not provided', value: 2 }, { name: 'Malaysia', value: 1 }, { name: 'Singapore', value: 1 }]);
  assert.deepEqual(result.demographics.tiers, [{ name: 'Community', value: 2 }, { name: 'Not provided', value: 1 }, { name: 'Supporter', value: 1 }]);
  assert.deepEqual(result.demographics.statuses, [{ name: 'active', value: 2 }, { name: 'Not provided', value: 1 }, { name: 'pending', value: 1 }]);
  assert.ok(!JSON.stringify(result).includes('PRIVATE_'));
});

const models = { User, Organisation, OrganisationMembership, Invoice };
const originals = [];
let records, findCalls;
const matches = (record, filter = {}) => Object.entries(filter).every(([key, expected]) => expected && typeof expected === 'object' && '$in' in expected ? expected.$in.includes(record[key]) : record[key] === expected);
function query(value) {
  return {
    select() { return this; },
    async lean() { return structuredClone(value); },
    then(resolve, reject) { return Promise.resolve(structuredClone(value)).then(resolve, reject); }
  };
}
before(() => {
  for (const [name, model] of Object.entries(models)) {
    for (const [method, replacement] of Object.entries({
      find(filter) { findCalls.push({ model: name, filter: structuredClone(filter) }); return query(records[name].filter(row => matches(row, filter))); },
      findById(id) { return query(records[name].find(row => row._id === id) || null); }
    })) {
      originals.push([model, method, model[method]]);
      model[method] = replacement;
    }
  }
});
after(() => { for (const [model, method, original] of originals.reverse()) model[method] = original; });
beforeEach(() => {
  findCalls = [];
  records = {
    User: [
      { _id: 'ownerA', name: 'Owner A', emailVerified: true, status: 'active', activeOrganisationId: 'A', country: 'Excluded country' },
      { _id: 'ownerB', name: 'Owner B', emailVerified: true, status: 'active', activeOrganisationId: 'B' },
      { _id: 'memberA', name: 'PRIVATE_MEMBER_A', email: 'PRIVATE_EMAIL', emailVerified: true, status: 'active', activeOrganisationId: 'A', country: 'Malaysia' },
      { _id: 'memberB', name: 'PRIVATE_MEMBER_B', emailVerified: true, status: 'active', activeOrganisationId: 'B', country: 'FOREIGN_COUNTRY' }
    ],
    Organisation: [{ _id: 'A', adminId: 'ownerA', name: 'A' }, { _id: 'B', adminId: 'ownerB', name: 'B' }],
    OrganisationMembership: [
      member('2020-01-01', { userId: 'ownerA', organisationId: 'A', role: 'owner' }),
      member('2020-01-01', { userId: 'ownerA', organisationId: 'B' }),
      member('2020-01-01', { userId: 'memberA', organisationId: 'A' }),
      member('2020-01-01', { userId: 'memberB', organisationId: 'B', tierName: 'FOREIGN_TIER' })
    ],
    Invoice: [paid(new Date().toISOString(), 25, { organisationId: 'A', userEmail: 'PRIVATE_EMAIL' }), paid(new Date().toISOString(), 99999, { organisationId: 'B' })]
  };
});

function request({ userId = 'ownerA', months, startMonth, endMonth } = {}) {
  const route = adminRouter.stack.find(layer => layer.route?.path === '/dashboard-analytics').route;
  const handlers = [...adminRouter.stack.filter(layer => !layer.route).map(layer => layer.handle), ...route.stack.map(layer => layer.handle)];
  const selection = Object.fromEntries(Object.entries({ months, startMonth, endMonth }).filter(([, value]) => value !== undefined));
  const req = { query: selection, headers: userId ? { authorization: `Bearer ${jwt.sign({ id: userId }, config.JWT_SECRET)}` } : {}, method: 'GET', originalUrl: '/dashboard-analytics' };
  return new Promise((resolve, reject) => {
    let status = 200;
    const res = { status(value) { status = value; return this; }, json(body) { resolve({ status, body: JSON.parse(JSON.stringify(body)) }); } };
    let index = 0;
    const next = error => {
      if (error) return reject(error);
      const handler = handlers[index++];
      if (!handler) return reject(new Error('Route did not respond'));
      Promise.resolve(handler(req, res, next)).catch(reject);
    };
    next();
  });
}

test('Analytics endpoint enforces authentication, verified email, and selected organisation ownership', async () => {
  assert.equal((await request({ userId: null })).status, 401);
  assert.equal((await request({ userId: 'memberA' })).status, 403);
  records.User[0].activeOrganisationId = 'B';
  assert.equal((await request()).status, 403);
  records.User[0].activeOrganisationId = 'A';
  records.User[0].emailVerified = false;
  assert.equal((await request()).status, 403);
  assert.ok(!findCalls.some(call => call.model === 'Invoice'));
});

test('Analytics endpoint scopes every aggregate to the selected organisation and exposes no member or invoice details', async () => {
  const result = await request({ months: '3' });
  assert.equal(result.status, 200);
  assert.equal(result.body.period.months, 3);
  assert.equal(result.body.membershipTrend.at(-1).totalMembers, 1);
  assert.equal(result.body.summary.revenue, 25);
  assert.deepEqual(result.body.demographics.countries, [{ name: 'Malaysia', value: 1 }]);
  assert.deepEqual(findCalls.find(call => call.model === 'Invoice').filter, { organisationId: 'A' });
  assert.ok(findCalls.some(call => call.model === 'OrganisationMembership' && call.filter.organisationId === 'A' && call.filter.role === 'member'));
  const serialized = JSON.stringify(result.body);
  for (const privateValue of ['PRIVATE_', 'FOREIGN_', 'memberA', 'ownerA', 'userEmail', 'invoiceNumber', 'Excluded country']) assert.ok(!serialized.includes(privateValue));
});

test('Analytics endpoint defaults to six months and rejects invalid inputs before reading invoices', async () => {
  assert.equal((await request()).body.period.months, 6);
  findCalls = [];
  for (const months of ['all', '6x', '0', '24', ['3'], {}]) assert.equal((await request({ months })).status, 400);
  assert.ok(!findCalls.some(call => call.model === 'Invoice'));
});

test('Analytics endpoint accepts historical month ranges without changing organisation isolation', async () => {
  records.Invoice = [paid('2025-11-30T23:59:59.999Z', 12, { organisationId: 'A' }), paid('2025-12-01', 888, { organisationId: 'A' }), paid('2025-11-01', 99999, { organisationId: 'B' })];
  const result = await request({ startMonth: '2025-11', endMonth: '2025-11' });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.period, { months: 1, start: '2025-11-01T00:00:00.000Z', end: '2025-11-30T23:59:59.999Z', timeZone: 'UTC' });
  assert.equal(result.body.summary.revenue, 12);
  assert.equal(result.body.summary.paidPayments, 1);
  assert.equal(result.body.membershipTrend[0].totalMembers, 1);
  assert.deepEqual(findCalls.find(call => call.model === 'Invoice').filter, { organisationId: 'A' });
  assert.equal((await request({ userId: 'memberA', startMonth: '2025-11', endMonth: '2025-11' })).status, 403);
});

test('Analytics endpoint returns clear 400 errors for invalid ranges before reading analytics records', async () => {
  for (const [selection, message] of [
    [{ startMonth: '2025-01' }, /both startMonth and endMonth/],
    [{ endMonth: '2025-01' }, /both startMonth and endMonth/],
    [{ startMonth: '2025-00', endMonth: '2025-01' }, /YYYY-MM/],
    [{ startMonth: '2025-01', endMonth: '2025-13' }, /YYYY-MM/],
    [{ startMonth: ['2025-01'], endMonth: '2025-02' }, /YYYY-MM/],
    [{ startMonth: '2025-01', endMonth: '2024-12' }, /on or before/],
    [{ startMonth: '9999-12', endMonth: '9999-12' }, /future/],
    [{ startMonth: '2000-01', endMonth: '2020-01' }, /120 months/],
    [{ months: '6', startMonth: '2025-01', endMonth: '2025-02' }, /not both/]
  ]) {
    const result = await request(selection);
    assert.equal(result.status, 400);
    assert.equal(result.body.success, false);
    assert.match(result.body.message, message);
  }
  assert.ok(!findCalls.some(call => call.model === 'Invoice'));
  assert.ok(!findCalls.some(call => call.model === 'OrganisationMembership' && call.filter.organisationId));
});
