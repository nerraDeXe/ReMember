import test from 'node:test';
import assert from 'node:assert/strict';
import { filterOrganisations } from '../src/organisationDirectory.js';
import { findTierPricingConflict, hasDuplicateTierPricing, tierPricingKey } from '../../shared/tierPricing.js';

const organisations = [
  { name: 'ReMember Club', description: 'Meet local makers', category: 'Technology', location: 'Kuala Lumpur', tags: ['Robotics', 'AI'], isPublic: true },
  { name: 'Art Society', description: 'Gallery visits', category: 'Arts', location: 'Penang', tags: ['Painting'], visibility: 'public' },
  { name: 'Private Makers', description: 'Meet local makers', category: 'Technology', visibility: 'private', isPublic: false },
  { name: 'New organisation' }
];
const names = result => result.map(org => org.name);

test('Directory searches trim whitespace and match name, description, category, location and individual tags', () => {
  for (const search of [' remember ', 'LOCAL MAKERS', 'Technology', 'KUALA LUMPUR', 'robotics']) {
    assert.deepEqual(names(filterOrganisations(organisations, { search, visibility: 'public' })), ['ReMember Club']);
  }
  assert.deepEqual(filterOrganisations(organisations, { search: 'robotics,ai' }), []);
  assert.deepEqual(names(filterOrganisations(organisations, { search: 'painting' })), ['Art Society']);
});

test('Visibility, category and search criteria apply together and leave input records unchanged', () => {
  const before = structuredClone(organisations);
  assert.deepEqual(names(filterOrganisations(organisations, { search: 'makers', category: 'Technology', visibility: 'public' })), ['ReMember Club']);
  assert.deepEqual(names(filterOrganisations(organisations, { category: 'Technology', visibility: 'private' })), ['Private Makers']);
  assert.deepEqual(filterOrganisations(organisations, { search: 'Penang', category: 'Technology' }), []);
  assert.deepEqual(filterOrganisations(organisations), organisations);
  assert.deepEqual(organisations, before);
});

test('Each page keeps its existing searchable fields and handles empty lists or missing fields', () => {
  const fields = ['name', 'description', 'category', 'location'];
  assert.deepEqual(filterOrganisations(organisations, { search: 'robotics', fields }), []);
  assert.deepEqual(names(filterOrganisations(organisations, { search: 'Technology', fields })), ['ReMember Club', 'Private Makers']);
  assert.deepEqual(filterOrganisations(organisations, { search: 'Technology', fields: ['name', 'description', 'location', 'tags'] }), []);
  assert.deepEqual(filterOrganisations([], { search: 'ReMember' }), []);
  assert.deepEqual(filterOrganisations([{}], { search: 'anything' }), []);
  assert.deepEqual(filterOrganisations([{}], { search: '   ' }), [{}]);
});

test('Tier pricing matches amounts in cents with the same billing interval', () => {
  const tiers = [
    { _id: 'monthly', price: 10, interval: 'monthly' },
    { _id: 'free', price: 0, interval: 'yearly', isActive: false },
  ];
  assert.equal(findTierPricingConflict(tiers, { price: '10.00', interval: 'monthly' }), tiers[0]);
  assert.equal(findTierPricingConflict(tiers, { price: '0.00', interval: 'yearly' }), tiers[1]);
  assert.equal(findTierPricingConflict(tiers, { price: 10, interval: 'yearly' }), null);
  assert.equal(findTierPricingConflict(tiers, { price: 120, interval: 'yearly' }), null);
  assert.equal(findTierPricingConflict(tiers, { price: 10, interval: 'monthly' }, 'monthly'), null);
  assert.equal(tierPricingKey({ price: 12.5 }), tierPricingKey({ price: '12.50', interval: 'monthly' }));
});

test('Tier setup detects duplicate pricing including free tiers and ignores incomplete amounts', () => {
  assert.equal(hasDuplicateTierPricing([{ price: '0', interval: 'monthly' }, { price: 0, interval: 'monthly' }]), true);
  assert.equal(hasDuplicateTierPricing([{ price: '12.50', interval: 'yearly' }, { price: 12.5, interval: 'yearly' }]), true);
  assert.equal(hasDuplicateTierPricing([{ price: 10, interval: 'monthly' }, { price: 10, interval: 'yearly' }]), false);
  assert.equal(hasDuplicateTierPricing([{ price: '' }, { price: '' }]), false);
  for (const price of ['', ' ', null, undefined, false, NaN, Infinity, -1, 0.001, '12.500', 'invalid', 1000001]) {
    assert.equal(tierPricingKey({ price, interval: 'monthly' }), null, `Invalid price ${price} does not become a pricing key`);
  }
  assert.equal(tierPricingKey({ price: 10, interval: 'weekly' }), null);
});
