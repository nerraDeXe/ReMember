import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { PaymentCheckout, Invoice, Organisation, OrganisationMembership, Tier, User, ActivityLog } from '../models/index.js';
import { membershipView } from './membershipContext.js';
import { updateOrgMemberCount } from './organisationAccess.js';
import { emailService } from './emailService.js';
import { walletService } from './walletService.js';
import { sendWelcomeForMembership } from './organisationEmailSettings.js';
import { dateMilliseconds, equivalentMonthlyCents, membershipBillingRevision, membershipCreditBalance,
  membershipPeriodEnd, paidMembershipPeriods, unusedMembershipCredit } from './membershipProration.js';

const methods = Object.freeze({ card: 'Demo card', online_banking: 'Online banking (demo)', ewallet: 'E-wallet (demo)' });
const payableStatuses = ['pending', 'active', 'expired', 'cancelled'];

export class PaymentError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export function paymentErrorResponse(error, res) {
  if (error instanceof PaymentError) return res.status(error.status).json({ success: false, message: error.message });
  console.error('[Payment gateway] Could not process the demo payment.');
  return res.status(503).json({ success: false, message: 'Could not confirm the payment. Check its status before trying again.' });
}

function checkoutView(checkout) {
  return { id: checkout._id, _id: checkout._id, reference: checkout.reference,
    organisationId: checkout.organisationId, organisationName: checkout.organisationName,
    tierId: checkout.tierId, tierName: checkout.tierName, amountCents: checkout.amountCents,
    currency: 'MYR', billingInterval: checkout.billingInterval, interval: checkout.billingInterval,
    ...quoteView(checkout),
    expiresAt: checkout.expiresAt, state: checkout.state, paymentMethod: checkout.paymentMethod, simulated: true };
}

function quoteView(quote) {
  const fields = ['intent', 'tierId', 'tierName', 'amountCents', 'subtotalCents', 'creditCents', 'unusedCreditCents',
    'creditBalanceCents', 'carryForwardCents', 'billingInterval', 'periodStart', 'periodEnd', 'previousPeriodStart',
    'previousPeriodEnd', 'remainingDays', 'totalDays', 'sourceTierId', 'sourceTierName', 'creditUnavailable', 'scheduledDowngrade'];
  return { ...Object.fromEntries(fields.filter(key => quote[key] !== undefined).map(key => [key, quote[key]])), currency: 'MYR' };
}

function resultFor(checkout, invoice) {
  return { paymentStatus: checkout.state, checkout: checkoutView(checkout), ...(invoice ? { invoice } : {}) };
}

export function createPaymentGateway({ now = () => new Date() } = {}) {
  const currentTime = () => new Date(now());

  async function capacityFor(tier, membership, session) {
    if (!tier.maxMembers) return;
    const query = OrganisationMembership.countDocuments({ organisationId: String(membership.organisationId),
      tierId: String(tier._id), role: 'member', userId: { $ne: String(membership.userId) }, status: { $in: ['active', 'pending'] } });
    const count = await (session ? query.session(session) : query);
    if (count >= tier.maxMembers) throw new PaymentError(409, 'This membership tier has reached its capacity.');
  }

  async function findCheckout(sessionId, userId, organisationId, session) {
    if (typeof sessionId !== 'string' || !/^pay_[a-f0-9]{32}$/.test(sessionId)) throw new PaymentError(404, 'Checkout not found for this membership.');
    const query = PaymentCheckout.findOne({ _id: sessionId, userId: String(userId), organisationId: String(organisationId) });
    const checkout = await (session ? query.session(session) : query);
    if (!checkout) throw new PaymentError(404, 'Checkout not found for this membership.');
    return checkout;
  }

  async function buildQuote({ user, organisation, membership, tier, intent }, session) {
    if (String(membership.userId) !== String(user._id) || String(membership.organisationId) !== String(organisation._id) || membership.role !== 'member' || !payableStatuses.includes(membership.status)) throw new PaymentError(403, 'This membership cannot make a payment.');
    const timestamp = currentTime();
    if ((membership.cancelAtPeriodEnd || membership.status === 'cancelled')
      && dateMilliseconds(membership.expirationDate) > timestamp.getTime()) throw new PaymentError(409, 'Resume your membership before upgrading or renewing it.');
    const subtotalCents = Math.round(tier.price * 100);
    if (!Number.isFinite(tier.price) || tier.price <= 0 || !Number.isSafeInteger(subtotalCents) || subtotalCents <= 0) throw new PaymentError(400, 'Choose a paid membership tier.');
    if (!['monthly', 'yearly'].includes(tier.interval) || tier.isActive === false || String(tier.organisationId) !== String(organisation._id)) throw new PaymentError(400, 'Choose an active monthly or yearly tier in this organisation.');
    if (membership.status === 'pending' && String(tier._id) !== String(membership.tierId)) throw new PaymentError(400, 'Complete payment for the membership tier you joined.');
    const sameTier = String(tier._id) === String(membership.tierId);
    const resolvedIntent = intent ?? (membership.status === 'pending' ? 'join' : 'renew');
    if (!['join', 'renew', 'upgrade'].includes(resolvedIntent)) throw new PaymentError(400, 'Choose whether to join, renew, or upgrade this membership.');
    if (membership.status === 'pending' && resolvedIntent !== 'join') throw new PaymentError(400, 'Complete your initial membership payment first.');
    if (membership.status !== 'pending' && resolvedIntent === 'join') throw new PaymentError(400, 'This membership has already been activated.');
    const scheduledDowngrade = resolvedIntent === 'renew' && Boolean(membership.scheduledTierId);
    if (scheduledDowngrade) {
      if (String(tier._id) !== String(membership.scheduledTierId)) throw new PaymentError(409, 'A downgrade is scheduled. Cancel that change before renewing your current tier.');
      if (!Number.isFinite(dateMilliseconds(membership.scheduledTierEffectiveAt))
        || !Number.isFinite(dateMilliseconds(membership.expirationDate))
        || timestamp.getTime() < dateMilliseconds(membership.scheduledTierEffectiveAt)
        || timestamp.getTime() < dateMilliseconds(membership.expirationDate)) throw new PaymentError(409, 'Your current paid membership has not ended yet. Renew the cheaper tier when that period ends.');
      await validateScheduledTier(tier, membership, organisation._id, session);
    } else if (resolvedIntent === 'renew' && !sameTier) throw new PaymentError(400, 'Renewal keeps your current tier. Choose an upgrade to change tiers.');
    let currentTier;
    if (resolvedIntent === 'upgrade') {
      if (membership.status !== 'active' || (membership.expirationDate && (!Number.isFinite(dateMilliseconds(membership.expirationDate))
        || dateMilliseconds(membership.expirationDate) <= timestamp.getTime()))) throw new PaymentError(409, 'An active membership is required to upgrade. Renew your current membership first.');
      if (sameTier) throw new PaymentError(400, 'Choose a higher membership tier to upgrade.');
      const query = Tier.findOne({ _id: String(membership.tierId), organisationId: String(organisation._id) });
      currentTier = await (session ? query.session(session) : query);
      if (!currentTier || !Number.isFinite(equivalentMonthlyCents(currentTier))) throw new PaymentError(409, 'Your current membership tier could not be verified. Contact the organisation before upgrading.');
      if (equivalentMonthlyCents(tier) <= equivalentMonthlyCents(currentTier)) throw new PaymentError(400, 'An upgrade must have a higher equivalent monthly price than your current tier.');
    }
    await capacityFor(tier, membership, session);
    const query = Invoice.find({ userId: String(user._id), organisationId: String(organisation._id), paymentStatus: 'paid', category: { $ne: 'event_ticket' } });
    const invoices = await (session ? query.session(session) : query);
    const sourcePeriods = paidMembershipPeriods(membership, invoices);
    const unused = unusedMembershipCredit(sourcePeriods, timestamp);
    const unusedCreditCents = resolvedIntent === 'upgrade' ? unused.creditCents : 0;
    const creditBalanceCents = membershipCreditBalance(membership);
    const availableCreditCents = unusedCreditCents + creditBalanceCents;
    if (!Number.isSafeInteger(availableCreditCents)) throw new PaymentError(409, 'Your membership credit could not be calculated. Contact the organisation.');
    const creditCents = Math.min(subtotalCents, availableCreditCents);
    const start = resolvedIntent === 'renew' && dateMilliseconds(membership.expirationDate) > timestamp.getTime() ? membership.expirationDate : timestamp.toISOString();
    return { intent: resolvedIntent, scheduledDowngrade, tierId: String(tier._id), tierName: tier.name, amountCents: subtotalCents - creditCents,
      subtotalCents, creditCents, unusedCreditCents, creditBalanceCents, carryForwardCents: availableCreditCents - creditCents,
      billingInterval: tier.interval, periodStart: new Date(start).toISOString(), periodEnd: membershipPeriodEnd(start, tier.interval),
      previousPeriodStart: unused.previousPeriodStart, previousPeriodEnd: unused.previousPeriodEnd,
      remainingDays: unused.remainingDays, totalDays: unused.totalDays,
      creditUnavailable: resolvedIntent === 'upgrade' && currentTier.price > 0
        && !sourcePeriods.some(period => dateMilliseconds(period.periodEnd) > timestamp.getTime()),
      sourceTierId: membership.tierId, sourceTierName: membership.tierName,
      sourceExpirationDate: membership.expirationDate, sourceMembershipStatus: membership.status,
      sourceBillingRevision: membershipBillingRevision(membership), sourcePeriods,
      sourceScheduledTierId: membership.scheduledTierId,
      sourceScheduledTierEffectiveAt: membership.scheduledTierEffectiveAt };
  }

  async function validateScheduledTier(tier, membership, organisationId, session) {
    const query = Tier.findOne({ _id: String(membership.tierId), organisationId: String(organisationId) });
    const currentTier = await (session ? query.session(session) : query);
    const targetPrice = equivalentMonthlyCents(tier);
    const currentPrice = equivalentMonthlyCents(currentTier);
    if (!currentTier || !Number.isFinite(targetPrice) || !Number.isFinite(currentPrice)
      || targetPrice >= currentPrice) throw new PaymentError(409, 'The scheduled tier is no longer cheaper than your current tier. Cancel the scheduled change and choose a membership again.');
  }

  async function quoteCheckout(input) { return { quote: quoteView(await buildQuote(input)) }; }

  async function createCheckout(input) {
    const { user, organisation, membership, tier } = input;
    const quote = await buildQuote(input);
    const timestamp = currentTime();
    const previous = await PaymentCheckout.findOne({ membershipId: String(membership._id), tierId: String(tier._id),
      intent: quote.intent, sourceBillingRevision: quote.sourceBillingRevision,
      sourceTierId: quote.sourceTierId, sourceMembershipStatus: quote.sourceMembershipStatus,
      ...(quote.sourceExpirationDate ? { sourceExpirationDate: quote.sourceExpirationDate } : { sourceExpirationDate: { $exists: false } }),
      state: 'pending', expiresAt: { $gt: timestamp.toISOString() } });
    if (previous) return resultFor(previous);
    const token = randomUUID().replaceAll('-', '');
    const checkout = await PaymentCheckout.create({ _id: `pay_${token}`, reference: `PAY-${token.slice(0, 16).toUpperCase()}`,
      membershipId: String(membership._id), organisationId: String(organisation._id), organisationName: organisation.name,
      userId: String(user._id), userName: user.name, userEmail: user.email, tierId: String(tier._id), tierName: tier.name,
      ...quote, expiresAt: new Date(Math.min(timestamp.getTime() + 15 * 60 * 1000,
        quote.intent === 'upgrade' && membership.expirationDate ? dateMilliseconds(membership.expirationDate) : Infinity)).toISOString(), state: 'pending' });
    return resultFor(checkout);
  }

  async function checkoutStatus(sessionId, userId, organisationId) {
    let checkout = await findCheckout(sessionId, userId, organisationId);
    if (checkout.state === 'pending' && new Date(checkout.expiresAt) <= currentTime()) {
      checkout = await PaymentCheckout.findOneAndUpdate({ _id: checkout._id, state: 'pending' }, { $set: { state: 'expired' } }, { new: true })
        || await findCheckout(sessionId, userId, organisationId);
    }
    const invoice = ['paid', 'failed'].includes(checkout.state) ? await Invoice.findOne({ paymentCheckoutId: checkout._id }) : null;
    return resultFor(checkout, invoice);
  }

  async function confirmCheckout({ sessionId, userId, organisationId, paymentMethod, scenario, verificationCode }) {
    if (!Object.hasOwn(methods, paymentMethod) || !['approved', 'declined'].includes(scenario)) throw new PaymentError(400, 'Choose a demo payment method and payment result.');
    if (verificationCode !== '123456') throw new PaymentError(400, 'Enter the demo verification code 123456.');
    const session = await mongoose.startSession();
    let checkout, invoice, membership, user, organisation, newlyPaid = false;
    try {
      await session.withTransaction(async () => {
        newlyPaid = false;
        checkout = await findCheckout(sessionId, userId, organisationId, session);
        if (['paid', 'failed'].includes(checkout.state)) {
          invoice = await Invoice.findOne({ paymentCheckoutId: checkout._id }).session(session);
          return;
        }
        if (checkout.state === 'expired' || new Date(checkout.expiresAt) <= currentTime()) throw new PaymentError(410, 'This checkout has expired. Start a new payment.');
        if (checkout.state !== 'pending') throw new PaymentError(409, 'This checkout was cancelled. Start a new payment.');
        membership = await OrganisationMembership.findById(checkout.membershipId).session(session);
        if (!membership || membership.userId !== checkout.userId || membership.organisationId !== checkout.organisationId || membership.role !== 'member' || !payableStatuses.includes(membership.status)) throw new PaymentError(403, 'This membership cannot make a payment.');
        if (!checkout.intent || (membership.cancelAtPeriodEnd && dateMilliseconds(membership.expirationDate) > currentTime().getTime())
          || membershipBillingRevision(membership) !== checkout.sourceBillingRevision
          || String(membership.tierId) !== String(checkout.sourceTierId)
          || (membership.scheduledTierId || null) !== (checkout.sourceScheduledTierId || null)
          || (membership.scheduledTierEffectiveAt || null) !== (checkout.sourceScheduledTierEffectiveAt || null)
          || (membership.expirationDate || null) !== (checkout.sourceExpirationDate || null)
          || membership.status !== checkout.sourceMembershipStatus
          || membershipCreditBalance(membership) !== checkout.creditBalanceCents) throw new PaymentError(409, 'Your membership has changed. Start a new checkout to recalculate its payment and credit.');
        if (checkout.intent === 'upgrade' && (membership.status !== 'active'
          || (membership.expirationDate && dateMilliseconds(membership.expirationDate) <= currentTime().getTime()))) throw new PaymentError(409, 'Your membership period has ended. Renew your current membership first.');
        const tier = await Tier.findOne({ _id: checkout.tierId, organisationId: checkout.organisationId, isActive: true }).session(session);
        if (!tier) throw new PaymentError(409, 'This membership tier is no longer available.');
        if (checkout.scheduledDowngrade) {
          if (checkout.intent !== 'renew' || String(membership.scheduledTierId) !== String(tier._id)
            || !Number.isFinite(dateMilliseconds(membership.scheduledTierEffectiveAt))
            || !Number.isFinite(dateMilliseconds(membership.expirationDate))
            || currentTime().getTime() < dateMilliseconds(membership.scheduledTierEffectiveAt)
            || currentTime().getTime() < dateMilliseconds(membership.expirationDate)) throw new PaymentError(409, 'The scheduled downgrade has changed. Start a new renewal after your current paid period ends.');
          await validateScheduledTier(tier, membership, checkout.organisationId, session);
        } else if (checkout.intent === 'renew' && membership.scheduledTierId) {
          throw new PaymentError(409, 'A downgrade is scheduled. Cancel that change before renewing your current tier.');
        }
        await capacityFor(tier, membership, session);
        user = await User.findById(checkout.userId).session(session);
        organisation = await Organisation.findById(checkout.organisationId).session(session);
        if (!user || !organisation) throw new PaymentError(404, 'This membership is no longer available.');
        const paid = scenario === 'approved';
        const timestamp = currentTime().toISOString();
        checkout = await PaymentCheckout.findOneAndUpdate({ _id: checkout._id, state: 'pending' }, { $set: {
          state: paid ? 'paid' : 'failed', paymentMethod, completedAt: timestamp,
        } }, { new: true, session });
        if (!checkout) throw new PaymentError(409, 'This payment has changed. Check its status before continuing.');
        invoice = await Invoice.findOneAndUpdate({ paymentCheckoutId: checkout._id }, { $setOnInsert: {
          invoiceNumber: `DEMO-${checkout._id.slice(4).toUpperCase()}`, paymentCheckoutId: checkout._id,
          organisationId: checkout.organisationId, userId: checkout.userId, userName: user.name, userEmail: user.email,
          tierId: checkout.tierId, tierName: checkout.tierName, amount: checkout.amountCents / 100, currency: 'MYR',
          billingInterval: checkout.billingInterval, paymentMethod: methods[paymentMethod], paymentStatus: paid ? 'paid' : 'failed',
          transactionId: checkout.reference, simulated: true,
          ...Object.fromEntries(['intent', 'scheduledDowngrade', 'subtotalCents', 'creditCents', 'unusedCreditCents', 'creditBalanceCents', 'carryForwardCents',
            'sourceTierId', 'sourceTierName', 'previousPeriodStart', 'previousPeriodEnd', 'remainingDays', 'totalDays']
            .filter(key => checkout[key] !== undefined).map(key => [key, checkout[key]])),
          ...(paid ? { periodStart: checkout.periodStart, periodEnd: checkout.periodEnd, paidAt: timestamp, coverageValueCents: checkout.subtotalCents } : {}),
        } }, { upsert: true, new: true, runValidators: true, session });
        if (paid) {
          membership.status = 'active';
          membership.tierId = checkout.tierId;
          membership.tierName = checkout.tierName;
          membership.expirationDate = checkout.periodEnd;
          membership.cancelAtPeriodEnd = false;
          membership.cancelledAt = undefined;
          membership.scheduledTierId = undefined;
          membership.scheduledTierEffectiveAt = undefined;
          membership.scheduledTierRequestedAt = undefined;
          const periods = checkout.intent === 'renew' ? checkout.sourcePeriods.filter(period => dateMilliseconds(period.periodEnd) > new Date(timestamp).getTime()) : [];
          membership.billingPeriods = [...periods, { tierId: checkout.tierId, periodStart: checkout.periodStart,
            periodEnd: checkout.periodEnd, valueCents: checkout.subtotalCents, billingInterval: checkout.billingInterval }];
          membership.creditBalanceCents = checkout.carryForwardCents;
          membership.billingRevision = membershipBillingRevision(membership) + 1;
          if (!membership.firstSubscribedAt) {
            const paidInvoices = await Invoice.find({ userId: checkout.userId, organisationId: checkout.organisationId, paymentStatus: 'paid', category: { $ne: 'event_ticket' } }).session(session);
            const starts = paidInvoices.flatMap(item => [item.periodStart, item.paidAt]).map(dateMilliseconds).filter(Number.isFinite);
            membership.firstSubscribedAt = new Date(Math.min(new Date(timestamp).getTime(), ...starts)).toISOString();
          }
          membership.renewalEmailRetryAt = undefined;
          membership.renewalEmailClaimedAt = undefined;
          membership.renewalEmailClaimToken = undefined;
          await membership.save({ session });
        }
        await ActivityLog.create([{ organisationId: checkout.organisationId, action: paid ? 'PAYMENT_SUCCESS' : 'PAYMENT_FAILED',
          userId: checkout.userId, userName: user.name, userEmail: user.email, actorRole: 'member',
          details: { invoiceNumber: invoice.invoiceNumber, amount: invoice.amount, transactionId: checkout.reference,
            intent: checkout.intent, creditCents: checkout.creditCents, carryForwardCents: checkout.carryForwardCents, simulated: true } }], { session });
        newlyPaid = paid;
      });
    } finally { await session.endSession(); }
    if (newlyPaid) {
      await updateOrgMemberCount(organisationId).catch(() => console.error('[Payment gateway] Member count update failed.'));
      const member = membershipView(user, membership, organisation);
      await walletService.updateWalletObject(member, 'Payment gateway demo').catch(() => console.error('[Payment gateway] Wallet update failed.'));
      await emailService.sendPaymentConfirmation(member, invoice).catch(() => console.error('[Payment gateway] Could not deliver the demo receipt.'));
      await sendWelcomeForMembership(user, membership, organisation).catch(() => console.error('[Payment gateway] Could not deliver the welcome message.'));
    }
    return resultFor(checkout, invoice);
  }

  async function cancelCheckout(sessionId, userId, organisationId) {
    let checkout = await findCheckout(sessionId, userId, organisationId);
    if (checkout.state === 'paid') throw new PaymentError(409, 'This payment has already completed. View its receipt.');
    if (checkout.state === 'pending') {
      checkout = await PaymentCheckout.findOneAndUpdate({ _id: checkout._id, state: 'pending' }, { $set: { state: 'cancelled', completedAt: currentTime().toISOString() } }, { new: true })
        || await findCheckout(sessionId, userId, organisationId);
      if (checkout.state === 'paid') throw new PaymentError(409, 'This payment has already completed. View its receipt.');
    }
    return resultFor(checkout);
  }

  return { quoteCheckout, createCheckout, checkoutStatus, confirmCheckout, cancelCheckout };
}

export const paymentGateway = createPaymentGateway();
