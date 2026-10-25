import { parseRoute } from './navigation.js';

// A small History API store keeps React and the address bar in sync, including
// changes made by Back/Forward. UI state stays in the URL; form contents do not.
export function createBrowserNavigation(browser) {
  let snapshot = parseRoute(browser.location);
  const listeners = new Set();
  let listening = false;
  const currentUrl = () => browser.location.pathname + browser.location.search + browser.location.hash;
  const notify = () => {
    snapshot = parseRoute(browser.location);
    listeners.forEach(listener => listener());
  };
  const restore = () => {
    notify();
    const scroll = browser.history.state?.rememberNavigation?.scrollY || 0;
    browser.requestAnimationFrame?.(() => browser.scrollTo?.({ top: scroll, behavior: 'instant' }));
  };
  const navigate = (url, { replace = false } = {}) => {
    const destination = new URL(url, browser.location.href);
    if (destination.origin !== browser.location.origin) throw new Error('Navigation must stay within ReMember.');
    const next = destination.pathname + destination.search + destination.hash;
    const previous = currentUrl();
    if (next === previous) return;
    const currentState = browser.history.state || {};
    const scrollY = browser.scrollY || 0;
    browser.history.replaceState({ ...currentState, rememberNavigation: { ...currentState.rememberNavigation, scrollY } }, '', previous);
    const samePage = destination.pathname === browser.location.pathname;
    const state = { ...currentState, rememberNavigation: {
      previousUrl: replace ? currentState.rememberNavigation?.previousUrl : previous,
      scrollY: samePage ? scrollY : 0,
    } };
    browser.history[replace ? 'replaceState' : 'pushState'](state, '', next);
    notify();
    if (!samePage) browser.scrollTo?.({ top: 0, behavior: 'instant' });
  };
  const updateQuery = (updates, options) => {
    const query = new URLSearchParams(browser.location.search);
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === undefined || value === '') query.delete(key);
      else query.set(key, String(value));
    }
    const search = query.toString();
    navigate(browser.location.pathname + (search ? `?${search}` : '') + browser.location.hash, options);
  };
  const closeQuery = keys => {
    const query = new URLSearchParams(browser.location.search);
    for (const key of typeof keys === 'string' ? [keys] : keys) query.delete(key);
    const search = query.toString();
    const parent = browser.location.pathname + (search ? `?${search}` : '') + browser.location.hash;
    const previousUrl = browser.history.state?.rememberNavigation?.previousUrl;
    const previous = previousUrl ? new URL(previousUrl, browser.location.href) : null;
    const parentUrl = new URL(parent, browser.location.href);
    // Bookmarked queries may encode spaces as %20 rather than +. Both identify
    // the same parent entry and should close with one Back operation.
    const previousIsParent = previous && previous.origin === parentUrl.origin
      && previous.pathname === parentUrl.pathname && previous.hash === parentUrl.hash
      && previous.searchParams.toString() === parentUrl.searchParams.toString();
    if (previousIsParent) browser.history.back();
    else navigate(parent, { replace: true });
  };
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      if (!listening) {
        listening = true;
        browser.history.scrollRestoration = 'manual';
        browser.addEventListener('popstate', restore);
        browser.addEventListener('hashchange', notify);
        // A subscription may follow an update from an earlier effect.
        snapshot = parseRoute(browser.location);
      }
      return () => {
        listeners.delete(listener);
        if (!listeners.size) {
          listening = false;
          browser.removeEventListener('popstate', restore);
          browser.removeEventListener('hashchange', notify);
        }
      };
    },
    navigate, updateQuery, closeQuery,
  };
}
