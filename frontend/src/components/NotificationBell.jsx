import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Bell, RefreshCw, Settings } from 'lucide-react';
import { useNotifications } from '../context/NotificationsContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { getPageUrl } from '../navigation.js';
import { PageLink } from '../routing.jsx';
import NotificationList from './NotificationList.jsx';

export default function NotificationBell({ onNavigate, currentPage, onOpen }) {
  const { latest, unreadCount, loading, error, refresh, markRead } = useNotifications();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);
  const buttonRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => { setOpen(false); }, [currentPage]);
  useEffect(() => {
    if (!open) return;
    const outside = event => { if (!wrapperRef.current?.contains(event.target)) setOpen(false); };
    const escape = event => {
      if (event.key === 'Escape') { setOpen(false); buttonRef.current?.focus(); }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  const openNotification = notification => {
    markRead(notification).catch(error => showToast(error.message, 'error'));
    setOpen(false);
  };

  return <div className="notification-bell" ref={wrapperRef} onBlur={event => {
    if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <button ref={buttonRef} type="button" className={`notification-bell-button ${open ? 'notification-bell-button-open' : ''}`} aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`} aria-expanded={open} aria-controls="notification-dropdown" onClick={() => {
      if (!open) { onOpen?.(); refresh(); }
      setOpen(value => !value);
    }} onKeyDown={event => {
      if (event.key !== 'ArrowDown') return;
      event.preventDefault();
      if (!open) { onOpen?.(); refresh(); setOpen(true); }
      window.requestAnimationFrame(() => dropdownRef.current?.querySelector('a, button')?.focus());
    }}>
      <Bell aria-hidden="true" className="icon-medium" />
      {unreadCount > 0 && <span className="notification-badge" aria-hidden="true">{unreadCount > 99 ? '99+' : unreadCount}</span>}
    </button>
    {open && <section ref={dropdownRef} id="notification-dropdown" className="notification-dropdown" aria-labelledby="notification-dropdown-title">
      <div className="notification-dropdown-header">
        <div><h2 id="notification-dropdown-title">Notifications</h2><p>Your 3 most recent updates</p></div>
        <PageLink page="member-profile" onNavigate={onNavigate} onClick={() => setOpen(false)} className="notification-settings" aria-label="Notification settings"><Settings className="icon-default" aria-hidden="true" /></PageLink>
      </div>
      {loading && <p className="notification-state" role="status"><RefreshCw aria-hidden="true" className="icon-spinner" />Loading notifications…</p>}
      {error && <div className="notification-state notification-error" role="alert"><p>{error}</p><button type="button" className="notification-text-button" onClick={refresh}>Try again</button></div>}
      {!loading && !error && latest.length === 0 && <div className="notification-state"><Bell aria-hidden="true" className="icon-large" /><p>You’re all caught up.</p><span>New posts, event reminders, and membership updates will appear here.</span></div>}
      {!loading && !error && latest.length > 0 && <NotificationList notifications={latest.slice(0, 3)} onOpen={openNotification} compact />}
      <a href={getPageUrl('account-notifications')} className="notification-view-all" onClick={event => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault(); setOpen(false); onNavigate('account-notifications');
      }}>View all notifications<ArrowRight aria-hidden="true" className="icon-default" /></a>
    </section>}
  </div>;
}
