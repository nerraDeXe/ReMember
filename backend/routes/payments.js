import express from 'express';
import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import { Tier, Invoice, ActivityLog, OrganisationMembership } from '../models/index.js';
import { authenticateToken, requireVerifiedEmail } from '../middleware/auth.js';
import { withSelectedMembership, membershipView } from '../services/membershipContext.js';
import { getAccountContext, updateOrgMemberCount } from '../services/organisationAccess.js';
import { emailService } from '../services/emailService.js';
import { walletService } from '../services/walletService.js';

const router = express.Router();
router.post('/renew', authenticateToken, requireVerifiedEmail, withSelectedMembership, async (req, res, next) => {
  try {
    if (req.membershipRole !== 'member') return res.status(400).json({ success: false, message: 'Organisation owners do not need to purchase their own membership.' });
    const tier = await Tier.findOne({ _id: req.body.tierId || req.membership.tierId, organisationId: req.organisationId, isActive: true });
    if (!tier) return res.status(400).json({ success: false, message: 'Choose an active tier in this organisation.' });
    if (tier.maxMembers) {
      const reserved = await OrganisationMembership.countDocuments({ organisationId: req.organisationId, tierId: tier._id, role: 'member', userId: { $ne: String(req.user._id) }, status: { $in: ['active', 'pending'] } });
      if (reserved >= tier.maxMembers) return res.status(409).json({ success: false, message: 'This membership tier has reached its capacity.' });
    }
    const now = new Date();
    const previousExpiry = req.membership.expirationDate && new Date(req.membership.expirationDate);
    const expiry = new Date(previousExpiry > now ? previousExpiry : now);
    if (tier.interval === 'monthly') expiry.setMonth(expiry.getMonth() + 1);
    else expiry.setFullYear(expiry.getFullYear() + 1);
    const failed = req.body.simulateFailure === true;
    const invoiceData = {
      organisationId: req.organisationId,
      invoiceNumber: `INV-${randomUUID()}`,
      userId: String(req.user._id), userName: req.user.name, userEmail: req.user.email,
      tierId: tier._id, tierName: tier.name, amount: tier.price, currency: 'USD',
      billingInterval: tier.interval,
      paymentMethod: req.body.paymentMethod || 'Test payment',
      paymentStatus: failed ? 'failed' : 'paid',
      transactionId: `txn_test_${randomUUID()}`,
      periodStart: now.toISOString(), periodEnd: failed ? undefined : expiry.toISOString(), paidAt: failed ? undefined : now.toISOString(),
    };
    if (failed) {
      const invoice = await Invoice.create(invoiceData);
      await ActivityLog.create({ organisationId: req.organisationId, action: 'PAYMENT_FAILED', userId: String(req.user._id), userName: req.user.name, userEmail: req.user.email, actorRole: 'member', details: { invoiceNumber: invoice.invoiceNumber, amount: tier.price } });
      return res.status(402).json({ success: false, message: 'The test payment was declined.', invoice });
    }
    let invoice;
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        [invoice] = await Invoice.create([invoiceData], { session });
        req.membership.status = 'active';
        req.membership.tierId = tier._id;
        req.membership.tierName = tier.name;
        req.membership.expirationDate = expiry.toISOString();
        await req.membership.save({ session });
      });
    } finally { await session.endSession(); }
    await updateOrgMemberCount(req.organisationId);
    const member = membershipView(req.user, req.membership);
    await walletService.updateWalletObject(member, 'MembershipPayment');
    emailService.sendPaymentConfirmation(member, invoice).catch(() => console.error('Could not record payment confirmation.'));
    await ActivityLog.create({ organisationId: req.organisationId, action: 'PAYMENT_SUCCESS', userId: member._id, userName: member.name, userEmail: member.email, actorRole: 'member', details: { invoiceNumber: invoice.invoiceNumber, amount: tier.price, tierName: tier.name } });
    res.json({ success: true, message: 'Test payment completed. Your organisation membership is active.', invoice, user: await getAccountContext(req.user) });
  } catch (err) { next(err); }
});

export default router;
