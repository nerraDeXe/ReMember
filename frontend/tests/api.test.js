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

test('Event requests carry the captured organisation for stale portal checks', async (t) => {
  const browser = mockBrowser(t);
  const organisationId = 'org/a & b';
  await api.getEvents(organisationId);
  await api.rsvpEvent('event-1', organisationId);
  await api.cancelRsvpEvent('event-1', organisationId);
  await api.deleteEvent('event-1', organisationId);
  for (const index of [0, 3]) assert.equal(new URL(browser.requests[index].url, 'https://remember.example').searchParams.get('organisationId'), organisationId);
  for (const index of [1, 2]) assert.deepEqual(JSON.parse(browser.requests[index].body), { organisationId });
  assert.equal(browser.requests[1].method, 'POST');
  assert.equal(browser.requests[3].method, 'DELETE');
  await api.searchEventLocations('Hall & Garden, Kuala Lumpur', organisationId);
  const searchUrl = new URL(browser.requests[4].url, 'https://remember.example');
  assert.equal(searchUrl.pathname, '/api/events/locations/search');
  assert.equal(searchUrl.searchParams.get('q'), 'Hall & Garden, Kuala Lumpur');
  assert.equal(searchUrl.searchParams.get('organisationId'), organisationId);
});

test('Direct member and post reads encode IDs and retain post organisation scope', async (t) => {
  const browser = mockBrowser(t);
  await api.getAdminMember('member/a & b');
  await api.getPost('post/a & b', 'org/a & b');
  await api.getPost('post-2');
  assert.equal(browser.requests[0].url, '/api/admin/members/member%2Fa%20%26%20b');
  const postUrl = new URL(browser.requests[1].url, 'https://remember.example');
  assert.equal(postUrl.pathname, '/api/posts/post%2Fa%20%26%20b');
  assert.equal(postUrl.searchParams.get('organisationId'), 'org/a & b');
  assert.equal(browser.requests[2].url, '/api/posts/post-2');
});

test('Demo gateway requests preserve the checkout and captured organisation without accepting payment amounts', async (t) => {
  const browser = mockBrowser(t);
  await api.createPaymentCheckout('tier-1', 'org/a & b');
  await api.getPaymentCheckout('checkout/a & b', 'org/a & b');
  await api.confirmPayment('checkout/a & b', 'org/a & b', { paymentMethod: 'card', scenario: 'approved', verificationCode: '123456' });
  await api.cancelPayment('checkout/a & b', 'org/a & b');
  assert.deepEqual(JSON.parse(browser.requests[0].body), { tierId: 'tier-1', organisationId: 'org/a & b' });
  const statusUrl = new URL(browser.requests[1].url, 'https://remember.example');
  assert.equal(statusUrl.pathname, '/api/payments/checkout/checkout%2Fa%20%26%20b');
  assert.equal(statusUrl.searchParams.get('organisationId'), 'org/a & b');
  assert.equal(browser.requests[2].url, '/api/payments/checkout/checkout%2Fa%20%26%20b/confirm');
  assert.deepEqual(JSON.parse(browser.requests[2].body), { paymentMethod: 'card', scenario: 'approved', verificationCode: '123456', organisationId: 'org/a & b' });
  assert.deepEqual(JSON.parse(browser.requests[3].body), { organisationId: 'org/a & b' });
});

test('Membership lifecycle and upgrade requests capture organisation and never submit a client price or credit', async (t) => {
  const browser = mockBrowser(t);
  const organisationId = 'org/a & b';
  await api.getMembership(organisationId);
  await api.cancelMembership(organisationId);
  await api.resumeMembership(organisationId);
  await api.scheduleMembershipDowngrade(organisationId, 'cheaper-tier');
  await api.cancelMembershipDowngrade(organisationId);
  await api.getPaymentQuote('premium-tier', organisationId, 'upgrade');
  await api.createPaymentCheckout('premium-tier', organisationId, 'upgrade');
  const membershipUrl = new URL(browser.requests[0].url, 'https://remember.example');
  assert.equal(membershipUrl.pathname, '/api/members/membership');
  assert.equal(membershipUrl.searchParams.get('organisationId'), organisationId);
  assert.deepEqual(browser.requests.slice(1).map(({ url, method, body }) => ({ url, method, payload: JSON.parse(body) })), [
    { url: '/api/members/membership/cancel', method: 'POST', payload: { organisationId } },
    { url: '/api/members/membership/resume', method: 'POST', payload: { organisationId } },
    { url: '/api/members/membership/downgrade', method: 'POST', payload: { organisationId, tierId: 'cheaper-tier' } },
    { url: '/api/members/membership/downgrade/cancel', method: 'POST', payload: { organisationId } },
    { url: '/api/payments/quote', method: 'POST', payload: { tierId: 'premium-tier', organisationId, intent: 'upgrade' } },
    { url: '/api/payments/checkout', method: 'POST', payload: { tierId: 'premium-tier', organisationId, intent: 'upgrade' } },
  ]);
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
