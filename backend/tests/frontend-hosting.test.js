import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { once } from 'node:events';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import express from 'express';
import { mountFrontend } from '../services/frontendHosting.js';

let directory, server, origin;
const html = '<!doctype html><html><body>ReMember test website</body></html>';
before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'remember-frontend-hosting-'));
  await mkdir(join(directory, 'assets'));
  await writeFile(join(directory, 'index.html'), html);
  await writeFile(join(directory, 'assets', 'app.js'), 'window.remember = true;');
  const app = express();
  app.use(express.json());
  app.get('/api/health', (req, res) => res.json({ status: 'healthy' }));
  app.get('/api/private', (req, res) => res.status(401).json({ success: false }));
  app.post('/api/echo', (req, res) => res.json(req.body));
  mountFrontend(app, { directory, required: true });
  app.use((req, res) => res.status(404).json({ success: false, message: 'Not found' }));
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  origin = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  if (server) { server.closeAllConnections(); await new Promise(done => server.close(done)); }
  if (directory && resolve(directory).startsWith(resolve(tmpdir()) + sep)) await rm(directory, { recursive: true, force: true });
});

test('The website root and client page links serve the built HTML with revalidation', async () => {
  for (const path of ['/', '/memberships', '/organisations/join?invite=sample', '/index.html']) {
    const response = await fetch(origin + path, { headers: { Accept: 'text/html' } });
    assert.equal(response.status, 200, path);
    assert.match(response.headers.get('content-type'), /text\/html/);
    assert.equal(response.headers.get('cache-control'), 'no-cache');
    assert.equal(await response.text(), html);
  }
  const head = await fetch(origin + '/', { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
});

test('Built assets load as JavaScript, and missing assets are genuine 404 responses', async () => {
  const response = await fetch(origin + '/assets/app.js');
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /javascript/);
  assert.equal(await response.text(), 'window.remember = true;');
  for (const path of ['/assets/missing.js', '/missing.png']) {
    const missing = await fetch(origin + path);
    assert.equal(missing.status, 404);
    assert.match(missing.headers.get('content-type'), /application\/json/);
  }
});

test('API successes, authentication failures, and unknown API routes never become HTML', async () => {
  const health = await fetch(origin + '/api/health');
  assert.deepEqual(await health.json(), { status: 'healthy' });
  assert.equal((await fetch(origin + '/api/private')).status, 401);
  for (const path of ['/api', '/api/missing', '/API/missing']) {
    const missing = await fetch(origin + path, { headers: { Accept: 'text/html' } });
    assert.equal(missing.status, 404);
    assert.match(missing.headers.get('content-type'), /application\/json/);
  }
  const echo = await fetch(origin + '/api/echo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'Community' }) });
  assert.deepEqual(await echo.json(), { title: 'Community' });
});

test('Non-page requests do not fall back to the website', async () => {
  assert.equal((await fetch(origin + '/memberships', { method: 'POST' })).status, 404);
  assert.equal((await fetch(origin + '/memberships', { headers: { Accept: 'application/json' } })).status, 404);
});

test('A missing production build fails clearly while local API-only development remains supported', () => {
  const missing = join(directory, 'not-built');
  assert.equal(mountFrontend(express(), { directory: missing }), false);
  assert.throws(() => mountFrontend(express(), { directory: missing, required: true }), /Frontend build is missing/);
});
