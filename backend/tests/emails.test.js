import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { once } from 'node:events';
import net from 'node:net';
import { EmailNotification, ActivityLog } from '../models/index.js';
import { emailService } from '../services/emailService.js';
import { mailDelivery, logMailDeliveryFailure } from '../services/mailDelivery.js';
import { gmailDelivery } from '../services/gmailDelivery.js';
import nodemailer from 'nodemailer';
import { getOrganisationEmailSettings } from '../../shared/organisationEmails.js';

const member = { _id: 'member', name: 'Test Member', email: 'member@example.test', membershipNumber: 'MEM-TEST', tierName: 'Community', status: 'active' };
const event = { organisationId: 'org', title: 'Community Meetup', date: '2099-01-01', time: '18:00', location: 'Main Hall' };
let records, activities, savedStatuses;
const MAIL_ENV_KEYS = ['MAIL_TRANSPORT', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_REQUIRE_TLS', 'SMTP_USER', 'SMTP_PASSWORD', 'GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'GMAIL_REFRESH_TOKEN', 'EMAIL_FROM'];
let previousMailEnvironment;

beforeEach(t => {
  previousMailEnvironment = Object.fromEntries(MAIL_ENV_KEYS.map(key => [key, process.env[key]]));
  for (const key of MAIL_ENV_KEYS) delete process.env[key];
  process.env.MAIL_TRANSPORT = 'smtp';
  records = [];
  activities = [];
  savedStatuses = [];
  t.mock.method(EmailNotification, 'create', async input => {
    const record = new EmailNotification(input);
    t.mock.method(record, 'save', async () => {
      assert.equal(record.validateSync(), undefined);
      savedStatuses.push(record.status);
      return record;
    });
    assert.equal(record.validateSync(), undefined);
    records.push(record);
    return record;
  });
  t.mock.method(ActivityLog, 'create', async input => { activities.push(input); return input; });
});

afterEach(() => {
  for (const [key, value] of Object.entries(previousMailEnvironment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

const gmailSettings = () => Object.assign(process.env, {
  MAIL_TRANSPORT: 'gmail-api', GMAIL_CLIENT_ID: 'fixture-client-id',
  GMAIL_CLIENT_SECRET: 'fixture-client-secret', GMAIL_REFRESH_TOKEN: 'fixture-refresh-token',
  EMAIL_FROM: 'ReMember <sender@example.test>',
});

test('Automatic Gmail selection uses the API even when legacy SMTP settings remain configured', async t => {
  gmailSettings();
  Object.assign(process.env, { MAIL_TRANSPORT: 'auto', SMTP_HOST: 'smtp.gmail.com', SMTP_USER: 'sender@example.test', SMTP_PASSWORD: 'fixture-app-password' });
  t.mock.method(nodemailer, 'createTransport', () => assert.fail('Gmail API delivery must not open SMTP'));
  const send = t.mock.method(gmailDelivery, 'send', async () => ({ accepted: true, deliveryMethod: 'gmail-api' }));
  assert.equal(mailDelivery.deliveryMethod(), 'gmail-api');
  assert.equal(mailDelivery.isConfigured(), true);
  assert.deepEqual(await mailDelivery.send({ to: member.email, subject: 'Fixture', text: 'Test' }), { accepted: true, deliveryMethod: 'gmail-api' });
  assert.equal(send.mock.calls.length, 1);
});

test('Partial Gmail setup and unknown transport fail without silently falling back to SMTP', async t => {
  Object.assign(process.env, { MAIL_TRANSPORT: 'auto', GMAIL_CLIENT_ID: 'fixture-client-id', SMTP_HOST: 'smtp.gmail.com', EMAIL_FROM: 'sender@example.test' });
  t.mock.method(nodemailer, 'createTransport', () => assert.fail('Incomplete API setup must not fall back to SMTP'));
  t.mock.method(gmailDelivery, 'send', () => assert.fail('Incomplete API setup must not send'));
  assert.equal(mailDelivery.deliveryMethod(), 'gmail-api');
  assert.equal(mailDelivery.isConfigured(), false);
  await assert.rejects(mailDelivery.send({ to: member.email, subject: 'Fixture', text: 'Test' }), { code: 'EMAIL_CONFIG' });
  process.env.MAIL_TRANSPORT = 'unsupported';
  assert.equal(mailDelivery.isConfigured(), false);
  await assert.rejects(mailDelivery.send({ to: member.email, subject: 'Fixture', text: 'Test' }), { code: 'EMAIL_CONFIG' });
  const record = await emailService.sendEventRsvpConfirmation(member, event);
  assert.equal(record.status, 'unavailable');
  assert.equal(record.sentAt, undefined);
});

test('Explicit SMTP selection retains the existing transport when Gmail settings are present', () => {
  gmailSettings();
  Object.assign(process.env, { MAIL_TRANSPORT: 'smtp', SMTP_HOST: 'smtp.gmail.com', SMTP_USER: 'sender@example.test', SMTP_PASSWORD: 'fixture-app-password' });
  assert.equal(mailDelivery.deliveryMethod(), 'smtp');
  assert.equal(mailDelivery.isConfigured(), true);
});

test('Gmail confirmations retain their transport and become sent only after API acceptance', async t => {
  gmailSettings();
  t.mock.method(gmailDelivery, 'send', async () => {
    assert.equal(records.at(-1).status, 'pending');
    return { accepted: true, deliveryMethod: 'gmail-api' };
  });
  const record = await emailService.sendEventRsvpConfirmation(member, event);
  assert.equal(record.deliveryMethod, 'gmail-api');
  assert.equal(record.status, 'sent');
  assert.ok(record.sentAt);
  assert.equal(activities[0].action, 'EMAIL_SENT');
});

test('Rejected or unacknowledged Gmail delivery never records a sent email', async t => {
  gmailSettings();
  t.mock.method(console, 'error', () => {});
  const send = t.mock.method(gmailDelivery, 'send', async () => { throw Object.assign(new Error('API authorization failed'), { code: 'GMAIL_AUTH' }); });
  const failed = await emailService.sendEventRsvpConfirmation(member, event);
  assert.equal(failed.deliveryMethod, 'gmail-api');
  assert.equal(failed.status, 'failed');
  assert.equal(failed.sentAt, undefined);
  send.mock.mockImplementation(async () => ({}));
  const unacknowledged = await emailService.sendEventRsvpConfirmation(member, event);
  assert.equal(unacknowledged.status, 'failed');
  assert.equal(unacknowledged.sentAt, undefined);
});

test('SMTP failure diagnostics distinguish blocked connections from authentication failures without logging secrets', t => {
  const log = t.mock.method(console, 'error', () => {});
  const secret = 'private-app-password-reset-token-member@example.test';
  const timeout = Object.assign(new Error(secret), {
    code: 'ETIMEDOUT', command: `CONN ${secret}`, response: secret,
    stack: secret, auth: { user: secret, pass: secret },
  });
  const authentication = Object.assign(new Error(secret), {
    code: 'EAUTH', responseCode: 535, command: `AUTH ${secret}`, response: secret, stack: secret,
  });

  logMailDeliveryFailure('verification', timeout);
  logMailDeliveryFailure('password_reset', authentication);

  assert.equal(log.mock.calls[0].arguments[0], 'Verification email delivery failed.');
  assert.equal(log.mock.calls[0].arguments[1].code, 'ETIMEDOUT');
  assert.match(log.mock.calls[0].arguments[1].reason, /outbound SMTP access/);
  assert.equal(log.mock.calls[1].arguments[0], 'Password reset email delivery failed.');
  assert.equal(log.mock.calls[1].arguments[1].code, 'EAUTH');
  assert.equal(log.mock.calls[1].arguments[1].responseCode, 535);
  assert.match(log.mock.calls[1].arguments[1].reason, /credentials/);
  assert.equal(JSON.stringify(log.mock.calls.map(call => call.arguments)).includes(secret), false);
});

test('SMTP failure diagnostics discard unrecognized fields and untrusted context', t => {
  const log = t.mock.method(console, 'error', () => {});
  const secret = 'private-provider-response-reset-token';
  logMailDeliveryFailure(secret, { code: secret, responseCode: `535 ${secret}`, message: secret, response: secret });
  logMailDeliveryFailure('__proto__', { code: '__proto__', responseCode: 1000 });
  logMailDeliveryFailure('confirmation', null);

  for (const call of log.mock.calls) {
    assert.equal(call.arguments[1].code, 'UNKNOWN');
    assert.equal(Object.hasOwn(call.arguments[1], 'responseCode'), false);
  }
  assert.equal(log.mock.calls[0].arguments[0], 'Email delivery failed.');
  assert.equal(log.mock.calls[1].arguments[0], 'Email delivery failed.');
  assert.equal(JSON.stringify(log.mock.calls.map(call => call.arguments)).includes(secret), false);
});

test('All confirmation templates reach SMTP and record sent only after provider acceptance', async t => {
  t.mock.method(mailDelivery, 'isConfigured', () => true);
  const sent = [];
  t.mock.method(mailDelivery, 'send', async message => {
    const record = records.at(-1);
    assert.equal(record.status, 'pending');
    assert.equal(record.sentAt, undefined);
    assert.equal(activities.length, sent.length);
    sent.push(message);
    return { accepted: true };
  });

  await emailService.sendRegistrationConfirmation({ ...member, organisationId: 'org' });
  await emailService.sendPaymentConfirmation(member, { organisationId: 'org', invoiceNumber: 'INV-TEST', tierName: 'Community', amount: 25, paymentMethod: 'Test payment' });
  await emailService.sendEventRsvpConfirmation(member, event);

  assert.equal(sent.length, 3);
  for (const [index, message] of sent.entries()) {
    assert.equal(message.to, member.email);
    assert.equal(message.subject, records[index].subject);
    assert.equal(message.html, records[index].htmlContent);
    assert.equal(records[index].status, 'sent');
    assert.equal(records[index].deliveryMethod, 'smtp');
    assert.equal(records[index].organisationId, 'org');
    assert.ok(Number.isFinite(Date.parse(records[index].sentAt)));
    assert.equal(activities[index].action, 'EMAIL_SENT');
    assert.equal(activities[index].organisationId, 'org');
  }
  assert.deepEqual(savedStatuses, ['sent', 'sent', 'sent']);
});

test('RSVP confirmations include every event day, time zone and an encoded Google Maps link', async t => {
  t.mock.method(mailDelivery, 'isConfigured', () => true);
  const messages = [];
  t.mock.method(mailDelivery, 'send', async message => { messages.push(message); return { accepted: true }; });
  await emailService.sendEventRsvpConfirmation(member, {
    ...event,
    title: 'Community <Workshop>',
    location: 'Hall A & B, Kuala Lumpur',
    locationLatitude: 3.153, locationLongitude: 101.713,
    startDate: '2099-01-01', endDate: '2099-01-02', timeZone: 'Asia/Kuala_Lumpur',
    schedule: [{ date: '2099-01-01', startTime: '09:00', endTime: '12:00' }, { date: '2099-01-02', startTime: '14:00', endTime: '17:30' }],
  });
  assert.equal(messages.length, 1);
  assert.match(messages[0].html, /2099-01-01: 09:00/);
  assert.match(messages[0].html, /2099-01-02: 14:00/);
  assert.match(messages[0].html, /17:30/);
  assert.match(messages[0].html, /Asia\/Kuala_Lumpur/);
  assert.match(messages[0].html, /Community &lt;Workshop&gt;/);
  assert.match(messages[0].html, /Open in Google Maps/);
  assert.match(messages[0].text, /2099-01-02: 14:00/);
  const link = messages[0].text.split('Open in Google Maps: ')[1].split('\n')[0];
  assert.equal(new URL(link).searchParams.get('query'), '3.153,101.713');
  assert.match(messages[0].html, /OpenStreetMap contributors/);
  assert.match(messages[0].text, /https:\/\/www.openstreetmap.org\/copyright/);
});

test('SMTP failure preserves the in-app confirmation without claiming it was sent', async t => {
  t.mock.method(mailDelivery, 'isConfigured', () => true);
  t.mock.method(mailDelivery, 'send', async () => { throw new Error('Provider rejected the message'); });
  t.mock.method(console, 'error', () => {});
  const record = await emailService.sendEventRsvpConfirmation(member, event);
  assert.equal(record.status, 'failed');
  assert.equal(record.sentAt, undefined);
  assert.equal(record.htmlContent.includes(event.title), true);
  assert.deepEqual(savedStatuses, ['failed']);
  assert.equal(activities[0].action, 'EMAIL_DELIVERY_FAILED');
  assert.equal(activities[0].details.status, 'failed');
});

test('Missing SMTP records unavailable and never attempts delivery', async t => {
  t.mock.method(mailDelivery, 'isConfigured', () => false);
  const send = t.mock.method(mailDelivery, 'send', async () => assert.fail('SMTP must not run without configuration'));
  const record = await emailService.sendEventRsvpConfirmation(member, event);
  assert.equal(record.status, 'unavailable');
  assert.equal(record.sentAt, undefined);
  assert.equal(send.mock.calls.length, 0);
  assert.equal(activities[0].action, 'EMAIL_DELIVERY_FAILED');
});

test('A new notification cannot default to sent before delivery', () => {
  const record = new EmailNotification({ recipientEmail: member.email, recipientName: member.name, type: 'EVENT_RSVP', subject: 'Test', htmlContent: '<p>Test</p>' });
  assert.equal(record.status, 'pending');
  assert.equal(record.sentAt, undefined);
  assert.equal(record.deliveryMethod, undefined);
});

test('Organisation welcome and renewal templates interpolate plain text and escape member and owner content', async t => {
  t.mock.method(mailDelivery, 'isConfigured', () => true);
  const sent = [];
  t.mock.method(mailDelivery, 'send', async message => { sent.push(message); return { accepted: true }; });
  const organisation = { _id: 'art-org', name: 'Art & <Club>', emailSettings: getOrganisationEmailSettings({
    welcome: { subject: 'Welcome {memberName} to {organisationName}', body: 'Hello {memberName}\n<script>alert(1)</script>\nYour tier: {tierName}' },
    renewal: { enabled: true, daysBefore: 7, subject: '{organisationName}: renewal in {renewalDays} days', body: '{memberName}: {tierName} expires {expiryDate}.' }
  }) };
  const unsafeMember = { ...member, name: '<img onerror=alert(1)> {organisationName}' };
  const membership = { role: 'member', tierName: 'Gold <VIP>', expirationDate: '2026-11-01T12:00:00.000Z' };
  await emailService.sendOrganisationWelcome(unsafeMember, membership, organisation);
  await emailService.sendOrganisationRenewal(unsafeMember, membership, organisation);
  assert.equal(sent.length, 2);
  assert.equal(sent[0].subject, 'Welcome <img onerror=alert(1)> {organisationName} to Art & <Club>');
  assert.match(sent[0].text, /<script>alert\(1\)<\/script>/);
  assert.match(sent[0].html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(sent[0].html, /&lt;img onerror=alert\(1\)&gt;/);
  assert.equal(sent[0].html.includes('<script>'), false);
  assert.match(sent[1].text, /expires 2026-11-01/);
  assert.equal(sent[1].subject, 'Art & <Club>: renewal in 7 days');
  assert.equal(records[0].organisationId, 'art-org');
  assert.equal(records[1].type, 'MEMBERSHIP_RENEWAL');
});

test('Disabled templates, organisation owners and notification opt-outs never dispatch membership email', async t => {
  const send = t.mock.method(mailDelivery, 'send', async () => assert.fail('Skipped emails must not reach SMTP'));
  const organisation = { _id: 'org', name: 'Organisation', emailSettings: getOrganisationEmailSettings({ welcome: { enabled: false }, renewal: { enabled: true } }) };
  const membership = { role: 'member', tierName: 'Community' };
  assert.equal((await emailService.sendOrganisationWelcome(member, membership, organisation)).status, 'skipped');
  assert.equal((await emailService.sendOrganisationRenewal({ ...member, notifications: { email: false } }, membership, organisation)).status, 'skipped');
  assert.equal((await emailService.sendOrganisationRenewal(member, { ...membership, role: 'owner' }, organisation)).status, 'skipped');
  assert.equal(send.mock.calls.length, 0);
  assert.equal(records.length, 0);
});

async function smtpReceiver(t, acceptMessage) {
  const messages = [];
  const recipients = [];
  const sockets = new Set();
  const server = net.createServer(socket => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.setEncoding('utf8');
    socket.write('220 localhost test SMTP\r\n');
    let buffer = '', data = null;
    socket.on('data', chunk => {
      buffer += chunk;
      while (buffer.includes('\r\n')) {
        const boundary = buffer.indexOf('\r\n');
        const line = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        if (data !== null) {
          if (line === '.') {
            messages.push(data.join('\r\n'));
            data = null;
            socket.write(acceptMessage ? '250 Message accepted\r\n' : '550 Message rejected\r\n');
          } else data.push(line);
        } else if (/^(EHLO|HELO) /i.test(line)) socket.write('250 localhost\r\n');
        else if (/^MAIL FROM:/i.test(line)) socket.write('250 Sender accepted\r\n');
        else if (/^RCPT TO:/i.test(line)) { recipients.push(line); socket.write('250 Recipient accepted\r\n'); }
        else if (line === 'DATA') { data = []; socket.write('354 End with a dot\r\n'); }
        else if (line === 'QUIT') socket.end('221 Bye\r\n');
        else socket.write('250 OK\r\n');
      }
    });
  });
  t.after(() => {
    for (const socket of sockets) socket.destroy();
    return new Promise(resolve => server.close(resolve));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const settings = { SMTP_HOST: '127.0.0.1', SMTP_PORT: String(server.address().port), SMTP_SECURE: 'false', SMTP_REQUIRE_TLS: 'false', SMTP_USER: '', SMTP_PASSWORD: '', EMAIL_FROM: 'ReMember <sender@example.test>' };
  Object.assign(process.env, settings);
  return { messages, recipients };
}

test('RSVP uses the real Nodemailer transport to send a message to a local SMTP server', { timeout: 10000 }, async t => {
  const smtp = await smtpReceiver(t, true);
  const record = await emailService.sendEventRsvpConfirmation(member, event);
  assert.equal(record.status, 'sent');
  assert.equal(smtp.messages.length, 1);
  assert.deepEqual(smtp.recipients, ['RCPT TO:<member@example.test>']);
  assert.match(smtp.messages[0], /From: ReMember <sender@example\.test>/);
  assert.match(smtp.messages[0], /To: member@example\.test/);
  assert.match(smtp.messages[0], /Content-Type: text\/html/);
  assert.match(smtp.messages[0], /Community Meetup/);
  assert.equal(activities[0].action, 'EMAIL_SENT');
});

test('A real SMTP rejection is recorded as failed without a sent timestamp', { timeout: 10000 }, async t => {
  const smtp = await smtpReceiver(t, false);
  t.mock.method(console, 'error', () => {});
  const record = await emailService.sendEventRsvpConfirmation(member, event);
  assert.equal(smtp.messages.length, 1);
  assert.equal(record.status, 'failed');
  assert.equal(record.sentAt, undefined);
  assert.equal(activities[0].action, 'EMAIL_DELIVERY_FAILED');
});
