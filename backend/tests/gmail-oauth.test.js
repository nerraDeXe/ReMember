import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import test from 'node:test';
import dotenv from 'dotenv';
import { OAuth2Client } from 'google-auth-library';
import { authorizeGmail, GMAIL_SEND_SCOPE } from '../scripts/gmail-oauth.mjs';

async function availablePort() {
  const probe = createServer();
  await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', resolve); });
  const port = probe.address().port;
  await new Promise((resolve, reject) => probe.close(error => error ? reject(error) : resolve()));
  return port;
}

for (const desktop of [false, true]) {
  test(`${desktop ? 'Desktop' : 'Web'} OAuth validates the local callback and saves only after consent`, { timeout: 10_000 }, async t => {
    const directory = await mkdtemp(join(tmpdir(), 'remember-gmail-oauth-test-'));
    const envPath = join(directory, '.env');
    let setup;
    t.after(async () => {
      await setup?.catch(() => {});
      const target = resolve(directory);
      assert.equal(dirname(target), resolve(tmpdir()));
      assert.match(basename(target), /^remember-gmail-oauth-test-/);
      await rm(target, { recursive: true, force: true });
    });

    const original = 'JWT_SECRET="unrelated-fixture-secret"\nSMTP_HOST="smtp.example.test"\n';
    await writeFile(envPath, original, { mode: 0o600 });
    const output = [];
    t.mock.method(console, 'log', (...values) => output.push(values.join(' ')));
    const port = await availablePort();
    const redirect = `http://127.0.0.1:${port}${desktop ? '/' : '/oauth2/callback'}`;
    const exchange = t.mock.method(OAuth2Client.prototype, 'getToken', async function (request) {
      assert.equal(this.redirectUri, redirect);
      assert.equal(request.code, 'fixture-authorization-code');
      assert.match(request.codeVerifier, /^[A-Za-z0-9._~-]{43,128}$/);
      return { tokens: { scope: GMAIL_SEND_SCOPE, refresh_token: 'fixture-private-refresh-token' } };
    });
    setup = authorizeGmail({
      desktop, port, envPath, timeoutMs: 3_000,
      environment: {
        GMAIL_CLIENT_ID: 'fixture-client.apps.googleusercontent.com',
        GMAIL_CLIENT_SECRET: 'fixture-private-client-secret',
        EMAIL_FROM: 'ReMember <sender@example.test>',
      },
    });
    setup.catch(() => {});
    let link;
    for (let attempt = 0; attempt < 200; attempt += 1) {
      link = output.find(line => line.startsWith('https://accounts.google.com/'));
      if (link) break;
      await new Promise(resolve => setTimeout(resolve, 5));
    }
    assert.ok(link, 'helper prints the authorization link after starting its listener');
    const consent = new URL(link);
    assert.equal(consent.searchParams.get('redirect_uri'), redirect);
    assert.equal(consent.searchParams.get('scope'), GMAIL_SEND_SCOPE);
    assert.equal(consent.searchParams.get('access_type'), 'offline');
    assert.equal(consent.searchParams.get('code_challenge_method'), 'S256');

    const wrongPath = new URL('/wrong-callback', redirect);
    const wrongResponse = await fetch(wrongPath);
    assert.equal(wrongResponse.status, 404);
    await wrongResponse.text();
    const callback = new URL(redirect);
    callback.searchParams.set('state', 'wrong-state');
    callback.searchParams.set('code', 'fixture-authorization-code');
    const rejected = await fetch(callback);
    assert.equal(rejected.status, 400);
    await rejected.text();
    assert.equal(exchange.mock.calls.length, 0);
    assert.equal(await readFile(envPath, 'utf8'), original);

    callback.searchParams.set('state', consent.searchParams.get('state'));
    const accepted = await fetch(callback);
    assert.equal(accepted.status, 200);
    const page = await accepted.text();
    await setup;
    assert.equal(exchange.mock.calls.length, 1);
    const saved = dotenv.parse(await readFile(envPath, 'utf8'));
    assert.equal(saved.GMAIL_REFRESH_TOKEN, 'fixture-private-refresh-token');
    assert.equal(saved.MAIL_TRANSPORT, 'gmail-api');
    assert.equal(saved.JWT_SECRET, 'unrelated-fixture-secret');
    assert.equal(saved.SMTP_HOST, 'smtp.example.test');
    for (const secret of ['fixture-private-refresh-token', 'fixture-private-client-secret', 'fixture-authorization-code']) {
      assert.equal(output.join('\n').includes(secret), false);
      assert.equal(page.includes(secret), false);
    }
  });
}
