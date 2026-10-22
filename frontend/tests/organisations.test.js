import test from 'node:test';
import assert from 'node:assert/strict';
import { filterOrganisations } from '../src/organisationDirectory.js';

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
