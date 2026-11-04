import { getPageUrl } from './navigation.js';

export const notificationId = notification => notification.id || notification._id;

export function notificationDestination(notification, user) {
  const organisationId = notification.organisationId;
  if (!organisationId) return getPageUrl('account-memberships');
  if (notification.type === 'post') {
    return getPageUrl('member-communication', { organisationId, query: notification.postId ? { post: notification.postId } : undefined });
  }
  if (notification.type === 'event') {
    return getPageUrl('member-events', { organisationId, query: notification.eventId ? { event: notification.eventId } : undefined });
  }
  if (notification.type === 'membership') {
    const membership = user?.memberships?.find(item => item.organisationId === organisationId);
    const status = membership?.status || (user?.activeOrganisationId === organisationId ? user.membershipStatus : undefined);
    if (!status || ['pending', 'cancelled', 'suspended', 'revoked'].includes(status)) return getPageUrl('account-memberships');
    return getPageUrl('member-membership', { organisationId });
  }
  return getPageUrl('account-memberships');
}

export function notificationTime(value, now = Date.now()) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const minutes = Math.max(0, Math.floor((Number(now) - date.getTime()) / 60000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: date.getFullYear() !== new Date(now).getFullYear() ? 'numeric' : undefined });
}
