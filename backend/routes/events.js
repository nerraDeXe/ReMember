import express from 'express';
import { Event, ActivityLog, Tier } from '../models/index.js';
import { authenticateToken, requireVerifiedEmail } from '../middleware/auth.js';
import { requireOrganisationOwner } from '../middleware/organisationAccess.js';
import { withSelectedMembership, requireActiveMembership } from '../services/membershipContext.js';
import { emailService } from '../services/emailService.js';
import { eventView } from '../services/eventView.js';
import { normaliseEventInput } from '../services/eventInput.js';
import { isEventTierAllowed, getEventAccessLabel } from '../../shared/events.js';
import { eventLocationService } from '../services/eventLocations.js';
import { getEventTiming } from '../../shared/eventTiming.js';

const router = express.Router();
router.use(authenticateToken, requireVerifiedEmail, withSelectedMembership);
router.use((req, res, next) => {
  const expectedOrganisationId = ['GET', 'DELETE'].includes(req.method) ? req.query?.organisationId : req.body?.organisationId;
  if (expectedOrganisationId !== undefined && expectedOrganisationId !== req.organisationId) {
    return res.status(409).json({ success: false, message: 'Your selected organisation has changed. Reload this page before continuing.' });
  }
  next();
});

router.get('/locations/search', requireOrganisationOwner, async (req, res) => {
  try {
    const locations = await eventLocationService.search(req.query?.q);
    res.json({ success: true, locations });
  } catch (error) {
    if (error.retryAfter) res.setHeader('Retry-After', String(error.retryAfter));
    res.status(error.status || 503).json({ success: false, message: error.message || 'Location search is temporarily unavailable. Please try again.' });
  }
});

async function organisationTiers(req) {
  return Tier.find({ organisationId: req.organisationId }).lean();
}

function view(event, req, tiers) {
  return {
    ...eventView(event, req.user._id, req.membershipRole === 'owner', tiers),
    isAllowedTier: req.membershipRole === 'owner' || isEventTierAllowed(event, req.membership, tiers),
  };
}

async function recordActivity(req, action, event) {
  await ActivityLog.create({
    action,
    organisationId: req.organisationId,
    userId: req.user._id,
    userName: req.user.name,
    userEmail: req.user.email,
    actorRole: req.membershipRole === 'owner' ? 'admin' : 'member',
    details: { eventId: event._id, title: event.title, date: event.date, capacity: event.capacity },
    ipAddress: req.ip || '127.0.0.1',
    timestamp: new Date().toISOString(),
  }).catch(error => console.error('Could not record event activity:', error));
}

router.get('/', requireActiveMembership, async (req, res) => {
  try {
    const [events, tiers] = await Promise.all([Event.find({ organisationId: req.organisationId }), organisationTiers(req)]);
    res.json({ success: true, events: events.map(event => view(event, req, tiers)) });
  } catch (error) {
    console.error('Fetch events error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch events.' });
  }
});

router.post('/:id/rsvp', requireActiveMembership, async (req, res) => {
  try {
    const event = await Event.findOne({ _id: req.params.id, organisationId: req.organisationId });
    if (!event) return res.status(404).json({ success: false, message: 'Event not found.' });
    const timing = getEventTiming(event);
    if (!timing.rsvpOpen) return res.status(409).json({ success: false, message: timing.status === 'ended' ? 'This event has ended. RSVPs are closed.' : timing.status === 'in_progress' ? 'This event has started. RSVPs are closed.' : 'This event has no valid registration schedule. Contact the organisation.' });
    const tiers = await organisationTiers(req);
    if (req.membershipRole !== 'owner' && !isEventTierAllowed(event, req.membership, tiers)) {
      return res.status(403).json({ success: false, message: `This event is available to ${getEventAccessLabel(event, tiers)}.` });
    }
    const rsvps = event.rsvps || [];
    const userId = String(req.user._id);
    if (rsvps.some(rsvp => String(rsvp.userId) === userId)) return res.status(400).json({ success: false, message: 'You have already reserved a place at this event.' });
    if (rsvps.length >= event.capacity) return res.status(400).json({ success: false, message: 'Sorry, this event has reached maximum capacity.' });
    const updated = await Event.findOneAndUpdate(
      { _id: req.params.id, organisationId: req.organisationId,
        ...(event.updatedAt ? { updatedAt: event.updatedAt } : {}),
        $expr: { $lt: ['$$NOW', new Date(timing.startsAt)] } },
      { $set: { rsvps: [...rsvps, { userId, userName: req.user.name, userEmail: req.user.email, rsvpDate: new Date().toISOString() }] } },
      { new: true },
    );
    if (!updated) return res.status(409).json({ success: false, message: 'The event has started or changed. Refresh the event list before trying again.' });
    const confirmation = await emailService.sendEventRsvpConfirmation(req.user, event).catch(() => console.error('Could not send or record RSVP confirmation.'));
    const emailDelivery = confirmation?.status || 'failed';
    await recordActivity(req, 'EVENT_RSVP', event);
    res.json({
      success: true,
      message: `RSVP confirmed for "${event.title}"! ${emailDelivery === 'sent' ? 'A confirmation email has been sent to your email provider.' : 'Your reservation is saved, but the confirmation email could not be sent.'}`,
      emailDelivery,
      event: view(updated, req, tiers),
    });
  } catch (error) {
    console.error('RSVP error:', error);
    res.status(500).json({ success: false, message: 'Failed to complete RSVP.' });
  }
});

router.post('/:id/cancel-rsvp', async (req, res) => {
  try {
    const event = await Event.findOne({ _id: req.params.id, organisationId: req.organisationId });
    if (!event) return res.status(404).json({ success: false, message: 'Event not found.' });
    const updated = await Event.findOneAndUpdate(
      { _id: req.params.id, organisationId: req.organisationId },
      { $set: { rsvps: (event.rsvps || []).filter(rsvp => String(rsvp.userId) !== String(req.user._id)) } },
      { new: true },
    );
    if (!updated) return res.status(404).json({ success: false, message: 'Event not found.' });
    res.json({ success: true, message: 'Your RSVP has been cancelled.', event: view(updated, req, await organisationTiers(req)) });
  } catch (error) {
    console.error('Cancel RSVP error:', error);
    res.status(500).json({ success: false, message: 'Failed to cancel RSVP.' });
  }
});

router.post('/', requireOrganisationOwner, async (req, res) => {
  try {
    const tiers = await organisationTiers(req);
    let fields;
    try { fields = normaliseEventInput(req.body, { tiers }); }
    catch (error) { return res.status(400).json({ success: false, message: error.message }); }
    const event = await Event.create({ ...fields, organisationId: req.organisationId, rsvps: [] });
    await recordActivity(req, 'EVENT_CREATED', event);
    res.status(201).json({ success: true, message: `Event "${event.title}" published successfully.`, event: view(event, req, tiers) });
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({ success: false, message: 'Failed to create event.' });
  }
});

router.put('/:id', requireOrganisationOwner, async (req, res) => {
  try {
    const existing = await Event.findOne({ _id: req.params.id, organisationId: req.organisationId });
    if (!existing) return res.status(404).json({ success: false, message: 'Event not found.' });
    const tiers = await organisationTiers(req);
    let fields;
    try { fields = normaliseEventInput(req.body, { existing, tiers }); }
    catch (error) { return res.status(400).json({ success: false, message: error.message }); }
    const event = await Event.findOneAndUpdate({ _id: req.params.id, organisationId: req.organisationId }, { $set: fields }, { new: true, runValidators: true });
    if (!event) return res.status(404).json({ success: false, message: 'Event not found.' });
    res.json({ success: true, message: 'Event updated successfully.', event: view(event, req, tiers) });
  } catch (error) {
    console.error('Update event error:', error);
    res.status(500).json({ success: false, message: 'Failed to update event.' });
  }
});

router.delete('/:id', requireOrganisationOwner, async (req, res) => {
  try {
    const existing = await Event.findOne({ _id: req.params.id, organisationId: req.organisationId });
    if (!existing) return res.status(404).json({ success: false, message: 'Event not found.' });
    await Event.findOneAndDelete({ _id: req.params.id, organisationId: req.organisationId });
    res.json({ success: true, message: `Event "${existing.title}" deleted successfully.` });
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete event.' });
  }
});

export default router;
