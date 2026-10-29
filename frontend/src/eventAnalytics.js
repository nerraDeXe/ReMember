import { getEventDates } from '../../shared/events.js';
import { getEventTiming } from '../../shared/eventTiming.js';

function validDate(value) {
  try { return typeof value === 'string' && getEventDates(value).length === 1; }
  catch { return false; }
}

function registrationTime(value, now) {
  if (typeof value !== 'string') return null;
  const match = value.match(/^(\d{4}-\d{2}-\d{2})(?:T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,9})?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d))?$/);
  if (!match || !validDate(match[1])) return null;
  const timestamp = Date.parse(value.length === 10 ? `${value}T00:00:00.000Z` : value);
  return Number.isFinite(timestamp) && timestamp <= now.getTime() ? timestamp : null;
}

function rosterFor(event, now) {
  const roster = [];
  const members = new Map();
  for (const rsvp of Array.isArray(event.rsvps) ? event.rsvps : []) {
    if (!rsvp || typeof rsvp !== 'object') continue;
    const userId = typeof rsvp.userId === 'string' || typeof rsvp.userId === 'number' ? String(rsvp.userId).trim() : '';
    const timestamp = registrationTime(rsvp.rsvpDate, now);
    if (userId && members.has(userId)) {
      const existing = members.get(userId);
      if (timestamp !== null && (existing.timestamp === null || timestamp < existing.timestamp)) existing.timestamp = timestamp;
      continue;
    }
    const registration = { timestamp };
    roster.push(registration);
    if (userId) members.set(userId, registration);
  }
  return roster;
}

/** Monthly trends describe the current roster; cancelled RSVPs are not recoverable history. */
export function buildEventAnalytics(events, { now = new Date(), months = 6, scope = 'all' } = {}) {
  const timestamp = new Date(now);
  const current = Number.isFinite(timestamp.getTime()) ? timestamp : new Date();
  const monthCount = [3, 6, 12].includes(months) ? months : 6;
  const selectedScope = ['all', 'upcoming', 'past'].includes(scope) ? scope : 'all';
  const registrationTrend = Array.from({ length: monthCount }, (_, index) => {
    const date = new Date(current);
    date.setUTCDate(1);
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCMonth(current.getUTCMonth() - monthCount + 1 + index);
    return { month: date.toISOString().slice(0, 7), label: date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' }), registrations: 0 };
  });
  const monthsByKey = new Map(registrationTrend.map(month => [month.month, month]));
  const records = (Array.isArray(events) ? events : []).filter(event => event && typeof event === 'object').map((event, index) => {
    const period = getEventTiming(event, current);
    const roster = rosterFor(event, current);
    const capacity = Number.isInteger(Number(event.capacity)) && Number(event.capacity) > 0 ? Number(event.capacity) : null;
    return { roster, hasPeriod: period.hasPeriod, total: {
      id: String(event._id || event.id || `event-${index}`), title: typeof event.title === 'string' && event.title.trim() ? event.title : 'Untitled event',
      rsvpCount: roster.length, capacity, remainingPlaces: capacity === null ? null : Math.max(0, capacity - roster.length),
      startDate: period.startDate, endDate: period.endDate, timeZone: period.timeZone, upcoming: period.upcoming,
    } };
  });
  const selected = records.filter(record => selectedScope === 'all' || (selectedScope === 'upcoming' ? record.total.upcoming : record.hasPeriod && !record.total.upcoming));
  let undatedRegistrations = 0;
  let totalRsvps = 0;
  for (const record of selected) {
    totalRsvps += record.roster.length;
    for (const { timestamp: registeredAt } of record.roster) {
      if (registeredAt === null) { undatedRegistrations++; continue; }
      const month = monthsByKey.get(new Date(registeredAt).toISOString().slice(0, 7));
      if (month) month.registrations++;
    }
  }
  return { upcomingEvents: records.filter(record => record.total.upcoming).length,
    eventTotals: selected.map(record => record.total).sort((a, b) => (a.startDate || '9999').localeCompare(b.startDate || '9999') || a.title.localeCompare(b.title)),
    registrationTrend, totalRsvps, undatedRegistrations };
}
