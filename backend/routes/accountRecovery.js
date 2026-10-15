import express from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { User } from '../models/index.js';
import { config } from '../config/config.js';
import { mailDelivery } from '../services/mailDelivery.js';
import { passwordError } from '../../shared/accountRules.js';

const router = express.Router();
const RESET_FIELDS = '+password +passwordResetHash +passwordResetExpiresAt +passwordResetSentAt';
const hashToken = token => crypto.createHash('sha256').update(token).digest('hex');
const responseMessage = 'If an account with a password uses that email address, password reset instructions will be sent shortly.';

router.post('/forgot-password', async (req, res) => {
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ success: false, message: 'Enter a valid email address.' });
  if (!mailDelivery.isConfigured() || !config.APP_WEB_URL) return res.status(503).json({ success: false, message: 'Password reset emails are temporarily unavailable. Please try again later.' });
  try {
    const user = await User.findOne({ email }).select(RESET_FIELDS);
    if (user?.password) {
      const now = new Date();
      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = hashToken(token);
      const pending = await User.findOneAndUpdate({
        _id: user._id, password: user.password,
        $or: [{ passwordResetSentAt: { $exists: false } }, { passwordResetSentAt: null }, { passwordResetSentAt: { $lte: new Date(now.getTime() - 60_000) } }]
      }, { $set: { passwordResetHash: tokenHash, passwordResetExpiresAt: new Date(now.getTime() + 30 * 60_000), passwordResetSentAt: now } }, { new: true });
      if (pending) {
        try {
          const link = new URL(config.APP_WEB_URL);
          if (!['http:', 'https:'].includes(link.protocol)) throw new Error('Invalid application URL.');
          link.hash = `reset-password?token=${token}`;
          await mailDelivery.send({
            to: user.email, subject: 'Reset your ReMember password',
            text: `Use this link to reset your ReMember password: ${link.href}\n\nThis link expires in 30 minutes and can be used once. If you did not request a reset, you can ignore this email.`
          });
        } catch {
          await User.updateOne({ _id: user._id, passwordResetHash: tokenHash }, { $unset: { passwordResetHash: '', passwordResetExpiresAt: '' } });
          console.error('Password reset email delivery failed. Check SMTP configuration and application URL.');
        }
      }
    }
    return res.json({ success: true, message: responseMessage });
  } catch {
    return res.status(503).json({ success: false, message: 'Could not request a password reset. Please try again later.' });
  }
});

router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;
  const invalidPassword = passwordError(password);
  if (invalidPassword) return res.status(400).json({ success: false, message: invalidPassword });
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return res.status(400).json({ success: false, message: 'This reset link is invalid or has expired. Request another link.' });
  try {
    const filter = { passwordResetHash: hashToken(token), passwordResetExpiresAt: { $gt: new Date() } };
    const user = await User.findOne(filter).select(RESET_FIELDS);
    if (!user?.password) return res.status(400).json({ success: false, message: 'This reset link is invalid or has expired. Request another link.' });
    const updated = await User.findOneAndUpdate({ ...filter, _id: user._id, password: user.password }, {
      $set: { password: await bcrypt.hash(password, 10) }, $inc: { sessionVersion: 1 },
      $unset: { passwordResetHash: '', passwordResetExpiresAt: '', passwordResetSentAt: '' }
    }, { new: true });
    if (!updated) return res.status(400).json({ success: false, message: 'This reset link is invalid or has already been used.' });
    return res.json({ success: true, message: 'Your password has been reset. Sign in with your new password.' });
  } catch {
    return res.status(500).json({ success: false, message: 'Could not reset your password. Please try again.' });
  }
});

export default router;
