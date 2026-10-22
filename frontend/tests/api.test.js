import test from 'node:test';
import assert from 'node:assert/strict';
import { api, apiRequest } from '../src/api.js';

function mockBrowser(t, respond = () => Response.json({ success: true })) {
  const browser = { token: 'session-token', requests: [], events: [] };
  const globals = {
    localStorage: { getItem: (key) => key === 'remember_token' ? browser.token : null },
    window: { dispatchEvent: (event) => browser.events.push(event) },
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
  };
  for (const [key, value] of Object.entries(globals)) {
    const original = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    t.after(() => original ? Object.defineProperty(globalThis, key, original) : delete globalThis[key]);
  }
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    browser.requests.push({ url, ...options });
    return respond(browser);
  });
  return browser;
}

test('Requests share authentication while preserving caller headers and fetch options', async (t) => {
  const browser = mockBrowser(t);
  const signal = new AbortController().signal;
  assert.deepEqual(await apiRequest('/example', { signal, headers: { Accept: 'application/json' } }), { success: true });
  assert.deepEqual(browser.requests[0], {
    url: '/api/example', signal,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer session-token', Accept: 'application/json' },
  });
  browser.token = null;
  await api.getMe();
  assert.equal(browser.requests[1].headers.Authorization, undefined);
});

test('JSON helpers preserve HTTP methods, field payloads and requests without a body', async (t) => {
  const browser = mockBrowser(t);
  const credentials = { email: 'member@example.com', password: 'Example123!', rememberMe: true };
  await api.login(credentials);
  await api.updateOrganisationVisibility('org-1', false);
  await api.rsvpEvent('event-1');
  await api.syncWalletObject('member-1');
  await api.resendVerification();
  await api.deleteTier('tier-1');
  assert.deepEqual(browser.requests.map(({ url, method, body }) => ({ url, method, body })), [
    { url: '/api/auth/login', method: 'POST', body: JSON.stringify(credentials) },
    { url: '/api/organisations/org-1/visibility', method: 'PUT', body: '{"isPublic":false,"visibility":"private"}' },
    { url: '/api/events/event-1/rsvp', method: 'POST', body: undefined },
    { url: '/api/wallet/update-object/member-1', method: 'PUT', body: undefined },
    { url: '/api/auth/resend-verification', method: 'POST', body: '{}' },
    { url: '/api/tiers/tier-1', method: 'DELETE', body: undefined },
  ]);
});

test('Query helpers encode special characters and omit empty query strings', async (t) => {
  const browser = mockBrowser(t);
  const search = 'Research & Development + members';
  await api.getAdminMembers({ search, page: 2 });
  await api.getActivityLogs({ action: 'a&b' });
  await api.getOrganisations({ search });
  await api.getTiers('org/a & b');
  await api.getAdminMembers();
  await api.getTiers();
  await api.getDashboardAnalytics({ startMonth: '2025-11', endMonth: '2026-02' });
  await api.getDashboardAnalytics();
  const urls = browser.requests.map(({ url }) => new URL(url, 'https://remember.example'));
  assert.equal(urls[0].searchParams.get('search'), search);
  assert.equal(urls[0].searchParams.get('page'), '2');
  assert.equal(urls[1].searchParams.get('action'), 'a&b');
  assert.equal(urls[2].searchParams.get('search'), search);
  assert.equal(urls[3].searchParams.get('organisationId'), 'org/a & b');
  assert.equal(urls[4].href, 'https://remember.example/api/admin/members');
  assert.equal(urls[5].href, 'https://remember.example/api/tiers');
  assert.equal(urls[6].href, 'https://remember.example/api/admin/dashboard-analytics?startMonth=2025-11&endMonth=2026-02');
  assert.equal(urls[7].href, 'https://remember.example/api/admin/dashboard-analytics');
});

test('CSV exports return a Blob through shared authentication even with a generic MIME type', async (t) => {
  const csv = 'Name,Email\r\nMember,member@example.com';
  const browser = mockBrowser(t, (state) => new Response(csv, {
    headers: { 'Content-Type': state.requests.length === 1 ? 'application/octet-stream' : 'text/csv; charset=utf-8' },
  }));
  const blob = await api.exportMembersCsv({ status: 'active' });
  assert.ok(blob instanceof Blob);
  assert.equal(await blob.text(), csv);
  assert.equal(browser.requests[0].headers.Authorization, 'Bearer session-token');
  assert.equal(browser.requests[0].url, '/api/admin/export-csv?status=active');
  assert.equal(Object.hasOwn(browser.requests[0], 'responseType'), false);
  const result = await apiRequest('/another-csv');
  assert.equal(result.ok, true);
  assert.equal(await result.blob.text(), csv);
});

test('Expired CSV sessions emit the request token and preserve server error details', async (t) => {
  const browser = mockBrowser(t, (state) => {
    state.token = 'newer-session-token';
    return Response.json({ code: 'SESSION_EXPIRED', message: 'Please sign in again.' }, { status: 401 });
  });
  await assert.rejects(api.exportMembersCsv(), (error) => {
    assert.equal(error.status, 401);
    assert.equal(error.message, 'Please sign in again.');
    assert.equal(error.data.code, 'SESSION_EXPIRED');
    return true;
  });
  assert.equal(browser.events.length, 1);
  assert.equal(browser.events[0].type, 'remember:session-expired');
  assert.deepEqual(browser.events[0].detail, { token: 'session-token' });
});

test('Non-JSON errors, including CSV failures, throw rather than appear successful', async (t) => {
  const browser = mockBrowser(t, () => new Response('Service unavailable', {
    status: 503, headers: { 'Content-Type': 'text/csv' },
  }));
  await assert.rejects(api.exportMembersCsv(), { message: 'Request failed with status 503', status: 503, data: {} });
  assert.equal(browser.events.length, 0);
});
