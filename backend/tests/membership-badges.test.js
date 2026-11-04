import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_MEMBERSHIP_BADGE_COLOR, getBadgeTextColor, getOrganisationBadgeColor, isBadgeColor } from '../../shared/membershipBadges.js';
import { membershipView } from '../services/membershipContext.js';

test('Organisation accents accept complete hex colours and safely default missing or invalid data', () => {
  for (const value of ['#FFD700', '#abcdef', '#010203']) assert.equal(isBadgeColor(value), true);
  for (const value of [undefined, null, '', '#fff', 'red', '#fffffff', 123, {}]) {
    assert.equal(isBadgeColor(value), false);
    assert.equal(getOrganisationBadgeColor({ badgeColor: value }), DEFAULT_MEMBERSHIP_BADGE_COLOR);
  }
  assert.equal(getOrganisationBadgeColor(null), DEFAULT_MEMBERSHIP_BADGE_COLOR);
  assert.equal(getOrganisationBadgeColor({ badgeColor: '#102030' }), '#102030');
});

test('Both light and dark organisation accents keep badge text legible', () => {
  assert.equal(getBadgeTextColor('#ffffff'), '#000000');
  assert.equal(getBadgeTextColor('#000000'), '#ffffff');
  assert.equal(getBadgeTextColor('#FFD700'), '#000000');
  assert.equal(getBadgeTextColor('#123456'), '#ffffff');
  assert.equal(getBadgeTextColor('invalid'), getBadgeTextColor(DEFAULT_MEMBERSHIP_BADGE_COLOR));
});

test('Every tier in an organisation generates the same badge accent, scoped independently of the active account', () => {
  const account = { _id: 'person', name: 'Member', membershipNumber: 'MEM-1', activeOrganisation: { _id: 'other-org', badgeColor: '#ff0000' } };
  const organisation = { _id: 'org-a', name: 'Community A', badgeColor: '#123456' };
  for (const tierName of ['Bronze Explorer', 'Silver Patron', 'Gold VIP', 'Platinum Elite', 'Custom tier']) {
    const member = membershipView(account, { organisationId: 'org-a', tierName, status: 'active' }, organisation);
    assert.equal(member.organisation.name, 'Community A');
    assert.equal(getOrganisationBadgeColor(member.organisation), '#123456');
    assert.equal(member.tierName, tierName);
  }
  const other = membershipView(account, { organisationId: 'org-b', status: 'active' }, { _id: 'org-b', badgeColor: '#abcdef' });
  assert.equal(getOrganisationBadgeColor(other.organisation), '#abcdef');
});

test('Legacy tier colours do not affect membership card colours', () => {
  const member = membershipView({ _id: 'person', badgeColor: '#ff0000' }, { organisationId: 'org-a', tierName: 'Silver Patron', badgeColor: '#00ff00' }, { _id: 'org-a' });
  assert.equal(getOrganisationBadgeColor(member.organisation), DEFAULT_MEMBERSHIP_BADGE_COLOR);
});
