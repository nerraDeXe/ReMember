import { getEventDates, getEligibleEventTiers, DEFAULT_EVENT_TIME_ZONE, formatEventTimeRange, hasEventCoordinates } from '../../shared/events.js';
import { normaliseOrganisationImage } from './organisationImages.js';
import { eventLocalDate, eventTimeInstant } from '../../shared/eventTiming.js';

const has = (body, key) => Object.hasOwn(body, key);

function text(value, label, maximum) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maximum) throw new Error(`${label} is required and must be ${maximum} characters or fewer.`);
  return value.trim();
}

export function normaliseEventInput(body, { existing = null, tiers = [], now = new Date() } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Provide valid event details.');
  const creating = !existing;
  const fields = {};
  for (const [key, label, maximum] of [['title', 'Title', 160], ['description', 'Description', 5000], ['location', 'Location', 500]]) {
    if (creating || has(body, key)) fields[key] = text(body[key], label, maximum);
  }
  if (creating || has(body, 'category')) fields.category = text(body.category ?? 'Networking', 'Category', 80);
  if (creating || has(body, 'capacity')) {
    if (body.capacity !== undefined && (!['string', 'number'].includes(typeof body.capacity) || (typeof body.capacity === 'string' && !/^\d+$/.test(body.capacity.trim())))) throw new Error('Capacity must be a whole number from 1 to 100,000.');
    const capacity = body.capacity === undefined ? 100 : Number(body.capacity);
    if (!Number.isSafeInteger(capacity) || capacity < 1 || capacity > 100000) throw new Error('Capacity must be a whole number from 1 to 100,000.');
    if (existing && capacity < (existing.rsvps || []).length) throw new Error('Capacity cannot be lower than the number of existing reservations.');
    fields.capacity = capacity;
  }
  if (creating || has(body, 'location') || has(body, 'locationPlaceId')) {
    const placeId = body.locationPlaceId === undefined ? '' : body.locationPlaceId;
    if (typeof placeId !== 'string' || (placeId && !/^[A-Za-z0-9_-]{1,256}$/.test(placeId))) throw new Error('Select a valid map location or enter an address.');
    fields.locationPlaceId = placeId;
  }
  const latitudeProvided = has(body, 'locationLatitude');
  const longitudeProvided = has(body, 'locationLongitude');
  if (latitudeProvided || longitudeProvided) {
    if (!latitudeProvided || !longitudeProvided || ((body.locationLatitude !== null || body.locationLongitude !== null) && !hasEventCoordinates(body))) throw new Error('Choose a valid location with both latitude and longitude.');
    fields.locationLatitude = body.locationLatitude;
    fields.locationLongitude = body.locationLongitude;
  } else if (creating || has(body, 'location')) {
    fields.locationLatitude = null;
    fields.locationLongitude = null;
  }

  if (creating || ['startDate', 'endDate', 'schedule', 'timeZone', 'date', 'time'].some(key => has(body, key))) {
    const startDate = has(body, 'startDate') ? body.startDate : existing?.startDate;
    const endDate = has(body, 'endDate') ? body.endDate : existing?.endDate ?? startDate;
    const dates = getEventDates(startDate, endDate);
    const schedule = has(body, 'schedule') ? body.schedule : existing?.schedule;
    if (!Array.isArray(schedule) || schedule.length !== dates.length) throw new Error('Set a start and end time for every event day.');
    const days = new Map();
    for (const day of schedule) {
      if (!day || typeof day !== 'object' || !dates.includes(day.date) || days.has(day.date)) throw new Error('The schedule must include each event day exactly once.');
      if (typeof day.startTime !== 'string' || typeof day.endTime !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(day.startTime) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(day.endTime)) throw new Error('Choose valid start and end times for each event day.');
      if (day.endTime <= day.startTime) throw new Error('Each day must end after its start time.');
      days.set(day.date, { date: day.date, startTime: day.startTime, endTime: day.endTime });
    }
    const timeZone = has(body, 'timeZone') ? body.timeZone : existing?.timeZone ?? DEFAULT_EVENT_TIME_ZONE;
    if (typeof timeZone !== 'string' || !timeZone || timeZone.length > 100) throw new Error('Choose a valid event time zone.');
    try { new Intl.DateTimeFormat('en', { timeZone }).format(); }
    catch { throw new Error('Choose a valid event time zone.'); }
    if ((creating || startDate !== (existing.startDate || existing.date) || timeZone !== (existing.timeZone || DEFAULT_EVENT_TIME_ZONE))
      && startDate <= eventLocalDate(now, timeZone)) throw new Error('Events must start tomorrow or later in the event time zone. Today and past dates are not allowed.');
    for (const day of days.values()) {
      if (!eventTimeInstant(day.date, day.startTime, timeZone) || !eventTimeInstant(day.date, day.endTime, timeZone, true)) {
        throw new Error('An event time does not exist in the selected time zone. Choose another time.');
      }
    }
    fields.startDate = startDate;
    fields.endDate = endDate;
    fields.schedule = dates.map(date => days.get(date));
    fields.timeZone = timeZone;
    fields.date = startDate;
    fields.time = formatEventTimeRange(fields.schedule[0]);
  }

  if (creating || has(body, 'tierAccess') || has(body, 'minimumTierId')) {
    const access = has(body, 'tierAccess') ? body.tierAccess : existing?.tierAccess ?? 'all';
    if (!['all', 'minimum'].includes(access)) throw new Error('Choose all tiers or a minimum membership tier.');
    fields.tierAccess = access;
    if (access === 'minimum') {
      const minimumTierId = has(body, 'minimumTierId') ? body.minimumTierId : existing?.minimumTierId;
      const minimum = tiers.find(tier => String(tier._id) === minimumTierId && tier.isActive !== false);
      if (!minimum) throw new Error('Choose an active membership tier from this organisation.');
      fields.minimumTierId = String(minimum._id);
      fields.allowedTiers = getEligibleEventTiers(tiers, fields.minimumTierId).map(tier => tier.name);
    } else {
      fields.minimumTierId = '';
      fields.allowedTiers = [];
    }
  } else if (has(body, 'allowedTiers') && JSON.stringify(body.allowedTiers) !== JSON.stringify(existing.allowedTiers || [])) {
    throw new Error('Choose all tiers or a minimum membership tier.');
  }

  if (creating || has(body, 'imageUrl')) {
    const image = body.imageUrl === undefined ? '' : body.imageUrl;
    if (typeof image !== 'string') throw new Error('Upload a JPEG, PNG, or WebP header image.');
    if (image && !image.trim().startsWith('data:') && image !== existing?.imageUrl) throw new Error('Upload a header image from your device. Image URLs are not supported.');
    fields.imageUrl = normaliseOrganisationImage(image, 'Header');
  }
  return fields;
}
