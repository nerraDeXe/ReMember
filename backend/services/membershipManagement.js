import { Invoice, Tier, OrganisationMembership, ActivityLog } from '../models/index.js';
import { membershipView } from './membershipContext.js';
import { effectiveMembershipStatus } from './membershipState.js';
import { updateOrgMemberCount } from './organisationAccess.js';
import { equivalentMonthlyCents } from './membershipProration.js';
import { billingRevisionFilter, scheduledDowngradeUnset } from './scheduledDowngrade.js';

export class MembershipError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const validDate = value => (typeof value === 'string' || value instanceof Date) && Number.isFinite(new Date(value).getTime());

export async function membershipDetails(user, membership, organisation, now = new Date()) {
  const [tier, scheduledTier, invoices] = await Promise.all([
    membership.tierId ? Tier.findOne({ _id: membership.tierId, organisationId: String(organisation._id) }) : null,
    membership.scheduledTierId ? Tier.findOne({ _id: membership.scheduledTierId, organisationId: String(organisation._id) }) : null,
    Invoice.find({ organisationId: String(organisation._id), userId: String(user._id), paymentStatus: 'paid' }).lean()
  ]);
  const paidMemberships = invoices.filter(invoice => invoice.category !== 'event_ticket');
  const starts = paidMemberships.map(invoice => invoice.paidAt || invoice.periodStart || invoice.createdAt)
    .filter(validDate).sort((a, b) => Date.parse(a) - Date.parse(b));
  const periods = (membership.billingPeriods || []).filter(period => validDate(period.periodStart) && validDate(period.periodEnd));
  const eligibleInvoices = paidMemberships.filter(invoice => invoice.tierId === membership.tierId && validDate(invoice.periodStart) && Date.parse(invoice.periodStart) <= now.getTime());
  const latestInvoice = eligibleInvoices.filter(invoice => Date.parse(invoice.periodEnd) > now.getTime())
    .sort((a, b) => Date.parse(b.periodStart) - Date.parse(a.periodStart))[0]
    || eligibleInvoices.sort((a, b) => Date.parse(b.periodStart) - Date.parse(a.periodStart))[0];
  const currentPeriod = periods.filter(period => Date.parse(period.periodStart) <= now.getTime() && Date.parse(period.periodEnd) > now.getTime())
    .sort((a, b) => Date.parse(b.periodStart) - Date.parse(a.periodStart))[0];
  const firstSubscribedAt = membership.firstSubscribedAt || starts[0] || (tier?.price === 0 ? membership.joinedDate : null);
  const currentPrice = equivalentMonthlyCents(tier);
  const scheduledPrice = equivalentMonthlyCents(scheduledTier);
  const scheduledTierFull = scheduledTier?.maxMembers ? await OrganisationMembership.countDocuments({
    organisationId: String(organisation._id), tierId: String(scheduledTier._id), status: { $in: ['active', 'pending'] }, userId: { $ne: String(user._id) }
  }) >= scheduledTier.maxMembers : false;
  return {
    ...membershipView(user, membership, organisation), status: effectiveMembershipStatus(membership, now), tier,
    scheduledTier: scheduledTier || null,
    scheduledTierUnavailable: Boolean(membership.scheduledTierId && (!scheduledTier || scheduledTier.isActive !== true || scheduledTierFull
      || !Number.isFinite(currentPrice) || !Number.isFinite(scheduledPrice) || scheduledPrice >= currentPrice
      || String(scheduledTier._id) === String(membership.tierId))),
    firstSubscribedAt,
    currentPeriodStart: currentPeriod?.periodStart || latestInvoice?.periodStart || null,
    currentPeriodEnd: membership.expirationDate || null,
    renewalDate: membership.cancelAtPeriodEnd ? null : membership.expirationDate || null,
    renewalMode: 'manual',
  };
}

/** A member can only cancel or resume the association selected by the server. */
export async function changeMembershipCancellation({ user, membership, organisation, resume = false, now = new Date() }) {
  if (membership.role !== 'member' || String(membership.userId) !== String(user._id) || String(membership.organisationId) !== String(organisation._id)) throw new MembershipError(403, 'Only members can manage their own membership.');
  if (['revoked', 'suspended'].includes(membership.status)) throw new MembershipError(403, 'Contact the organisation about this membership.');
  const timestamp = now.toISOString();
  const tier = membership.tierId ? await Tier.findOne({ _id: membership.tierId, organisationId: String(organisation._id) }) : null;
  const paidAccessRemaining = membership.status === 'active' && (!tier || tier.price > 0) && Date.parse(membership.expirationDate) > now.getTime();
  if (resume && (!membership.cancelAtPeriodEnd || !paidAccessRemaining)) throw new MembershipError(409, 'Only a membership with paid access remaining can undo cancellation.');
  if (!resume && (membership.cancelAtPeriodEnd || membership.status === 'cancelled')) return membership;
  const updated = await OrganisationMembership.findOneAndUpdate({
    _id: membership._id, organisationId: String(organisation._id), userId: String(user._id), role: 'member',
    status: membership.status, ...billingRevisionFilter(membership)
  }, {
    $set: resume ? { cancelAtPeriodEnd: false } : {
      cancelAtPeriodEnd: paidAccessRemaining, cancelledAt: timestamp, status: paidAccessRemaining ? 'active' : 'cancelled',
      ...(membership.status === 'active' && tier?.price === 0 && !membership.firstSubscribedAt ? { firstSubscribedAt: membership.joinedDate || timestamp } : {})
    },
    $unset: resume ? { cancelledAt: '' } : { ...scheduledDowngradeUnset },
    $inc: { billingRevision: 1 }
  }, { new: true, runValidators: true });
  if (!updated) throw new MembershipError(409, 'Your membership changed. Reload it before continuing.');
  await ActivityLog.create({ organisationId: String(organisation._id), action: resume ? 'MEMBERSHIP_CANCELLATION_UNDONE' : 'MEMBERSHIP_CANCELLED',
    userId: String(user._id), userName: user.name, userEmail: user.email, actorRole: 'member',
    details: { effectiveAt: paidAccessRemaining ? membership.expirationDate : timestamp, cancelAtPeriodEnd: !resume && paidAccessRemaining }, timestamp
  }).catch(() => console.error('Could not record membership cancellation audit.'));
  if (!paidAccessRemaining && !resume) await updateOrgMemberCount(organisation._id).catch(() => console.error('Could not update organisation member count.'));
  return updated;
}

function requireMemberManagement(user, membership, organisation) {
  if (membership.role !== 'member' || String(membership.userId) !== String(user._id)
    || String(membership.organisationId) !== String(organisation._id)) throw new MembershipError(403, 'Only members can manage their own membership.');
  if (['revoked', 'suspended'].includes(membership.status)) throw new MembershipError(403, 'Contact the organisation about this membership.');
}

export async function scheduleMembershipDowngrade({ user, membership, organisation, tierId, now = new Date() }) {
  requireMemberManagement(user, membership, organisation);
  if (membership.cancelAtPeriodEnd || membership.status === 'cancelled') throw new MembershipError(409, 'Undo cancellation before scheduling a membership downgrade.');
  if (membership.status !== 'active' || !validDate(membership.expirationDate) || Date.parse(membership.expirationDate) <= now.getTime()) {
    throw new MembershipError(409, 'Only an active paid membership with time remaining can schedule a downgrade.');
  }
  if (typeof tierId !== 'string' || !tierId.trim()) throw new MembershipError(400, 'Choose a membership tier for your next renewal.');
  const [currentTier, target] = await Promise.all([
    Tier.findOne({ _id: membership.tierId, organisationId: String(organisation._id) }),
    Tier.findOne({ _id: tierId, organisationId: String(organisation._id), isActive: true })
  ]);
  if (!target) throw new MembershipError(404, 'The selected membership tier is unavailable.');
  const currentPrice = equivalentMonthlyCents(currentTier);
  const targetPrice = equivalentMonthlyCents(target);
  if (!Number.isFinite(currentPrice) || currentPrice <= 0 || !Number.isFinite(targetPrice)
    || targetPrice >= currentPrice || String(target._id) === String(membership.tierId)) {
    throw new MembershipError(400, 'Choose a tier with a lower equivalent monthly price.');
  }
  if (target.maxMembers) {
    const count = await OrganisationMembership.countDocuments({ organisationId: String(organisation._id), tierId: String(target._id),
      status: { $in: ['active', 'pending'] }, userId: { $ne: String(user._id) } });
    if (count >= target.maxMembers) throw new MembershipError(409, 'This membership tier has reached its capacity.');
  }
  const timestamp = now.toISOString();
  const updated = await OrganisationMembership.findOneAndUpdate({
    _id: membership._id, organisationId: String(organisation._id), userId: String(user._id), role: 'member',
    status: 'active', tierId: membership.tierId, expirationDate: membership.expirationDate,
    cancelAtPeriodEnd: { $ne: true }, ...billingRevisionFilter(membership)
  }, { $set: { scheduledTierId: String(target._id), scheduledTierEffectiveAt: membership.expirationDate,
    scheduledTierRequestedAt: timestamp }, $inc: { billingRevision: 1 } }, { new: true, runValidators: true });
  if (!updated) throw new MembershipError(409, 'Your membership changed. Reload it before continuing.');
  await ActivityLog.create({ organisationId: String(organisation._id), action: 'MEMBERSHIP_DOWNGRADE_SCHEDULED',
    userId: String(user._id), userName: user.name, userEmail: user.email, actorRole: 'member',
    details: { previousTierId: membership.tierId, tierId: String(target._id), effectiveAt: membership.expirationDate }, timestamp
  }).catch(() => console.error('Could not record membership downgrade audit.'));
  return updated;
}

export async function cancelMembershipDowngrade({ user, membership, organisation, now = new Date() }) {
  requireMemberManagement(user, membership, organisation);
  if (!membership.scheduledTierId) return membership;
  const updated = await OrganisationMembership.findOneAndUpdate({
    _id: membership._id, organisationId: String(organisation._id), userId: String(user._id), role: 'member',
    status: membership.status, scheduledTierId: membership.scheduledTierId, ...billingRevisionFilter(membership)
  }, { $unset: { ...scheduledDowngradeUnset }, $inc: { billingRevision: 1 } }, { new: true, runValidators: true });
  if (!updated) throw new MembershipError(409, 'Your membership changed. Reload it before continuing.');
  await ActivityLog.create({ organisationId: String(organisation._id), action: 'MEMBERSHIP_DOWNGRADE_CANCELLED',
    userId: String(user._id), userName: user.name, userEmail: user.email, actorRole: 'member',
    details: { tierId: membership.scheduledTierId }, timestamp: now.toISOString()
  }).catch(() => console.error('Could not record membership downgrade audit.'));
  return updated;
}
