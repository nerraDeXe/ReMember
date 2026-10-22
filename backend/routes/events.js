import express from 'express';
import { Event, ActivityLog } from '../models/index.js';
import { authenticateToken, requireVerifiedEmail } from '../middleware/auth.js';
import { requireOrganisationOwner } from '../middleware/organisationAccess.js';
import { withSelectedMembership, requireActiveMembership } from '../services/membershipContext.js';
import { emailService } from '../services/emailService.js';
import { eventView } from '../services/eventView.js';

const router = express.Router();
router.use(authenticateToken, requireVerifiedEmail, withSelectedMembership);

/**
 * GET /api/events
 * Get upcoming community events with RSVP state
 */
router.get('/', requireActiveMembership, async (req, res) => {
  try {
    const events = await Event.find({ organisationId: req.organisationId });
    const userId = String(req.user._id);

    const decorated = events.map(evt => {
      const evtObj = eventView(evt, userId, req.membershipRole === 'owner');
      const isAllowed = req.membershipRole === 'owner' || !evtObj.allowedTiers || evtObj.allowedTiers.length === 0 || evtObj.allowedTiers.includes(req.membership.tierName);

      return {
        ...evtObj,
        isAllowedTier: isAllowed
      };
    });

    res.json({
      success: true,
      events: decorated
    });
  } catch (err) {
    console.error('Fetch events error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch events.', error: err.message });
  }
});

/**
 * POST /api/events/:id/rsvp
 * RSVP directly for an upcoming event
 */
router.post('/:id/rsvp', requireActiveMembership, async (req, res) => {
  try {
    const event = await Event.findOne({ _id: req.params.id, organisationId: req.organisationId });
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }

    const rsvps = event.rsvps || [];
    const userId = String(req.user._id);

    // Check if already RSVP'd
    if (rsvps.some(r => String(r.userId) === userId)) {
      return res.status(400).json({ success: false, message: 'You have already RSVP’d to this event.' });
    }

    // Check capacity
    if (rsvps.length >= event.capacity) {
      return res.status(400).json({ success: false, message: 'Sorry, this event has reached maximum capacity.' });
    }

    // Check tier eligibility
    if (req.membershipRole !== 'owner' && event.allowedTiers && event.allowedTiers.length > 0 && !event.allowedTiers.includes(req.membership.tierName)) {
      return res.status(403).json({
        success: false,
        message: `This event requires one of the following membership tiers: ${event.allowedTiers.join(', ')}.`
      });
    }

    const newRsvp = {
      userId,
      userName: req.user.name,
      userEmail: req.user.email,
      rsvpDate: new Date().toISOString()
    };

    const updatedRsvps = [...rsvps, newRsvp];
    const updatedEvent = await Event.findByIdAndUpdate(
      req.params.id,
      { $set: { rsvps: updatedRsvps } },
      { new: true }
    );

    // Trigger automated email confirmation
    const confirmation = await emailService.sendEventRsvpConfirmation(req.user, event).catch(() => {
      console.error('Could not send or record RSVP confirmation.');
    });
    const emailDelivery = confirmation?.status || 'failed';

    // Log member activity
    await ActivityLog.create({
      action: 'EVENT_RSVP',
      organisationId: req.organisationId,
      userId: req.user._id,
      userName: req.user.name,
      userEmail: req.user.email,
      actorRole: req.user.role,
      details: {
        eventId: event._id,
        eventTitle: event.title,
        date: event.date
      },
      ipAddress: req.ip || req.connection.remoteAddress || '127.0.0.1',
      timestamp: new Date().toISOString()
    }).catch(console.error);

    res.json({
      success: true,
      message: `RSVP confirmed for "${event.title}"! ${emailDelivery === 'sent' ? 'A confirmation email has been sent to your email provider.' : 'Your reservation is saved, but the confirmation email could not be sent.'}`,
      emailDelivery,
      event: eventView(updatedEvent, req.user._id, req.membershipRole === 'owner')
    });
  } catch (err) {
    console.error('RSVP error:', err);
    res.status(500).json({ success: false, message: 'Failed to complete RSVP.', error: err.message });
  }
});

/**
 * POST /api/events/:id/cancel-rsvp
 * Cancel member RSVP
 */
router.post('/:id/cancel-rsvp', async (req, res) => {
  try {
    const event = await Event.findOne({ _id: req.params.id, organisationId: req.organisationId });
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }

    const userId = String(req.user._id);
    const updatedRsvps = (event.rsvps || []).filter(r => String(r.userId) !== userId);

    const updated = await Event.findByIdAndUpdate(
      req.params.id,
      { $set: { rsvps: updatedRsvps } },
      { new: true }
    );

    res.json({
      success: true,
      message: 'Your RSVP has been cancelled.',
      event: eventView(updated, req.user._id, req.membershipRole === 'owner')
    });
  } catch (err) {
    console.error('Cancel RSVP error:', err);
    res.status(500).json({ success: false, message: 'Failed to cancel RSVP.', error: err.message });
  }
});

/**
 * POST /api/events
 * Admin creates a new event listing with date, capacity, and allowed tiers
 */
router.post('/', requireOrganisationOwner, async (req, res) => {
  try {
    const { title, description, date, time, location, category, capacity, allowedTiers, imageUrl } = req.body;

    if (!title || !description || !date) {
      return res.status(400).json({ success: false, message: 'Title, description, and date are required.' });
    }

    const newEvent = await Event.create({
      organisationId: req.organisationId,
      title: title.trim(),
      description: description.trim(),
      date,
      time: time || '18:00 - 21:00 EST',
      location: location || 'Main Auditorium & Live Stream',
      category: category || 'Networking',
      capacity: Number(capacity) || 100,
      allowedTiers: Array.isArray(allowedTiers) ? allowedTiers : (allowedTiers ? allowedTiers.split(',').map(s => s.trim()) : []),
      imageUrl: imageUrl || 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=600&q=80',
      rsvps: []
    });

    // Log admin activity
    await ActivityLog.create({
      action: 'EVENT_CREATED',
      organisationId: req.organisationId,
      userId: req.user._id,
      userName: req.user.name,
      userEmail: req.user.email,
      actorRole: 'admin',
      details: {
        eventId: newEvent._id,
        title: newEvent.title,
        date: newEvent.date,
        capacity: newEvent.capacity
      },
      ipAddress: req.ip || req.connection.remoteAddress || '127.0.0.1',
      timestamp: new Date().toISOString()
    }).catch(console.error);

    res.status(201).json({
      success: true,
      message: `Event "${newEvent.title}" published successfully.`,
      event: newEvent
    });
  } catch (err) {
    console.error('Create event error:', err);
    res.status(500).json({ success: false, message: 'Failed to create event.', error: err.message });
  }
});

/**
 * PUT /api/events/:id
 * Admin updates event listing
 */
router.put('/:id', requireOrganisationOwner, async (req, res) => {
  try {
    const { title, description, date, time, location, category, capacity, allowedTiers, imageUrl } = req.body;
    const updateData = {};
    if (title) updateData.title = title.trim();
    if (description) updateData.description = description.trim();
    if (date) updateData.date = date;
    if (time) updateData.time = time;
    if (location) updateData.location = location;
    if (category) updateData.category = category;
    if (capacity) updateData.capacity = Number(capacity);
    if (allowedTiers) updateData.allowedTiers = Array.isArray(allowedTiers) ? allowedTiers : allowedTiers.split(',').map(s => s.trim());
    if (imageUrl) updateData.imageUrl = imageUrl;

    const updated = await Event.findOneAndUpdate({ _id: req.params.id, organisationId: req.organisationId }, updateData, { new: true });
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }

    res.json({
      success: true,
      message: 'Event updated successfully.',
      event: updated
    });
  } catch (err) {
    console.error('Update event error:', err);
    res.status(500).json({ success: false, message: 'Failed to update event.', error: err.message });
  }
});

/**
 * DELETE /api/events/:id
 * Admin deletes event listing
 */
router.delete('/:id', requireOrganisationOwner, async (req, res) => {
  try {
    const existing = await Event.findOne({ _id: req.params.id, organisationId: req.organisationId });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }

    await Event.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: `Event "${existing.title}" deleted successfully.`
    });
  } catch (err) {
    console.error('Delete event error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete event.', error: err.message });
  }
});

export default router;
