import test from 'node:test';
import assert from 'node:assert/strict';
import { getAccountHomePage, getPageAfterContextChange, isAccountPage } from '../src/navigation.js';

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
