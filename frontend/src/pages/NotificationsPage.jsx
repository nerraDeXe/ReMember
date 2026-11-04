import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Bell, CheckCheck, RefreshCw, Settings } from 'lucide-react';
import { api } from '../api.js';
import NotificationList from '../components/NotificationList.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useNotifications } from '../context/NotificationsContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { notificationId } from '../notifications.js';
import { PageLink, useUrlState } from '../routing.jsx';

const PAGE_SIZE = 20;

export default function NotificationsPage({ onNavigate }) {
  const { user, token } = useAuth();
  const { unreadCount, revision, markRead, markAllRead, refresh } = useNotifications();
  const { showToast } = useToast();
  const [pageQuery, setPageQuery] = useUrlState('page', '1');
  const parsedPage = Number(pageQuery);
  const page = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const [notifications, setNotifications] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [pendingId, setPendingId] = useState(null);
  const [markingAll, setMarkingAll] = useState(false);
  const currentUser = useRef(user?._id);
  currentUser.current = user?._id;
  const userId = user?._id;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    api.getNotifications({ page, limit: PAGE_SIZE }).then(data => {
      if (cancelled) return;
      if (!data.success) throw new Error(data.message || 'Could not load notifications.');
      const count = data.total || 0;
      const pageCount = Math.max(1, data.totalPages || Math.ceil(count / PAGE_SIZE));
      if (page > pageCount) { setPageQuery(String(pageCount), { replace: true }); return; }
      setNotifications(data.notifications || []);
      setTotal(count);
      setTotalPages(pageCount);
    }).catch(error => {
      if (!cancelled) setError(error.message || 'Could not load notifications.');
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId, token, page, revision, retry, setPageQuery]);

  const handleMarkRead = async notification => {
    const id = notificationId(notification);
    setPendingId(id);
    try { await markRead(notification); }
    catch (error) { if (currentUser.current === userId) showToast(error.message, 'error'); }
    finally { if (currentUser.current === userId) setPendingId(null); }
  };
  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    try { await markAllRead(); }
    catch (error) { if (currentUser.current === userId) showToast(error.message, 'error'); }
    finally { if (currentUser.current === userId) setMarkingAll(false); }
  };

  return <div className="page-stack notifications-page">
    <div className="page-header">
      <div><h1 className="page-title"><Bell aria-hidden="true" className="icon-brand-large" />Notifications</h1><p className="page-description">Posts, event reminders, and membership updates from your organisations.</p></div>
      <PageLink page="member-profile" onNavigate={onNavigate} className="button-muted button-inline button-small"><Settings aria-hidden="true" className="icon-default" />Notification settings</PageLink>
    </div>
    <section className="notifications-panel" aria-label="All notifications" aria-busy={loading}>
      <div className="notifications-toolbar"><p><strong>{unreadCount}</strong> unread<span className="notifications-total"> · {total} total</span></p><div className="row-wrap"><button type="button" className="notification-text-button" onClick={() => { setRetry(value => value + 1); refresh(); }} disabled={loading} aria-label="Refresh notifications"><RefreshCw aria-hidden="true" className="icon-default" />Refresh</button><button type="button" className="notification-text-button" onClick={handleMarkAllRead} disabled={!unreadCount || markingAll}><CheckCheck aria-hidden="true" className="icon-default" />{markingAll ? 'Marking…' : 'Mark all as read'}</button></div></div>
      {loading && <p className="notification-state" role="status"><RefreshCw aria-hidden="true" className="icon-spinner" />Loading notifications…</p>}
      {!loading && error && <div className="notification-state notification-error" role="alert"><p>{error}</p><button type="button" className="notification-text-button" onClick={() => setRetry(value => value + 1)}>Try again</button></div>}
      {!loading && !error && notifications.length === 0 && <div className="notification-state notifications-empty"><Bell aria-hidden="true" className="icon-large" /><p>You’re all caught up.</p><span>When your organisations post an update, an event is coming up, or your membership changes, you’ll see it here.</span></div>}
      {!loading && !error && notifications.length > 0 && <NotificationList notifications={notifications} onOpen={notification => { markRead(notification).catch(error => showToast(error.message, 'error')); }} onMarkRead={handleMarkRead} pendingId={pendingId} />}
      {!error && totalPages > 1 && <nav className="notifications-pagination" aria-label="Notification pages"><button type="button" className="button-muted button-inline button-small" disabled={page <= 1 || loading} onClick={() => setPageQuery(String(page - 1))}><ArrowLeft aria-hidden="true" className="icon-default" />Previous</button><span>Page {page} of {totalPages}</span><button type="button" className="button-muted button-inline button-small" disabled={page >= totalPages || loading} onClick={() => setPageQuery(String(page + 1))}>Next<ArrowRight aria-hidden="true" className="icon-default" /></button></nav>}
    </section>
  </div>;
}
