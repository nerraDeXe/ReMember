import React from 'react';
import { CalendarClock, Check, CreditCard, Megaphone } from 'lucide-react';
import { notificationDestination, notificationId, notificationTime } from '../notifications.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useNavigation } from '../routing.jsx';

export default function NotificationList({ notifications, onOpen, onMarkRead, pendingId, compact = false }) {
  const { user, refreshUser, getCurrentUser } = useAuth();
  const { showToast } = useToast();
  const { navigate, getSnapshot } = useNavigation();
  return <ul className={`notification-list ${compact ? 'notification-list-compact' : ''}`}>
    {notifications.map(notification => {
      const id = notificationId(notification);
      const Icon = notification.type === 'post' ? Megaphone : notification.type === 'event' ? CalendarClock : CreditCard;
      const date = new Date(notification.createdAt);
      const validDate = Number.isFinite(date.getTime());
      return <li key={id} className={`notification-item ${!notification.readAt ? 'notification-item-unread' : ''}`}>
        <a href={notificationDestination(notification, user)} className="notification-item-link" onClick={async event => {
          if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          const openingRoute = getSnapshot();
          onOpen?.(notification);
          try {
            const account = notification.type === 'membership' ? await refreshUser() : user;
            if (getCurrentUser()?._id !== user?._id || getSnapshot() !== openingRoute) return;
            navigate(notificationDestination(notification, account));
          } catch (error) {
            if (getCurrentUser()?._id === user?._id) showToast(error.message || 'Could not open this notification.', 'error');
          }
        }}>
          <span className="notification-type-icon"><Icon aria-hidden="true" className="icon-default" /></span>
          <span className="notification-item-content">
            <span className="notification-organisation">{notification.organisationName || 'ReMember'}</span>
            <span className="notification-item-title">{notification.title}</span>
            <span className="notification-item-message">{notification.message}</span>
            <span className="notification-item-meta">
              <time dateTime={validDate ? date.toISOString() : undefined} title={validDate ? date.toLocaleString() : undefined}>{notificationTime(notification.createdAt)}</time>
              {!notification.readAt && <span className="notification-unread-label">Unread</span>}
            </span>
          </span>
        </a>
        {!compact && !notification.readAt && <button type="button" className="notification-mark-read" onClick={() => onMarkRead?.(notification)} disabled={pendingId === id} aria-label={`Mark ${notification.title} as read`} title="Mark as read"><Check aria-hidden="true" className="icon-default" /><span className="notification-mark-read-label">Mark as read</span></button>}
      </li>;
    })}
  </ul>;
}
