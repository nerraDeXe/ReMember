import express from 'express';
import { EmailNotification } from '../models/index.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/emails
 * Retrieve sent automated email confirmations
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    let emails = [];

    emails = await EmailNotification.find({ recipientEmail: user.email });

    // Sort descending by sentAt
    emails.sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt));

    res.json({
      success: true,
      emails
    });
  } catch (err) {
    console.error('Fetch emails error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch emails.', error: err.message });
  }
});

export default router;
