import { DEFAULT_MEMBERSHIP_BADGE_COLOR } from '../../shared/membershipBadges.js';

const missingOrganisationColour = { badgeColor: { $exists: false } };
const legacyTierFields = { $or: [{ accessLevel: { $exists: true } }, { badgeColor: { $exists: true } }] };

/**
 * Use native collections: Mongoose intentionally no longer knows the old tier fields.
 * Repeating this migration preserves configured organisation colours and other data.
 */
export async function migrateMembershipBadges({ organisations, tiers, dryRun = false }) {
  const [organisationsNeedingDefault, tiersWithLegacyFields] = await Promise.all([
    organisations.countDocuments(missingOrganisationColour),
    tiers.countDocuments(legacyTierFields)
  ]);
  const summary = { dryRun, organisationsNeedingDefault, tiersWithLegacyFields, organisationsUpdated: 0, tiersUpdated: 0 };
  if (dryRun) return summary;

  // Establish the shared setting before deleting the retired tier settings.
  const organisationResult = await organisations.updateMany(missingOrganisationColour, { $set: { badgeColor: DEFAULT_MEMBERSHIP_BADGE_COLOR } });
  const tierResult = await tiers.updateMany({}, { $unset: { accessLevel: '', badgeColor: '' } });
  summary.organisationsUpdated = organisationResult.modifiedCount;
  summary.tiersUpdated = tierResult.modifiedCount;

  const [missingColours, remainingLegacyFields] = await Promise.all([
    organisations.countDocuments(missingOrganisationColour),
    tiers.countDocuments(legacyTierFields)
  ]);
  if (missingColours || remainingLegacyFields) throw new Error('Membership badge migration could not finish. Restart after checking database writes.');
  return summary;
}
