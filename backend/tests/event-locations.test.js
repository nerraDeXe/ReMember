import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createEventLocationService, EventLocationError } from '../services/eventLocations.js';

const place = (overrides = {}) => ({ osm_type: 'way', osm_id: 42, place_id: 100, display_name: '  KL Convention Centre,   Kuala Lumpur ', lat: '3.1538', lon: '101.7138', ...overrides });
const response = (payload = [place()], { status = 200, retryAfter } = {}) => ({ ok: status >= 200 && status < 300, status, headers: { get: name => name === 'retry-after' ? retryAfter : null }, async json() { return payload; } });
const options = (overrides = {}) => ({ userAgent: 'ReMember/1.0 (+https://remember.example.test)', endpoint: 'https://nominatim.openstreetmap.org/search', ...overrides });
const errorStatus = status => error => error instanceof EventLocationError && error.status === status;

test('Location searches identify the application and request at most five English JSON results', async () => {
  let requestedUrl, requestOptions;
  const service = createEventLocationService(options({ fetch: async (url, init) => { requestedUrl = new URL(url); requestOptions = init; return response(); } }));
  const results = await service.search('  KL Convention   Centre ');
  assert.equal(requestedUrl.origin, 'https://nominatim.openstreetmap.org');
  assert.equal(requestedUrl.pathname, '/search');
  assert.equal(requestedUrl.searchParams.get('q'), 'KL Convention Centre');
  assert.equal(requestedUrl.searchParams.get('format'), 'jsonv2');
  assert.equal(requestedUrl.searchParams.get('limit'), '5');
  assert.equal(requestedUrl.searchParams.get('accept-language'), 'en');
  assert.equal(requestOptions.headers['User-Agent'], 'ReMember/1.0 (+https://remember.example.test)');
  assert.equal(requestOptions.redirect, 'error');
  assert.ok(requestOptions.signal instanceof AbortSignal);
  assert.deepEqual(results, [{ id: 'way:42', label: 'KL Convention Centre, Kuala Lumpur', latitude: 3.1538, longitude: 101.7138 }]);
});

test('Search query validation rejects missing, short, long and structured inputs without network activity', async () => {
  let calls = 0;
  const service = createEventLocationService(options({ fetch: async () => { calls++; return response(); } }));
  for (const query of [undefined, null, '', '  ', 'ab', 'x'.repeat(201), 123, {}, ['Kuala Lumpur']]) await assert.rejects(service.search(query), errorStatus(400));
  assert.equal(calls, 0);
});

test('A configurable endpoint supports switching away from the public provider', async () => {
  let requestedUrl;
  const service = createEventLocationService(options({ endpoint: 'https://maps.example.test/geocode/search', fetch: async url => { requestedUrl = new URL(url); return response(); } }));
  await service.search('Kuala Lumpur');
  assert.equal(requestedUrl.origin, 'https://maps.example.test');
  assert.equal(requestedUrl.pathname, '/geocode/search');
});

test('Invalid endpoint and missing application identity fail before making a network request', async () => {
  let calls = 0;
  for (const config of [{ endpoint: 'file:///private/data' }, { endpoint: 'https://user:password@example.test/search' }, { endpoint: 'bad endpoint' }, { userAgent: '' }, { userAgent: 'app\r\nInjected: 1' }]) {
    const service = createEventLocationService(options({ fetch: async () => { calls++; return response(); }, ...config }));
    await assert.rejects(service.search('Kuala Lumpur'), errorStatus(503));
  }
  assert.equal(calls, 0);
});

test('Provider results normalize coordinates and labels, discard invalid entries and deduplicate to five', async () => {
  const raw = [null, {}, place({ display_name: '' }), place({ lat: null }), place({ lat: '' }), place({ lat: 'NaN' }), place({ lat: '91' }), place({ lon: '-181' }), place(), place(), ...Array.from({ length: 10 }, (_, index) => place({ osm_id: index + 100, display_name: 'x'.repeat(600) }))];
  const service = createEventLocationService(options({ fetch: async () => response(raw) }));
  const results = await service.search('Convention Centre');
  assert.equal(results.length, 5);
  assert.deepEqual(results[0], { id: 'way:42', label: 'KL Convention Centre, Kuala Lumpur', latitude: 3.1538, longitude: 101.7138 });
  assert.equal(results[1].label.length, 500);
  assert.equal(new Set(results.map(result => result.id)).size, 5);
});

test('Only one provider request starts per second across different searches', async () => {
  let time = 0, calls = 0;
  const service = createEventLocationService(options({ now: () => time, fetch: async () => { calls++; return response(); } }));
  await service.search('Kuala Lumpur');
  await assert.rejects(service.search('Johor Bahru'), error => errorStatus(429)(error) && error.retryAfter === 1);
  time = 999;
  await assert.rejects(service.search('Johor Bahru'), errorStatus(429));
  time = 1000;
  await service.search('Johor Bahru');
  assert.equal(calls, 2);
});

test('Concurrent identical searches share one request while different searches receive retry guidance', async () => {
  let complete, calls = 0;
  const service = createEventLocationService(options({ now: () => 0, fetch: () => { calls++; return new Promise(resolve => { complete = resolve; }); } }));
  const first = service.search('Kuala Lumpur');
  const duplicate = service.search('  kuala  lumpur ');
  await assert.rejects(service.search('Johor Bahru'), errorStatus(429));
  complete(response());
  const [a, b] = await Promise.all([first, duplicate]);
  assert.equal(calls, 1);
  assert.deepEqual(a, b);
  a[0].label = 'Changed';
  assert.notEqual(a[0].label, b[0].label);
});

test('Cached normalized queries avoid requests and expire after the bounded TTL', async () => {
  let time = 0, calls = 0;
  const service = createEventLocationService(options({ now: () => time, cacheTtlMs: 5000, fetch: async () => { calls++; return response(); } }));
  const first = await service.search('Kuala Lumpur');
  first[0].label = 'Changed';
  const second = await service.search('  kuala   lumpur ');
  assert.notEqual(second[0].label, 'Changed');
  time = 4999;
  await service.search('Kuala Lumpur');
  assert.equal(calls, 1);
  time = 5000;
  await service.search('Kuala Lumpur');
  assert.equal(calls, 2);
});

test('Cache capacity evicts least recently used queries and caches empty search results', async () => {
  let time = 0, calls = 0;
  const service = createEventLocationService(options({ now: () => time, cacheMaxEntries: 2, fetch: async () => { calls++; return response([]); } }));
  await service.search('First place');
  time += 1000;
  await service.search('Second place');
  await service.search('First place');
  time += 1000;
  await service.search('Third place');
  await service.search('First place');
  assert.equal(calls, 3);
  time += 1000;
  assert.deepEqual(await service.search('Second place'), []);
  assert.equal(calls, 4);
});

test('Provider rate-limit retry-after is returned and prevents premature subsequent calls', async () => {
  let time = 0, calls = 0;
  const service = createEventLocationService(options({ now: () => time, fetch: async () => { calls++; return calls === 1 ? response(null, { status: 429, retryAfter: '30' }) : response(); } }));
  await assert.rejects(service.search('First place'), error => errorStatus(429)(error) && error.retryAfter === 30);
  time = 1000;
  await assert.rejects(service.search('Another place'), error => errorStatus(429)(error) && error.retryAfter === 29);
  assert.equal(calls, 1);
  time = 30000;
  await service.search('Another place');
  assert.equal(calls, 2);
});

test('Provider unavailable and HTTP-date retry-after values are respected', async () => {
  const time = Date.parse('2026-10-23T01:00:00Z');
  const service = createEventLocationService(options({ now: () => time, fetch: async () => response(null, { status: 503, retryAfter: 'Fri, 23 Oct 2026 01:00:10 GMT' }) }));
  await assert.rejects(service.search('Kuala Lumpur'), error => errorStatus(503)(error) && error.retryAfter === 10);
  await assert.rejects(service.search('Johor Bahru'), error => errorStatus(429)(error) && error.retryAfter === 10);
});

test('Unexpected provider HTTP and malformed JSON responses return safe errors and are not cached', async () => {
  for (const failure of [response(null, { status: 403 }), response({ unexpected: 'object' }), { ok: true, async json() { throw new SyntaxError('PRIVATE upstream response'); } }]) {
    let time = 0, calls = 0;
    const service = createEventLocationService(options({ now: () => time, fetch: async () => { calls++; return calls === 1 ? failure : response(); } }));
    await assert.rejects(service.search('Kuala Lumpur'), error => errorStatus(502)(error) && !error.message.includes('PRIVATE'));
    time += 1000;
    await service.search('Kuala Lumpur');
    assert.equal(calls, 2);
  }
});

test('Network failure returns a safe availability error and releases the request slot', async () => {
  let time = 0, calls = 0;
  const service = createEventLocationService(options({ now: () => time, fetch: async () => { calls++; if (calls === 1) throw new Error('PRIVATE network information'); return response(); } }));
  await assert.rejects(service.search('Kuala Lumpur'), error => errorStatus(503)(error) && !error.message.includes('PRIVATE'));
  time += 1000;
  await service.search('Johor Bahru');
  assert.equal(calls, 2);
});

test('Timed-out provider requests are aborted and return a retryable availability error', async () => {
  let aborted = false;
  const service = createEventLocationService(options({ timeoutMs: 5, fetch: (_url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener('abort', () => { aborted = true; reject(new Error('Aborted')); });
  }) }));
  await assert.rejects(service.search('Kuala Lumpur'), error => errorStatus(503)(error) && /timed out/.test(error.message) && error.retryAfter === 1);
  assert.equal(aborted, true);
});
