import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { User, ActivityLog } from '../models/index.js';
import { config } from '../config/config.js';
import { emailService } from '../services/emailService.js';
import { mailDelivery, logMailDeliveryFailure } from '../services/mailDelivery.js';
import { getAccountContext } from '../services/organisationAccess.js';
import { authenticateToken } from '../middleware/auth.js';
import { COUNTRIES } from '../../shared/countries.js';
import { passwordError } from '../../shared/accountRules.js';
import { normaliseAccountPhone } from '../services/accountValidation.js';
import { issueSession } from '../services/sessions.js';
import recoveryRoutes from './accountRecovery.js';
import { createGoogleAuthRouter } from './googleAuth.js';

const router = express.Router();
const CODE_LIFETIME_MS = 30 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_CODE_ATTEMPTS = 5;
const VERIFICATION_FIELDS = '+emailVerificationHash +emailVerificationExpiresAt +emailVerificationSentAt +emailVerificationAttempts';

const hashCode = (userId, code) => crypto.createHmac('sha256', config.JWT_SECRET)
  .update(`${userId}:${code}`).digest('hex');

function verificationSummary(user) {
  if (user.emailVerified) return undefined;
  const sentAt = user.emailVerificationSentAt && new Date(user.emailVerificationSentAt).getTime();
  const canResendAt = sentAt ? new Date(sentAt + RESEND_COOLDOWN_MS).toISOString() : null;
  if (!mailDelivery.isConfigured()) {
    return {
      delivery: 'unavailable',
      message: 'Verification email is unavailable. The ReMember administrator needs to configure email delivery.',
      canResendAt
    };
  }
  const active = user.emailVerificationHash && new Date(user.emailVerificationExpiresAt).getTime() > Date.now();
  return {
    delivery: active ? 'sent' : 'failed',
    message: active ? 'Enter the six-digit verification code sent to your email address.' : 'Request a new verification email to confirm your email address.',
    canResendAt
  };
}

async function sendVerification(user) {
  if (user.emailVerified) return { delivery: 'already_verified', message: 'Your email address is already verified.' };
  if (!mailDelivery.isConfigured()) return verificationSummary(user);

  const now = new Date();
  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
  const codeHash = hashCode(user._id, code);
  // Reserve the cooldown before delivery so parallel requests cannot send extra codes.
  const pending = await User.findOneAndUpdate({
    _id: user._id,
    emailVerified: { $ne: true },
    $or: [
      { emailVerificationSentAt: { $exists: false } },
      { emailVerificationSentAt: null },
      { emailVerificationSentAt: { $lte: new Date(now.getTime() - RESEND_COOLDOWN_MS) } }
    ]
  }, {
    $set: {
      emailVerificationHash: codeHash,
      emailVerificationExpiresAt: new Date(now.getTime() + CODE_LIFETIME_MS),
      emailVerificationSentAt: now,
      emailVerificationAttempts: 0
    }
  }, { new: true }).select(VERIFICATION_FIELDS);

  if (!pending) {
    const current = await User.findById(user._id).select(VERIFICATION_FIELDS);
    if (current?.emailVerified) return { delivery: 'already_verified', message: 'Your email address is already verified.' };
    return { ...verificationSummary(current || user), delivery: 'cooldown', message: 'Please wait one minute before requesting another verification email.' };
  }

  const canResendAt = new Date(now.getTime() + RESEND_COOLDOWN_MS).toISOString();
  try {
    await emailService.sendEmailVerification(pending, code);
    return { delivery: 'sent', message: 'A six-digit verification code has been sent to your email address.', canResendAt };
  } catch (error) {
    // A failed delivery must not leave a usable code. Retain the cooldown timestamp.
    await User.updateOne({ _id: user._id, emailVerificationHash: codeHash }, {
      $unset: { emailVerificationHash: '', emailVerificationExpiresAt: '', emailVerificationAttempts: '' }
    });
    logMailDeliveryFailure('verification', error);
    return { delivery: 'failed', message: 'Your account is saved, but the verification email could not be delivered. Please try again in one minute.', canResendAt };
  }
}

router.post('/register', async (req, res) => {
  try {
    const { firstName, lastName, email, password, country, phone = '', bio = '' } = req.body;
    if (![firstName, lastName, email, password, country].every(value => typeof value === 'string' && value.trim())) {
      return res.status(400).json({ success: false, message: 'First name, last name, email, password, and country are required.' });
    }
    if (firstName.trim().length > 100 || lastName.trim().length > 100) {
      return res.status(400).json({ success: false, message: 'First name and last name must each be 100 characters or fewer.' });
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (normalizedEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({ success: false, message: 'Enter a valid email address.' });
    }
    const invalidPassword = passwordError(password);
    if (invalidPassword) return res.status(400).json({ success: false, message: invalidPassword });
    const selectedCountry = COUNTRIES.find(item => item.name === country.trim() || item.code === country.trim().toUpperCase());
    if (!selectedCountry) {
      return res.status(400).json({ success: false, message: 'Choose a country from the country list.' });
    }
    if (typeof bio !== 'string' || bio.length > 500) {
      return res.status(400).json({ success: false, message: 'Member bio must be 500 characters or fewer.' });
    }
    let normalizedPhone;
    try { normalizedPhone = normaliseAccountPhone(phone, selectedCountry.name); }
    catch (error) { return res.status(400).json({ success: false, message: error.message }); }
    if (await User.findOne({ email: normalizedEmail })) {
      return res.status(409).json({ success: false, code: 'ACCOUNT_EXISTS', message: 'An account with this email address already exists. Sign in instead.' });
    }

    const now = new Date();
    const user = await User.create({
      firstName: firstName.trim(), lastName: lastName.trim(),
      name: `${firstName.trim()} ${lastName.trim()}`,
      email: normalizedEmail, password: await bcrypt.hash(password, 10),
      country: selectedCountry.name, address: { country: selectedCountry.name },
      phone: normalizedPhone, bio: bio.trim(), role: 'member', status: 'active',
      membershipNumber: `MEM-${crypto.randomBytes(12).toString('hex').toUpperCase()}`,
      joinedDate: now.toISOString(), emailVerified: false, onboardingCompleted: false
    });
    const verification = await sendVerification(user);
    await ActivityLog.create({
      action: 'USER_REGISTERED', userId: user._id, userName: user.name, userEmail: user.email,
      actorRole: 'member', details: { status: user.status, emailVerified: false },
      ipAddress: req.ip || req.connection?.remoteAddress || '127.0.0.1', timestamp: now.toISOString()
    }).catch(() => console.error('Could not record account registration activity.'));

    return res.status(201).json({
      success: true, message: 'Your ReMember account is created. Confirm your email address to continue.',
      ...issueSession(user), user: await getAccountContext(user), verification
    });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ success: false, message: 'An account with this email address already exists.' });
    console.error('Account registration failed.');
    return res.status(500).json({ success: false, message: 'Failed to complete registration.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password, rememberMe = false } = req.body;
    if (typeof rememberMe !== 'boolean') return res.status(400).json({ success: false, message: 'Remember Me must be true or false.' });
    if (typeof email !== 'string' || !email.trim() || typeof password !== 'string' || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }
    const user = await User.findOne({ email: email.toLowerCase().trim() }).select(`+password ${VERIFICATION_FIELDS}`);
    if (!user || !user.password || !await bcrypt.compare(password, user.password)) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }
    if (user.status === 'revoked' || user.status === 'suspended') {
      return res.status(403).json({ success: false, message: `This account is currently ${user.status}. Please contact administration.` });
    }
    let verification = verificationSummary(user);
    if (!user.emailVerified && (!user.emailVerificationHash || new Date(user.emailVerificationExpiresAt).getTime() <= Date.now())) {
      verification = await sendVerification(user);
    }
    return res.json({ success: true, message: `Welcome back, ${user.name}!`, ...issueSession(user, rememberMe), user: await getAccountContext(user), verification });
  } catch {
    console.error('Account login failed.');
    return res.status(500).json({ success: false, message: 'Authentication failed.' });
  }
});

router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select(VERIFICATION_FIELDS);
    return res.json({ success: true, user: await getAccountContext(user), verification: verificationSummary(user) });
  } catch {
    return res.status(500).json({ success: false, message: 'Could not load your account.' });
  }
});

router.post('/resend-verification', authenticateToken, async (req, res) => {
  try {
    const verification = await sendVerification(req.user);
    if (verification.delivery === 'cooldown') {
      const retryAfterSeconds = Math.max(1, Math.ceil((new Date(verification.canResendAt).getTime() - Date.now()) / 1000));
      res.set('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({ success: false, message: verification.message, verification, retryAfterSeconds });
    }
    const delivered = verification.delivery === 'sent' || verification.delivery === 'already_verified';
    return res.status(delivered ? 200 : 503).json({ success: delivered, message: verification.message, verification });
  } catch {
    return res.status(500).json({ success: false, message: 'Could not send a verification email. Please try again.' });
  }
});

router.post('/verify-email', authenticateToken, async (req, res) => {
  try {
    const code = typeof req.body.code === 'string' ? req.body.code.trim() : '';
    if (!/^\d{6}$/.test(code)) return res.status(400).json({ success: false, message: 'Enter the six-digit code from your verification email.' });
    const user = await User.findById(req.user._id).select(VERIFICATION_FIELDS);
    if (user.emailVerified) return res.json({ success: true, message: 'Your email address is already verified.', ...issueSession(user, req.auth.rememberMe, req.auth.exp), user: await getAccountContext(user) });
    if (!user.emailVerificationHash || new Date(user.emailVerificationExpiresAt).getTime() <= Date.now()) {
      return res.status(400).json({ success: false, message: 'Your verification code has expired or was not sent. Request a new code.' });
    }
    if (user.emailVerificationAttempts >= MAX_CODE_ATTEMPTS) {
      return res.status(400).json({ success: false, message: 'Too many incorrect verification attempts. Request a new code.' });
    }
    const expectedHash = Buffer.from(user.emailVerificationHash, 'hex');
    const providedHash = Buffer.from(hashCode(user._id, code), 'hex');
    if (expectedHash.length !== providedHash.length || !crypto.timingSafeEqual(expectedHash, providedHash)) {
      await User.updateOne({ _id: user._id, emailVerified: { $ne: true }, emailVerificationHash: user.emailVerificationHash, emailVerificationAttempts: { $lt: MAX_CODE_ATTEMPTS } }, { $inc: { emailVerificationAttempts: 1 } });
      return res.status(400).json({ success: false, message: 'The verification code is incorrect. Check your email and try again.' });
    }
    const verifiedUser = await User.findOneAndUpdate({
      _id: user._id, emailVerified: { $ne: true }, emailVerificationHash: user.emailVerificationHash,
      emailVerificationExpiresAt: { $gt: new Date() }, emailVerificationAttempts: { $lt: MAX_CODE_ATTEMPTS }
    }, {
      $set: { emailVerified: true },
      $unset: { emailVerificationHash: '', emailVerificationExpiresAt: '', emailVerificationSentAt: '', emailVerificationAttempts: '' }
    }, { new: true });
    if (!verifiedUser) return res.status(400).json({ success: false, message: 'This code is no longer valid. Request a new verification code.' });
    return res.json({ success: true, message: 'Your email address is confirmed.', ...issueSession(verifiedUser, req.auth.rememberMe, req.auth.exp), user: await getAccountContext(verifiedUser) });
  } catch {
    return res.status(500).json({ success: false, message: 'Could not confirm your email address. Please try again.' });
  }
});

router.use(recoveryRoutes);
router.use(createGoogleAuthRouter(sendVerification));
export default router;
