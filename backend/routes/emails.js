import express from 'express';
import { EmailNotification } from '../models/index.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/emails
 * Retrieve automated confirmation records and their delivery status
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const emails = await EmailNotification.find({ recipientEmail: req.user.email });

    emails.sort((a, b) => new Date(b.sentAt || b.createdAt) - new Date(a.sentAt || a.createdAt));

    res.json({
      success: true,
      emails: emails.map(email => {
        const record = email.toObject();
        // Old records said "sent" even though the app never contacted SMTP.
        return { ...record, status: record.deliveryMethod === 'smtp' ? record.status : 'recorded' };
      })
    });
  } catch (err) {
    console.error('Fetch emails error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch emails.', error: err.message });
  }
});

export default router;
