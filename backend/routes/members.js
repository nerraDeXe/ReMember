import express from 'express';
import { countryChoice, normaliseAccountPhone } from '../services/accountValidation.js';
import { User, Tier, Invoice, Event, ActivityLog } from '../models/index.js';
import { authenticateToken, requireVerifiedEmail } from '../middleware/auth.js';
import { withSelectedMembership, requireActiveMembership } from '../services/membershipContext.js';
import { eventView } from '../services/eventView.js';
import { walletService } from '../services/walletService.js';

const router = express.Router();
router.use(authenticateToken, requireVerifiedEmail);
const MAX_AVATAR_SIZE = 2 * 1024 * 1024;
const AVATAR_DATA_URL = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/;

/**
 * GET /api/members/dashboard
 * Member dashboard summary: status, tier, expiration, wallet pass, upcoming RSVPs, recent invoices
 */
router.get('/dashboard', withSelectedMembership, async (req, res) => {
  try {
    const user = req.membershipUser;
    const tier = user.tierId ? await Tier.findOne({ _id: user.tierId, organisationId: req.organisationId }) : null;

    // Get user's RSVPs from events
    const allEvents = await Event.find({ organisationId: req.organisationId });
    const myEvents = allEvents.filter(event => 
      event.rsvps && event.rsvps.some(r => String(r.userId) === String(user._id))
    );

    // Get user invoices
    const allInvoices = await Invoice.find({ userId: String(user._id), organisationId: req.organisationId });
    const invoices = (Array.isArray(allInvoices) ? allInvoices : allInvoices._data || [])
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 5);

    // Ensure wallet pass is up-to-date
    const isExpired = Boolean(user.expirationDate && new Date(user.expirationDate) < new Date());
    const walletPass = user.status === 'active' && !isExpired ? walletService.generateSaveUrl(user) : null;

    const { password: _, ...userSafe } = user;

    res.json({
      success: true,
      membership: {
        userId: user._id,
        _id: user._id,
        organisationId: req.organisationId,
        organisationName: req.organisation.name,
        name: user.name,
        email: user.email,
        membershipNumber: user.membershipNumber,
        status: user.status,
        tierName: user.tierName,
        tier: tier || null,
        joinedDate: user.joinedDate,
        expirationDate: user.expirationDate,
        isExpired: user.expirationDate ? new Date(user.expirationDate) < new Date() : false,
        avatarUrl: user.avatarUrl,
        phone: user.phone,
        bio: user.bio,
        address: user.address,
        googleWallet: walletPass ? {
          saveUrl: walletPass.saveUrl,
          jwtToken: walletPass.jwt,
          passObject: walletPass.passObject,
          lastSyncedAt: user.googleWallet?.lastSyncedAt || new Date().toISOString(),
          syncStatus: user.googleWallet?.syncStatus || 'synced'
        } : null
      },
      upcomingRsvps: myEvents.map(event => eventView(event, user._id, req.membershipRole === 'owner')),
      recentInvoices: invoices
    });
  } catch (err) {
    console.error('Member dashboard error:', err);
    res.status(500).json({ success: false, message: 'Could not load member dashboard.', error: err.message });
  }
});

/**
 * PUT /api/members/profile
 * Seamlessly update personal profile information in MongoDB
 */
router.put('/profile', async (req, res) => {
  try {
    const userId = req.user._id;
    const { name, phone, bio, address, avatarUrl, notifications } = req.body;
    if (bio !== undefined && (typeof bio !== 'string' || bio.length > 500)) {
      return res.status(400).json({ success: false, message: 'Member bio must be 500 characters or fewer.' });
    }

    const updateFields = {};
    if (name) updateFields.name = name.trim();
    const selectedCountry = countryChoice(address?.country || req.user.country || req.user.address?.country);
    if (address?.country !== undefined && !selectedCountry) return res.status(400).json({ success: false, message: 'Choose a country from the country list.' });
    if (phone !== undefined) {
      try { updateFields.phone = normaliseAccountPhone(phone, selectedCountry?.name); }
      catch (error) { return res.status(400).json({ success: false, message: error.message }); }
    }
    if (address?.country !== undefined) updateFields.country = selectedCountry.name;
    if (bio !== undefined) updateFields.bio = bio;
    const updateOperation = { $set: updateFields };
    if (avatarUrl !== undefined && avatarUrl !== req.user.avatarUrl) {
      if (avatarUrl === '') {
        updateOperation.$unset = { avatarUrl: 1 };
      } else {
        const avatarMatch = typeof avatarUrl === 'string' && avatarUrl.match(AVATAR_DATA_URL);
        if (!avatarMatch) {
          return res.status(400).json({
            success: false,
            message: 'Profile photo must be a JPEG, PNG, or WebP image.'
          });
        }

        if (Buffer.byteLength(avatarMatch[2], 'base64') > MAX_AVATAR_SIZE) {
          return res.status(400).json({
            success: false,
            message: 'Profile photos must be 2 MB or smaller.'
          });
        }

        updateFields.avatarUrl = avatarUrl;
      }
    }
    if (address) updateFields.address = address;
    if (notifications) updateFields.notifications = notifications;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateOperation,
      { new: true }
    );

    // Log profile update in ActivityLog
    await ActivityLog.create({
      action: 'PROFILE_UPDATED',
      organisationId: req.user.activeOrganisationId,
      userId: userId,
      userName: updatedUser.name,
      userEmail: updatedUser.email,
      actorRole: req.user.role,
      details: {
        fieldsChanged: Object.keys(updateFields)
      },
      ipAddress: req.ip || req.connection.remoteAddress || '127.0.0.1',
      timestamp: new Date().toISOString()
    }).catch(console.error);

    const userObj = updatedUser.toObject ? updatedUser.toObject() : { ...updatedUser };
    const { password: _, ...userSafe } = userObj;

    res.json({
      success: true,
      message: 'Profile information updated successfully.',
      user: userSafe
    });
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ success: false, message: 'Failed to update profile.', error: err.message });
  }
});

/**
 * GET /api/members/wallet-pass
 * Generate and return Google Wallet Pass details and interactive badge
 */
router.get('/wallet-pass', withSelectedMembership, requireActiveMembership, async (req, res) => {
  try {
    const passData = walletService.generateSaveUrl(req.membershipUser);
    res.json({
      success: true,
      saveUrl: passData.saveUrl,
      jwt: passData.jwt,
      passObject: passData.passObject
    });
  } catch (err) {
    console.error('Wallet pass error:', err);
    res.status(500).json({ success: false, message: 'Failed to generate wallet pass.', error: err.message });
  }
});

/**
 * GET /api/members/invoices
 * View historical payment invoices
 */
router.get('/invoices', withSelectedMembership, async (req, res) => {
  try {
    const userInvoices = await Invoice.find({ userId: String(req.user._id), organisationId: req.organisationId });
    const invoices = (Array.isArray(userInvoices) ? userInvoices : userInvoices._data || [])
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    res.json({
      success: true,
      invoices
    });
  } catch (err) {
    console.error('Fetch invoices error:', err);
    res.status(500).json({ success: false, message: 'Failed to load invoices.', error: err.message });
  }
});

/**
 * GET /api/members/invoices/:id/download
 * Download formatted invoice metadata for personal records
 */
router.get('/invoices/:id/download', withSelectedMembership, async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found.' });
    }

    // Ensure user owns invoice or is admin
    if (String(invoice.organisationId) !== req.organisationId || (String(invoice.userId) !== String(req.user._id) && req.membershipRole !== 'owner')) {
      return res.status(403).json({ success: false, message: 'Unauthorized invoice access.' });
    }

    res.json({
      success: true,
      invoice,
      downloadMetadata: {
        filename: `${invoice.invoiceNumber}.json`,
        downloadedAt: new Date().toISOString(),
        issuer: 'ReMember Club Inc.'
      }
    });
  } catch (err) {
    console.error('Download invoice error:', err);
    res.status(500).json({ success: false, message: 'Failed to download invoice.', error: err.message });
  }
});

export default router;
