import assert from 'node:assert/strict';
import test from 'node:test';
import { emailDeliveryStatus } from '../src/emailDelivery.js';

test('Historical sent records cannot claim SMTP delivery', () => {
  const legacy = emailDeliveryStatus({ status: 'sent', sentAt: '2026-10-01T00:00:00Z' });
  assert.equal(legacy.label, 'Recorded only');
  assert.equal(legacy.isSent, false);
  assert.match(legacy.description, /without sending/);
});

test('Only SMTP acceptance shows sent and it does not claim inbox delivery', () => {
  const sent = emailDeliveryStatus({ status: 'sent', deliveryMethod: 'smtp' });
  assert.equal(sent.isSent, true);
  assert.match(sent.description, /Inbox delivery is not confirmed/);
  for (const status of ['pending', 'failed', 'unavailable', 'unexpected']) {
    const display = emailDeliveryStatus({ status, deliveryMethod: 'smtp' });
    assert.equal(display.isSent, false);
    assert.notEqual(display.label, 'Sent');
  }
});
