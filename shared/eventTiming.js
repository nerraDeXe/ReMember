import { DEFAULT_EVENT_TIME_ZONE, getEventDates } from './events.js';

const DAY_MS = 86_400_000;
const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const formatters = new Map();

function formatter(timeZone) {
  if (!formatters.has(timeZone)) formatters.set(timeZone, new Intl.DateTimeFormat('en-GB', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }));
  return formatters.get(timeZone);
}

export function eventTimeZone(value) {
  try { if (typeof value === 'string' && value.trim()) { formatter(value.trim()); return value.trim(); } }
  catch { /* Legacy events use the default calendar when their zone is missing or invalid. */ }
  return DEFAULT_EVENT_TIME_ZONE;
}

function partsAt(timestamp, timeZone) {
  return Object.fromEntries(formatter(timeZone).formatToParts(new Date(timestamp)).map(part => [part.type, part.value]));
}

export function eventLocalDate(now = new Date(), timeZone = DEFAULT_EVENT_TIME_ZONE) {
  const parts = partsAt(new Date(now).getTime(), eventTimeZone(timeZone));
  return `${parts.year.padStart(4, '0')}-${parts.month}-${parts.day}`;
}

function validDate(value) {
  try { return typeof value === 'string' && getEventDates(value).length === 1; }
  catch { return false; }
}

function nextDate(date) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + DAY_MS).toISOString().slice(0, 10);
}

export function earliestEventDate(timeZone = DEFAULT_EVENT_TIME_ZONE, now = new Date()) {
  return nextDate(eventLocalDate(now, timeZone));
}

/** Resolve local wall time without depending on the server/browser time zone.
 * Ambiguous DST starts use the earlier instant; ends use the later instant.
 * Missing local times during a DST jump return null instead of moving an event. */
export function eventTimeInstant(date, time, timeZone = DEFAULT_EVENT_TIME_ZONE, end = false) {
  if (!validDate(date) || !TIME.test(time || '')) return null;
  const zone = eventTimeZone(timeZone);
  const wallTime = Date.parse(`${date}T${time}:00Z`);
  const offsets = new Set();
  for (const hours of [-36, -12, 0, 12, 36]) {
    const sample = wallTime + hours * 3_600_000;
    const parts = partsAt(sample, zone);
    offsets.add(Date.parse(`${parts.year.padStart(4, '0')}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`) - sample);
  }
  const candidates = [...offsets].map(offset => wallTime - offset).filter(timestamp => {
    const parts = partsAt(timestamp, zone);
    return `${parts.year.padStart(4, '0')}-${parts.month}-${parts.day}` === date && `${parts.hour}:${parts.minute}` === time;
  });
  return candidates.length ? new Date(end ? Math.max(...candidates) : Math.min(...candidates)).toISOString() : null;
}

export function getEventTiming(event = {}, now = new Date()) {
  const timeZone = eventTimeZone(event.timeZone);
  const schedule = (Array.isArray(event.schedule) ? event.schedule : []).filter(day => day && validDate(day.date)).slice().sort((a, b) => a.date.localeCompare(b.date));
  const startDate = [event.startDate, event.date, schedule[0]?.date].find(validDate) || null;
  const endDate = [event.endDate, schedule.at(-1)?.date, startDate].find(validDate) || null;
  const unknown = { status: 'unknown', startDate: null, endDate: null, timeZone, startsAt: null, endsAt: null, rsvpOpen: false, upcoming: false, hasPeriod: false };
  try { if (!startDate || !endDate) return unknown; getEventDates(startDate, endDate); }
  catch { return unknown; }
  const first = schedule.find(day => day.date === startDate);
  const last = schedule.filter(day => day.date === endDate).at(-1);
  const legacy = typeof event.time === 'string' ? event.time.match(/^(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})(?:\s|$)/) : null;
  // Free text can name an ambiguous zone (e.g. EST). Without a stored zone,
  // close registration at the start of that local date and end at its midnight.
  const explicitZone = typeof event.timeZone === 'string' && eventTimeZone(event.timeZone) === event.timeZone.trim();
  const startTime = TIME.test(first?.startTime || '') ? first.startTime : !schedule.length && explicitZone && legacy ? legacy[1].padStart(5, '0') : '00:00';
  const endTime = TIME.test(last?.endTime || '') ? last.endTime : !schedule.length && explicitZone && legacy ? legacy[2].padStart(5, '0') : null;
  const startsAt = eventTimeInstant(startDate, startTime, timeZone);
  const endsAt = eventTimeInstant(endTime ? endDate : nextDate(endDate), endTime || '00:00', timeZone, true);
  if (!startsAt || !endsAt || Date.parse(endsAt) <= Date.parse(startsAt)) return { ...unknown, startDate, endDate, timeZone };
  const timestamp = new Date(now).getTime();
  if (!Number.isFinite(timestamp)) return unknown;
  const status = timestamp >= Date.parse(endsAt) ? 'ended' : timestamp >= Date.parse(startsAt) ? 'in_progress' : 'upcoming';
  return { status, startDate, endDate, timeZone, startsAt, endsAt, rsvpOpen: status === 'upcoming', upcoming: status !== 'ended', hasPeriod: true };
}
