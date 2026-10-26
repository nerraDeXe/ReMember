import assert from 'node:assert/strict';
import { inspect } from 'node:util';
import { test } from 'node:test';
import { createGmailDelivery, gmailDelivery } from '../services/gmailDelivery.js';

const configuration = {
  GMAIL_CLIENT_ID: 'test-google-client-id',
  GMAIL_CLIENT_SECRET: 'private-google-client-secret',
  GMAIL_REFRESH_TOKEN: 'private-google-refresh-token',
  EMAIL_FROM: 'ReMember Team <sender@example.test>',
};
const privateAccessToken = 'private-google-access-token';
const message = { to: 'member@example.test', subject: 'Membership confirmation', text: 'Welcome to ReMember.', html: '<p>Welcome to ReMember.</p>' };

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function tokenResponse() {
  return jsonResponse({ access_token: privateAccessToken, token_type: 'Bearer', expires_in: 3600 });
}

function transport(responses, options = {}) {
  const requests = [];
  const delivery = createGmailDelivery({
    env: { ...configuration, ...options.env },
    ...(options.timeoutMs ? { timeoutMs: options.timeoutMs } : {}),
    fetchImplementation: async (input, init) => {
      const request = new Request(input, init);
      const details = {
        url: request.url,
        method: request.method,
        headers: request.headers,
        signal: request.signal,
        body: await request.text(),
      };
      requests.push(details);
      const response = responses.shift();
      assert.notEqual(response, undefined, 'Email delivery made an unexpected extra HTTP request.');
      return typeof response === 'function' ? response(details) : response;
    },
  });
  return { delivery, requests };
}

function assertSanitized(error) {
  assert.ok(error instanceof Error);
  const output = [String(error), JSON.stringify(error), inspect(error, { depth: 5 })].join('\n');
  for (const secret of [configuration.GMAIL_CLIENT_SECRET, configuration.GMAIL_REFRESH_TOKEN, privateAccessToken, 'private-provider-error']) {
    assert.equal(output.includes(secret), false, 'The surfaced delivery error must not include credentials or provider response text.');
  }
  return true;
}

function headersAndBody(raw) {
  const index = raw.indexOf('\r\n\r\n');
  assert.ok(index >= 0, 'Expected RFC MIME headers and body.');
  return { headers: raw.slice(0, index).replace(/\r\n[ \t]+/g, ' '), body: raw.slice(index + 4) };
}

function decodeQuotedPrintable(value) {
  const bytes = [];
  const unfolded = value.replace(/=\r?\n/g, '');
  for (let index = 0; index < unfolded.length; index += 1) {
    if (unfolded[index] === '=' && /^[0-9a-f]{2}$/i.test(unfolded.slice(index + 1, index + 3))) {
      bytes.push(Number.parseInt(unfolded.slice(index + 1, index + 3), 16));
      index += 2;
    } else bytes.push(unfolded.charCodeAt(index));
  }
  return Buffer.from(bytes).toString('utf8');
}

function decodedPart(raw, contentType) {
  const root = headersAndBody(raw);
  const boundary = /boundary=(?:"([^"]+)"|([^;\s]+))/i.exec(root.headers);
  assert.ok(boundary, 'Both email bodies should be present in a MIME multipart message.');
  const parts = root.body.split(`--${boundary[1] || boundary[2]}`);
  for (const part of parts) {
    if (!part.startsWith('\r\n') || part.startsWith('\r\n--')) continue;
    const { headers, body } = headersAndBody(part.slice(2));
    if (!headers.toLowerCase().includes(`content-type: ${contentType}`)) continue;
    assert.match(headers, /charset=utf-8/i);
    const encoding = /Content-Transfer-Encoding: ([^\r\n]+)/i.exec(headers)?.[1].trim().toLowerCase();
    const decoded = encoding === 'base64' ? Buffer.from(body, 'base64').toString('utf8')
      : encoding === 'quoted-printable' ? decodeQuotedPrintable(body) : body;
    return decoded.replace(/\r\n/g, '\n').trimEnd();
  }
  assert.fail(`Missing ${contentType} MIME part.`);
}

function decodedSubject(raw) {
  const { headers } = headersAndBody(raw);
  const subject = /^Subject: (.+)$/im.exec(headers)?.[1];
  assert.ok(subject, 'Expected a Subject MIME header.');
  return subject.replace(/\?=\s+=\?/g, '?==?').replace(/=\?utf-8\?([bq])\?([^?]+)\?=/gi, (_, encoding, value) =>
    encoding.toLowerCase() === 'b' ? Buffer.from(value, 'base64').toString('utf8') : decodeQuotedPrintable(value.replace(/_/g, ' ')));
}

test('Gmail delivery requires the sender and every OAuth credential before attempting HTTP', async () => {
  assert.equal(typeof gmailDelivery.isConfigured, 'function');
  assert.equal(typeof gmailDelivery.send, 'function');
  assert.equal(transport([]).delivery.isConfigured(), true);
  for (const key of Object.keys(configuration)) {
    const { delivery, requests } = transport([], { env: { [key]: '' } });
    assert.equal(delivery.isConfigured(), false, `Expected missing ${key} to disable Gmail delivery.`);
    await assert.rejects(delivery.send(message), assertSanitized);
    assert.equal(requests.length, 0);
  }
});

test('Gmail sends an RFC MIME message over HTTPS with a refresh token and UTF-8 plain text and HTML', async () => {
  const { delivery, requests } = transport([tokenResponse(), jsonResponse({ id: 'gmail-message-id' })]);
  const subject = 'Welcome Zoë — 欢迎 🎉';
  const text = 'Hello Zoë,\nYour membership is ready. 欢迎 🎉';
  const html = '<p>Hello Zoë,</p><p>Your membership is ready. 欢迎 🎉</p>';
  const result = await delivery.send({ ...message, subject, text, html });

  assert.deepEqual(result, { accepted: true, deliveryMethod: 'gmail-api' });
  assert.equal(requests.length, 2);
  assert.equal(requests[0].url, 'https://oauth2.googleapis.com/token');
  assert.equal(requests[0].method, 'POST');
  const grant = new URLSearchParams(requests[0].body);
  assert.equal(grant.get('grant_type'), 'refresh_token');
  assert.equal(grant.get('client_id'), configuration.GMAIL_CLIENT_ID);
  assert.equal(grant.get('client_secret'), configuration.GMAIL_CLIENT_SECRET);
  assert.equal(grant.get('refresh_token'), configuration.GMAIL_REFRESH_TOKEN);
  assert.equal(requests[1].url, 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send');
  assert.equal(requests[1].method, 'POST');
  assert.equal(requests[1].headers.get('authorization'), `Bearer ${privateAccessToken}`);
  assert.match(requests[1].headers.get('content-type'), /^application\/json/);
  const payload = JSON.parse(requests[1].body);
  assert.deepEqual(Object.keys(payload), ['raw']);
  assert.match(payload.raw, /^[A-Za-z0-9_-]+$/);
  const mime = Buffer.from(payload.raw, 'base64url').toString('utf8');
  assert.match(mime, /From: ReMember Team <sender@example\.test>/);
  assert.match(mime, /To: member@example\.test/);
  assert.equal(decodedSubject(mime), subject);
  assert.equal(decodedPart(mime, 'text/plain'), text);
  assert.equal(decodedPart(mime, 'text/html'), html);
  assert.equal(mime.includes(configuration.GMAIL_REFRESH_TOKEN), false);
  for (const request of requests) assert.ok(request.signal instanceof AbortSignal);
});

test('Cached OAuth access tokens are refreshed when the configured account credentials change', async () => {
  const env = { ...configuration };
  const requests = [];
  const responses = [tokenResponse(), jsonResponse({ id: 'first-message' }), jsonResponse({ id: 'second-message' }),
    jsonResponse({ access_token: 'replacement-access-token', expires_in: 3600 }), jsonResponse({ id: 'third-message' })];
  const delivery = createGmailDelivery({ env, fetchImplementation: async (input, init) => {
    const request = new Request(input, init);
    requests.push({ url: request.url, headers: request.headers, body: await request.text() });
    assert.ok(responses.length, 'A cached token should not cause another OAuth request.');
    return responses.shift();
  } });

  await delivery.send(message);
  await delivery.send(message);
  assert.equal(requests.length, 3);
  assert.equal(requests[2].headers.get('authorization'), `Bearer ${privateAccessToken}`);

  env.GMAIL_REFRESH_TOKEN = 'replacement-refresh-token';
  await delivery.send(message);
  assert.equal(requests.length, 5);
  assert.equal(requests[3].url, 'https://oauth2.googleapis.com/token');
  assert.equal(new URLSearchParams(requests[3].body).get('refresh_token'), env.GMAIL_REFRESH_TOKEN);
  assert.equal(requests[4].headers.get('authorization'), 'Bearer replacement-access-token');
});

test('A Gmail 401 clears the rejected cached token for the next explicit send without retrying the first email', async () => {
  const { delivery, requests } = transport([
    tokenResponse(),
    jsonResponse({ error: { message: 'private-provider-error' } }, 401),
    jsonResponse({ access_token: 'reauthorized-access-token', expires_in: 3600 }),
    jsonResponse({ id: 'next-explicit-message' }),
  ]);

  await assert.rejects(delivery.send(message), error => {
    assert.equal(error.code, 'GMAIL_AUTH');
    return assertSanitized(error);
  });
  assert.equal(requests.length, 2, 'A rejected email must not automatically refresh and send again.');

  assert.deepEqual(await delivery.send({ ...message, subject: 'A later explicit email' }), { accepted: true, deliveryMethod: 'gmail-api' });
  assert.equal(requests.length, 4);
  assert.equal(requests[2].url, 'https://oauth2.googleapis.com/token');
  assert.equal(new URLSearchParams(requests[2].body).get('refresh_token'), configuration.GMAIL_REFRESH_TOKEN);
  assert.equal(requests[3].url, 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send');
  assert.equal(requests[3].headers.get('authorization'), 'Bearer reauthorized-access-token');
  const mime = Buffer.from(JSON.parse(requests[3].body).raw, 'base64url').toString('utf8');
  assert.equal(decodedSubject(mime), 'A later explicit email');
});

test('OAuth provider failures are sanitized, classified and never followed by a send or retry', async t => {
  for (const [status, code] of [[400, 'GMAIL_AUTH'], [401, 'GMAIL_AUTH'], [403, 'GMAIL_FORBIDDEN'], [429, 'GMAIL_RATE_LIMIT'], [503, 'GMAIL_UNAVAILABLE']]) {
    await t.test(String(status), async () => {
      const { delivery, requests } = transport([jsonResponse({ error: 'invalid_grant', error_description: `private-provider-error ${configuration.GMAIL_REFRESH_TOKEN}` }, status)]);
      await assert.rejects(delivery.send(message), error => {
        assert.equal(error.code, code);
        return assertSanitized(error);
      });
      assert.equal(requests.length, 1);
    });
  }
});

test('Gmail provider failures are sanitized and never retried, including ambiguous server failures', async t => {
  for (const [status, code] of [[401, 'GMAIL_AUTH'], [403, 'GMAIL_FORBIDDEN'], [429, 'GMAIL_RATE_LIMIT'], [503, 'GMAIL_UNAVAILABLE']]) {
    await t.test(String(status), async () => {
      const { delivery, requests } = transport([tokenResponse(), jsonResponse({ error: { message: `private-provider-error ${privateAccessToken}` } }, status)]);
      await assert.rejects(delivery.send(message), error => {
        assert.equal(error.code, code);
        return assertSanitized(error);
      });
      assert.equal(requests.length, 2);
    });
  }
});

test('Malformed OAuth responses cannot dispatch an email', async t => {
  const responses = [jsonResponse({}), jsonResponse({ access_token: '' }), new Response('private-provider-error', { status: 200 })];
  for (const [index, response] of responses.entries()) {
    await t.test(String(index), async () => {
      const { delivery, requests } = transport([response]);
      await assert.rejects(delivery.send(message), assertSanitized);
      assert.equal(requests.length, 1);
    });
  }
});

test('A successful HTTP response needs a Gmail message ID before delivery is accepted', async t => {
  const responses = [jsonResponse({}), jsonResponse({ id: '' }), jsonResponse({ id: 42 }), jsonResponse(null), new Response('private-provider-error', { status: 200 })];
  for (const [index, response] of responses.entries()) {
    await t.test(String(index), async () => {
      const { delivery, requests } = transport([tokenResponse(), response]);
      await assert.rejects(delivery.send(message), error => {
        assert.equal(error.code, 'GMAIL_UNAVAILABLE');
        return assertSanitized(error);
      });
      assert.equal(requests.length, 2);
    });
  }
});

test('Network errors cannot leak request credentials or trigger a duplicate send', async t => {
  for (const phase of ['token', 'send']) {
    await t.test(phase, async () => {
      const failure = () => {
        throw Object.assign(new Error(`private-provider-error ${configuration.GMAIL_CLIENT_SECRET} ${configuration.GMAIL_REFRESH_TOKEN} ${privateAccessToken}`), { response: { privateAccessToken } });
      };
      const { delivery, requests } = transport(phase === 'token' ? [failure] : [tokenResponse(), failure]);
      await assert.rejects(delivery.send(message), error => {
        assert.equal(error.code, 'GMAIL_UNAVAILABLE');
        return assertSanitized(error);
      });
      assert.equal(requests.length, phase === 'token' ? 1 : 2);
    });
  }
});

test('OAuth and Gmail requests have finite deadlines and abort without retrying', { timeout: 2000 }, async t => {
  for (const phase of ['token', 'send']) {
    await t.test(phase, async () => {
      const neverRespond = () => new Promise(() => {});
      const { delivery, requests } = transport(phase === 'token' ? [neverRespond] : [tokenResponse(), neverRespond], { timeoutMs: 100 });
      await assert.rejects(delivery.send(message), error => {
        assert.equal(error.code, 'ETIMEDOUT');
        return assertSanitized(error);
      });
      assert.equal(requests.length, phase === 'token' ? 1 : 2);
      assert.equal(requests.at(-1).signal.aborted, true);
    });
  }
});

test('A stalled Gmail response body also times out without claiming delivery or retrying', { timeout: 2000 }, async () => {
  let streamController;
  const stalledBody = new ReadableStream({ start(controller) {
    streamController = controller;
    controller.enqueue(new TextEncoder().encode('{"id":'));
  } });
  const { delivery, requests } = transport([tokenResponse(), new Response(stalledBody, { status: 200 })], { timeoutMs: 100 });
  try {
    await assert.rejects(delivery.send(message), error => {
      assert.equal(error.code, 'ETIMEDOUT');
      return assertSanitized(error);
    });
    assert.equal(requests.length, 2);
    assert.equal(requests[1].signal.aborted, true);
  } finally {
    streamController.close();
  }
});
