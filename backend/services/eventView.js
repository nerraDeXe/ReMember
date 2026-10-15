export function eventView(event, userId, isOwner = false) {
  const value = event.toObject ? event.toObject() : { ...event };
  const rsvps = value.rsvps || [];
  return {
    ...value,
    rsvps: isOwner ? rsvps : [],
    rsvpCount: rsvps.length,
    spotsLeft: Math.max(0, Number(value.capacity || 0) - rsvps.length),
    isRsvped: rsvps.some(rsvp => String(rsvp.userId) === String(userId)),
  };
}
