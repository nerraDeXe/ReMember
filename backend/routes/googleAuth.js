import express from 'express';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { User, AuthChallenge } from '../models/index.js';
import { config } from '../config/config.js';
import { googleIdentity } from '../services/googleIdentity.js';
import { validateAccountDetails } from '../services/accountValidation.js';
import { issueSession } from '../services/sessions.js';
import { getAccountContext } from '../services/organisationAccess.js';

const options = { audience: 'remember-auth-flow', issuer: 'ReMember' };
async function createFlow(purpose, claims) {
  const id = crypto.randomUUID();
  await AuthChallenge.create({ _id: id, purpose, expiresAt: new Date(Date.now() + 10 * 60_000), consumed: false });
  return jwt.sign({ ...claims, purpose, jti: id }, config.JWT_SECRET, { ...options, expiresIn: '10m' });
}
function readFlow(token, purpose) {
  if (typeof token !== 'string' || token.length > 6000) throw new Error('Invalid flow token.');
  const payload = jwt.verify(token, config.JWT_SECRET, options);
  if (payload.purpose !== purpose || !payload.jti) throw new Error('Invalid flow token.');
  return payload;
}
async function consumeFlow(payload) {
  return AuthChallenge.findOneAndUpdate({ _id: payload.jti, purpose: payload.purpose, consumed: false, expiresAt: { $gt: new Date() } }, { $set: { consumed: true } }, { new: true });
}

export function createGoogleAuthRouter(sendVerification) {
  const router = express.Router();
  router.get('/google/config', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!googleIdentity.clientId()) return res.json({ enabled: false });
    try {
      const nonce = crypto.randomBytes(24).toString('hex');
      const challengeToken = await createFlow('google-challenge', { nonce });
      return res.json({ enabled: true, clientId: googleIdentity.clientId(), nonce, challengeToken });
    } catch { return res.status(503).json({ success: false, message: 'Google sign-in is temporarily unavailable.' }); }
  });

  router.post('/google', async (req, res) => {
    const { credential, challengeToken, rememberMe = false, intent = 'login' } = req.body;
    if (!googleIdentity.clientId()) return res.status(503).json({ success: false, message: 'Google sign-in is currently unavailable.' });
    if (typeof rememberMe !== 'boolean' || !['login', 'register'].includes(intent)) return res.status(400).json({ success: false, message: 'Invalid sign-in options.' });
    let claims;
    try {
      const flow = readFlow(challengeToken, 'google-challenge');
      if (typeof credential !== 'string' || credential.length > 12_000) throw new Error('Missing Google credential.');
      claims = await googleIdentity.verify(credential);
      if (!claims?.sub || typeof claims.sub !== 'string' || claims.email_verified !== true || typeof claims.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(claims.email) || claims.email.length > 254 || claims.nonce !== flow.nonce) throw new Error('Unverified Google identity.');
      if (!await consumeFlow(flow)) throw new Error('This sign-in attempt has already been used.');
    } catch { return res.status(401).json({ success: false, message: 'Google sign-in could not be verified. Please try again.' }); }
    try {
      const user = await User.findOne({ googleId: claims.sub });
      if (user) {
        if (intent === 'register') return res.status(409).json({ success: false, code: 'GOOGLE_ACCOUNT_EXISTS', email: user.email, message: 'This Google account already has a ReMember account. Choose Sign in with Google on the sign-in page.' });
        if (['revoked', 'suspended'].includes(user.status)) return res.status(403).json({ success: false, message: 'This account is unavailable. Contact administration.' });
        const verification = user.emailVerified ? undefined : await sendVerification(user);
        return res.json({ success: true, ...issueSession(user, rememberMe), user: await getAccountContext(user), verification });
      }
      if (await User.findOne({ email: claims.email.toLowerCase() })) return res.status(409).json({ success: false, code: 'ACCOUNT_EXISTS', email: claims.email.toLowerCase(), message: 'A ReMember account already uses this email. Sign in with its password or use Forgot password.' });
      const signupToken = await createFlow('google-signup', {
        googleId: claims.sub, email: claims.email.toLowerCase(),
        firstName: typeof claims.given_name === 'string' ? claims.given_name.slice(0, 100) : '',
        lastName: typeof claims.family_name === 'string' ? claims.family_name.slice(0, 100) : '', rememberMe,
        emailVerified: claims.email.toLowerCase().endsWith('@gmail.com') || Boolean(claims.hd)
      });
      return res.json({ success: true, signupRequired: true, signupToken, profile: { email: claims.email.toLowerCase(), firstName: claims.given_name || '', lastName: claims.family_name || '' }, rememberMe });
    } catch { return res.status(500).json({ success: false, message: 'Could not sign in with Google. Please try again.' }); }
  });

  router.post('/google/register', async (req, res) => {
    let flow, details;
    try { flow = readFlow(req.body.signupToken, 'google-signup'); }
    catch { return res.status(401).json({ success: false, message: 'Your Google signup has expired. Choose Google sign-up again.' }); }
    try { details = validateAccountDetails(req.body); }
    catch (error) { return res.status(400).json({ success: false, message: error.message }); }
    try {
      if (await User.findOne({ $or: [{ email: flow.email }, { googleId: flow.googleId }] })) return res.status(409).json({ success: false, code: 'ACCOUNT_EXISTS', message: 'This account already exists. Please sign in instead.' });
      if (!await consumeFlow(flow)) return res.status(401).json({ success: false, message: 'This Google signup has expired or was already completed. Please sign in again.' });
      const user = await User.create({ ...details, email: flow.email, googleId: flow.googleId, emailVerified: flow.emailVerified, onboardingCompleted: false, role: 'member', status: 'active', membershipNumber: `MEM-${crypto.randomBytes(12).toString('hex').toUpperCase()}` });
      const verification = user.emailVerified ? undefined : await sendVerification(user);
      return res.status(201).json({ success: true, ...issueSession(user, flow.rememberMe), user: await getAccountContext(user), verification });
    } catch (error) {
      if (error.code === 11000) return res.status(409).json({ success: false, code: 'ACCOUNT_EXISTS', message: 'This account already exists. Please sign in instead.' });
      return res.status(500).json({ success: false, message: 'Could not complete Google signup. Choose Google sign-up again to retry.' });
    }
  });
  return router;
}
