import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import jwt from 'jsonwebtoken';
import { config } from '../config/config.js';
import { User, Organisation, OrganisationMembership, OrganisationPost, ActivityLog } from '../models/index.js';
import postRouter from '../routes/posts.js';
import { POST_LIMITS } from '../../shared/posts.js';
import { MAX_IMAGE_SIZE } from '../../shared/imageUploads.js';

// Mock only database operations: auth, account context, route validation, and
// organisation boundaries run together without a database or outgoing email.
const models = { User, Organisation, OrganisationMembership, OrganisationPost, ActivityLog };
const originals = [];
const clone = value => structuredClone(value);
let records, serial, mutations;
const pngBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=', 'base64');
const pngImage = `data:image/png;base64,${pngBytes.toString('base64')}`;
const validPost = () => ({ title: 'Community notice', subtitle: 'A quick update for our members', description: 'Please visit the membership desk this weekend.', imageUrl: '' });

function matches(record, filter = {}) {
  return Object.entries(filter).every(([key, expected]) => {
    if (expected && typeof expected === 'object' && '$in' in expected) return expected.$in.includes(record[key]);
    return record[key] === expected;
  });
}
function document(value) {
  if (!value) return value;
  const result = clone(value);
  Object.defineProperty(result, 'toObject', { value: () => clone(value) });
  return result;
}
function query(value) {
  let result = clone(value);
  return {
    select() { return this; },
    sort(criteria) {
      result.sort((a, b) => {
        for (const [key, direction] of Object.entries(criteria)) {
          if (a[key] !== b[key]) return a[key] > b[key] ? direction : -direction;
        }
        return 0;
      });
      return this;
    },
    skip(amount) { result = result.slice(amount); return this; },
    limit(amount) { result = result.slice(0, amount); return this; },
    async lean() { return clone(result); },
    then(resolve, reject) {
      return Promise.resolve(Array.isArray(result) ? result.map(document) : (result && typeof result === 'object' ? document(result) : result)).then(resolve, reject);
    },
  };
}
function patch(model, method, replacement) {
  originals.push([model, method, model[method]]);
  model[method] = replacement;
}
before(() => {
  for (const [name, model] of Object.entries(models)) {
    const collection = () => records[name];
    patch(model, 'find', filter => query(collection().filter(record => matches(record, filter))));
    patch(model, 'findOne', filter => query(collection().find(record => matches(record, filter)) || null));
    patch(model, 'findById', id => query(collection().find(record => record._id === id) || null));
    patch(model, 'countDocuments', filter => query(collection().filter(record => matches(record, filter)).length));
    patch(model, 'create', async input => {
      const now = new Date().toISOString();
      const record = { _id: `${name}-${++serial}`, createdAt: now, updatedAt: now, ...clone(input) };
      collection().push(record);
      return document(record);
    });
    patch(model, 'findOneAndUpdate', (filter, update, options) => {
      mutations.push({ model: name, method: 'update', filter: clone(filter), options: clone(options) });
      const record = collection().find(value => matches(value, filter));
      if (record) {
        Object.assign(record, update.$set, { updatedAt: new Date().toISOString() });
        for (const key of Object.keys(update.$unset || {})) delete record[key];
      }
      return query(record || null);
    });
    patch(model, 'findOneAndDelete', filter => {
      mutations.push({ model: name, method: 'delete', filter: clone(filter) });
      const index = collection().findIndex(value => matches(value, filter));
      return query(index < 0 ? null : collection().splice(index, 1)[0]);
    });
  }
});
after(() => {
  for (const [model, method, original] of originals.reverse()) model[method] = original;
});
beforeEach(() => {
  serial = 0;
  mutations = [];
  records = Object.fromEntries(Object.keys(models).map(name => [name, []]));
  for (const [id, organisationId] of [['ownerA', 'A'], ['ownerB', 'B'], ['member', 'A'], ['outsider', 'A']]) {
    records.User.push({ _id: id, name: `${id} display name`, email: `${id}@example.test`, password: 'PRIVATE_PASSWORD', emailVerified: true, status: 'active', role: id.startsWith('owner') ? 'admin' : 'member', activeOrganisationId: organisationId });
  }
  records.Organisation.push({ _id: 'A', name: 'Organisation A', adminId: 'ownerA', isPublic: true }, { _id: 'B', name: 'Organisation B', adminId: 'ownerB', isPublic: true });
  records.OrganisationMembership.push({ _id: 'member-A', userId: 'member', organisationId: 'A', role: 'member', status: 'active' });
  for (const organisationId of ['A', 'B']) {
    records.OrganisationPost.push({ _id: `post-${organisationId}`, organisationId, ...validPost(), authorId: `owner${organisationId}`, authorName: `Owner ${organisationId}`, createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z', __v: 0 });
  }
});

function request(method, path = '/', { userId = 'member', body = {}, params = {}, query: parameters = {} } = {}) {
  const route = postRouter.stack.find(layer => layer.route?.path === path && layer.route.methods[method.toLowerCase()])?.route;
  assert.ok(route, `Route ${method} ${path} exists`);
  const handlers = [...postRouter.stack.filter(layer => !layer.route).map(layer => layer.handle), ...route.stack.map(layer => layer.handle)];
  const req = { method, body, params, query: parameters, originalUrl: path, ip: '127.0.0.1', headers: userId ? { authorization: `Bearer ${jwt.sign({ id: userId }, config.JWT_SECRET)}` } : {} };
  return new Promise((resolve, reject) => {
    let status = 200;
    const res = { status(value) { status = value; return this; }, json(value) { resolve({ status, body: JSON.parse(JSON.stringify(value)) }); } };
    let index = 0;
    const next = error => {
      if (error) return reject(error);
      const handler = handlers[index++];
      if (!handler) return reject(new Error('Route completed without a response'));
      Promise.resolve(handler(req, res, next)).catch(reject);
    };
    next();
  });
}

test('Posts require a verified session and a membership even for a public organisation', async () => {
  for (const method of ['GET', 'POST', 'PUT', 'DELETE']) {
    assert.equal((await request(method, ['PUT', 'DELETE'].includes(method) ? '/:id' : '/', { userId: null })).status, 401);
  }
  records.User.find(user => user._id === 'member').emailVerified = false;
  assert.equal((await request('GET')).status, 403);
  assert.equal((await request('GET', '/', { userId: 'outsider' })).status, 400);
  assert.equal(records.OrganisationPost.length, 2);
});

test('Members read only their selected organisation posts without internal metadata', async () => {
  const result = await request('GET', '/', { query: { organisationId: 'A' } });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.posts.map(post => post._id), ['post-A']);
  assert.equal(result.body.total, 1);
  assert.ok(!JSON.stringify(result.body).includes('authorId'));
  assert.ok(!JSON.stringify(result.body).includes('__v'));
  records.OrganisationMembership.push({ _id: 'member-B', userId: 'member', organisationId: 'B', role: 'member', status: 'active' });
  records.User.find(user => user._id === 'member').activeOrganisationId = 'B';
  assert.deepEqual((await request('GET')).body.posts.map(post => post._id), ['post-B']);
});

test('Pending and expired members retain notices while suspended and revoked members lose access', async () => {
  const membership = records.OrganisationMembership[0];
  for (const status of ['pending', 'expired']) {
    membership.status = status;
    assert.equal((await request('GET')).status, 200);
  }
  for (const status of ['suspended', 'revoked']) {
    membership.status = status;
    assert.ok([400, 403].includes((await request('GET')).status));
  }
});

test('Posting, editing, and deleting require selected organisation ownership', async () => {
  for (const method of ['POST', 'PUT', 'DELETE']) {
    assert.equal((await request(method, method === 'POST' ? '/' : '/:id', { params: { id: 'post-A' }, body: validPost() })).status, 403);
  }
  records.OrganisationMembership.push({ _id: 'ownerA-B', userId: 'ownerA', organisationId: 'B', role: 'member', status: 'active' });
  records.User.find(user => user._id === 'ownerA').activeOrganisationId = 'B';
  assert.equal((await request('POST', '/', { userId: 'ownerA', body: validPost() })).status, 403);
  assert.equal(records.OrganisationPost.length, 2);
});

test('Owner publication normalises text and derives organisation and author from the session', async () => {
  const result = await request('POST', '/', { userId: 'ownerA', body: { ...validPost(), title: '  Important news  ', organisationId: 'A', authorId: 'ownerB', authorName: 'Forged name', createdAt: '2000-01-01' } });
  assert.equal(result.status, 201);
  assert.equal(result.body.post.title, 'Important news');
  assert.equal(result.body.post.organisationId, 'A');
  assert.equal(result.body.post.authorName, 'ownerA display name');
  assert.equal(records.OrganisationPost.at(-1).authorId, 'ownerA');
  assert.notEqual(result.body.post.createdAt, '2000-01-01');
  assert.equal(records.ActivityLog[0].action, 'POST_CREATED');
  assert.equal(records.ActivityLog[0].organisationId, 'A');
});

test('Required fields reject blank, malformed, and overlong text without writes', async () => {
  for (const [field, limit] of Object.entries(POST_LIMITS)) {
    for (const value of ['', ' \n ', null, 123, {}, 'x'.repeat(limit + 1)]) {
      const result = await request('POST', '/', { userId: 'ownerA', body: { ...validPost(), [field]: value } });
      assert.equal(result.status, 400, `${field} ${JSON.stringify(value).slice(0, 25)}`);
    }
    const valid = await request('POST', '/', { userId: 'ownerA', body: { ...validPost(), [field]: 'x'.repeat(limit) } });
    assert.equal(valid.status, 201, `${field} allows its exact character limit`);
  }
  assert.equal(records.OrganisationPost.length, 5);
  assert.equal((await request('POST', '/', { userId: 'ownerA', body: null })).status, 400);
});

test('An organisation snapshot mismatch rejects stale-page reads and writes without side effects', async () => {
  records.Organisation.find(organisation => organisation._id === 'B').adminId = 'ownerA';
  records.User.find(user => user._id === 'ownerA').activeOrganisationId = 'B';
  for (const method of ['GET', 'POST', 'PUT', 'DELETE']) {
    const result = await request(method, ['PUT', 'DELETE'].includes(method) ? '/:id' : '/', {
      userId: 'ownerA', params: { id: 'post-B' }, query: { organisationId: 'A' }, body: { ...validPost(), organisationId: 'A' },
    });
    assert.equal(result.status, 409, method);
    assert.match(result.body.message, /selected organisation has changed/);
  }
  assert.equal(records.OrganisationPost.length, 2);
  assert.equal(records.ActivityLog.length, 0);
  assert.equal(mutations.length, 0);
});

test('Post images are optional, accept supported uploads, and reject unsafe or oversized content', async () => {
  const noImage = validPost();
  delete noImage.imageUrl;
  assert.equal((await request('POST', '/', { userId: 'ownerA', body: noImage })).body.post.imageUrl, '');
  assert.equal((await request('POST', '/', { userId: 'ownerA', body: { ...validPost(), imageUrl: pngImage } })).body.post.imageUrl, pngImage);
  const oversized = Buffer.alloc(MAX_IMAGE_SIZE + 1);
  pngBytes.copy(oversized);
  for (const imageUrl of [null, {}, 'javascript:alert(1)', 'data:image/svg+xml;base64,PHN2Zz4=', 'data:image/png;base64,YWJjZA==', `data:image/png;base64,${oversized.toString('base64')}`]) {
    assert.equal((await request('POST', '/', { userId: 'ownerA', body: { ...validPost(), imageUrl } })).status, 400);
  }
  assert.equal(records.OrganisationPost.length, 4);
});

test('Pagination stays within the selected organisation and orders posts newest first', async () => {
  for (let day = 2; day <= 14; day++) {
    records.OrganisationPost.push({ ...records.OrganisationPost[0], _id: `A-${day}`, createdAt: `2026-10-${String(day).padStart(2, '0')}T00:00:00.000Z` });
  }
  const result = await request('GET', '/', { query: { page: '2', limit: '6' } });
  assert.equal(result.status, 200);
  assert.equal(result.body.total, 14);
  assert.equal(result.body.totalPages, 3);
  assert.equal(result.body.page, 2);
  assert.deepEqual(result.body.posts.map(post => post._id), [8, 7, 6, 5, 4, 3].map(day => `A-${day}`));
  const beyond = await request('GET', '/', { query: { page: '10' } });
  assert.deepEqual(beyond.body.posts, []);
  for (const query of [{ page: '0' }, { page: '-1' }, { page: '1.2' }, { page: ['1', '2'] }, { page: '9007199254740991', limit: '24' }, { limit: '25' }, { limit: 'all' }]) {
    assert.equal((await request('GET', '/', { query })).status, 400);
  }
});

test('Owners cannot edit or delete foreign posts and mutations retain the organisation in their atomic filter', async () => {
  assert.equal((await request('PUT', '/:id', { userId: 'ownerA', params: { id: 'post-B' }, body: validPost() })).status, 404);
  assert.equal((await request('DELETE', '/:id', { userId: 'ownerA', params: { id: 'post-B' } })).status, 404);
  assert.equal(records.OrganisationPost.find(post => post._id === 'post-B').title, validPost().title);
  assert.ok(mutations.every(call => call.filter.organisationId === 'A' && call.filter._id === 'post-B'));
});

test('Owners update and remove their post, retain attribution, and can explicitly remove its image', async () => {
  records.OrganisationPost[0].imageUrl = pngImage;
  const fields = { ...validPost(), title: 'Updated notice', authorName: 'Imposter', authorId: 'ownerB', organisationId: 'A' };
  delete fields.imageUrl;
  const updated = await request('PUT', '/:id', { userId: 'ownerA', params: { id: 'post-A' }, body: fields });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.post.imageUrl, pngImage, 'An omitted image preserves the upload');
  assert.equal(updated.body.post.authorName, 'Owner A');
  assert.equal(records.OrganisationPost[0].authorId, 'ownerA');
  const removedImage = await request('PUT', '/:id', { userId: 'ownerA', params: { id: 'post-A' }, body: { ...validPost(), imageUrl: '' } });
  assert.equal(removedImage.body.post.imageUrl, '');
  const invalidUpdate = await request('PUT', '/:id', { userId: 'ownerA', params: { id: 'post-A' }, body: { ...validPost(), description: 'x'.repeat(1001) } });
  assert.equal(invalidUpdate.status, 400);
  assert.equal((await request('DELETE', '/:id', { userId: 'ownerA', params: { id: 'post-A' } })).status, 200);
  assert.deepEqual(records.OrganisationPost.map(post => post._id), ['post-B']);
  assert.deepEqual(records.ActivityLog.map(log => log.action), ['POST_UPDATED', 'POST_UPDATED', 'POST_DELETED']);
});

function richDescription() {
  return {
    type: 'doc', content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'Welcome', marks: [{ type: 'bold' }, { type: 'italic' }, { type: 'underline' }] }] },
      { type: 'orderedList', attrs: { start: 2 }, content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Visit the desk' }] }] }] },
      { type: 'image', attrs: { src: pngImage, alt: 'Membership desk', title: '' } },
    ],
  };
}

test('Structured descriptions preserve typography, list numbering, and uploaded images for members', async () => {
  const descriptionContent = richDescription();
  const created = await request('POST', '/', { userId: 'ownerA', body: { ...validPost(), description: 'Forged plain fallback', descriptionContent } });
  assert.equal(created.status, 201);
  assert.equal(created.body.post.description, 'Welcome\nVisit the desk');
  assert.deepEqual(created.body.post.descriptionContent, descriptionContent);
  const listed = await request('GET');
  const memberPost = listed.body.posts.find(post => post._id === created.body.post._id);
  assert.deepEqual(memberPost.descriptionContent, descriptionContent);
  assert.equal(memberPost.description, created.body.post.description);
});

test('Structured description validation rejects unsafe nodes and images without writing', async () => {
  const unsafeNodes = [
    { type: 'html', content: '<script>alert(1)</script>' },
    { type: 'paragraph', attrs: { onclick: 'alert(1)' }, content: [{ type: 'text', text: 'Hello' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'Hello', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }] },
    { type: 'image', attrs: { src: 'javascript:alert(1)' } },
    { type: 'image', attrs: { src: 'data:image/svg+xml;base64,PHN2Zz4=' } },
    { type: 'image', attrs: { src: 'data:image/png;base64,YWJjZA==' } },
  ];
  const oversized = Buffer.alloc(MAX_IMAGE_SIZE + 1);
  pngBytes.copy(oversized);
  unsafeNodes.push({ type: 'image', attrs: { src: `data:image/png;base64,${oversized.toString('base64')}` } });
  for (const node of unsafeNodes) {
    const descriptionContent = richDescription();
    descriptionContent.content.push(node);
    assert.equal((await request('POST', '/', { userId: 'ownerA', body: { ...validPost(), descriptionContent } })).status, 400);
  }
  assert.equal(records.OrganisationPost.length, 2);
  assert.equal(records.ActivityLog.length, 0);
});

test('Rich descriptions enforce actual text length, require text, and limit image count', async () => {
  const body = validPost();
  const doc = text => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });
  assert.equal((await request('POST', '/', { userId: 'ownerA', body: { ...body, descriptionContent: doc('x'.repeat(1000)) } })).status, 201);
  assert.equal((await request('POST', '/', { userId: 'ownerA', body: { ...body, descriptionContent: doc('x'.repeat(1001)) } })).status, 400);
  assert.equal((await request('POST', '/', { userId: 'ownerA', body: { ...body, descriptionContent: doc(' '.repeat(1001) + 'x' + ' '.repeat(1001)) } })).status, 400);
  assert.equal((await request('POST', '/', { userId: 'ownerA', body: { ...body, descriptionContent: { type: 'doc', content: [...doc('x'.repeat(1000)).content, { type: 'paragraph', content: [] }] } } })).status, 400);
  assert.equal((await request('POST', '/', { userId: 'ownerA', body: { ...body, descriptionContent: { type: 'doc', content: [{ type: 'image', attrs: { src: pngImage } }] } } })).status, 400);
  const imageDoc = richDescription();
  for (let count = 0; count < 3; count++) imageDoc.content.push({ type: 'image', attrs: { src: pngImage } });
  assert.equal((await request('POST', '/', { userId: 'ownerA', body: { ...body, descriptionContent: imageDoc } })).status, 400);
});

test('Editing a formatted post keeps the new document and plain edits clear stale formatting', async () => {
  const rich = await request('PUT', '/:id', { userId: 'ownerA', params: { id: 'post-A' }, body: { ...validPost(), descriptionContent: richDescription() } });
  assert.equal(rich.status, 200);
  assert.equal(rich.body.post.description, 'Welcome\nVisit the desk');
  assert.deepEqual(records.OrganisationPost[0].descriptionContent, richDescription());
  const plain = await request('PUT', '/:id', { userId: 'ownerA', params: { id: 'post-A' }, body: validPost() });
  assert.equal(plain.status, 200);
  assert.equal(plain.body.post.description, validPost().description);
  assert.ok(!Object.hasOwn(plain.body.post, 'descriptionContent'));
  assert.ok(!Object.hasOwn(records.OrganisationPost[0], 'descriptionContent'));
});
