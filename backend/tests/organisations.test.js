import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { config } from '../config/config.js';
import { User, Organisation, OrganisationMembership, Tier, ActivityLog } from '../models/index.js';
import organisationRouter from '../routes/organisations.js';
import tierRouter from '../routes/tiers.js';
import { getAccountContext, normaliseTierInput, resolveSelectedOrganisation } from '../services/organisationAccess.js';
import { requireOrganisationOwner, requireOrganisationMembership } from '../middleware/organisationAccess.js';
import { MAX_IMAGE_SIZE } from '../../shared/imageUploads.js';
import { emailService } from '../services/emailService.js';
import { getOrganisationEmailSettings } from '../../shared/organisationEmails.js';

const pngBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=', 'base64');
const pngImage = `data:image/png;base64,${pngBytes.toString('base64')}`;

// These tests replace only Mongo operations. They exercise real auth middleware,
// organisation routes, account context, and the transaction boundary without Atlas.
const models = { User, Organisation, OrganisationMembership, Tier, ActivityLog };
let records, serial, failTierCreation, welcomeCalls;
const originals = [];
const clone = value => structuredClone(value);
const asDocument = value => {
  if (!value) return value;
  const document = clone(value);
  Object.defineProperty(document, 'toObject', { value: () => clone(value) });
  return document;
};
function query(value) {
  return {
    lean: async () => clone(value), select() { return this; },
    then(resolve, reject) {
      return Promise.resolve(Array.isArray(value) ? value.map(asDocument) : (value && typeof value === 'object' ? asDocument(value) : value)).then(resolve, reject);
    }
  };
}
function matches(record, filter = {}) {
  return Object.entries(filter).every(([key, expected]) => {
    if (key === '$or') return expected.some(branch => matches(record, branch));
    if (expected && typeof expected === 'object') {
      if ('$in' in expected) return expected.$in.includes(record[key]);
      if ('$ne' in expected) return record[key] !== expected.$ne;
    }
    return record[key] === expected;
  });
}
function applyUpdate(record, update) {
  Object.assign(record, update.$set || (!Object.keys(update).some(key => key.startsWith('$')) ? update : {}));
  for (const key of Object.keys(update.$unset || {})) delete record[key];
}
function patch(target, name, replacement) {
  originals.push([target, name, target[name]]);
  target[name] = replacement;
}
before(() => {
  patch(emailService, 'sendOrganisationWelcome', async (user, membership, organisation) => {
    welcomeCalls.push({ userId: user._id, membershipId: membership._id, organisationId: organisation._id });
    return { status: 'sent', sentAt: new Date().toISOString() };
  });
  for (const [name, model] of Object.entries(models)) {
    const collection = () => records[name];
    patch(model, 'find', filter => query(collection().filter(record => matches(record, filter))));
    patch(model, 'findOne', filter => query(collection().find(record => matches(record, filter)) || null));
    patch(model, 'findById', id => query(collection().find(record => record._id === id) || null));
    patch(model, 'countDocuments', filter => query(collection().filter(record => matches(record, filter)).length));
    patch(model, 'exists', filter => query(collection().find(record => matches(record, filter)) ? { _id: 'exists' } : null));
    patch(model, 'create', async (input, options) => {
      if (name === 'Tier' && failTierCreation) throw new Error('Deliberate tier write failure');
      if (options?.session && Array.isArray(input) && input.length > 1) assert.equal(options.ordered, true, 'Transaction tier inserts must be sequential');
      const inputs = Array.isArray(input) ? input : [input];
      const documents = inputs.map(data => ({ _id: `${name.toLowerCase()}-${++serial}`, ...clone(data) }));
      collection().push(...documents);
      return Array.isArray(input) ? documents.map(asDocument) : asDocument(documents[0]);
    });
    patch(model, 'findOneAndUpdate', (filter, update, options = {}) => {
      let record = collection().find(value => matches(value, filter));
      if (!record && options.upsert) {
        record = { _id: `${name.toLowerCase()}-${++serial}`, ...clone(filter), ...clone(update.$setOnInsert) };
        collection().push(record);
      }
      if (record) applyUpdate(record, update);
      return query(record || null);
    });
    patch(model, 'findByIdAndUpdate', (id, update) => {
      const record = collection().find(value => value._id === id);
      if (record) applyUpdate(record, update);
      return query(record || null);
    });
    patch(model, 'findOneAndDelete', filter => {
      const index = collection().findIndex(record => matches(record, filter));
      return query(index < 0 ? null : collection().splice(index, 1)[0]);
    });
    patch(model, 'findByIdAndDelete', id => {
      const index = collection().findIndex(record => record._id === id);
      return query(index < 0 ? null : collection().splice(index, 1)[0]);
    });
    patch(model, 'deleteMany', filter => {
      records[name] = collection().filter(record => !matches(record, filter));
      return Promise.resolve({ acknowledged: true });
    });
    patch(model, 'updateMany', (filter, update) => {
      for (const record of collection().filter(record => matches(record, filter))) applyUpdate(record, update);
      return Promise.resolve({ acknowledged: true });
    });
  }
  patch(mongoose, 'startSession', async () => ({
    async withTransaction(callback) {
      const snapshot = clone(records);
      try { await callback(); }
      catch (error) { records = snapshot; throw error; }
    },
    async endSession() {}
  }));
});
after(() => {
  for (const [target, name, original] of originals.reverse()) target[name] = original;
});
beforeEach(() => {
  serial = 0;
  failTierCreation = false;
  welcomeCalls = [];
  records = Object.fromEntries(Object.keys(models).map(name => [name, []]));
  records.User.push({ _id: 'alice', name: 'Alice Owner', email: 'alice@example.test', password: 'secret', emailVerificationHash: 'secret-hash', emailVerificationAttempts: 0, emailVerified: true, role: 'member', status: 'active', onboardingCompleted: false, activeOrganisationId: '' });
});

function request(router, method, path, { userId = null, body = {}, params = {}, query = {} } = {}) {
  const route = router.stack.find(layer => layer.route?.path === path && layer.route.methods[method.toLowerCase()])?.route;
  assert.ok(route, `Route ${method} ${path} exists`);
  const req = { body, params, query, method, originalUrl: path, ip: '127.0.0.1', headers: userId ? { authorization: `Bearer ${jwt.sign({ id: userId }, config.JWT_SECRET)}` } : {} };
  return new Promise((resolve, reject) => {
    let status = 200;
    const res = { status(value) { status = value; return this; }, json(value) { resolve({ status, body: JSON.parse(JSON.stringify(value)) }); } };
    let index = 0;
    const next = error => {
      if (error) return reject(error);
      const layer = route.stack[index++];
      if (!layer) return reject(new Error('Route completed without a response'));
      Promise.resolve(layer.handle(req, res, next)).catch(reject);
    };
    next();
  });
}

function seedOrganisation(id, ownerId = 'bob', isPublic = true) {
  records.Organisation.push({ _id: id, name: `Organisation ${id}`, adminId: ownerId, visibility: isPublic ? 'public' : 'private', isPublic, category: isPublic ? 'Public category' : 'Private category', memberCount: 1 });
  records.Tier.push({ _id: `${id}-free`, organisationId: id, name: 'Community', price: 0, interval: 'monthly', isActive: true });
  records.Tier.push({ _id: `${id}-paid`, organisationId: id, name: 'Supporter', price: 12.50, interval: 'monthly', isActive: true });
}

test('Account context can select membership in another organisation while retaining ownership', async () => {
  seedOrganisation('owned', 'alice', false);
  seedOrganisation('joined');
  records.User[0].role = 'admin';
  records.User[0].activeOrganisationId = 'joined';
  records.OrganisationMembership.push({ _id: 'owned-legacy', organisationId: 'owned', userId: 'alice', role: 'owner', status: 'active', tierId: 'owned-free', tierName: 'Community' });
  records.OrganisationMembership.push({ _id: 'joined-member', organisationId: 'joined', userId: 'alice', role: 'member', status: 'active', tierId: 'joined-free', tierName: 'Community', joinedDate: '2026-10-14' });
  const user = await getAccountContext(records.User[0]);
  assert.equal(user.organisationRole, 'member');
  assert.equal(user.ownedOrganisations[0]._id, 'owned');
  assert.equal(user.activeOrganisationId, 'joined');
  assert.equal(user.tierId, 'joined-free');
  assert.equal(user.password, undefined);
  assert.equal(user.emailVerificationHash, undefined);
  assert.equal(user.emailVerificationAttempts, undefined);
  records.User[0].activeOrganisationId = 'owned';
  const ownerContext = await getAccountContext(records.User[0]);
  assert.equal(ownerContext.organisationRole, 'owner');
  assert.equal(ownerContext.tierId, '');
  assert.equal(ownerContext.tierName, '');
});

test('Unassociated accounts get no organisation or automatic membership tier', async () => {
  const user = await getAccountContext({ ...records.User[0], tierId: 'legacy-default', tierName: 'Old global tier' });
  assert.equal(user.activeOrganisationId, null);
  assert.equal(user.organisationRole, null);
  assert.equal(user.tierId, '');
  assert.equal(user.membershipStatus, null);
});

test('Revoked selected membership falls back consistently to an organisation the account owns', async () => {
  seedOrganisation('owned', 'alice', false);
  seedOrganisation('revoked');
  records.User[0].role = 'admin';
  records.User[0].activeOrganisationId = 'revoked';
  records.OrganisationMembership.push({ _id: 'revoked-member', organisationId: 'revoked', userId: 'alice', role: 'member', status: 'revoked' });
  const context = await getAccountContext(records.User[0]);
  assert.equal(context.activeOrganisationId, 'owned');
  const selected = await resolveSelectedOrganisation(records.User[0]);
  assert.equal(selected._id, 'owned');
  const req = { user: records.User[0] };
  let called = false;
  await requireOrganisationOwner(req, { status() { assert.fail('Fallback owner access must be allowed'); } }, () => { called = true; });
  assert.equal(called, true);
  assert.equal(req.organisationId, 'owned');
});

test('Discovery hides another owner’s private organisations even from a global admin', async () => {
  records.User[0].role = 'admin';
  seedOrganisation('public');
  seedOrganisation('other-private', 'bob', false);
  seedOrganisation('own-private', 'alice', false);
  const publicResult = await request(organisationRouter, 'GET', '/');
  assert.deepEqual(publicResult.body.organisations.map(org => org._id), ['public']);
  const ownResult = await request(organisationRouter, 'GET', '/', { userId: 'alice' });
  assert.deepEqual(new Set(ownResult.body.organisations.map(org => org._id)), new Set(['public', 'own-private']));
  const categoryResult = await request(organisationRouter, 'GET', '/categories');
  assert.deepEqual(categoryResult.body.categories, ['Public category']);
  const privateResult = await request(organisationRouter, 'GET', '/:id', { userId: 'alice', params: { id: 'other-private' } });
  assert.equal(privateResult.status, 404);
});

test('Verified member creates an organisation and its chosen tiers atomically', async () => {
  const result = await request(organisationRouter, 'POST', '/', { userId: 'alice', body: { name: 'Art Club', description: 'A community for artists.', adminId: 'attacker', tiers: [{ name: 'Free', price: 0, interval: 'monthly' }, { name: 'Supporter', price: '25.50', interval: 'yearly' }] } });
  assert.equal(result.status, 201);
  assert.equal(result.body.organisation.adminId, 'alice');
  assert.equal(result.body.tiers.length, 2);
  assert.equal(result.body.tiers[1].price, 25.50);
  assert.ok(result.body.tiers.every(tier => tier.organisationId === result.body.organisation._id));
  assert.equal(records.OrganisationMembership[0].role, 'owner');
  assert.equal(records.OrganisationMembership[0].tierId, undefined);
  assert.equal(records.OrganisationMembership[0].tierName, undefined);
  assert.equal(result.body.user.organisationRole, 'owner');
  assert.equal(result.body.user.tierName, '');
  assert.equal(result.body.user.onboardingCompleted, true);
  assert.equal(result.body.user.role, 'admin');
  assert.equal(result.body.user.password, undefined);
});

test('Tier write failure rolls back organisation creation and account promotion', async () => {
  failTierCreation = true;
  const result = await request(organisationRouter, 'POST', '/', { userId: 'alice', body: { name: 'Club', description: 'Club description', tiers: [{ name: 'Members', price: 0 }] } });
  assert.equal(result.status, 500);
  assert.equal(records.Organisation.length, 0);
  assert.equal(records.Tier.length, 0);
  assert.equal(records.OrganisationMembership.length, 0);
  assert.equal(records.User[0].role, 'member');
  assert.equal(records.User[0].onboardingCompleted, false);
});

test('Organisation owners can upload, replace, remove and read images without changing another organisation', async () => {
  seedOrganisation('owned', 'alice');
  seedOrganisation('other', 'bob');
  const largerImage = `data:image/png;base64,${Buffer.concat([pngBytes, Buffer.alloc(1200)]).toString('base64')}`;
  assert.ok(largerImage.length > 1000, 'Uploads exceed the old URL field length limit');
  const uploaded = await request(organisationRouter, 'PUT', '/:id', { userId: 'alice', params: { id: 'owned' }, body: { logoUrl: pngImage, bannerUrl: largerImage } });
  assert.equal(uploaded.status, 200);
  assert.equal(uploaded.body.organisation.logoUrl, pngImage);
  assert.equal(uploaded.body.organisation.bannerUrl, largerImage);
  const discovered = await request(organisationRouter, 'GET', '/');
  assert.equal(discovered.body.organisations.find(org => org._id === 'owned').bannerUrl, largerImage);

  const forbidden = await request(organisationRouter, 'PUT', '/:id', { userId: 'alice', params: { id: 'other' }, body: { logoUrl: pngImage } });
  assert.equal(forbidden.status, 403);
  assert.equal(records.Organisation.find(org => org._id === 'other').logoUrl, undefined);

  const replaced = await request(organisationRouter, 'PUT', '/:id', { userId: 'alice', params: { id: 'owned' }, body: { logoUrl: largerImage, bannerUrl: '' } });
  assert.equal(replaced.status, 200);
  assert.equal(replaced.body.organisation.logoUrl, largerImage);
  assert.equal(replaced.body.organisation.bannerUrl, '');
  const removed = await request(organisationRouter, 'PUT', '/:id', { userId: 'alice', params: { id: 'owned' }, body: { logoUrl: '' } });
  assert.equal(removed.status, 200);
  assert.equal(records.Organisation.find(org => org._id === 'owned').logoUrl, '');
});

test('Image uploads reject unsupported formats, fake image content, malformed base64 and oversized files', async () => {
  seedOrganisation('owned', 'alice');
  const oversizedBytes = Buffer.alloc(MAX_IMAGE_SIZE + 1);
  pngBytes.copy(oversizedBytes);
  const invalidImages = [
    null,
    'javascript:alert(1)',
    'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
    'data:image/png;base64,@@invalid@@',
    'data:image/png;base64,aGVsbG8=',
    pngImage.replace('image/png', 'image/jpeg'),
    `data:image/png;base64,${oversizedBytes.toString('base64')}`
  ];
  for (const field of ['logoUrl', 'bannerUrl']) {
    for (const image of invalidImages) {
      const result = await request(organisationRouter, 'PUT', '/:id', { userId: 'alice', params: { id: 'owned' }, body: { [field]: image } });
      assert.equal(result.status, 400, `Invalid ${field} must be rejected`);
      assert.equal(records.Organisation[0][field], undefined);
    }
  }
});

test('Organisation creation supports uploaded images and existing remote images can be retained', async () => {
  const created = await request(organisationRouter, 'POST', '/', { userId: 'alice', body: { name: 'Art Club', description: 'Artists welcome.', logoUrl: pngImage, tiers: [{ name: 'Member', price: 0 }] } });
  assert.equal(created.status, 201);
  assert.equal(created.body.organisation.logoUrl, pngImage);
  const remote = 'https://example.test/existing-banner.png';
  const updated = await request(organisationRouter, 'PUT', '/:id', { userId: 'alice', params: { id: created.body.organisation._id }, body: { bannerUrl: remote, name: 'Updated Art Club' } });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.organisation.logoUrl, pngImage);
  assert.equal(updated.body.organisation.bannerUrl, remote);
});

test('Creation requires email confirmation and at least one valid tier', async () => {
  records.User[0].emailVerified = false;
  const unverified = await request(organisationRouter, 'POST', '/', { userId: 'alice', body: { name: 'Club', description: 'Description', tiers: [{ name: 'Free', price: 0 }] } });
  assert.equal(unverified.status, 403);
  records.User[0].emailVerified = true;
  const missingTier = await request(organisationRouter, 'POST', '/', { userId: 'alice', body: { name: 'Club', description: 'Description' } });
  assert.equal(missingTier.status, 400);
  assert.equal(records.Organisation.length, 0);
  for (const price of [-1, 0.001, 'NaN', 'Infinity', '', 1000001, true]) assert.throws(() => normaliseTierInput({ name: 'Invalid', price }));
  assert.throws(() => normaliseTierInput({ name: 'Invalid', price: 2, interval: 'weekly' }));
});

test('Free joining activates membership; paid joining stays pending and cannot bypass payment', async () => {
  seedOrganisation('free-org');
  seedOrganisation('paid-org');
  const free = await request(organisationRouter, 'POST', '/:id/join', { userId: 'alice', params: { id: 'free-org' }, body: { tierId: 'free-org-free' } });
  assert.equal(free.status, 200);
  assert.equal(free.body.membership.status, 'active');
  assert.equal(free.body.requiresPayment, false);
  assert.equal(welcomeCalls.length, 1);
  assert.equal(welcomeCalls[0].organisationId, 'free-org');
  assert.ok(records.OrganisationMembership[0].welcomeEmailSentAt);
  assert.equal(records.OrganisationMembership[0].welcomeEmailEligible, false);
  await request(organisationRouter, 'POST', '/:id/join', { userId: 'alice', params: { id: 'free-org' }, body: { tierId: 'free-org-free' } });
  assert.equal(welcomeCalls.length, 1, 'Repeated joins must not send a second welcome');
  const paid = await request(organisationRouter, 'POST', '/:id/join', { userId: 'alice', params: { id: 'paid-org' }, body: { tierId: 'paid-org-paid' } });
  assert.equal(paid.body.membership.status, 'pending');
  assert.equal(paid.body.requiresPayment, true);
  assert.equal(welcomeCalls.length, 1, 'Pending paid memberships receive no welcome');
  assert.equal(records.OrganisationMembership[1].welcomeEmailEligible, true);
  const repeat = await request(organisationRouter, 'POST', '/:id/join', { userId: 'alice', params: { id: 'paid-org' }, body: { tierId: 'paid-org-free' } });
  assert.equal(repeat.body.membership.status, 'pending');
  assert.equal(repeat.body.membership.tierId, 'paid-org-paid');
  assert.equal(records.OrganisationMembership.length, 2);
  assert.equal(repeat.body.user.activeOrganisationId, 'paid-org');
});

test('Email settings defaults, customisation and access remain specific to the organisation owner', async () => {
  seedOrganisation('owned', 'alice');
  seedOrganisation('other', 'bob');
  const initial = await request(organisationRouter, 'GET', '/:id/email-settings', { userId: 'alice', params: { id: 'owned' } });
  assert.equal(initial.status, 200);
  assert.deepEqual(initial.body.emailSettings, getOrganisationEmailSettings());
  const settings = getOrganisationEmailSettings({ welcome: { subject: 'Welcome to our art club, {memberName}' }, renewal: { enabled: true, daysBefore: 7 } });
  const updated = await request(organisationRouter, 'PUT', '/:id/email-settings', { userId: 'alice', params: { id: 'owned' }, body: settings });
  assert.equal(updated.status, 200);
  assert.deepEqual(updated.body.emailSettings, settings);
  assert.deepEqual(records.Organisation[0].emailSettings, settings);
  assert.equal(records.Organisation[1].emailSettings, undefined);
  for (const method of ['GET', 'PUT']) {
    const forbidden = await request(organisationRouter, method, '/:id/email-settings', { userId: 'alice', params: { id: 'other' }, body: settings });
    assert.equal(forbidden.status, 403);
  }
  records.User[0].role = 'admin';
  const globalAdmin = await request(organisationRouter, 'PUT', '/:id/email-settings', { userId: 'alice', params: { id: 'other' }, body: settings });
  assert.equal(globalAdmin.status, 403);
});

test('Email templates stay private in public discovery, organisation details and member join responses', async () => {
  seedOrganisation('owned', 'alice');
  const settings = getOrganisationEmailSettings({ welcome: { body: 'Private owner template for {memberName}' } });
  records.Organisation[0].emailSettings = settings;
  records.User.push({ ...records.User[0], _id: 'bob', name: 'Bob Member', email: 'bob@example.test' });

  const discovery = await request(organisationRouter, 'GET', '/');
  assert.equal(discovery.status, 200);
  assert.equal(discovery.body.organisations[0].emailSettings, undefined);
  const details = await request(organisationRouter, 'GET', '/:id', { params: { id: 'owned' } });
  assert.equal(details.status, 200);
  assert.equal(details.body.organisation.emailSettings, undefined);
  const ownerDetails = await request(organisationRouter, 'GET', '/:id', { userId: 'alice', params: { id: 'owned' } });
  assert.deepEqual(ownerDetails.body.organisation.emailSettings, settings);

  const joined = await request(organisationRouter, 'POST', '/:id/join', { userId: 'bob', params: { id: 'owned' }, body: { tierId: 'owned-free' } });
  assert.equal(joined.status, 200);
  assert.equal(joined.body.organisation.emailSettings, undefined);
  const memberDiscovery = await request(organisationRouter, 'GET', '/', { userId: 'bob' });
  assert.equal(memberDiscovery.body.organisations[0].emailSettings, undefined);
  const forbidden = await request(organisationRouter, 'GET', '/:id/email-settings', { userId: 'bob', params: { id: 'owned' } });
  assert.equal(forbidden.status, 403);
  assert.deepEqual(records.Organisation[0].emailSettings, settings);
});

test('Email settings reject invalid schedules, header injection and unknown placeholders', async () => {
  seedOrganisation('owned', 'alice');
  for (const changes of [
    { renewal: { daysBefore: 0 } }, { renewal: { daysBefore: 366 } }, { renewal: { daysBefore: 1.5 } }, { renewal: { daysBefore: '7' } },
    { welcome: { subject: 'Hello\nBcc: victim@example.test' } }, { welcome: { subject: '{password}' } }, { welcome: { body: '' } },
    { welcome: { body: 'x'.repeat(5001) } }, { welcome: { enabled: 'false' } }
  ]) {
    const result = await request(organisationRouter, 'PUT', '/:id/email-settings', { userId: 'alice', params: { id: 'owned' }, body: getOrganisationEmailSettings(changes) });
    assert.equal(result.status, 400);
    assert.equal(records.Organisation[0].emailSettings, undefined);
  }
});

test('Joining enforces public visibility, same organisation tiers, and suspended membership restrictions', async () => {
  seedOrganisation('public');
  seedOrganisation('private', 'bob', false);
  const privateResult = await request(organisationRouter, 'POST', '/:id/join', { userId: 'alice', params: { id: 'private' }, body: { tierId: 'private-free' } });
  assert.equal(privateResult.status, 403);
  const crossTier = await request(organisationRouter, 'POST', '/:id/join', { userId: 'alice', params: { id: 'public' }, body: { tierId: 'private-free' } });
  assert.equal(crossTier.status, 400);
  records.OrganisationMembership.push({ _id: 'blocked', organisationId: 'public', userId: 'alice', role: 'member', status: 'suspended' });
  const blocked = await request(organisationRouter, 'POST', '/:id/join', { userId: 'alice', params: { id: 'public' }, body: { tierId: 'public-free' } });
  assert.equal(blocked.status, 403);
});

test('Organisation selection requires an existing ownership or membership association', async () => {
  seedOrganisation('owned', 'alice');
  seedOrganisation('unjoined');
  const denied = await request(organisationRouter, 'POST', '/select', { userId: 'alice', body: { organisationId: 'unjoined' } });
  assert.equal(denied.status, 403);
  const allowed = await request(organisationRouter, 'POST', '/select', { userId: 'alice', body: { organisationId: 'owned' } });
  assert.equal(allowed.body.user.organisationRole, 'owner');
  const skip = await request(organisationRouter, 'POST', '/onboarding-complete', { userId: 'alice' });
  assert.equal(skip.body.user.onboardingCompleted, true);
});

test('Only actual owners can update orgs and tiers; ownership identifiers are immutable', async () => {
  records.User[0].role = 'admin';
  records.User[0].activeOrganisationId = 'owned';
  seedOrganisation('owned', 'alice');
  seedOrganisation('other');
  const denied = await request(organisationRouter, 'PUT', '/:id', { userId: 'alice', params: { id: 'other' }, body: { name: 'Stolen' } });
  assert.equal(denied.status, 403);
  const immutable = await request(organisationRouter, 'PUT', '/:id', { userId: 'alice', params: { id: 'owned' }, body: { adminId: 'bob', memberCount: 999, name: 'Renamed' } });
  assert.equal(immutable.body.organisation.adminId, 'alice');
  assert.equal(immutable.body.organisation.memberCount, 1);
  const crossTier = await request(tierRouter, 'PUT', '/:id', { userId: 'alice', params: { id: 'other-free' }, body: { price: 100 } });
  assert.equal(crossTier.status, 404);
  const ownTier = await request(tierRouter, 'PUT', '/:id', { userId: 'alice', params: { id: 'owned-paid' }, body: { price: '18.75', organisationId: 'other' } });
  assert.equal(ownTier.status, 200);
  assert.equal(ownTier.body.tier.organisationId, 'owned');
  assert.equal(ownTier.body.tier.price, 18.75);
});

test('Owner middleware denies a global admin who selects another organisation; pending cannot access member features', async () => {
  seedOrganisation('owned', 'alice');
  seedOrganisation('joined');
  records.User[0].role = 'admin';
  records.User[0].activeOrganisationId = 'joined';
  records.OrganisationMembership.push({ _id: 'member', organisationId: 'joined', userId: 'alice', role: 'member', status: 'pending' });
  let deniedStatus;
  const res = { status(value) { deniedStatus = value; return this; }, json() {} };
  await requireOrganisationOwner({ user: records.User[0] }, res, () => assert.fail('Should deny nonowner context'));
  assert.equal(deniedStatus, 403);
  await requireOrganisationMembership({ user: records.User[0] }, res, () => assert.fail('Should deny pending membership'));
  assert.equal(deniedStatus, 403);
  records.OrganisationMembership[0].status = 'active';
  const req = { user: records.User[0] };
  let called = false;
  await requireOrganisationMembership(req, res, () => { called = true; });
  assert.equal(called, true);
  assert.equal(req.organisationId, 'joined');
  assert.equal(req.membership._id, 'member');
});
