const SUPPORTED_MONTHS = [3, 6, 12];
const MAX_RANGE_MONTHS = 120;
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const NOT_PROVIDED = 'Not provided';

export function dashboardMonths(value) {
  if (value === undefined) return 6;
  return (typeof value === 'string' && SUPPORTED_MONTHS.map(String).includes(value)) || (typeof value === 'number' && SUPPORTED_MONTHS.includes(value)) ? Number(value) : null;
}

function monthDate(year, month) {
  const date = new Date(0);
  date.setUTCFullYear(year, month, 1);
  return date;
}

function monthIndex(value) {
  if (typeof value !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return null;
  const year = Number(value.slice(0, 4));
  return year >= 1 ? year * 12 + Number(value.slice(5)) - 1 : null;
}

/** Resolves the inclusive month selection before any database reads. */
export function dashboardPeriod({ months, startMonth, endMonth } = {}, now = new Date()) {
  const currentTime = timestamp(now);
  if (currentTime === null) throw new RangeError('now must be a valid date.');
  const current = new Date(currentTime);
  const currentIndex = current.getUTCFullYear() * 12 + current.getUTCMonth();
  const hasRange = startMonth !== undefined || endMonth !== undefined;
  let count, firstMonth, end;
  if (hasRange) {
    if (months !== undefined) throw new RangeError('Use either months or startMonth/endMonth, not both.');
    if (startMonth === undefined || endMonth === undefined) throw new RangeError('Provide both startMonth and endMonth.');
    const startIndex = monthIndex(startMonth);
    const endIndex = monthIndex(endMonth);
    if (startIndex === null || endIndex === null) throw new RangeError('startMonth and endMonth must use YYYY-MM with a valid year and month.');
    if (startIndex > endIndex) throw new RangeError('startMonth must be on or before endMonth.');
    if (endIndex > currentIndex) throw new RangeError('Month range cannot include future months.');
    count = endIndex - startIndex + 1;
    if (count > MAX_RANGE_MONTHS) throw new RangeError('Select a range of 120 months or fewer.');
    firstMonth = monthDate(Math.floor(startIndex / 12), startIndex % 12);
    const nextMonth = monthDate(Math.floor(endIndex / 12), endIndex % 12 + 1);
    end = Math.min(currentTime, nextMonth.getTime() - 1);
  } else {
    count = dashboardMonths(months);
    if (count === null) throw new RangeError('months must be 3, 6, or 12.');
    firstMonth = monthDate(current.getUTCFullYear(), current.getUTCMonth() - count + 1);
    end = currentTime;
  }
  return { months: count, start: firstMonth.toISOString(), end: new Date(end).toISOString(), timeZone: 'UTC' };
}

function timestamp(value) {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : null;
  if (typeof value !== 'string' || !value.trim()) return null;
  // Date-only strings and timezone-less ISO timestamps are interpreted in UTC.
  const input = value.trim();
  const parts = input.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/);
  if (!parts) return null;
  const [, year, month, day, hour, minute, second, zone] = parts;
  const monthDays = new Date(Date.UTC(Number(year) + 400, Number(month), 0)).getUTCDate();
  // Date.parse otherwise silently rolls dates such as February 30 into March.
  if (Number(month) < 1 || Number(month) > 12 || Number(day) < 1 || Number(day) > monthDays || Number(hour || 0) > 23 || Number(minute || 0) > 59 || Number(second || 0) > 59) return null;
  const normalized = hour && !zone ? `${input}Z` : input;
  const result = Date.parse(normalized);
  return Number.isFinite(result) ? result : null;
}

function recordTime(record, preferred, fallback) {
  return timestamp(record[preferred]) ?? timestamp(record[fallback]);
}

function label(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : NOT_PROVIDED;
}

function distribution(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  return [...counts].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
}

function amountCents(value) {
  if ((typeof value !== 'number' && typeof value !== 'string') || (typeof value === 'string' && !value.trim())) return 0;
  const number = Number(value);
  const cents = Math.round(number * 100);
  return Number.isFinite(number) && number >= 0 && Number.isSafeInteger(cents) ? cents : 0;
}

/**
 * Aggregates an organisation's current roster and invoices without exposing accounts.
 * Roster history reflects current memberships by join date, not historical active status.
 * Revenue is paid USD invoices; payment counts include every currency.
 */
export function buildDashboardAnalytics({ memberships = [], users = [], invoices = [], months: requestedMonths, startMonth, endMonth, now = new Date() } = {}) {
  const period = dashboardPeriod({ months: requestedMonths, startMonth, endMonth }, now);
  const { months } = period;
  const end = Date.parse(period.end);
  const firstMonth = new Date(period.start);
  const start = firstMonth.getTime();
  const previousStart = monthDate(firstMonth.getUTCFullYear(), firstMonth.getUTCMonth() - months).getTime();
  const buckets = Array.from({ length: months }, (_, index) => {
    const date = monthDate(firstMonth.getUTCFullYear(), firstMonth.getUTCMonth() + index);
    return { month: date.toISOString().slice(0, 7), label: MONTH_LABELS[date.getUTCMonth()] };
  });
  const membershipTrend = buckets.map(bucket => ({ ...bucket, newMembers: 0, totalMembers: 0 }));
  const paymentTrend = buckets.map(bucket => ({ ...bucket, revenue: 0, paidPayments: 0, failedPayments: 0 }));
  const indexByMonth = new Map(buckets.map((bucket, index) => [bucket.month, index]));
  const summary = { newMembers: 0, previousNewMembers: 0, revenue: 0, previousRevenue: 0, paidPayments: 0, previousPaidPayments: 0 };
  const roster = memberships.filter(membership => membership.role === 'member');
  let earlierMembers = 0;
  for (const membership of roster) {
    const joined = recordTime(membership, 'joinedDate', 'createdAt');
    if (joined === null || joined > end) continue;
    if (joined < start) {
      earlierMembers++;
      if (joined >= previousStart) summary.previousNewMembers++;
    } else {
      membershipTrend[indexByMonth.get(new Date(joined).toISOString().slice(0, 7))].newMembers++;
      summary.newMembers++;
    }
  }
  let totalMembers = earlierMembers;
  for (const month of membershipTrend) month.totalMembers = totalMembers += month.newMembers;

  let excludedCurrencyPayments = 0;
  for (const invoice of invoices) {
    const paid = invoice.paymentStatus === 'paid';
    if (!paid && invoice.paymentStatus !== 'failed') continue;
    const date = paid ? recordTime(invoice, 'paidAt', 'createdAt') : timestamp(invoice.createdAt);
    if (date === null || date < previousStart || date > end) continue;
    const usd = !invoice.currency || String(invoice.currency).trim().toUpperCase() === 'USD';
    const revenue = paid && usd ? amountCents(invoice.amount) : 0;
    if (date < start) {
      if (paid) {
        summary.previousPaidPayments++;
        summary.previousRevenue += revenue;
      }
      continue;
    }
    const bucket = paymentTrend[indexByMonth.get(new Date(date).toISOString().slice(0, 7))];
    if (paid) {
      bucket.paidPayments++;
      bucket.revenue += revenue;
      summary.paidPayments++;
      summary.revenue += revenue;
      if (!usd) excludedCurrencyPayments++;
    } else bucket.failedPayments++;
  }
  for (const bucket of paymentTrend) bucket.revenue /= 100;
  summary.revenue /= 100;
  summary.previousRevenue /= 100;
  const usersById = new Map(users.map(user => [String(user._id), user]));
  const countries = roster.map(membership => {
    const user = usersById.get(String(membership.userId));
    return label(user?.country) === NOT_PROVIDED ? label(user?.address?.country) : label(user.country);
  });
  return {
    success: true,
    period,
    membershipTrend,
    paymentTrend,
    demographics: { countries: distribution(countries), tiers: distribution(roster.map(member => label(member.tierName))), statuses: distribution(roster.map(member => label(member.status))) },
    summary,
    currency: 'USD',
    excludedCurrencyPayments
  };
}
