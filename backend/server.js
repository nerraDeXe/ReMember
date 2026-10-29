import { config } from './config/config.js';
import { dbManager } from './models/db.js';
import { Invoice, PaymentCheckout, Organisation, Tier } from './models/index.js';
import { migrateMembershipBadges } from './services/membershipBadgeMigration.js';
import { startRenewalScheduler } from './services/renewalScheduler.js';
import { mailDelivery } from './services/mailDelivery.js';
import { createApp } from './app.js';

const app = createApp();

// Initialize database & Start Server
async function startServer() {
  try {
    await dbManager.init(config.MONGODB_URI);
    // Native collections also remove fields no longer present in the tier schema.
    await migrateMembershipBadges({ organisations: Organisation.collection, tiers: Tier.collection });
    // Payment idempotency relies on these unique indexes before serving traffic.
    await Promise.all([Invoice.init(), PaymentCheckout.init()]);

    const server = app.listen(config.PORT, () => {
      console.log(`\n======================================================`);
      console.log(`🚀 ReMember Backend Server running on port ${config.PORT}`);
      console.log(`📡 Base API URL: http://localhost:${config.PORT}/api`);
      console.log(`🛡️  RBAC & JWT Security: ENABLED`);
      console.log('💳 Payment gateway: DEMO MODE (no money is charged)');
      console.log(`🎟️  Google Wallet Pass Engine: ENABLED`);
      console.log(`✉️  Automated Email Dispatcher: ${mailDelivery.isConfigured() ? `${mailDelivery.deliveryMethod()} configured` : 'NOT CONFIGURED'}`);
      console.log(`======================================================\n`);
    });
    const stopRenewalScheduler = startRenewalScheduler();
    server.on('close', stopRenewalScheduler);
  } catch (error) {
    console.error('Fatal initialization error:', error);
    process.exit(1);
  }
}

startServer();
