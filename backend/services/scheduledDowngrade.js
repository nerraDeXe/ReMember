import { OrganisationMembership, Tier, Organisation, ActivityLog } from '../models/index.js';
import { equivalentMonthlyCents } from './membershipProration.js';

export const scheduledDowngradeUnset = {
  scheduledTierId: '', scheduledTierEffectiveAt: '', scheduledTierRequestedAt: ''
};

export function billingRevisionFilter(membership) {
  return membership.billingRevision
    ? { billingRevision: membership.billingRevision }
    : { $or: [{ billingRevision: 0 }, { billingRevision: { $exists: false } }] };
}

export function downgradeIsDue(membership, now = new Date()) {
  const effectiveAt = Date.parse(membership.scheduledTierEffectiveAt);
  const expiration = Date.parse(membership.expirationDate);
  return membership.role === 'member' && ['active', 'expired'].includes(membership.status)
    && !membership.cancelAtPeriodEnd && Boolean(membership.scheduledTierId)
    && Number.isFinite(effectiveAt) && effectiveAt === expiration && effectiveAt <= now.getTime();
}

/** Free plans require no payment. Resolve them when the account is next read,
 * while paid plans remain expired until their renewal payment succeeds. */
export async function resolveDueFreeDowngrade(membership, organisation, now = new Date()) {
  if (!organisation || String(organisation._id) !== String(membership.organisationId)
    || !downgradeIsDue(membership, now)) return membership;
  const [currentTier, target] = await Promise.all([
    Tier.findOne({ _id: membership.tierId, organisationId: String(organisation._id) }),
    Tier.findOne({ _id: membership.scheduledTierId, organisationId: String(organisation._id), isActive: true })
  ]);
  const currentPrice = equivalentMonthlyCents(currentTier);
  if (!target || target.price !== 0 || !Number.isFinite(currentPrice) || currentPrice <= 0
    || !['monthly', 'yearly'].includes(target.interval) || String(target._id) === String(membership.tierId)) return membership;
  if (target.maxMembers) {
    const count = await OrganisationMembership.countDocuments({ organisationId: String(organisation._id),
      tierId: String(target._id), status: { $in: ['active', 'pending'] }, userId: { $ne: String(membership.userId) } });
    if (count >= target.maxMembers) return membership;
  }
  const updated = await OrganisationMembership.findOneAndUpdate({
    _id: membership._id, organisationId: String(organisation._id), userId: String(membership.userId), role: 'member',
    status: membership.status, tierId: membership.tierId, expirationDate: membership.expirationDate,
    scheduledTierId: membership.scheduledTierId, scheduledTierEffectiveAt: membership.scheduledTierEffectiveAt,
    cancelAtPeriodEnd: { $ne: true }, ...billingRevisionFilter(membership)
  }, {
    $set: { tierId: String(target._id), tierName: target.name, status: 'active', cancelAtPeriodEnd: false },
    $unset: { ...scheduledDowngradeUnset, expirationDate: '', cancelledAt: '' },
    $inc: { billingRevision: 1 }
  }, { new: true, runValidators: true });
  if (!updated) {
    // A simultaneous cancellation, payment, or admin change wins. Return its
    // current state so this request cannot continue with stale entitlements.
    const current = await OrganisationMembership.findOne({ _id: membership._id, organisationId: String(organisation._id), userId: String(membership.userId) });
    return current ? (current.toObject ? current.toObject() : current) : null;
  }
  await ActivityLog.create({ organisationId: String(organisation._id), action: 'MEMBERSHIP_DOWNGRADE_APPLIED',
    userId: String(membership.userId), actorRole: 'system',
    details: { previousTierId: membership.tierId, tierId: String(target._id), effectiveAt: membership.scheduledTierEffectiveAt, paymentRequired: false },
    timestamp: now.toISOString()
  }).catch(() => console.error('Could not record membership downgrade audit.'));
  if (membership.status !== 'active') {
    try {
      const [activeCount, ownerMember] = await Promise.all([
        OrganisationMembership.countDocuments({ organisationId: String(organisation._id), status: 'active' }),
        OrganisationMembership.findOne({ organisationId: String(organisation._id), userId: organisation.adminId, status: 'active' })
      ]);
      await Organisation.findByIdAndUpdate(organisation._id, { $set: { memberCount: activeCount + (organisation.adminId && !ownerMember ? 1 : 0) } });
    } catch { console.error('Could not update organisation member count.'); }
  }
  return updated.toObject ? updated.toObject() : updated;
}
