import express from 'express';
import { User, Tier, Invoice, ActivityLog, OrganisationMembership } from '../models/index.js';
import { authenticateToken, requireVerifiedEmail } from '../middleware/auth.js';
import { requireOrganisationOwner } from '../middleware/organisationAccess.js';
import { updateOrgMemberCount } from '../services/organisationAccess.js';
import { membershipView } from '../services/membershipContext.js';
import { walletService } from '../services/walletService.js';
import { billingRevisionFilter } from '../services/scheduledDowngrade.js';
import { adminMembershipStatus } from '../services/membershipState.js';
import { buildDashboardAnalytics, dashboardPeriod } from '../services/dashboardAnalytics.js';

const router = express.Router();
router.use(authenticateToken, requireVerifiedEmail, requireOrganisationOwner);

function adminMemberView(account, membership, organisation) {
  const member = membershipView(account, membership, organisation);
  return { ...member, accessStatus: member.status, status: adminMembershipStatus(membership),
    cancellationScheduled: member.status === 'active' && member.cancelAtPeriodEnd };
}

async function membersFor(organisationId) {
  const associations = await OrganisationMembership.find({ organisationId, role: 'member' });
  const accounts = await User.find({ _id: { $in: associations.map(item => item.userId) } });
  const byId = new Map(accounts.map(account => [String(account._id), account]));
  return associations.filter(item => byId.has(String(item.userId))).map(item => adminMemberView(byId.get(String(item.userId)), item));
}

router.get('/dashboard-analytics', async (req, res, next) => {
  try {
    const { months, startMonth, endMonth } = req.query;
    const now = new Date();
    try {
      dashboardPeriod({ months, startMonth, endMonth }, now);
    } catch (error) {
      if (error instanceof RangeError) return res.status(400).json({ success: false, message: error.message });
      throw error;
    }
    const [memberships, invoices] = await Promise.all([
      OrganisationMembership.find({ organisationId: req.organisationId, role: 'member' }).select('userId role status tierName joinedDate createdAt cancelAtPeriodEnd expirationDate').lean(),
      Invoice.find({ organisationId: req.organisationId }).select('amount currency paymentStatus paidAt createdAt').lean()
    ]);
    const users = memberships.length ? await User.find({ _id: { $in: memberships.map(member => member.userId) } }).select('country address.country').lean() : [];
    res.json(buildDashboardAnalytics({ memberships, users, invoices, months, startMonth, endMonth, now }));
  } catch (err) { next(err); }
});

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

router.get('/members/:id', async (req, res, next) => {
  try {
    const membership = await OrganisationMembership.findOne({ organisationId: req.organisationId, userId: req.params.id, role: 'member' });
    const account = membership && await User.findById(req.params.id);
    if (!account) return res.status(404).json({ success: false, message: 'Member not found in this organisation.' });
    res.json({ success: true, member: adminMemberView(account, membership) });
  } catch (err) { next(err); }
});

router.put('/members/:id/status', async (req, res, next) => {
  try {
    const { status, reason } = req.body;
    if (!['active', 'pending', 'suspended', 'revoked', 'expired'].includes(status)) return res.status(400).json({ success: false, message: 'Invalid membership status.' });
    let membership = await OrganisationMembership.findOne({ organisationId: req.organisationId, userId: req.params.id, role: 'member' });
    const account = membership && await User.findById(req.params.id);
    if (!account) return res.status(404).json({ success: false, message: 'Member not found in this organisation.' });
    const previousStatus = membership.status;
    if (status === 'active' && adminMembershipStatus(membership) === 'cancelled') {
      return res.status(409).json({ success: false, message: 'This member cancelled their subscription. They can undo a scheduled cancellation or renew through Manage Membership.' });
    }
    if (status === 'active' && previousStatus === 'pending') {
      const currentTier = await Tier.findOne({ _id: membership.tierId, organisationId: req.organisationId });
      if (currentTier?.price > 0) return res.status(409).json({ success: false, message: 'Complete the first payment through the payment gateway to activate this membership.' });
    }
    membership = await OrganisationMembership.findOneAndUpdate({ _id: membership._id, organisationId: req.organisationId, role: 'member',
      status: membership.status, ...billingRevisionFilter(membership)
    }, {
      $set: { status }, $inc: { billingRevision: 1 },
      ...(status !== previousStatus ? { $unset: { scheduledTierId: '', scheduledTierEffectiveAt: '', scheduledTierRequestedAt: '' } } : {})
    }, { new: true, runValidators: true });
    if (!membership) return res.status(409).json({ success: false, message: 'This membership changed. Reload it before changing its status.' });
    await updateOrgMemberCount(req.organisationId);
    const member = membershipView(account, membership, req.organisation);
    await walletService.updateWalletObject(member, req.user.name);
    await ActivityLog.create({ organisationId: req.organisationId, action: 'STATUS_UPDATED', userId: member._id, userName: member.name, userEmail: member.email, actorRole: 'admin', details: { previousStatus, newStatus: status, reason: String(reason || 'Administrative review'), adminId: req.user._id } });
    res.json({ success: true, message: 'Organisation membership status updated.', member: adminMemberView(account, membership, req.organisation) });
  } catch (err) { next(err); }
});

router.put('/members/:id/tier', async (req, res, next) => {
  try {
    let membership = await OrganisationMembership.findOne({ organisationId: req.organisationId, userId: req.params.id, role: 'member' });
    const account = membership && await User.findById(req.params.id);
    if (!account) return res.status(404).json({ success: false, message: 'Member not found in this organisation.' });
    const tier = await Tier.findOne({ _id: req.body.tierId, organisationId: req.organisationId, isActive: true });
    if (!tier) return res.status(404).json({ success: false, message: 'Tier not found in this organisation.' });
    const previousTier = membership.tierName;
    membership = await OrganisationMembership.findOneAndUpdate({ _id: membership._id, organisationId: req.organisationId, role: 'member',
      status: membership.status, ...billingRevisionFilter(membership)
    }, {
      $set: { tierId: tier._id, tierName: tier.name }, $inc: { billingRevision: 1 },
      ...(String(membership.tierId) !== String(tier._id) ? { $unset: { scheduledTierId: '', scheduledTierEffectiveAt: '', scheduledTierRequestedAt: '' } } : {})
    }, { new: true, runValidators: true });
    if (!membership) return res.status(409).json({ success: false, message: 'This membership changed. Reload it before changing its tier.' });
    const member = membershipView(account, membership, req.organisation);
    const walletSync = await walletService.updateWalletObject(member, req.user.name);
    await ActivityLog.create({ organisationId: req.organisationId, action: 'TIER_CHANGED', userId: member._id, userName: member.name, userEmail: member.email, actorRole: 'admin', details: { previousTier, newTier: tier.name, adminId: req.user._id } });
    res.json({ success: true, message: 'Organisation membership tier updated.', member: adminMemberView(account, membership, req.organisation), walletSync });
  } catch (err) { next(err); }
});

router.get('/financial-summary', async (req, res, next) => {
  try {
    const invoices = await Invoice.find({ organisationId: req.organisationId });
    const paid = invoices.filter(invoice => invoice.paymentStatus === 'paid' && String(invoice.currency || '').toUpperCase() === 'MYR');
    const revenueByTier = {};
    let totalSubscriptionRevenue = 0;
    let totalEventTicketingRevenue = 0;
    for (const invoice of paid) {
      const amount = Number(invoice.amount) || 0;
      if (invoice.category === 'event_ticket') totalEventTicketingRevenue += amount;
      else totalSubscriptionRevenue += amount;
      revenueByTier[invoice.tierName || 'Membership'] = (revenueByTier[invoice.tierName || 'Membership'] || 0) + amount;
    }
    const members = await OrganisationMembership.find({ organisationId: req.organisationId, role: 'member' });
    const latestByMember = new Map();
    for (const invoice of paid) {
      if (invoice.category === 'event_ticket') continue;
      const previous = latestByMember.get(invoice.userId);
      const invoiceTime = Date.parse(invoice.periodEnd || invoice.paidAt || invoice.createdAt) || 0;
      const previousTime = previous ? Date.parse(previous.periodEnd || previous.paidAt || previous.createdAt) || 0 : 0;
      if (!previous || invoiceTime > previousTime) latestByMember.set(invoice.userId, invoice);
    }
    const monthlyRecurringRevenue = members.reduce((total, member) => {
      if (member.status !== 'active' || !member.expirationDate || new Date(member.expirationDate) <= new Date()) return total;
      const invoice = latestByMember.get(member.userId);
      const planAmount = invoice && Number.isSafeInteger(invoice.coverageValueCents) ? invoice.coverageValueCents / 100 : Number(invoice?.amount || 0);
      return total + (invoice ? planAmount / (invoice.billingInterval === 'yearly' ? 12 : 1) : 0);
    }, 0);
    res.json({ success: true, metrics: { totalRevenue: totalSubscriptionRevenue + totalEventTicketingRevenue, totalSubscriptionRevenue, totalEventTicketingRevenue, monthlyRecurringRevenue, annualRunRate: monthlyRecurringRevenue * 12, paidInvoicesCount: paid.length, failedInvoicesCount: invoices.filter(invoice => invoice.paymentStatus === 'failed').length, totalTransactions: invoices.length, membersCount: members.length, activeMembersCount: members.filter(member => adminMembershipStatus(member) === 'active').length }, revenueByTier, recentTransactions: [...invoices].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 10) });
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
