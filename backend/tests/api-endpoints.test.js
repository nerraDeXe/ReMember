import assert from 'node:assert/strict';
import { once } from 'node:events';
import { after, before, test } from 'node:test';
import { createApp } from '../app.js';
import { api } from '../../frontend/src/api.js';

// Inspect the actual production app, including nested auth routers and server
// prefixes. A router-level 401 alone is not proof that an endpoint exists.
function hasEndpoint(stack, pathname, method) {
  for (const layer of stack) {
    if (!layer.match(pathname)) continue;
    if (layer.route?.methods[method.toLowerCase()]) return true;
    if (layer.handle?.stack && hasEndpoint(layer.handle.stack, pathname.slice(layer.path.length) || '/', method)) return true;
  }
  return false;
}

const app = createApp({ serveFrontend: false, logRequests: false });
let server, origin;
before(async () => {
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  origin = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });

test('Every frontend API method matches a registered backend endpoint and HTTP method', async t => {
  const requests = [];
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => null } });
  t.after(() => originalStorage ? Object.defineProperty(globalThis, 'localStorage', originalStorage) : delete globalThis.localStorage);
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    requests.push({ url, method: options.method || 'GET' });
    return Response.json({ success: true });
  });
  for (const [name, request] of Object.entries(api)) {
    await t.test(name, async () => {
      const previous = requests.length;
      // These are representative record/organisation identifiers; request data
      // is not sent anywhere. Only the transport and route registration run.
      await request('endpoint-audit-record', 'endpoint-audit-organisation');
      assert.equal(requests.length, previous + 1);
      const { url, method } = requests.at(-1);
      const pathname = new URL(url, 'http://remember.test').pathname;
      assert.ok(hasEndpoint(app._router.stack, pathname, method), `${name}: missing ${method} ${pathname}`);
    });
  }
});

test('Payment gateway session routes and the renewal alias are mounted on the real app', () => {
  for (const [method, pathname] of [
    ['POST', '/api/payments/checkout'], ['GET', '/api/payments/checkout/pay_example'],
    ['POST', '/api/payments/checkout/pay_example/confirm'], ['POST', '/api/payments/checkout/pay_example/cancel'],
    ['POST', '/api/payments/renew'],
  ]) assert.ok(hasEndpoint(app._router.stack, pathname, method), `${method} ${pathname}`);
  for (const pathname of ['/api/payments/connect', '/api/payments/portal', '/api/payments/webhook']) {
    assert.equal(hasEndpoint(app._router.stack, pathname, 'POST'), false);
  }
  assert.equal(hasEndpoint(app._router.stack, '/api/payments/missing', 'POST'), false);
});

test('Actual checkout requests reach authentication instead of the API 404 handler', async () => {
  for (const path of ['/api/payments/checkout', '/api/payments/renew', '/api/payments/checkout/pay_example/confirm', '/api/payments/checkout/pay_example/cancel']) {
    const response = await fetch(origin + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(response.status, 401, path);
    assert.match((await response.json()).message, /authentication token/i);
  }
});

test('Health exposes backend capabilities without credentials or payment configuration values', async () => {
  const response = await fetch(origin + '/api/health');
  const body = await response.json();
  assert.deepEqual(body.capabilities, { paymentGateway: true, simulatedPayments: true });
  assert.ok(!JSON.stringify(body).includes('secret'));
});

test('Unknown endpoints still return the JSON API 404', async () => {
  const response = await fetch(origin + '/api/nonexistent-route', { method: 'POST' });
  assert.equal(response.status, 404);
  assert.match((await response.json()).message, /API endpoint.*not found/);
});
