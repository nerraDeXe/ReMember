import { getEventMapsUrl, getEligibleEventTiers, getEventAccessLabel } from '../../shared/events.js';
import { getEventTiming } from '../../shared/eventTiming.js';

export function eventView(event, userId, isOwner = false, tiers = []) {
  const value = event.toObject ? event.toObject() : { ...event };
  const rsvps = value.rsvps || [];
  const timing = getEventTiming(value);
  return {
    ...value,
    ...(value.tierAccess === 'minimum' && tiers.length ? { allowedTiers: getEligibleEventTiers(tiers, value.minimumTierId).map(tier => tier.name) } : {}),
    mapsUrl: getEventMapsUrl(value),
    eventStatus: timing.status,
    startsAt: timing.startsAt,
    endsAt: timing.endsAt,
    rsvpOpen: timing.rsvpOpen,
    tierAccessLabel: getEventAccessLabel(value, tiers),
    rsvps: isOwner ? rsvps : [],
    rsvpCount: rsvps.length,
    spotsLeft: Math.max(0, Number(value.capacity || 0) - rsvps.length),
    isRsvped: rsvps.some(rsvp => String(rsvp.userId) === String(userId)),
  };
}
