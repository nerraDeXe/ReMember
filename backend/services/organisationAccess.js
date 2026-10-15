import { Organisation, OrganisationMembership, User } from '../models/index.js';

export const accessibleMembershipStatuses = ['active', 'pending', 'expired'];

export function organisationIsPublic(organisation) {
  return organisation.isPublic === true && organisation.visibility !== 'private';
}

export function isOrganisationOwner(organisation, user) {
  return Boolean(user && organisation && String(organisation.adminId) === String(user._id));
}

export function sanitiseUser(user) {
  const result = user?.toObject ? user.toObject() : { ...user };
  for (const key of Object.keys(result)) {
    if (key === 'password' || key.startsWith('emailVerification')) delete result[key];
  }
  return result;
}

export function organisationSummary(organisation) {
  return {
    _id: organisation._id,
    name: organisation.name,
    logoUrl: organisation.logoUrl || '',
    visibility: organisation.visibility,
    isPublic: organisationIsPublic(organisation)
  };
}

/** Account roles belong to organisations; a person can own one and join another. */
export async function getAccountContext(user) {
  const result = sanitiseUser(user);
  const [owned, memberships] = await Promise.all([
    Organisation.find({ adminId: String(user._id) }).lean(),
    OrganisationMembership.find({ userId: String(user._id) }).lean()
  ]);
  const organisationIds = [...new Set([...owned.map(org => org._id), ...memberships.map(member => member.organisationId)])];
  const organisations = organisationIds.length ? await Organisation.find({ _id: { $in: organisationIds } }).lean() : [];
  const organisationsById = new Map(organisations.map(org => [String(org._id), org]));
  const ownedIds = new Set(owned.map(org => String(org._id)));
  const accessible = memberships.filter(member => organisationsById.has(String(member.organisationId)) && accessibleMembershipStatuses.includes(member.status));
  const selectedId = String(user.activeOrganisationId || '');
  const selectedIsAccessible = ownedIds.has(selectedId) || accessible.some(member => String(member.organisationId) === selectedId);
  const activeOrganisationId = selectedIsAccessible ? selectedId : (owned[0]?._id || accessible.find(member => member.status === 'active')?.organisationId || accessible[0]?.organisationId || null);
  const activeOrganisation = activeOrganisationId ? organisationsById.get(String(activeOrganisationId)) : null;
  const selectedMembership = memberships.find(member => String(member.organisationId) === String(activeOrganisationId));

  result.ownedOrganisations = owned.map(organisationSummary);
  result.memberships = memberships.filter(member => organisationsById.has(String(member.organisationId))).map(member => ({
    ...member,
    organisationName: organisationsById.get(String(member.organisationId)).name,
    organisation: organisationSummary(organisationsById.get(String(member.organisationId)))
  }));
  result.activeOrganisationId = activeOrganisationId;
  result.activeOrganisation = activeOrganisation ? organisationSummary(activeOrganisation) : null;
  result.organisationRole = activeOrganisation ? (isOrganisationOwner(activeOrganisation, user) ? 'owner' : 'member') : null;
  result.membershipStatus = result.organisationRole === 'owner' ? 'active' : (selectedMembership?.status || null);
  result.tierId = result.organisationRole === 'owner' ? '' : (selectedMembership?.tierId || '');
  result.tierName = result.organisationRole === 'owner' ? '' : (selectedMembership?.tierName || '');
  result.membershipJoinedDate = selectedMembership?.joinedDate || null;
  result.joinedDate = selectedMembership?.joinedDate || user.joinedDate;
  result.expirationDate = selectedMembership?.expirationDate || null;
  return result;
}

export async function canReadOrganisation(organisation, user) {
  if (organisationIsPublic(organisation) || isOrganisationOwner(organisation, user)) return true;
  if (!user) return false;
  return Boolean(await OrganisationMembership.findOne({ organisationId: String(organisation._id), userId: String(user._id), status: 'active' }));
}

export async function resolveSelectedOrganisation(user) {
  const context = await getAccountContext(user);
  return context.activeOrganisationId ? Organisation.findById(context.activeOrganisationId) : null;
}

export const getActiveOrganisation = resolveSelectedOrganisation;

export async function updateOrgMemberCount(organisationId) {
  const organisation = await Organisation.findById(organisationId);
  if (!organisation) return;
  const [activeCount, ownerMember] = await Promise.all([
    OrganisationMembership.countDocuments({ organisationId: String(organisationId), status: 'active' }),
    OrganisationMembership.findOne({ organisationId: String(organisationId), userId: organisation.adminId, status: 'active' })
  ]);
  return Organisation.findByIdAndUpdate(organisationId, { $set: { memberCount: activeCount + (organisation.adminId && !ownerMember ? 1 : 0) } }, { new: true });
}

/** Validate the same price and interval constraints during setup and later editing. */
export function normaliseTierInput(input = {}) {
  if (typeof input.name !== 'string' || !input.name.trim() || input.name.trim().length > 80) {
    throw new Error('Each membership tier needs a name of 1–80 characters.');
  }
  if (!['number', 'string'].includes(typeof input.price) || (typeof input.price === 'string' && !/^\d+(\.\d{1,2})?$/.test(input.price.trim()))) {
    throw new Error('Tier prices must be nonnegative amounts with at most two decimal places.');
  }
  const price = Number(input.price);
  if (!Number.isFinite(price) || price < 0 || price > 1000000 || Math.abs(price * 100 - Math.round(price * 100)) > 0.00001) {
    throw new Error('Tier prices must be between USD 0 and USD 1,000,000, with at most two decimal places.');
  }
  const interval = input.interval || 'monthly';
  if (!['monthly', 'yearly'].includes(interval)) throw new Error('Choose monthly or yearly billing.');
  if (input.description !== undefined && (typeof input.description !== 'string' || input.description.length > 1000)) throw new Error('Tier descriptions must be at most 1,000 characters.');
  const perks = typeof input.perks === 'string' ? input.perks.split('\n').map(perk => perk.trim()).filter(Boolean) : (input.perks || []);
  if (!Array.isArray(perks) || perks.length > 30 || perks.some(perk => typeof perk !== 'string' || perk.length > 500)) throw new Error('Tier benefits must be a list of up to 30 short descriptions.');
  const maxMembers = input.maxMembers === undefined || input.maxMembers === null || input.maxMembers === '' ? null : Number(input.maxMembers);
  if (maxMembers !== null && (!Number.isSafeInteger(maxMembers) || maxMembers < 1)) throw new Error('Member limits must be positive whole numbers.');
  const accessLevel = input.accessLevel === undefined ? 1 : Number(input.accessLevel);
  if (!Number.isSafeInteger(accessLevel) || accessLevel < 1) throw new Error('Access levels must be positive whole numbers.');
  if (input.isActive !== undefined && typeof input.isActive !== 'boolean') throw new Error('Tier activity must be true or false.');
  if (input.badgeColor && (typeof input.badgeColor !== 'string' || !/^#[0-9a-f]{6}$/i.test(input.badgeColor))) throw new Error('Choose a valid tier badge colour.');
  const name = input.name.trim();
  return {
    name,
    slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'membership',
    price: Math.round(price * 100) / 100,
    interval,
    badgeColor: input.badgeColor || '#FFD700',
    description: input.description || '',
    perks: perks.map(perk => perk.trim()).filter(Boolean),
    isActive: input.isActive === undefined ? true : input.isActive,
    accessLevel,
    maxMembers
  };
}

export async function selectOrganisationForUser(user, organisationId) {
  const organisation = await Organisation.findById(organisationId);
  if (!organisation) return null;
  const membership = isOrganisationOwner(organisation, user) ? null : await OrganisationMembership.findOne({ organisationId: String(organisationId), userId: String(user._id), status: { $in: accessibleMembershipStatuses } });
  if (!isOrganisationOwner(organisation, user) && !membership) return null;
  const updatedUser = await User.findByIdAndUpdate(user._id, { $set: { activeOrganisationId: String(organisationId) } }, { new: true });
  return getAccountContext(updatedUser);
}
