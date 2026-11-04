import test from 'node:test';
import assert from 'node:assert/strict';
import { notificationDestination, notificationId, notificationTime } from '../src/notifications.js';

test('Post and event notifications open the exact record in the source organisation', () => {
  for (const [type, idKey, page] of [['post', 'postId', '/member/communication'], ['event', 'eventId', '/member/events']]) {
    const destination = new URL(notificationDestination({ type, organisationId: 'org / two', [idKey]: 'record ?#+' }), 'https://remember.test');
    assert.equal(destination.pathname, page);
    assert.equal(destination.searchParams.get('organisation'), 'org / two');
    assert.equal(destination.searchParams.get(type), 'record ?#+');
  }
});

test('Membership notifications remain accessible for cancelled, pending and unavailable organisations', () => {
  const notification = { type: 'membership', organisationId: 'B' };
  for (const status of ['pending', 'cancelled', 'suspended', 'revoked']) {
    assert.equal(notificationDestination(notification, { memberships: [{ organisationId: 'B', status }] }), '/account/memberships');
  }
  assert.equal(notificationDestination(notification, { activeOrganisationId: 'A', membershipStatus: 'active' }), '/account/memberships');
  assert.equal(notificationDestination(notification, { memberships: [{ organisationId: 'B', status: 'active' }] }), '/member/membership?organisation=B');
  assert.equal(notificationDestination(notification, { activeOrganisationId: 'B', membershipStatus: 'expired' }), '/member/membership?organisation=B');
  assert.equal(notificationDestination({ type: 'post' }), '/account/memberships');
});

test('Notification identifiers support API views and timestamps handle invalid dates', () => {
  assert.equal(notificationId({ id: 'view-id', _id: 'internal-id' }), 'view-id');
  assert.equal(notificationId({ _id: 'internal-id' }), 'internal-id');
  const now = Date.parse('2026-11-04T12:00:00Z');
  assert.equal(notificationTime('2026-11-04T12:00:01Z', now), 'Just now');
  assert.equal(notificationTime('2026-11-04T11:55:00Z', now), '5m ago');
  assert.equal(notificationTime('2026-11-04T09:00:00Z', now), '3h ago');
  assert.equal(notificationTime('2026-11-01T12:00:00Z', now), '3d ago');
  assert.equal(notificationTime('bad date', now), '');
});
