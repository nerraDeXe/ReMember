export const EVENT_MAX_DAYS = 31;
export const DEFAULT_EVENT_TIME_ZONE = 'Asia/Kuala_Lumpur';

const DAY_MS = 24 * 60 * 60 * 1000;

function dateTimestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
  const stamp = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(stamp) && new Date(stamp).toISOString().slice(0, 10) === value ? stamp : NaN;
}

export function getEventDates(startDate, endDate = startDate) {
  const start = dateTimestamp(startDate);
  const end = dateTimestamp(endDate);
  if (!Number.isFinite(start) || !Number.isFinite(end)) throw new Error('Choose valid start and end dates.');
  if (end < start) throw new Error('The end date must be on or after the start date.');
  const count = (end - start) / DAY_MS + 1;
  if (count > EVENT_MAX_DAYS) throw new Error(`Events can last up to ${EVENT_MAX_DAYS} days.`);
  return Array.from({ length: count }, (_, index) => new Date(start + index * DAY_MS).toISOString().slice(0, 10));
}

export function getEventSchedule(event = {}) {
  if (Array.isArray(event.schedule) && event.schedule.length) {
    return event.schedule.map(day => ({ date: day.date, startTime: day.startTime, endTime: day.endTime })).sort((a, b) => a.date.localeCompare(b.date));
  }
  // Keep old listings readable without inventing a time zone for their free text.
  const time = typeof event.time === 'string' ? event.time.match(/^(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})(?:\s|$)/) : null;
  return event.date ? [{ date: event.date, startTime: time ? time[1].padStart(5, '0') : '', endTime: time ? time[2].padStart(5, '0') : '', legacyTime: typeof event.time === 'string' ? event.time : '' }] : [];
}

function formattedDate(value, options = {}) {
  const stamp = dateTimestamp(value);
  return Number.isFinite(stamp) ? new Date(stamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC', ...options }) : value || '';
}

export function formatEventDateRange(event = {}) {
  const start = event.startDate || event.date || event.schedule?.[0]?.date;
  const end = event.endDate || start;
  return end && end !== start ? `${formattedDate(start)} – ${formattedDate(end)}` : formattedDate(start);
}

export function formatEventTimeRange(day = {}) {
  return day.legacyTime || (day.startTime && day.endTime ? `${day.startTime} – ${day.endTime}` : '');
}

export function hasEventCoordinates(event = {}) {
  return typeof event.locationLatitude === 'number' && Number.isFinite(event.locationLatitude) && event.locationLatitude >= -90 && event.locationLatitude <= 90
    && typeof event.locationLongitude === 'number' && Number.isFinite(event.locationLongitude) && event.locationLongitude >= -180 && event.locationLongitude <= 180;
}

export function getEventMapsUrl(event = {}) {
  const hasCoordinates = hasEventCoordinates(event);
  if (!hasCoordinates && (typeof event.location !== 'string' || !event.location.trim())) return '';
  const query = new URLSearchParams({ api: '1', query: hasCoordinates ? `${event.locationLatitude},${event.locationLongitude}` : event.location.trim() });
  if (!hasCoordinates && typeof event.locationPlaceId === 'string' && /^[A-Za-z0-9_-]{1,256}$/.test(event.locationPlaceId)) query.set('query_place_id', event.locationPlaceId);
  return `https://www.google.com/maps/search/?${query.toString()}`;
}

function tierRank(tier) {
  const price = Number(tier.price);
  return (Number.isFinite(price) ? price : 0) / (tier.interval === 'yearly' ? 12 : 1);
}

function compareTierRank(a, b) {
  return tierRank(a) - tierRank(b);
}

export function sortEventTiers(tiers = []) {
  return tiers.filter(tier => tier.isActive !== false).slice().sort((a, b) => compareTierRank(a, b) || String(a.name).localeCompare(String(b.name)));
}

export function getEligibleEventTiers(tiers = [], minimumTierId) {
  const minimum = tiers.find(tier => String(tier._id) === String(minimumTierId));
  return minimum ? sortEventTiers(tiers).filter(tier => compareTierRank(tier, minimum) >= 0) : [];
}

export function isEventTierAllowed(event, membership = {}, tiers = []) {
  if (event.tierAccess === 'all') return true;
  if (event.tierAccess === 'minimum') {
    const minimum = tiers.find(tier => String(tier._id) === String(event.minimumTierId));
    const memberTier = tiers.find(tier => String(tier._id) === String(membership.tierId));
    return Boolean(minimum && memberTier && compareTierRank(memberTier, minimum) >= 0);
  }
  return !event.allowedTiers?.length || event.allowedTiers.includes(membership.tierName);
}

export function getEventAccessLabel(event, tiers = []) {
  if (event.tierAccess === 'minimum') {
    const minimum = tiers.find(tier => String(tier._id) === String(event.minimumTierId));
    return `${minimum?.name || event.allowedTiers?.[0] || 'Selected tier'} and higher`;
  }
  return event.tierAccess === 'all' || !event.allowedTiers?.length ? 'All membership tiers' : event.allowedTiers.join(', ');
}
