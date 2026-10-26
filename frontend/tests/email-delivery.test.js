import assert from 'node:assert/strict';
import test from 'node:test';
import { emailDeliveryStatus } from '../src/emailDelivery.js';

test('Historical sent records cannot claim SMTP delivery', () => {
  const legacy = emailDeliveryStatus({ status: 'sent', sentAt: '2026-10-01T00:00:00Z' });
  assert.equal(legacy.label, 'Recorded only');
  assert.equal(legacy.isSent, false);
  assert.match(legacy.description, /without sending/);
});

test('Unavailable delivery remains explicit when no supported transport was configured', () => {
  assert.equal(emailDeliveryStatus({ status: 'unavailable' }).label, 'Email unavailable');
  assert.equal(emailDeliveryStatus({ status: 'unavailable', deliveryMethod: 'unknown' }).isSent, false);
});

test('SMTP and Gmail API acceptance show sent without claiming inbox delivery', () => {
  for (const deliveryMethod of ['smtp', 'gmail-api']) {
    const sent = emailDeliveryStatus({ status: 'sent', deliveryMethod });
    assert.equal(sent.isSent, true);
    assert.match(sent.description, /Inbox delivery is not confirmed/);
    for (const status of ['pending', 'failed', 'unavailable', 'unexpected']) {
      const display = emailDeliveryStatus({ status, deliveryMethod });
      assert.equal(display.isSent, false);
      assert.notEqual(display.label, 'Sent');
    }
  }
  assert.equal(emailDeliveryStatus({ status: 'sent', deliveryMethod: 'unknown' }).isSent, false);
});
