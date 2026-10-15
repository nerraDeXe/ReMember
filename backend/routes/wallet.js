import express from 'express';
import { User, OrganisationMembership } from '../models/index.js';
import { authenticateToken, requireVerifiedEmail } from '../middleware/auth.js';
import { withSelectedMembership, requireActiveMembership, membershipView } from '../services/membershipContext.js';
import { walletService } from '../services/walletService.js';

const router = express.Router();
router.use(authenticateToken, requireVerifiedEmail, withSelectedMembership, requireActiveMembership);

router.get('/pass', (req, res) => {
  const pass = walletService.generateSaveUrl(req.membershipUser);
  res.json({ success: true, ...pass });
});

router.put('/update-object/:memberId', async (req, res, next) => {
  try {
    if (String(req.params.memberId) !== String(req.user._id) && req.membershipRole !== 'owner') {
      return res.status(403).json({ success: false, message: 'You can only sync your own membership pass.' });
    }
    const membership = await OrganisationMembership.findOne({ organisationId: req.organisationId, userId: req.params.memberId });
    const account = membership && await User.findById(req.params.memberId);
    if (!account) return res.status(404).json({ success: false, message: 'Member not found in this organisation.' });
    const result = await walletService.updateWalletObject(membershipView(account, membership), req.user.name);
    res.json({ success: true, message: 'Organisation membership pass synced.', result });
  } catch (err) { next(err); }
});

export default router;
