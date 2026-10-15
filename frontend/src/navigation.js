const accountPages = new Set(['account-organisations', 'member-organisations', 'member-profile', 'organisation-setup']);

export function isAccountPage(page) {
  return accountPages.has(page);
}

export function getAccountHomePage(account) {
  if (account?.ownedOrganisations?.length || account?.organisationRole === 'owner') return 'account-organisations';
  return account?.activeOrganisationId ? 'member-dashboard' : 'member-organisations';
}

export function getPageAfterContextChange(page, account) {
  // Account pages must stay open when a portal is selected, renamed or deleted.
  if (isAccountPage(page)) return page;
  if (['landing', 'login', 'register', 'verify-email', 'account-onboarding'].includes(page)) return getAccountHomePage(account);
  if (account?.organisationRole === 'owner') return 'admin-dashboard';
  return account?.activeOrganisationId ? 'member-dashboard' : getAccountHomePage(account);
}
