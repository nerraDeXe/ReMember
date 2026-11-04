import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { notificationId } from '../notifications.js';
import { useAuth } from './AuthContext.jsx';

const NotificationsContext = createContext(null);
const emptyState = scope => ({ scope, latest: [], unreadCount: 0, total: 0, loading: true, error: '', revision: 0 });

export function NotificationsProvider({ children }) {
  const { user, token } = useAuth();
  const scope = user?.emailVerified && user?.onboardingCompleted ? `${user._id}:${token}` : null;
  const currentScope = useRef(scope);
  currentScope.current = scope;
  const requestSequence = useRef(0);
  const pendingReads = useRef(new Map());
  const [state, setState] = useState(() => emptyState(scope));

  const refresh = useCallback(async () => {
    if (!scope) return;
    const sequence = ++requestSequence.current;
    setState(previous => previous.scope === scope ? { ...previous, error: '' } : emptyState(scope));
    try {
      const data = await api.getNotifications({ page: 1, limit: 3 });
      if (currentScope.current !== scope || sequence !== requestSequence.current) return;
      if (!data.success) throw new Error(data.message || 'Could not load notifications.');
      setState(previous => ({ scope, latest: data.notifications || [], unreadCount: data.unreadCount || 0, total: data.total || 0, loading: false, error: '', revision: previous.revision + 1 }));
    } catch (error) {
      if (currentScope.current === scope && sequence === requestSequence.current) {
        setState(previous => ({ ...previous, scope, loading: false, error: error.message || 'Could not load notifications.' }));
      }
    }
  }, [scope]);

  useEffect(() => {
    setState(emptyState(scope));
    if (!scope) return;
    refresh();
    const refreshWhenVisible = () => { if (document.visibilityState !== 'hidden') refresh(); };
    const timer = window.setInterval(refreshWhenVisible, 60000);
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      requestSequence.current += 1;
      window.clearInterval(timer);
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [scope, refresh]);

  const markRead = useCallback(async notification => {
    if (notification.readAt || !scope) return;
    const id = notificationId(notification);
    const key = `${scope}:${id}`;
    if (pendingReads.current.has(key)) return pendingReads.current.get(key);
    const request = (async () => {
      const data = await api.markNotificationRead(id);
      if (currentScope.current !== scope) return;
      if (!data.success) throw new Error(data.message || 'Could not mark notification as read.');
      requestSequence.current += 1;
      const readAt = data.notification?.readAt || new Date().toISOString();
      setState(previous => ({ ...previous, loading: false, latest: previous.latest.map(item => notificationId(item) === id ? { ...item, readAt } : item), unreadCount: typeof data.unreadCount === 'number' ? data.unreadCount : Math.max(0, previous.unreadCount - 1), revision: previous.revision + 1 }));
      await refresh();
    })();
    pendingReads.current.set(key, request);
    try { await request; }
    finally { pendingReads.current.delete(key); }
  }, [scope, refresh]);

  const markAllRead = useCallback(async () => {
    if (!scope) return;
    const data = await api.markAllNotificationsRead();
    if (currentScope.current !== scope) return;
    if (!data.success) throw new Error(data.message || 'Could not mark notifications as read.');
    requestSequence.current += 1;
    const readAt = new Date().toISOString();
    setState(previous => ({ ...previous, loading: false, latest: previous.latest.map(item => ({ ...item, readAt: item.readAt || readAt })), unreadCount: typeof data.unreadCount === 'number' ? data.unreadCount : 0, revision: previous.revision + 1 }));
    await refresh();
  }, [scope, refresh]);

  const visibleState = state.scope === scope ? state : emptyState(scope);
  return <NotificationsContext.Provider value={{ ...visibleState, refresh, markRead, markAllRead }}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) throw new Error('useNotifications must be used within NotificationsProvider.');
  return context;
}
