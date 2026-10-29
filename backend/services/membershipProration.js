const DAY = 24 * 60 * 60 * 1000;

export function dateMilliseconds(value) {
  if (value === undefined || value === null || value === '') return NaN;
  return new Date(value).getTime();
}

// Billing anniversaries keep the UTC time and clamp month-end and leap dates.
export function membershipPeriodEnd(start, interval) {
  const date = new Date(start);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  if (interval === 'monthly') date.setUTCMonth(date.getUTCMonth() + 1);
  else if (interval === 'yearly') date.setUTCFullYear(date.getUTCFullYear() + 1);
  else throw new RangeError('Unsupported membership interval.');
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return date.toISOString();
}

export function equivalentMonthlyCents(tier) {
  if (!Number.isFinite(tier?.price) || tier.price < 0 || !['monthly', 'yearly'].includes(tier.interval)) return NaN;
  const cents = Math.round(tier.price * 100);
  if (!Number.isSafeInteger(cents)) return NaN;
  return tier.interval === 'yearly' ? cents / 12 : cents;
}

export function membershipBillingRevision(membership) {
  return Number.isSafeInteger(membership.billingRevision) && membership.billingRevision >= 0 ? membership.billingRevision : 0;
}

export function membershipCreditBalance(membership) {
  return Number.isSafeInteger(membership.creditBalanceCents) && membership.creditBalanceCents > 0 ? membership.creditBalanceCents : 0;
}

// Credits use recorded, paid service value. Editable catalogue prices never
// establish a member's historical payment or increase a legacy credit.
export function paidMembershipPeriods(membership, invoices = []) {
  const endLimit = dateMilliseconds(membership.expirationDate);
  const stored = Array.isArray(membership.billingPeriods) && membership.billingPeriods.length > 0;
  const candidates = stored ? membership.billingPeriods : invoices.filter(invoice =>
    invoice.paymentStatus === 'paid' && invoice.currency === 'MYR' && invoice.category !== 'event_ticket'
      && String(invoice.userId) === String(membership.userId)
      && String(invoice.organisationId) === String(membership.organisationId)
      && String(invoice.tierId) === String(membership.tierId))
    .map(invoice => ({ tierId: invoice.tierId, periodStart: invoice.periodStart, periodEnd: invoice.periodEnd,
      billingInterval: invoice.billingInterval,
      valueCents: invoice.coverageValueCents ?? (Number.isFinite(invoice.amount) ? Math.round(invoice.amount * 100) : NaN) }));
  const periods = candidates.filter(period => String(period.tierId) === String(membership.tierId)
    && Number.isSafeInteger(period.valueCents) && period.valueCents >= 0
    && Number.isFinite(dateMilliseconds(period.periodStart)) && Number.isFinite(dateMilliseconds(period.periodEnd))
    && dateMilliseconds(period.periodEnd) > dateMilliseconds(period.periodStart)
    && Number.isFinite(endLimit) && dateMilliseconds(period.periodEnd) <= endLimit)
    .map(period => ({ tierId: String(period.tierId), periodStart: new Date(period.periodStart).toISOString(),
      periodEnd: new Date(period.periodEnd).toISOString(), valueCents: period.valueCents,
      billingInterval: period.billingInterval }));
  periods.sort((a, b) => a.periodStart.localeCompare(b.periodStart) || a.periodEnd.localeCompare(b.periodEnd) || b.valueCents - a.valueCents);
  // Historical duplicate/overlapping invoices cannot create duplicate credit.
  const result = [];
  for (const period of periods) {
    const start = dateMilliseconds(period.periodStart);
    const end = dateMilliseconds(period.periodEnd);
    const lastEnd = result.length ? dateMilliseconds(result.at(-1).periodEnd) : -Infinity;
    if (end <= lastEnd) continue;
    if (start < lastEnd) {
      result.push({ ...period, periodStart: new Date(lastEnd).toISOString(),
        valueCents: Math.round(period.valueCents * (end - lastEnd) / (end - start)) });
    } else result.push(period);
  }
  return result;
}

export function unusedMembershipCredit(periods, at) {
  const timestamp = dateMilliseconds(at);
  let creditCents = 0;
  for (const period of periods) {
    const start = dateMilliseconds(period.periodStart);
    const end = dateMilliseconds(period.periodEnd);
    if (end <= timestamp) continue;
    const fraction = Math.min(1, Math.max(0, (end - Math.max(timestamp, start)) / (end - start)));
    creditCents += Math.round(period.valueCents * fraction);
  }
  if (!Number.isSafeInteger(creditCents)) throw new RangeError('The membership credit is too large to calculate.');
  const active = periods.find(period => dateMilliseconds(period.periodStart) <= timestamp && dateMilliseconds(period.periodEnd) > timestamp);
  return { creditCents, previousPeriodStart: active?.periodStart,
    previousPeriodEnd: active?.periodEnd,
    remainingDays: active ? Math.round((dateMilliseconds(active.periodEnd) - timestamp) / DAY * 100) / 100 : 0,
    totalDays: active ? Math.round((dateMilliseconds(active.periodEnd) - dateMilliseconds(active.periodStart)) / DAY * 100) / 100 : 0 };
}
