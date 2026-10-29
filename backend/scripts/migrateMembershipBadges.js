import mongoose from 'mongoose';
import { config } from '../config/config.js';
import { dbManager } from '../models/db.js';
import { Organisation, Tier } from '../models/index.js';
import { migrateMembershipBadges } from '../services/membershipBadgeMigration.js';

const arguments_ = process.argv.slice(2);
if (arguments_.some(argument => !['--apply', '--dry-run'].includes(argument)) || arguments_.includes('--apply') && arguments_.includes('--dry-run')) {
  console.error('Usage: npm run migrate:membership-badges -- [--dry-run | --apply]');
  process.exitCode = 1;
} else {
  try {
    await dbManager.init(config.MONGODB_URI);
    const summary = await migrateMembershipBadges({ organisations: Organisation.collection, tiers: Tier.collection, dryRun: !arguments_.includes('--apply') });
    console.log(JSON.stringify(summary, null, 2));
    if (summary.dryRun) console.log('Preview only. Add --apply to save these changes.');
  } catch {
    // Connection strings and database error details can contain credentials.
    console.error('Membership badge migration failed. Check the database connection and write permissions, then retry.');
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}
