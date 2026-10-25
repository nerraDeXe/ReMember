import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PAGE_PATHS, getAccountHomePage, getPageAfterContextChange, getPageUrl,
  isAccountPage, isPortalPage, parseRoute, resolvePageAccess,
} from '../src/navigation.js';
import { createBrowserNavigation } from '../src/browserHistory.js';

const owner = { activeOrganisationId: 'owned', organisationRole: 'owner', ownedOrganisations: [{ _id: 'owned' }] };
const member = { activeOrganisationId: 'joined', organisationRole: 'member', ownedOrganisations: [] };

test('Owners sign in to the organisation list before choosing an admin portal', () => {
  assert.equal(getAccountHomePage(owner), 'account-organisations');
  assert.equal(getPageAfterContextChange('login', owner), 'account-organisations');
  assert.equal(getAccountHomePage({ ...owner, activeOrganisationId: 'joined', organisationRole: 'member' }), 'account-organisations');
});

test('Member accounts retain their dashboard or open My Memberships before choosing a portal', () => {
  assert.equal(getAccountHomePage(member), 'member-dashboard');
  assert.equal(getAccountHomePage({}), 'account-memberships');
  assert.equal(getPageAfterContextChange('login', {}), 'account-memberships');
  assert.equal(getAccountHomePage({ ...member, activeOrganisationId: null }), 'account-memberships');
  assert.equal(getAccountHomePage({ ...member, role: 'admin' }), 'member-dashboard');
});

test('Account pages stay outside portals when selection changes or an organisation is deleted', () => {
  for (const page of ['account-organisations', 'account-memberships', 'member-organisations', 'member-profile', 'organisation-setup']) {
    assert.equal(isAccountPage(page), true);
    assert.equal(getPageAfterContextChange(page, owner), page);
    assert.equal(getPageAfterContextChange(page, member), page);
    assert.equal(getPageAfterContextChange(page, {}), page);
  }
});

test('Portal context changes reset the dashboard and remove admin access for member context', () => {
  assert.equal(isAccountPage('admin-members'), false);
  assert.equal(getPageAfterContextChange('admin-members', owner), 'admin-dashboard');
  assert.equal(getPageAfterContextChange('admin-members', { ...member, role: 'admin' }), 'member-dashboard');
  assert.equal(getPageAfterContextChange('admin-dashboard', {}), 'account-memberships');
  assert.equal(getPageAfterContextChange('member-invoices', owner), 'admin-dashboard');
});

test('Every public, account and portal page has a distinct URL that survives a direct visit', () => {
  assert.equal(new Set(Object.values(PAGE_PATHS)).size, Object.keys(PAGE_PATHS).length);
  for (const page of Object.keys(PAGE_PATHS)) {
    const destination = new URL(getPageUrl(page), 'https://remember.test');
    assert.equal(parseRoute(destination).page, page, page);
    assert.equal(parseRoute({ pathname: destination.pathname + '/' }).page, page, `${page} trailing slash`);
  }
  assert.equal(getPageUrl('member-organisations'), getPageUrl('account-memberships'));
  assert.equal(parseRoute({ pathname: '/unknown-page' }).page, 'not-found');
  assert.throws(() => getPageUrl('unknown-page'), /Unknown page/);
});

test('Deep URLs retain encoded record IDs, filters and portal organisation context', () => {
  const recordId = 'record / with ? and #';
  const destination = new URL(getPageUrl('admin-members', {
    organisationId: 'org / two',
    query: { member: recordId, page: '3', status: 'active', search: 'Alex & Sam' },
  }), 'https://remember.test');
  const route = parseRoute(destination);
  assert.equal(route.page, 'admin-members');
  assert.equal(route.query.get('organisation'), 'org / two');
  assert.equal(route.query.get('member'), recordId);
  assert.equal(route.query.get('page'), '3');
  assert.equal(route.query.get('status'), 'active');
  assert.equal(route.query.get('search'), 'Alex & Sam');
  const accountUrl = new URL(getPageUrl('member-profile', {
    organisationId: 'old-org', query: { organisation: 'old-org', section: 'address' },
  }), 'https://remember.test');
  assert.equal(accountUrl.searchParams.has('organisation'), false);
  assert.equal(accountUrl.searchParams.get('section'), 'address');
  assert.equal(isPortalPage('member-profile'), false);
  assert.equal(isPortalPage('member-dashboard'), true);
  assert.equal(isPortalPage('admin-members'), true);
});

test('Existing emailed password reset links preserve their token during migration', () => {
  const route = parseRoute({ pathname: '/', search: '', hash: '#reset-password?token=once%2Bonly%2Ftoken%3D' });
  assert.equal(route.page, 'reset-password');
  assert.equal(route.legacy, true);
  assert.equal(route.query.get('token'), 'once+only/token=');
  const migrated = new URL(getPageUrl(route.page, { query: route.query }), 'https://remember.test');
  assert.equal(migrated.pathname, '/reset-password');
  assert.equal(migrated.searchParams.get('token'), 'once+only/token=');
  assert.equal(parseRoute({ hash: '#reset-password' }).query.size, 0);
  assert.equal(parseRoute(migrated).legacy, false);
});

test('Direct visits enforce sign in, email verification, onboarding and portal permissions', () => {
  const signedMember = { ...member, emailVerified: true, onboardingCompleted: true };
  const signedOwner = { ...owner, emailVerified: true, onboardingCompleted: true };
  for (const page of ['landing', 'login', 'register', 'google-signup', 'forgot-password', 'reset-password', 'not-found']) {
    assert.equal(resolvePageAccess(page, null), page);
  }
  for (const page of ['account-organisations', 'member-profile', 'member-invoices', 'admin-members']) {
    assert.equal(resolvePageAccess(page, null), 'login', page);
    assert.equal(resolvePageAccess(page, { ...signedMember, emailVerified: false }), 'verify-email', page);
    assert.equal(resolvePageAccess(page, { ...signedMember, onboardingCompleted: false }), 'account-onboarding', page);
  }
  assert.equal(resolvePageAccess('organisation-setup', { ...signedMember, onboardingCompleted: false }), 'organisation-setup');
  assert.equal(resolvePageAccess('admin-members', signedOwner), 'admin-members');
  assert.equal(resolvePageAccess('admin-members', { ...signedMember, role: 'admin' }), 'member-dashboard');
  assert.equal(resolvePageAccess('member-invoices', signedMember), 'member-invoices');
  assert.equal(resolvePageAccess('member-invoices', { emailVerified: true, onboardingCompleted: true }), 'account-memberships');
  assert.equal(resolvePageAccess('member-renew', signedOwner), 'account-memberships');
  assert.equal(resolvePageAccess('login', signedOwner), 'account-organisations');
  assert.equal(resolvePageAccess('member-organisations', signedMember), 'account-memberships');
  assert.equal(resolvePageAccess('reset-password', { emailVerified: false }), 'reset-password');
});

function fakeBrowser(initialUrl) {
  const listeners = new Map();
  const entries = [{ url: new URL(initialUrl, 'https://remember.test').href, state: null }];
  let index = 0;
  const browser = {
    scrollY: 0,
    get location() { return new URL(entries[index].url); },
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(listener);
    },
    removeEventListener(type, listener) { listeners.get(type)?.delete(listener); },
    requestAnimationFrame(callback) { callback(); },
    scrollTo({ top }) { browser.scrollY = top; },
    emit(type) { listeners.get(type)?.forEach(listener => listener()); },
  };
  const move = offset => {
    if (index + offset < 0 || index + offset >= entries.length) return;
    index += offset;
    browser.emit('popstate');
  };
  browser.history = {
    get state() { return entries[index].state; },
    get length() { return entries.length; },
    replaceState(state, unused, url) { entries[index] = { state, url: new URL(url, browser.location).href }; },
    pushState(state, unused, url) {
      const destination = new URL(url, browser.location).href;
      entries.splice(index + 1);
      entries.push({ state, url: destination });
      index += 1;
    },
    back() { move(-1); },
    forward() { move(1); },
  };
  return browser;
}

test('Page navigation updates subscribers and Back/Forward restore pages, queries and scroll', () => {
  const browser = fakeBrowser('/account/organisations');
  const navigation = createBrowserNavigation(browser);
  let notifications = 0;
  const unsubscribe = navigation.subscribe(() => { notifications += 1; });
  const initial = navigation.getSnapshot();
  assert.equal(navigation.getSnapshot(), initial, 'unchanged snapshots stay stable for React subscribers');
  browser.scrollY = 420;
  navigation.navigate('/admin/members?organisation=A&page=2');
  assert.equal(navigation.getSnapshot().page, 'admin-members');
  assert.equal(navigation.getSnapshot().query.get('organisation'), 'A');
  assert.equal(browser.scrollY, 0);
  assert.equal(notifications, 1);
  navigation.navigate('/admin/members?organisation=A&page=2');
  assert.equal(browser.history.length, 2);
  assert.equal(notifications, 1, 'clicking the current destination does not create history');
  browser.history.back();
  assert.equal(navigation.getSnapshot().page, 'account-organisations');
  assert.equal(browser.scrollY, 420);
  browser.history.forward();
  assert.equal(navigation.getSnapshot().query.get('page'), '2');
  assert.equal(browser.scrollY, 0);
  assert.equal(notifications, 3);
  unsubscribe();
  browser.history.back();
  assert.equal(notifications, 3);
});

test('Replacing transient query text keeps history concise and preserves unrelated state', () => {
  const browser = fakeBrowser('/admin/members?organisation=A&status=active#directory');
  const navigation = createBrowserNavigation(browser);
  const unsubscribe = navigation.subscribe(() => {});
  browser.scrollY = 180;
  navigation.updateQuery({ search: 'Alex & Sam', page: 2 });
  navigation.updateQuery({ search: 'Alex & Samantha', page: null }, { replace: true });
  assert.equal(browser.history.length, 2);
  assert.equal(navigation.getSnapshot().query.get('search'), 'Alex & Samantha');
  assert.equal(navigation.getSnapshot().query.get('organisation'), 'A');
  assert.equal(navigation.getSnapshot().query.get('status'), 'active');
  assert.equal(navigation.getSnapshot().query.has('page'), false);
  assert.equal(navigation.getSnapshot().hash, '#directory');
  assert.equal(browser.scrollY, 180, 'same-page state changes retain scroll');
  browser.history.back();
  assert.equal(navigation.getSnapshot().query.has('search'), false);
  unsubscribe();
});

test('Closing an in-app dialog returns to its parent and Forward reopens it', () => {
  const browser = fakeBrowser('/admin/tiers?organisation=A');
  const navigation = createBrowserNavigation(browser);
  const unsubscribe = navigation.subscribe(() => {});
  navigation.updateQuery({ tier: 'new' });
  assert.equal(navigation.getSnapshot().query.get('tier'), 'new');
  navigation.closeQuery('tier');
  assert.equal(navigation.getSnapshot().query.has('tier'), false);
  assert.equal(navigation.getSnapshot().query.get('organisation'), 'A');
  assert.equal(browser.history.length, 2);
  browser.history.forward();
  assert.equal(navigation.getSnapshot().query.get('tier'), 'new');
  unsubscribe();
});

test('Closing a directly loaded dialog stays on its parent page without leaving the site', () => {
  const browser = fakeBrowser('/member/invoices?organisation=A&invoice=receipt%2Fone&page=2');
  const navigation = createBrowserNavigation(browser);
  const unsubscribe = navigation.subscribe(() => {});
  navigation.closeQuery(['invoice', 'missing']);
  assert.equal(navigation.getSnapshot().page, 'member-invoices');
  assert.equal(navigation.getSnapshot().query.has('invoice'), false);
  assert.equal(navigation.getSnapshot().query.get('organisation'), 'A');
  assert.equal(navigation.getSnapshot().query.get('page'), '2');
  assert.equal(browser.history.length, 1);
  unsubscribe();
});

test('Closing a dialog recognises equivalent query encodings in its parent URL', () => {
  const browser = fakeBrowser('/admin/tiers?organisation=A&search=Alex%20Sam');
  const navigation = createBrowserNavigation(browser);
  const unsubscribe = navigation.subscribe(() => {});
  navigation.updateQuery({ tier: 'new' });
  navigation.closeQuery('tier');
  assert.equal(browser.location.search, '?organisation=A&search=Alex%20Sam');
  browser.history.forward();
  assert.equal(navigation.getSnapshot().query.get('tier'), 'new');
  unsubscribe();
});

test('History navigation rejects external destinations without changing the current page', () => {
  const browser = fakeBrowser('/login');
  const navigation = createBrowserNavigation(browser);
  assert.throws(() => navigation.navigate('https://another-site.test/login'), /within ReMember/);
  assert.throws(() => navigation.navigate('//another-site.test/login'), /within ReMember/);
  assert.equal(browser.location.pathname, '/login');
  assert.equal(browser.history.length, 1);
});
