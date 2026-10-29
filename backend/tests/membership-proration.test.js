import assert from 'node:assert/strict';
import { test } from 'node:test';
import { equivalentMonthlyCents, membershipPeriodEnd, paidMembershipPeriods, unusedMembershipCredit } from '../services/membershipProration.js';

const member = { userId: 'member', organisationId: 'org', tierId: 'basic', expirationDate: '2026-01-31T00:00:00.000Z' };
const paid = { userId: 'member', organisationId: 'org', tierId: 'basic', paymentStatus: 'paid', currency: 'MYR',
  periodStart: '2026-01-01T00:00:00.000Z', periodEnd: '2026-01-31T00:00:00.000Z', amount: 100, billingInterval: 'monthly' };

test('Credit uses the unused fraction of a recorded payment with cent rounding', () => {
  const periods = paidMembershipPeriods(member, [paid]);
  assert.deepEqual(unusedMembershipCredit(periods, '2026-01-16T00:00:00.000Z'), {
    creditCents: 5000, previousPeriodStart: paid.periodStart, previousPeriodEnd: paid.periodEnd, remainingDays: 15, totalDays: 30 });
  assert.equal(unusedMembershipCredit(periods, '2026-01-31T00:00:00.000Z').creditCents, 0);
  assert.equal(unusedMembershipCredit(periods, '2025-12-31T00:00:00.000Z').creditCents, 10000);
  assert.equal(unusedMembershipCredit(periods, '2026-01-30T00:00:00.000Z').creditCents, 333);
});

test('Unpaid, foreign, undated and unsupported-currency invoices never establish credit', () => {
  const invalid = [{ ...paid, paymentStatus: 'failed' }, { ...paid, paymentStatus: 'pending' },
    { ...paid, currency: 'USD' }, { ...paid, userId: 'another' }, { ...paid, organisationId: 'another' },
    { ...paid, tierId: 'another' }, { ...paid, category: 'event_ticket' }, { ...paid, periodStart: undefined }, { ...paid, periodEnd: 'invalid' },
    { ...paid, amount: -10 }, { ...paid, periodEnd: '2027-01-31T00:00:00.000Z' }];
  assert.deepEqual(paidMembershipPeriods(member, invalid), []);
});

test('Duplicate and overlapping historical invoices cannot multiply a credit', () => {
  const periods = paidMembershipPeriods(member, [paid, paid, { ...paid, periodStart: '2026-01-16T00:00:00.000Z', amount: 50 }]);
  assert.equal(periods.length, 1);
  assert.equal(unusedMembershipCredit(periods, '2026-01-16T00:00:00.000Z').creditCents, 5000);
});

test('Future prepaid periods contribute full value and current periods contribute only unused value', () => {
  const periods = paidMembershipPeriods({ ...member, expirationDate: '2026-02-28T00:00:00.000Z' }, [paid,
    { ...paid, periodStart: paid.periodEnd, periodEnd: '2026-02-28T00:00:00.000Z' }]);
  assert.equal(unusedMembershipCredit(periods, '2026-01-16T00:00:00.000Z').creditCents, 15000);
});

test('A stored service-value ledger supersedes invoices after a discounted upgrade', () => {
  const periods = paidMembershipPeriods({ ...member, billingPeriods: [{ tierId: 'basic', periodStart: paid.periodStart,
    periodEnd: paid.periodEnd, valueCents: 20000, billingInterval: 'monthly' }] }, [{ ...paid, amount: 150 }]);
  assert.equal(unusedMembershipCredit(periods, '2026-01-16T00:00:00.000Z').creditCents, 10000);
});

test('Billing cycles handle month-end, leap years and equivalent monthly ordering', () => {
  assert.equal(membershipPeriodEnd('2026-01-31T12:00:00.000Z', 'monthly'), '2026-02-28T12:00:00.000Z');
  assert.equal(membershipPeriodEnd('2028-02-29T12:00:00.000Z', 'yearly'), '2029-02-28T12:00:00.000Z');
  assert.equal(equivalentMonthlyCents({ price: 120, interval: 'yearly' }), 1000);
  assert.equal(equivalentMonthlyCents({ price: 20, interval: 'monthly' }), 2000);
  assert.ok(Number.isNaN(equivalentMonthlyCents({ price: Infinity, interval: 'monthly' })));
  assert.throws(() => membershipPeriodEnd(paid.periodStart, 'weekly'), RangeError);
});
