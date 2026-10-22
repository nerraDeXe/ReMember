import express from 'express';
import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import { Organisation, OrganisationMembership, User, Tier, ActivityLog } from '../models/index.js';
import { authenticateToken, requireVerifiedEmail } from '../middleware/auth.js';
import { optionalAuth } from '../middleware/organisationAccess.js';
import { normaliseOrganisationImage } from '../services/organisationImages.js';
import { getOrganisationEmailSettings, normaliseOrganisationEmailSettings } from '../../shared/organisationEmails.js';
import { sendWelcomeForMembership } from '../services/organisationEmailSettings.js';
import {
  accessibleMembershipStatuses,
  canReadOrganisation,
  getAccountContext,
  isOrganisationOwner,
  normaliseTierInput,
  organisationIsPublic,
  selectOrganisationForUser,
  updateOrgMemberCount
} from '../services/organisationAccess.js';

const router = express.Router();
const organisationFields = ['name', 'description', 'category', 'location', 'website', 'contactEmail', 'logoUrl', 'bannerUrl', 'joinRequirements', 'tags', 'featured'];

function organisationForViewer(organisation, user) {
  const result = organisation.toObject ? organisation.toObject() : { ...organisation };
  if (!isOrganisationOwner(organisation, user)) delete result.emailSettings;
  return result;
}

function normaliseOrganisationInput(body, creating = false) {
  const result = {};
  for (const field of organisationFields) {
    if (body[field] === undefined) continue;
    if (field === 'logoUrl' || field === 'bannerUrl') {
      result[field] = normaliseOrganisationImage(body[field], field === 'logoUrl' ? 'Logo' : 'Banner');
    } else if (field === 'tags') {
      const tags = typeof body.tags === 'string' ? body.tags.split(',') : body.tags;
      if (!Array.isArray(tags) || tags.length > 20 || tags.some(tag => typeof tag !== 'string' || tag.length > 80)) throw new Error('Provide up to 20 short organisation tags.');
      result.tags = tags.map(tag => tag.trim()).filter(Boolean);
    } else if (field === 'featured') {
      if (typeof body.featured !== 'boolean') throw new Error('Featured must be true or false.');
      result.featured = body.featured;
    } else {
      if (typeof body[field] !== 'string' || body[field].length > (field === 'description' ? 3000 : 1000)) throw new Error(`Provide a valid ${field}.`);
      result[field] = body[field].trim();
    }
  }
  if ((creating || body.name !== undefined) && !result.name) throw new Error('Organisation name is required.');
  if (result.name?.length > 120) throw new Error('Organisation names must be at most 120 characters.');
  if ((creating || body.description !== undefined) && !result.description) throw new Error('Organisation description is required.');
  if (body.visibility !== undefined && !['public', 'private'].includes(body.visibility)) throw new Error('Choose public or private organisation visibility.');
  if (body.isPublic !== undefined && typeof body.isPublic !== 'boolean') throw new Error('Public visibility must be true or false.');
  if (creating || body.isPublic !== undefined || body.visibility !== undefined) {
    result.isPublic = body.isPublic !== undefined ? body.isPublic : body.visibility !== 'private';
    result.visibility = result.isPublic ? 'public' : 'private';
  }
  return result;
}

async function logActivity(req, organisationId, action, details) {
  await ActivityLog.create({
    organisationId: String(organisationId), action,
    userId: req.user._id, userName: req.user.name, userEmail: req.user.email,
    actorRole: isOrganisationOwner(req.organisation, req.user) ? 'admin' : 'member',
    details, ipAddress: req.ip || '127.0.0.1', timestamp: new Date().toISOString()
  }).catch(error => console.error('Organisation audit error:', error.message));
}

async function requireTargetOwner(req, res, next) {
  try {
    const organisation = await Organisation.findById(req.params.id);
    if (!organisation) return res.status(404).json({ success: false, message: 'Organisation not found.' });
    if (!isOrganisationOwner(organisation, req.user)) return res.status(403).json({ success: false, message: 'Only this organisation’s owner can manage it.' });
    req.organisation = organisation;
    req.organisationId = String(organisation._id);
    next();
  } catch {
    res.status(500).json({ success: false, message: 'Unable to check organisation ownership.' });
  }
}

router.get('/', optionalAuth, async (req, res) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';
    const category = typeof req.query.category === 'string' ? req.query.category : '';
    const mine = req.query.mine === 'true';
    if (mine && !req.user) return res.status(401).json({ success: false, message: 'Sign in to see your organisations.' });
    const memberships = req.user ? await OrganisationMembership.find({ userId: String(req.user._id) }).lean() : [];
    const membershipsByOrganisation = new Map(memberships.map(member => [String(member.organisationId), member]));
    const ownedQuery = req.user ? { adminId: String(req.user._id) } : null;
    const memberIds = memberships.filter(member => (mine ? accessibleMembershipStatuses.includes(member.status) : member.status === 'active')).map(member => member.organisationId);
    const branches = [...(mine ? [] : [{ isPublic: true, visibility: 'public' }]), ...(ownedQuery ? [ownedQuery] : []), ...(memberIds.length ? [{ _id: { $in: memberIds } }] : [])];
    let organisations = branches.length ? await Organisation.find({ $or: branches }).lean() : [];
    if (req.query.visibility === 'public') organisations = organisations.filter(organisationIsPublic);
    if (req.query.visibility === 'private') organisations = organisations.filter(org => !organisationIsPublic(org));
    if (category && !['all', 'All Categories'].includes(category)) organisations = organisations.filter(org => org.category?.toLowerCase() === category.toLowerCase());
    if (search) organisations = organisations.filter(org => [org.name, org.description, org.category, org.location, ...(org.tags || [])].some(value => value?.toLowerCase().includes(search)));
    organisations.sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || a.name.localeCompare(b.name));
    organisations = organisations.map(org => ({ ...organisationForViewer(org, req.user), organisationRole: isOrganisationOwner(org, req.user) ? 'owner' : (membershipsByOrganisation.has(String(org._id)) ? 'member' : null), membership: membershipsByOrganisation.get(String(org._id)) || null }));
    res.json({ success: true, count: organisations.length, organisations });
  } catch (error) {
    console.error('Organisation search error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to retrieve organisations.' });
  }
});

router.get('/categories', optionalAuth, async (req, res) => {
  try {
    const memberships = req.user ? await OrganisationMembership.find({ userId: String(req.user._id), status: 'active' }).lean() : [];
    const branches = [{ isPublic: true, visibility: 'public' }, ...(req.user ? [{ adminId: String(req.user._id) }] : []), ...(memberships.length ? [{ _id: { $in: memberships.map(member => member.organisationId) } }] : [])];
    const organisations = await Organisation.find({ $or: branches }).lean();
    res.json({ success: true, categories: [...new Set(organisations.map(org => org.category).filter(Boolean))].sort() });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch categories.' });
  }
});

router.post('/select', authenticateToken, requireVerifiedEmail, async (req, res) => {
  try {
    if (typeof req.body.organisationId !== 'string' || !req.body.organisationId) return res.status(400).json({ success: false, message: 'Choose an organisation.' });
    const user = await selectOrganisationForUser(req.user, req.body.organisationId);
    if (!user) return res.status(403).json({ success: false, message: 'You can select organisations you own or have joined.' });
    res.json({ success: true, user });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to select organisation.' });
  }
});

router.post('/onboarding-complete', authenticateToken, requireVerifiedEmail, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.user._id, { $set: { onboardingCompleted: true } }, { new: true });
    res.json({ success: true, user: await getAccountContext(user) });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to save your preference.' });
  }
});

router.post('/', authenticateToken, requireVerifiedEmail, async (req, res) => {
  let input, tierInputs;
  try {
    input = normaliseOrganisationInput(req.body, true);
    if (!Array.isArray(req.body.tiers) || !req.body.tiers.length || req.body.tiers.length > 20) throw new Error('Create at least one membership tier, up to a maximum of 20.');
    tierInputs = req.body.tiers.map(normaliseTierInput);
    if (new Set(tierInputs.map(tier => tier.name.toLowerCase())).size !== tierInputs.length) throw new Error('Each membership tier needs a different name.');
    if (!tierInputs.some(tier => tier.isActive)) throw new Error('Create at least one active membership tier.');
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
  let session;
  try {
    session = await mongoose.startSession();
    let organisation, tiers, updatedUser;
    await session.withTransaction(async () => {
      [organisation] = await Organisation.create([{
        ...input,
        slug: `${input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${randomUUID().slice(0, 8)}`,
        category: input.category || 'Community & Networking', location: input.location || 'Global Network',
        contactEmail: input.contactEmail || req.user.email,
        adminId: String(req.user._id), adminName: req.user.name,
        memberCount: 1,
        joinRequirements: input.joinRequirements || (input.isPublic ? 'Open enrollment for verified members' : 'Private invite only')
      }], { session, ordered: true });
      tiers = await Tier.create(tierInputs.map(tier => ({ ...tier, organisationId: String(organisation._id) })), { session, ordered: true });
      await OrganisationMembership.create([{
        organisationId: String(organisation._id), userId: String(req.user._id), role: 'owner', status: 'active',
        joinedDate: new Date().toISOString()
      }], { session, ordered: true });
      updatedUser = await User.findByIdAndUpdate(req.user._id, { $set: { role: 'admin', activeOrganisationId: String(organisation._id), onboardingCompleted: true } }, { new: true, session });
      if (!updatedUser) throw new Error('Your account could not be found.');
    });
    req.organisation = organisation;
    await logActivity(req, organisation._id, 'ORGANISATION_CREATED', { organisationId: organisation._id, name: organisation.name, visibility: organisation.visibility });
    res.status(201).json({ success: true, message: `Organisation "${organisation.name}" created successfully.`, organisation, tiers, user: await getAccountContext(updatedUser) });
  } catch (error) {
    console.error('Create organisation error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to create organisation. Please try again.' });
  } finally {
    await session?.endSession();
  }
});

router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const organisation = await Organisation.findById(req.params.id);
    if (!organisation || !await canReadOrganisation(organisation, req.user)) return res.status(404).json({ success: false, message: 'Organisation not found.' });
    const [tiers, membership] = await Promise.all([
      Tier.find({ organisationId: String(organisation._id), ...(isOrganisationOwner(organisation, req.user) ? {} : { isActive: true }) }),
      req.user ? OrganisationMembership.findOne({ organisationId: String(organisation._id), userId: String(req.user._id) }) : Promise.resolve(null)
    ]);
    res.json({ success: true, organisation: organisationForViewer(organisation, req.user), tiers, membership, organisationRole: isOrganisationOwner(organisation, req.user) ? 'owner' : (membership ? 'member' : null) });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to load organisation.' });
  }
});

router.post('/:id/join', authenticateToken, requireVerifiedEmail, async (req, res) => {
  try {
    const organisation = await Organisation.findById(req.params.id);
    if (!organisation) return res.status(404).json({ success: false, message: 'Organisation not found.' });
    const owner = isOrganisationOwner(organisation, req.user);
    if (!organisationIsPublic(organisation) && !owner) return res.status(403).json({ success: false, message: 'This organisation is private. Joining requires an invitation.' });
    if (typeof req.body.tierId !== 'string') return res.status(400).json({ success: false, message: 'Choose a membership tier.' });
    const tier = await Tier.findOne({ _id: req.body.tierId, organisationId: String(organisation._id), isActive: true });
    if (!tier) return res.status(400).json({ success: false, message: 'Choose an active tier belonging to this organisation.' });
    let membership = await OrganisationMembership.findOne({ organisationId: String(organisation._id), userId: String(req.user._id) });
    if (membership && ['suspended', 'revoked'].includes(membership.status) && !owner) return res.status(403).json({ success: false, message: 'Contact this organisation’s owner about your membership status.' });
    if (!membership || membership.status === 'expired') {
      if (tier.maxMembers && await OrganisationMembership.countDocuments({ organisationId: String(organisation._id), tierId: String(tier._id), status: { $in: ['active', 'pending'] } }) >= tier.maxMembers && !owner) return res.status(409).json({ success: false, message: 'This membership tier has reached its member limit.' });
      const updates = { role: owner ? 'owner' : 'member', status: owner || tier.price === 0 ? 'active' : 'pending', tierId: String(tier._id), tierName: tier.name, joinedDate: new Date().toISOString() };
      // Active and pending memberships keep their tier and payment state.
      // The unique user/organisation index also prevents duplicate simultaneous joins.
      if (membership) {
        membership = await OrganisationMembership.findOneAndUpdate({ _id: membership._id, status: 'expired' }, { $set: updates, $unset: { expirationDate: '' } }, { new: true });
        if (!membership) membership = await OrganisationMembership.findOne({ organisationId: String(organisation._id), userId: String(req.user._id) });
      } else {
        try {
          membership = await OrganisationMembership.findOneAndUpdate({ organisationId: String(organisation._id), userId: String(req.user._id) }, { $setOnInsert: { ...updates, welcomeEmailEligible: !owner, organisationId: String(organisation._id), userId: String(req.user._id) } }, { upsert: true, new: true, runValidators: true });
        } catch (error) {
          if (error.code !== 11000) throw error;
          membership = await OrganisationMembership.findOne({ organisationId: String(organisation._id), userId: String(req.user._id) });
        }
      }
    }
    if (owner && (membership.role !== 'owner' || membership.status !== 'active')) membership = await OrganisationMembership.findByIdAndUpdate(membership._id, { $set: { role: 'owner', status: 'active' } }, { new: true });
    const user = await User.findByIdAndUpdate(req.user._id, { $set: { activeOrganisationId: String(organisation._id), onboardingCompleted: true } }, { new: true });
    const updatedOrganisation = await updateOrgMemberCount(organisation._id);
    const requiresPayment = membership.status === 'pending';
    if (!requiresPayment) await logActivity(req, organisation._id, 'ORGANISATION_JOINED', { organisationId: organisation._id, tierId: membership.tierId });
    if (!requiresPayment) await sendWelcomeForMembership(req.user, membership, organisation).catch(() => console.error('Could not send or record organisation welcome email.'));
    res.json({ success: true, message: requiresPayment ? 'Complete payment to activate your membership.' : 'You are a member of this organisation.', membership, organisation: organisationForViewer(updatedOrganisation || organisation, req.user), requiresPayment, user: await getAccountContext(user) });
  } catch (error) {
    console.error('Join organisation error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to join organisation.' });
  }
});

router.get('/:id/email-settings', authenticateToken, requireVerifiedEmail, requireTargetOwner, (req, res) => {
  res.json({ success: true, emailSettings: getOrganisationEmailSettings(req.organisation.emailSettings) });
});

router.put('/:id/email-settings', authenticateToken, requireVerifiedEmail, requireTargetOwner, async (req, res) => {
  let emailSettings;
  try { emailSettings = normaliseOrganisationEmailSettings(req.body); }
  catch (error) { return res.status(400).json({ success: false, message: error.message }); }
  try {
    const organisation = await Organisation.findByIdAndUpdate(req.params.id, { $set: { emailSettings } }, { new: true, runValidators: true });
    await logActivity(req, organisation._id, 'ORGANISATION_EMAIL_SETTINGS_UPDATED', { welcomeEnabled: emailSettings.welcome.enabled, renewalEnabled: emailSettings.renewal.enabled, daysBefore: emailSettings.renewal.daysBefore });
    res.json({ success: true, message: 'Organisation email settings saved.', emailSettings: getOrganisationEmailSettings(organisation.emailSettings) });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to save organisation email settings.' });
  }
});

router.put('/:id/visibility', authenticateToken, requireVerifiedEmail, requireTargetOwner, async (req, res) => {
  try {
    if (req.body.isPublic === undefined && req.body.visibility === undefined) return res.status(400).json({ success: false, message: 'Choose public or private visibility.' });
    let input;
    try { input = normaliseOrganisationInput({ isPublic: req.body.isPublic, visibility: req.body.visibility }); }
    catch (error) { return res.status(400).json({ success: false, message: error.message }); }
    const organisation = await Organisation.findByIdAndUpdate(req.params.id, { $set: input }, { new: true });
    await logActivity(req, organisation._id, 'ORGANISATION_VISIBILITY_UPDATED', { previousVisibility: req.organisation.visibility, visibility: organisation.visibility });
    res.json({ success: true, message: `Organisation is now ${organisation.visibility}.`, organisation });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to update visibility.' });
  }
});

router.put('/:id', authenticateToken, requireVerifiedEmail, requireTargetOwner, async (req, res) => {
  try {
    let input;
    try { input = normaliseOrganisationInput(req.body); }
    catch (error) { return res.status(400).json({ success: false, message: error.message }); }
    const organisation = await Organisation.findByIdAndUpdate(req.params.id, { $set: input }, { new: true, runValidators: true });
    await logActivity(req, organisation._id, 'ORGANISATION_UPDATED', { name: organisation.name, fieldsChanged: Object.keys(input) });
    res.json({ success: true, message: 'Organisation updated successfully.', organisation });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to update organisation.' });
  }
});

router.delete('/:id', authenticateToken, requireVerifiedEmail, requireTargetOwner, async (req, res) => {
  let session;
  try {
    session = await mongoose.startSession();
    await session.withTransaction(async () => {
      await Organisation.findByIdAndDelete(req.params.id, { session });
      await OrganisationMembership.deleteMany({ organisationId: req.params.id }, { session });
      await Tier.deleteMany({ organisationId: req.params.id }, { session });
      await User.updateMany({ activeOrganisationId: req.params.id }, { $set: { activeOrganisationId: '' } }, { session });
    });
    await logActivity(req, req.params.id, 'ORGANISATION_DELETED', { organisationName: req.organisation.name });
    res.json({ success: true, message: `Organisation "${req.organisation.name}" deleted successfully.`, user: await getAccountContext(await User.findById(req.user._id)) });
  } catch (error) {
    console.error('Delete organisation error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to delete organisation.' });
  } finally {
    await session?.endSession();
  }
});

export default router;
