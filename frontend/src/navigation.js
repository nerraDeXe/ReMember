const accountPages = new Set(['account-organisations', 'account-memberships', 'member-organisations', 'member-profile', 'organisation-setup']);

// These URLs are shared by links, browser history, and direct page visits.
export const PAGE_PATHS = Object.freeze({
  landing: '/',
  login: '/login',
  register: '/register',
  'google-signup': '/register/google',
  'forgot-password': '/forgot-password',
  'reset-password': '/reset-password',
  'verify-email': '/verify-email',
  'account-onboarding': '/onboarding',
  'organisation-setup': '/account/organisations/new',
  'account-organisations': '/account/organisations',
  'account-memberships': '/account/memberships',
  'member-profile': '/account/profile',
  'member-dashboard': '/member/dashboard',
  'member-events': '/member/events',
  'member-invoices': '/member/invoices',
  'member-communication': '/member/communication',
  'member-pass': '/member/pass',
  'member-renew': '/member/renew',
  'admin-dashboard': '/admin/dashboard',
  'admin-members': '/admin/members',
  'admin-tiers': '/admin/tiers',
  'admin-events': '/admin/events',
  'admin-posts': '/admin/posts',
  'admin-email-settings': '/admin/email-settings',
  'admin-finances': '/admin/finances',
  'admin-logs': '/admin/logs',
});

const pathPages = new Map(Object.entries(PAGE_PATHS).map(([page, path]) => [path, page]));
const publicPages = new Set(['landing', 'login', 'register', 'google-signup', 'forgot-password', 'reset-password', 'not-found']);

export function isPortalPage(page) {
  return (page.startsWith('admin-') || page.startsWith('member-')) && !isAccountPage(page);
}

export function getPageUrl(page, { query, organisationId } = {}) {
  if (page === 'member-organisations') page = 'account-memberships';
  const path = PAGE_PATHS[page];
  if (!path) throw new Error(`Unknown page: ${page}`);
  const params = new URLSearchParams(query);
  if (isPortalPage(page) && organisationId) params.set('organisation', organisationId);
  if (!isPortalPage(page)) params.delete('organisation');
  const search = params.toString();
  return path + (search ? `?${search}` : '');
}

export function parseRoute({ pathname = '/', search = '', hash = '' } = {}) {
  // Keep password reset emails sent before pathname routing working.
  const legacy = hash.startsWith('#reset-password');
  const path = legacy ? '/reset-password' : pathname.replace(/\/+$/, '') || '/';
  const query = new URLSearchParams(legacy ? (hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '') : search);
  return { page: pathPages.get(path) || 'not-found', pathname: path, query, legacy,
    url: pathname + search + hash, search, hash };
}

export function resolvePageAccess(page, account) {
  if (page === 'member-organisations') page = 'account-memberships';
  if (!account) return publicPages.has(page) ? page : 'login';
  if (['forgot-password', 'reset-password', 'not-found'].includes(page)) return page;
  if (!account.emailVerified) return 'verify-email';
  if (!account.onboardingCompleted) return page === 'organisation-setup' ? page : 'account-onboarding';
  if (['account-home', 'landing', 'login', 'register', 'google-signup', 'verify-email', 'account-onboarding'].includes(page)) return getAccountHomePage(account);
  if (isPortalPage(page) && !account.activeOrganisationId) return getAccountHomePage(account);
  if (page.startsWith('admin-') && account.organisationRole !== 'owner') return getAccountHomePage(account);
  if (page === 'member-renew' && account.organisationRole === 'owner') return 'account-memberships';
  return page;
}

export function isAccountPage(page) {
  return accountPages.has(page);
}

export function getAccountHomePage(account) {
  if (account?.ownedOrganisations?.length || account?.organisationRole === 'owner') return 'account-organisations';
  return account?.activeOrganisationId ? 'member-dashboard' : 'account-memberships';
}

export function getPageAfterContextChange(page, account) {
  if (['forgot-password', 'reset-password'].includes(page)) return page;
  // Account pages must stay open when a portal is selected, renamed or deleted.
  if (isAccountPage(page)) return page;
  if (['landing', 'login', 'register', 'google-signup', 'verify-email', 'account-onboarding'].includes(page)) return getAccountHomePage(account);
  if (account?.organisationRole === 'owner') return 'admin-dashboard';
  return account?.activeOrganisationId ? 'member-dashboard' : getAccountHomePage(account);
}
