import { randomUUID } from 'node:crypto';
import { Organisation, OrganisationMembership, User, Tier } from '../models/index.js';
import { dbManager } from '../models/db.js';
import { emailService } from './emailService.js';
import { mailDelivery } from './mailDelivery.js';
import { getOrganisationEmailSettings } from '../../shared/organisationEmails.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const CLAIM_LEASE_MS = 15 * 60 * 1000;
const RETRY_DELAY_MS = 60 * 60 * 1000;

/** A changed reminder interval must not send a second email for the same expiry. */
export function getRenewalEmailSchedule(membership, settings, now = new Date()) {
  if (!settings.enabled || !Number.isInteger(settings.daysBefore) || settings.daysBefore < 1 || settings.daysBefore > 365) return null;
  if (membership.role !== 'member' || membership.status !== 'active' || membership.cancelAtPeriodEnd || !membership.expirationDate) return null;
  const expiresAt = new Date(membership.expirationDate).getTime();
  const timestamp = now.getTime();
  if (!Number.isFinite(expiresAt) || !Number.isFinite(timestamp) || expiresAt <= timestamp) return null;
  const dueAt = expiresAt - settings.daysBefore * DAY_MS;
  const cycleKey = new Date(expiresAt).toISOString();
  if (timestamp < dueAt || membership.renewalEmailCycleKey === cycleKey) return null;
  if (Date.parse(membership.renewalEmailClaimedAt) > timestamp - CLAIM_LEASE_MS) return null;
  if (Date.parse(membership.renewalEmailRetryAt) > timestamp) return null;
  return { cycleKey, dueAt: new Date(dueAt).toISOString() };
}

function availableTimestamp(field, before) {
  return { $or: [{ [field]: { $exists: false } }, { [field]: null }, { [field]: '' }, { [field]: { $lte: before } }] };
}

/** Claim each membership atomically so overlapping scans and server processes agree. */
export async function runRenewalEmailScan({ now = new Date() } = {}) {
  const result = { sent: 0, failed: 0 };
  if (!dbManager.isConnected || !mailDelivery.isConfigured()) return result;
  const organisations = await Organisation.find({ 'emailSettings.renewal.enabled': true }).lean();
  const timestamp = now.toISOString();
  const leaseBefore = new Date(now.getTime() - CLAIM_LEASE_MS).toISOString();
  const retryAt = new Date(now.getTime() + RETRY_DELAY_MS).toISOString();

  for (const organisation of organisations) {
    const settings = getOrganisationEmailSettings(organisation.emailSettings).renewal;
    if (!settings.enabled) continue;
    let memberships;
    try {
      memberships = await OrganisationMembership.find({
        organisationId: String(organisation._id), role: 'member', status: 'active', cancelAtPeriodEnd: { $ne: true },
        expirationDate: { $exists: true, $nin: [null, ''] }
      }).lean();
    } catch {
      result.failed += 1;
      console.error('Could not load organisation memberships for renewal reminders.');
      continue;
    }

    for (const membership of memberships) {
      const schedule = getRenewalEmailSchedule(membership, settings, now);
      if (!schedule || String(membership.userId) === String(organisation.adminId)) continue;
      let claimToken;
      const claimIdentity = {
        _id: membership._id, organisationId: String(organisation._id),
        expirationDate: membership.expirationDate
      };
      try {
        let reminderTierName = membership.tierName;
        if (membership.scheduledTierId) {
          const target = await Tier.findOne({ _id: membership.scheduledTierId, organisationId: String(organisation._id), isActive: true }).lean();
          // Free changes need no renewal payment. Missing tiers are resolved by
          // the member instead of sending a reminder for the retired choice.
          if (!target || !Number.isFinite(target.price) || target.price <= 0) continue;
          reminderTierName = target.name;
        }
        const user = await User.findById(membership.userId).lean();
        if (!user?.email || user.emailVerified !== true || user.notifications?.email === false || ['suspended', 'revoked'].includes(user.status)) continue;
        claimToken = randomUUID();
        const claimed = await OrganisationMembership.findOneAndUpdate({
          ...claimIdentity, role: 'member', status: 'active', cancelAtPeriodEnd: { $ne: true },
          renewalEmailCycleKey: { $ne: schedule.cycleKey },
          $and: [availableTimestamp('renewalEmailClaimedAt', leaseBefore), availableTimestamp('renewalEmailRetryAt', timestamp)]
        }, { $set: { renewalEmailClaimedAt: timestamp, renewalEmailClaimToken: claimToken } }, { new: true });
        if (!claimed) continue;

        const reminderMembership = claimed.toObject ? claimed.toObject() : { ...claimed };
        reminderMembership.tierName = reminderTierName;
        const email = await emailService.sendOrganisationRenewal(user, reminderMembership, organisation);
        const sent = email?.status === 'sent';
        await OrganisationMembership.updateOne({ ...claimIdentity, renewalEmailClaimToken: claimToken }, {
          $set: sent ? { renewalEmailSentAt: email.sentAt || timestamp, renewalEmailCycleKey: schedule.cycleKey } : { renewalEmailRetryAt: retryAt },
          $unset: { renewalEmailClaimedAt: '', renewalEmailClaimToken: '', ...(sent ? { renewalEmailRetryAt: '' } : {}) }
        });
        result[sent ? 'sent' : 'failed'] += 1;
      } catch {
        result.failed += 1;
        console.error('Could not send or record an organisation renewal reminder.');
        if (claimToken) {
          await OrganisationMembership.updateOne({ ...claimIdentity, renewalEmailClaimToken: claimToken }, {
            $set: { renewalEmailRetryAt: retryAt },
            $unset: { renewalEmailClaimedAt: '', renewalEmailClaimToken: '' }
          }).catch(() => {});
        }
      }
    }
  }
  return result;
}

/** Run on startup and every minute; a slow scan never overlaps itself. */
export function startRenewalScheduler({ intervalMs = 60_000, scan = runRenewalEmailScan, isConnected = () => dbManager.isConnected } = {}) {
  let running = false;
  const tick = async () => {
    if (running || !isConnected()) return;
    running = true;
    try { await scan(); }
    catch { console.error('Organisation renewal reminder scan failed; the next scan will retry.'); }
    finally { running = false; }
  };
  void tick();
  const timer = setInterval(() => { void tick(); }, intervalMs);
  timer.unref?.();
  return () => clearInterval(timer);
}
