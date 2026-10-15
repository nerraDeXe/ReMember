import { Organisation, OrganisationMembership } from '../models/index.js';
import { getAccountContext } from './organisationAccess.js';

export function membershipView(user, membership) {
  const account = user.toObject ? user.toObject() : user;
  return {
    _id: String(account._id),
    userId: String(account._id),
    name: account.name,
    firstName: account.firstName,
    lastName: account.lastName,
    email: account.email,
    phone: account.phone,
    bio: account.bio,
    avatarUrl: account.avatarUrl,
    address: account.address,
    country: account.country,
    membershipNumber: account.membershipNumber,
    organisationId: membership.organisationId,
    role: membership.role,
    status: membership.status,
    tierId: membership.tierId,
    tierName: membership.tierName,
    joinedDate: membership.joinedDate,
    expirationDate: membership.expirationDate,
  };
}

export async function withSelectedMembership(req, res, next) {
  try {
    const context = await getAccountContext(req.user);
    if (!context.activeOrganisationId) {
      return res.status(400).json({ success: false, message: 'Choose an organisation first.' });
    }
    const organisation = await Organisation.findById(context.activeOrganisationId);
    const isOwner = organisation && String(organisation.adminId) === String(req.user._id);
    let membership = await OrganisationMembership.findOne({ organisationId: context.activeOrganisationId, userId: String(req.user._id) });
    if (isOwner && !membership) {
      membership = { organisationId: String(organisation._id), userId: String(req.user._id), role: 'owner', status: 'active' };
    }
    if (!organisation || !membership || (!isOwner && ['suspended', 'revoked'].includes(membership.status))) {
      return res.status(403).json({ success: false, message: 'You do not have access to this organisation.' });
    }
    req.organisation = organisation;
    req.organisationId = String(organisation._id);
    req.membership = membership;
    req.membershipRole = isOwner ? 'owner' : 'member';
    const association = membership.toObject ? membership.toObject() : { ...membership };
    req.membershipUser = membershipView(req.user, { ...association, role: req.membershipRole, status: isOwner ? 'active' : membership.status });
    next();
  } catch (err) {
    next(err);
  }
}

export function requireActiveMembership(req, res, next) {
  if (req.membershipRole === 'owner') return next();
  if (req.membership.status !== 'active' || (req.membership.expirationDate && new Date(req.membership.expirationDate) < new Date())) {
    return res.status(403).json({ success: false, message: 'An active organisation membership is required.' });
  }
  next();
}
