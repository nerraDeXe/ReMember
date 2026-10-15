import express from 'express';
import { Tier, Organisation, OrganisationMembership, ActivityLog } from '../models/index.js';
import { authenticateToken } from '../middleware/auth.js';
import { optionalAuth, requireOrganisationOwner } from '../middleware/organisationAccess.js';
import { canReadOrganisation, isOrganisationOwner, normaliseTierInput, resolveSelectedOrganisation } from '../services/organisationAccess.js';

const router = express.Router();

async function logTierActivity(req, action, tier, fieldsChanged) {
  await ActivityLog.create({ organisationId: req.organisationId, action, userId: req.user._id, userName: req.user.name, userEmail: req.user.email, actorRole: 'admin', details: { tierId: tier._id, tierName: tier.name, price: tier.price, interval: tier.interval, fieldsChanged }, ipAddress: req.ip || '127.0.0.1', timestamp: new Date().toISOString() }).catch(error => console.error('Tier audit error:', error.message));
}

router.get('/', optionalAuth, async (req, res) => {
  try {
    const organisation = typeof req.query.organisationId === 'string' ? await Organisation.findById(req.query.organisationId) : (req.user ? await resolveSelectedOrganisation(req.user) : null);
    if (!organisation) return res.json({ success: true, tiers: [] });
    if (!await canReadOrganisation(organisation, req.user)) return res.status(404).json({ success: false, message: 'Organisation not found.' });
    const tiers = await Tier.find({ organisationId: String(organisation._id), ...(isOrganisationOwner(organisation, req.user) ? {} : { isActive: true }) });
    res.json({ success: true, tiers });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch tiers.' });
  }
});

router.post('/', authenticateToken, requireOrganisationOwner, async (req, res) => {
  try {
    let input;
    try { input = normaliseTierInput(req.body); }
    catch (error) { return res.status(400).json({ success: false, message: error.message }); }
    if (await Tier.findOne({ organisationId: req.organisationId, name: input.name })) return res.status(409).json({ success: false, message: 'A tier with this name already exists in your organisation.' });
    const tier = await Tier.create({ ...input, organisationId: req.organisationId });
    await logTierActivity(req, 'TIER_CREATED', tier);
    res.status(201).json({ success: true, message: `Tier '${tier.name}' created successfully.`, tier });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to create tier.' });
  }
});

router.put('/:id', authenticateToken, requireOrganisationOwner, async (req, res) => {
  try {
    const existing = await Tier.findOne({ _id: req.params.id, organisationId: req.organisationId });
    if (!existing) return res.status(404).json({ success: false, message: 'Tier not found in your organisation.' });
    let input;
    try { input = normaliseTierInput({ ...existing.toObject(), ...req.body }); }
    catch (error) { return res.status(400).json({ success: false, message: error.message }); }
    const duplicate = await Tier.findOne({ organisationId: req.organisationId, name: input.name, _id: { $ne: existing._id } });
    if (duplicate) return res.status(409).json({ success: false, message: 'A tier with this name already exists in your organisation.' });
    if (existing.isActive && !input.isActive && !await Tier.exists({ organisationId: req.organisationId, isActive: true, _id: { $ne: existing._id } })) return res.status(400).json({ success: false, message: 'Keep at least one active membership tier.' });
    const tier = await Tier.findOneAndUpdate({ _id: existing._id, organisationId: req.organisationId }, { $set: input }, { new: true, runValidators: true });
    await logTierActivity(req, 'TIER_MODIFIED', tier, Object.keys(req.body));
    res.json({ success: true, message: `Tier '${tier.name}' updated successfully.`, tier });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to update tier.' });
  }
});

router.delete('/:id', authenticateToken, requireOrganisationOwner, async (req, res) => {
  try {
    const tier = await Tier.findOne({ _id: req.params.id, organisationId: req.organisationId });
    if (!tier) return res.status(404).json({ success: false, message: 'Tier not found in your organisation.' });
    if (!await Tier.exists({ organisationId: req.organisationId, isActive: true, _id: { $ne: tier._id } })) return res.status(400).json({ success: false, message: 'Keep at least one active membership tier.' });
    if (await OrganisationMembership.exists({ organisationId: req.organisationId, tierId: tier._id, status: { $in: ['active', 'pending'] } })) return res.status(409).json({ success: false, message: 'This tier has members. Deactivate it instead of deleting it.' });
    await Tier.findOneAndDelete({ _id: tier._id, organisationId: req.organisationId });
    await logTierActivity(req, 'TIER_DELETED', tier);
    res.json({ success: true, message: `Tier '${tier.name}' was deleted successfully.` });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to delete tier.' });
  }
});

export default router;
