export function effectiveMembershipStatus(membership, now = new Date()) {
  if (membership.status === 'active' && membership.cancelAtPeriodEnd && Date.parse(membership.expirationDate) <= new Date(now).getTime()) return 'cancelled';
  return membership.status;
}

// Admin reporting records the member's cancellation decision immediately,
// while access checks continue to honour any remaining paid time.
export function adminMembershipStatus(membership, now = new Date()) {
  const status = effectiveMembershipStatus(membership, now);
  return status === 'active' && membership.cancelAtPeriodEnd ? 'cancelled' : status;
}
