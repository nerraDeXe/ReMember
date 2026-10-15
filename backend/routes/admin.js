import express from 'express';
import { User, Tier, Invoice, ActivityLog, OrganisationMembership } from '../models/index.js';
import { authenticateToken, requireVerifiedEmail } from '../middleware/auth.js';
import { requireOrganisationOwner } from '../middleware/organisationAccess.js';
import { updateOrgMemberCount } from '../services/organisationAccess.js';
import { membershipView } from '../services/membershipContext.js';
import { walletService } from '../services/walletService.js';

const router = express.Router();
router.use(authenticateToken, requireVerifiedEmail, requireOrganisationOwner);

async function membersFor(organisationId) {
  const associations = await OrganisationMembership.find({ organisationId, role: 'member' });
  const accounts = await User.find({ _id: { $in: associations.map(item => item.userId) } });
  const byId = new Map(accounts.map(account => [String(account._id), account]));
  return associations.filter(item => byId.has(String(item.userId))).map(item => membershipView(byId.get(String(item.userId)), item));
}

router.get('/members', async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit) || 10));
    const search = String(req.query.search || '').trim().toLowerCase();
    let members = await membersFor(req.organisationId);
    if (search) members = members.filter(member => [member.name, member.email, member.membershipNumber, member.tierName].some(value => String(value || '').toLowerCase().includes(search)));
    if (req.query.status && req.query.status !== 'all') members = members.filter(member => member.status === req.query.status);
    if (req.query.tier && req.query.tier !== 'all') members = members.filter(member => member.tierId === req.query.tier || member.tierName === req.query.tier);
    const totalMembers = members.length;
    const totalPages = Math.ceil(totalMembers / limit) || 1;
    res.json({ success: true, members: members.slice((page - 1) * limit, page * limit), pagination: { page, limit, totalMembers, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 } });
  } catch (err) { next(err); }
});

router.put('/members/:id/status', async (req, res, next) => {
  try {
    const { status, reason } = req.body;
    if (!['active', 'pending', 'suspended', 'revoked', 'expired'].includes(status)) return res.status(400).json({ success: false, message: 'Invalid membership status.' });
    const membership = await OrganisationMembership.findOne({ organisationId: req.organisationId, userId: req.params.id, role: 'member' });
    const account = membership && await User.findById(req.params.id);
    if (!account) return res.status(404).json({ success: false, message: 'Member not found in this organisation.' });
    const previousStatus = membership.status;
    membership.status = status;
    await membership.save();
    await updateOrgMemberCount(req.organisationId);
    const member = membershipView(account, membership);
    await walletService.updateWalletObject(member, req.user.name);
    await ActivityLog.create({ organisationId: req.organisationId, action: 'STATUS_UPDATED', userId: member._id, userName: member.name, userEmail: member.email, actorRole: 'admin', details: { previousStatus, newStatus: status, reason: String(reason || 'Administrative review'), adminId: req.user._id } });
    res.json({ success: true, message: 'Organisation membership status updated.', member });
  } catch (err) { next(err); }
});

router.put('/members/:id/tier', async (req, res, next) => {
  try {
    const membership = await OrganisationMembership.findOne({ organisationId: req.organisationId, userId: req.params.id, role: 'member' });
    const account = membership && await User.findById(req.params.id);
    if (!account) return res.status(404).json({ success: false, message: 'Member not found in this organisation.' });
    const tier = await Tier.findOne({ _id: req.body.tierId, organisationId: req.organisationId, isActive: true });
    if (!tier) return res.status(404).json({ success: false, message: 'Tier not found in this organisation.' });
    const previousTier = membership.tierName;
    membership.tierId = tier._id;
    membership.tierName = tier.name;
    await membership.save();
    const member = membershipView(account, membership);
    const walletSync = await walletService.updateWalletObject(member, req.user.name);
    await ActivityLog.create({ organisationId: req.organisationId, action: 'TIER_CHANGED', userId: member._id, userName: member.name, userEmail: member.email, actorRole: 'admin', details: { previousTier, newTier: tier.name, adminId: req.user._id } });
    res.json({ success: true, message: 'Organisation membership tier updated.', member, walletSync });
  } catch (err) { next(err); }
});

router.get('/financial-summary', async (req, res, next) => {
  try {
    const invoices = await Invoice.find({ organisationId: req.organisationId });
    const paid = invoices.filter(invoice => invoice.paymentStatus === 'paid');
    const revenueByTier = {};
    let totalSubscriptionRevenue = 0;
    let totalEventTicketingRevenue = 0;
    for (const invoice of paid) {
      const amount = Number(invoice.amount) || 0;
      if (invoice.category === 'event_ticket') totalEventTicketingRevenue += amount;
      else totalSubscriptionRevenue += amount;
      revenueByTier[invoice.tierName || 'Membership'] = (revenueByTier[invoice.tierName || 'Membership'] || 0) + amount;
    }
    const monthlyRecurringRevenue = paid.filter(invoice => invoice.billingInterval === 'monthly').reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);
    const members = await OrganisationMembership.find({ organisationId: req.organisationId, role: 'member' });
    res.json({ success: true, metrics: { totalRevenue: totalSubscriptionRevenue + totalEventTicketingRevenue, totalSubscriptionRevenue, totalEventTicketingRevenue, monthlyRecurringRevenue, annualRunRate: monthlyRecurringRevenue * 12, paidInvoicesCount: paid.length, failedInvoicesCount: invoices.filter(invoice => invoice.paymentStatus === 'failed').length, totalTransactions: invoices.length, membersCount: members.length, activeMembersCount: members.filter(member => member.status === 'active').length }, revenueByTier, recentTransactions: [...invoices].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 10) });
  } catch (err) { next(err); }
});

router.get('/export-csv', async (req, res, next) => {
  try {
    let members = await membersFor(req.organisationId);
    if (req.query.status && req.query.status !== 'all') members = members.filter(member => member.status === req.query.status);
    if (req.query.tier && req.query.tier !== 'all') members = members.filter(member => member.tierId === req.query.tier || member.tierName === req.query.tier);
    const escapeCsv = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows = members.map(member => [member.membershipNumber, member.name, member.email, member.phone, member.tierName, member.status, member.joinedDate, member.expirationDate, member.country || member.address?.country].map(escapeCsv).join(','));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="organisation_members.csv"');
    res.send(['MembershipNumber,Name,Email,Phone,Tier,Status,JoinedDate,ExpirationDate,Country', ...rows].join('\r\n'));
  } catch (err) { next(err); }
});

router.get('/activity-logs', async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit) || 20));
    const filter = { organisationId: req.organisationId };
    if (req.query.action && req.query.action !== 'all') filter.action = req.query.action;
    const logs = await ActivityLog.find(filter).sort({ timestamp: -1 });
    res.json({ success: true, logs: logs.slice((page - 1) * limit, page * limit), pagination: { page, limit, totalLogs: logs.length, totalPages: Math.ceil(logs.length / limit) || 1 } });
  } catch (err) { next(err); }
});

export default router;
