import express from 'express';
import { Tier } from '../models/index.js';
import { authenticateToken, requireVerifiedEmail } from '../middleware/auth.js';
import { withSelectedMembership } from '../services/membershipContext.js';
import { paymentGateway, paymentErrorResponse } from '../services/paymentGateway.js';

const router = express.Router();
router.use(authenticateToken, requireVerifiedEmail, withSelectedMembership);
router.use((req, res, next) => {
  const expected = req.method === 'GET' ? req.query.organisationId : req.body?.organisationId;
  if (expected !== undefined && expected !== req.organisationId) return res.status(409).json({ success: false, message: 'Your selected organisation has changed. Reload checkout before continuing.' });
  if (req.membershipRole !== 'member') return res.status(400).json({ success: false, message: 'Organisation owners do not need to purchase their own membership.' });
  next();
});

async function checkout(req, res, quoteOnly = false) {
  try {
    if (typeof req.body.tierId !== 'string') return res.status(400).json({ success: false, message: 'Choose a membership tier.' });
    const tier = await Tier.findOne({ _id: req.body.tierId, organisationId: req.organisationId, isActive: true });
    if (!tier) return res.status(400).json({ success: false, message: 'Choose an active tier in this organisation.' });
    const result = await paymentGateway[quoteOnly ? 'quoteCheckout' : 'createCheckout']({ user: req.user, organisation: req.organisation,
      membership: req.membership, tier, intent: req.body.intent });
    res.json({ success: true, ...result });
  } catch (error) { paymentErrorResponse(error, res); }
}
router.post('/quote', (req, res) => checkout(req, res, true));
router.post('/checkout', (req, res) => checkout(req, res));
// A legacy renewal request opens a checkout; it cannot bypass authorization.
router.post('/renew', (req, res) => {
  req.body.intent = 'renew';
  return checkout(req, res);
});
router.get('/checkout/:sessionId', async (req, res) => {
  try { res.json({ success: true, ...await paymentGateway.checkoutStatus(req.params.sessionId, req.user._id, req.organisationId) }); }
  catch (error) { paymentErrorResponse(error, res); }
});
router.post('/checkout/:sessionId/confirm', async (req, res) => {
  try {
    const { paymentMethod, scenario, verificationCode } = req.body;
    res.json({ success: true, ...await paymentGateway.confirmCheckout({ sessionId: req.params.sessionId, userId: req.user._id, organisationId: req.organisationId, paymentMethod, scenario, verificationCode }) });
  } catch (error) { paymentErrorResponse(error, res); }
});
router.post('/checkout/:sessionId/cancel', async (req, res) => {
  try { res.json({ success: true, ...await paymentGateway.cancelCheckout(req.params.sessionId, req.user._id, req.organisationId) }); }
  catch (error) { paymentErrorResponse(error, res); }
});

export default router;
