import { createHash } from 'node:crypto';
import { Notification, OrganisationPost, Organisation, OrganisationMembership, User, Event, Tier } from '../models/index.js';
import { dbManager } from '../models/db.js';
import { getEventTiming } from '../../shared/eventTiming.js';
import { isEventTierAllowed } from '../../shared/events.js';

const DAY_MS = 86_400_000;
export const DEFAULT_EVENT_REMINDER_DAYS = [7, 1];

export function normaliseNotificationSettings(input, previous = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Notification settings must be an object.');
  const fields = {};
  for (const key of ['email', 'events', 'marketing']) {
    if (input[key] !== undefined) {
      if (typeof input[key] !== 'boolean') throw new Error('Notification preferences must be true or false.');
      fields[key] = input[key];
    }
  }
  if (input.eventReminderDays !== undefined) {
    if (!Array.isArray(input.eventReminderDays) || input.eventReminderDays.length > 5 || input.eventReminderDays.some(day => !Number.isInteger(day) || day < 1 || day > 365)) {
      throw new Error('Choose up to five event reminders, each between 1 and 365 whole days before the event.');
    }
    fields.eventReminderDays = [...new Set(input.eventReminderDays)].sort((a, b) => b - a);
  }
  return { ...previous, ...fields };
}

export function notificationView(notification) {
  return {
    id: String(notification._id), type: notification.type, title: notification.title, message: notification.message,
    organisationId: notification.organisationId, organisationName: notification.organisationName,
    ...(notification.postId ? { postId: notification.postId } : {}),
    ...(notification.eventId ? { eventId: notification.eventId } : {}),
    ...(notification.membershipId ? { membershipId: notification.membershipId } : {}),
    createdAt: notification.createdAt, readAt: notification.readAt || null,
  };
}

function statusAt(membership, now) {
  if (membership.status === 'active' && Date.parse(membership.expirationDate) <= now.getTime()) return membership.cancelAtPeriodEnd ? 'cancelled' : 'expired';
  return membership.status;
}

function activeMember(membership, now) {
  return membership.role !== 'owner' && statusAt(membership, now) === 'active';
}

/** Catch up to the closest due interval after downtime, without sending several reminders at once. */
export function eventReminderSchedule(event, preferences = {}, now = new Date()) {
  if (preferences.events === false) return null;
  const timing = getEventTiming(event, now);
  if (timing.status !== 'upcoming') return null;
  const days = preferences.eventReminderDays ?? DEFAULT_EVENT_REMINDER_DAYS;
  if (!Array.isArray(days)) return null;
  const remaining = Date.parse(timing.startsAt) - now.getTime();
  const daysBefore = [...new Set(days)].filter(day => Number.isInteger(day) && day >= 1 && day <= 365 && remaining <= day * DAY_MS).sort((a, b) => a - b)[0];
  return daysBefore ? { daysBefore, startsAt: timing.startsAt, dueAt: new Date(Date.parse(timing.startsAt) - daysBefore * DAY_MS).toISOString() } : null;
}

export function createNotificationService({ models = { Notification, OrganisationPost, Organisation, OrganisationMembership, User, Event, Tier }, isConnected = () => dbManager.isConnected } = {}) {
  async function persist(key, fields, now = new Date()) {
    const id = createHash('sha256').update(`${fields.userId}:${key}`).digest('hex');
    try {
      await models.Notification.updateOne({ _id: id }, { $setOnInsert: { _id: id, ...fields, readAt: null, createdAt: now, updatedAt: now } }, { upsert: true, timestamps: false });
    } catch (error) {
      // Two worker processes may race to upsert the same deterministic ID.
      if (error.code !== 11000) throw error;
    }
    return id;
  }

  async function notifyPost(post, organisation, now = new Date()) {
    if (!isConnected()) return;
    const org = organisation || await models.Organisation.findById(post.organisationId).lean();
    if (!org) return;
    const memberships = await models.OrganisationMembership.find({ organisationId: String(org._id), role: 'member', status: { $in: ['active', 'expired'] } }).lean();
    for (const membership of memberships) {
      if (String(membership.userId) === String(org.adminId)) continue;
      // A restarted fanout cannot deliver old posts to someone who joined later.
      if (Date.parse(membership.joinedDate) > Date.parse(post.createdAt || now)) continue;
      await persist(`post:${post._id}`, {
        userId: String(membership.userId), type: 'post', title: post.title,
        message: `${org.name} published a new post.`, organisationId: String(org._id), organisationName: org.name, postId: String(post._id),
      }, new Date(post.createdAt || now));
    }
    await models.OrganisationPost.updateOne({ _id: post._id, notificationQueued: true }, { $set: { notificationQueued: false } }, { timestamps: false });
  }

  async function notifyMembershipChange(before, after, { organisation, now = new Date() } = {}) {
    if (!isConnected() || !after?.userId || after.role === 'owner') return null;
    const previousStatus = before ? statusAt(before, now) : null;
    const nextStatus = statusAt(after, now);
    const changed = !before || previousStatus !== nextStatus || (before.tierId || '') !== (after.tierId || '') || (before.tierName || '') !== (after.tierName || '') || Boolean(before.cancelAtPeriodEnd) !== Boolean(after.cancelAtPeriodEnd) || (before.scheduledTierId || '') !== (after.scheduledTierId || '');
    if (!changed) return null;
    const org = organisation || await models.Organisation.findById(after.organisationId).lean();
    if (!org) return null;
    let message = `Your membership status is now ${nextStatus}${after.tierName ? ` (${after.tierName})` : ''}.`;
    if (nextStatus === 'active' && after.cancelAtPeriodEnd) message = `Your membership will end on ${after.expirationDate ? new Date(after.expirationDate).toLocaleDateString('en-GB', { timeZone: 'UTC' }) : 'the last day of your paid period'}.`;
    else if (before?.cancelAtPeriodEnd && !after.cancelAtPeriodEnd && nextStatus === 'active') message = 'Your membership has resumed.';
    else if (after.scheduledTierId && after.scheduledTierId !== before?.scheduledTierId) message = 'Your membership tier change has been scheduled for the end of your paid period.';
    else if (before?.scheduledTierId && !after.scheduledTierId && before.tierId === after.tierId) message = 'Your scheduled membership tier change has been cancelled.';
    // Email bookkeeping also updates timestamps; the billing revision changes
    // only when the membership itself changes and survives a retry of this hook.
    const revisionValue = after.billingRevision ?? after.updatedAt ?? after.cancelledAt ?? after.joinedDate ?? now.toISOString();
    const revision = revisionValue instanceof Date ? revisionValue.toISOString() : revisionValue;
    const id = await persist(`membership:${after._id}:${revision}:${nextStatus}:${after.tierId || ''}:${Boolean(after.cancelAtPeriodEnd)}:${after.scheduledTierId || ''}`, {
      userId: String(after.userId), type: 'membership', title: 'Membership updated', message,
      organisationId: String(org._id), organisationName: org.name, membershipId: String(after._id),
    }, now);
    // A persisted snapshot lets the scan repair a failed hook and detect expiry
    // even when the member has not opened their account since their paid term ended.
    await models.OrganisationMembership.updateOne({ _id: after._id, ...(after.updatedAt ? { updatedAt: after.updatedAt } : {}) }, {
      $set: { notificationSnapshot: { status: nextStatus, tierId: after.tierId || '', tierName: after.tierName || '', cancelAtPeriodEnd: Boolean(after.cancelAtPeriodEnd), scheduledTierId: after.scheduledTierId || '' } },
    }, { timestamps: false });
    return id;
  }

  async function scan({ now = new Date() } = {}) {
    const result = { posts: 0, reminders: 0, memberships: 0, failed: 0 };
    if (!isConnected()) return result;
    const posts = await models.OrganisationPost.find({ notificationQueued: true }).lean();
    for (const post of posts) {
      try { await notifyPost(post, null, now); result.posts += 1; }
      catch (error) { result.failed += 1; console.error('Could not deliver post notifications; the next scan will retry.', error.message); }
    }
    const memberships = await models.OrganisationMembership.find({ role: 'member' }).lean();
    const orgIds = [...new Set(memberships.map(member => String(member.organisationId)))];
    if (!orgIds.length) return result;
    const [organisations, events, tiers, users] = await Promise.all([
      models.Organisation.find({ _id: { $in: orgIds } }).lean(),
      models.Event.find({ organisationId: { $in: orgIds } }).lean(),
      models.Tier.find({ organisationId: { $in: orgIds } }).lean(),
      models.User.find({ _id: { $in: [...new Set(memberships.map(member => String(member.userId)))] } }).lean(),
    ]);
    const byOrg = new Map(organisations.map(org => [String(org._id), org]));
    const byUser = new Map(users.map(user => [String(user._id), user]));
    for (const membership of memberships) {
      const org = byOrg.get(String(membership.organisationId));
      const user = byUser.get(String(membership.userId));
      if (!org || !user || String(user._id) === String(org.adminId) || ['suspended', 'revoked'].includes(user.status)) continue;
      try {
        const recovered = await notifyMembershipChange(membership.notificationSnapshot, membership, { organisation: org, now });
        if (recovered) result.memberships += 1;
        if (!activeMember(membership, now)) continue;
        if (user.emailVerified !== true || user.notifications?.events === false) continue;
        const organisationTiers = tiers.filter(tier => String(tier.organisationId) === String(org._id));
        for (const event of events) {
          if (String(event.organisationId) !== String(org._id) || !isEventTierAllowed(event, membership, organisationTiers)) continue;
          const schedule = eventReminderSchedule(event, user.notifications, now);
          if (!schedule) continue;
          await persist(`event:${event._id}:${schedule.startsAt}:${schedule.daysBefore}`, {
            userId: String(user._id), type: 'event', title: event.title,
            message: `${org.name}: this event starts ${schedule.daysBefore === 1 ? 'within a day' : `within ${schedule.daysBefore} days`}.`,
            organisationId: String(org._id), organisationName: org.name, eventId: String(event._id),
          }, now);
          result.reminders += 1;
        }
      } catch (error) { result.failed += 1; console.error('Could not deliver member notifications; the next scan will retry.', error.message); }
    }
    return result;
  }
  return { persist, notifyPost, notifyMembershipChange, scan };
}

export const notificationService = createNotificationService();
export const notifyPost = (...args) => notificationService.notifyPost(...args);
export const notifyMembershipChange = (...args) => notificationService.notifyMembershipChange(...args);
export const runNotificationScan = (...args) => notificationService.scan(...args);

export function startNotificationScheduler({ intervalMs = 60_000, scan = runNotificationScan, isConnected = () => dbManager.isConnected } = {}) {
  let running = false;
  const tick = async () => {
    if (running || !isConnected()) return;
    running = true;
    try { await scan(); }
    catch (error) { console.error('Notification scan failed; the next scan will retry.', error.message); }
    finally { running = false; }
  };
  void tick();
  const timer = setInterval(() => { void tick(); }, intervalMs);
  timer.unref?.();
  return () => clearInterval(timer);
}
