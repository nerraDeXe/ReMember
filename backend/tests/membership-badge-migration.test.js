import assert from 'node:assert/strict';
import { test } from 'node:test';
import { migrateMembershipBadges } from '../services/membershipBadgeMigration.js';

function matches(record, filter) {
  return Object.entries(filter).every(([key, value]) => {
    if (key === '$or') return value.some(branch => matches(record, branch));
    if (value && typeof value === 'object' && '$exists' in value) return Object.hasOwn(record, key) === value.$exists;
    return record[key] === value;
  });
}

function nativeCollection(records, writes) {
  return {
    async countDocuments(filter) { return records.filter(record => matches(record, filter)).length; },
    async updateMany(filter, update) {
      writes.push({ filter: structuredClone(filter), update: structuredClone(update) });
      let modifiedCount = 0;
      for (const record of records.filter(record => matches(record, filter))) {
        const previous = JSON.stringify(record);
        Object.assign(record, update.$set);
        for (const key of Object.keys(update.$unset || {})) delete record[key];
        if (JSON.stringify(record) !== previous) modifiedCount++;
      }
      return { acknowledged: true, modifiedCount };
    }
  };
}

function fixture() {
  const organisations = [{ _id: 'A', name: 'New default' }, { _id: 'B', name: 'Custom', badgeColor: '#123ABC' }];
  const tiers = [
    { _id: 'A-basic', organisationId: 'A', name: 'Basic', price: 0, accessLevel: 1, badgeColor: '#FF0000', isActive: true },
    { _id: 'A-paid', organisationId: 'A', name: 'Paid', price: 25, accessLevel: 5, badgeColor: '#00FF00', isActive: false },
    { _id: 'B-paid', organisationId: 'B', name: 'Custom org tier', badgeColor: '#0000FF' },
    { _id: 'orphan', name: 'Legacy unscoped tier', accessLevel: null, badgeColor: null },
    { _id: 'clean', organisationId: 'B', name: 'Already migrated', price: 40 }
  ];
  const organisationWrites = [], tierWrites = [];
  const collections = { organisations: nativeCollection(organisations, organisationWrites), tiers: nativeCollection(tiers, tierWrites) };
  return { organisations, tiers, organisationWrites, tierWrites, collections };
}

test('Preview counts all legacy tier records without changing either collection', async () => {
  const data = fixture();
  const before = structuredClone({ organisations: data.organisations, tiers: data.tiers });
  const result = await migrateMembershipBadges({ ...data.collections, dryRun: true });
  assert.deepEqual(result, { dryRun: true, organisationsNeedingDefault: 1, tiersWithLegacyFields: 4, organisationsUpdated: 0, tiersUpdated: 0 });
  assert.deepEqual({ organisations: data.organisations, tiers: data.tiers }, before);
  assert.deepEqual(data.organisationWrites, []);
  assert.deepEqual(data.tierWrites, []);
});

test('Migration preserves configured organisation colours and unrelated data while removing all tier legacy fields', async () => {
  const data = fixture();
  const expectedTiers = data.tiers.map(({ accessLevel: _accessLevel, badgeColor: _badgeColor, ...tier }) => tier);
  const result = await migrateMembershipBadges(data.collections);
  assert.deepEqual(result, { dryRun: false, organisationsNeedingDefault: 1, tiersWithLegacyFields: 4, organisationsUpdated: 1, tiersUpdated: 4 });
  assert.deepEqual(data.organisations, [{ _id: 'A', name: 'New default', badgeColor: '#FFD700' }, { _id: 'B', name: 'Custom', badgeColor: '#123ABC' }]);
  assert.deepEqual(data.tiers, expectedTiers);
  assert.deepEqual(data.organisationWrites[0].filter, { badgeColor: { $exists: false } });
  assert.deepEqual(data.tierWrites[0], { filter: {}, update: { $unset: { accessLevel: '', badgeColor: '' } } });
});

test('Migration can be repeated and does not reset an owner colour chosen after the first run', async () => {
  const data = fixture();
  await migrateMembershipBadges(data.collections);
  data.organisations[0].badgeColor = '#13579B';
  const result = await migrateMembershipBadges(data.collections);
  assert.deepEqual(result, { dryRun: false, organisationsNeedingDefault: 0, tiersWithLegacyFields: 0, organisationsUpdated: 0, tiersUpdated: 0 });
  assert.equal(data.organisations[0].badgeColor, '#13579B');
});

test('Interrupted migration can safely retry after the organisation default was saved', async () => {
  const data = fixture();
  const update = data.collections.tiers.updateMany;
  data.collections.tiers.updateMany = async () => { throw new Error('Write interrupted'); };
  await assert.rejects(migrateMembershipBadges(data.collections), /Write interrupted/);
  assert.equal(data.organisations[0].badgeColor, '#FFD700');
  data.collections.tiers.updateMany = update;
  const result = await migrateMembershipBadges(data.collections);
  assert.equal(result.organisationsUpdated, 0);
  assert.equal(result.tiersUpdated, 4);
  assert.ok(data.tiers.every(tier => !Object.hasOwn(tier, 'accessLevel') && !Object.hasOwn(tier, 'badgeColor')));
});

test('Migration rejects an incomplete write so startup cannot serve legacy tier fields', async () => {
  const data = fixture();
  data.collections.tiers.updateMany = async () => ({ modifiedCount: 0 });
  await assert.rejects(migrateMembershipBadges(data.collections), /could not finish/);
});

test('Migration handles an empty database without creating organisations or tiers', async () => {
  const result = await migrateMembershipBadges({ organisations: nativeCollection([], []), tiers: nativeCollection([], []) });
  assert.deepEqual(result, { dryRun: false, organisationsNeedingDefault: 0, tiersWithLegacyFields: 0, organisationsUpdated: 0, tiersUpdated: 0 });
});
