import express from 'express';
import cors from 'cors';
import { config } from './config/config.js';
import { dbManager } from './models/db.js';
import { startRenewalScheduler } from './services/renewalScheduler.js';
import { mountFrontend } from './services/frontendHosting.js';

import authRoutes from './routes/auth.js';
import memberRoutes from './routes/members.js';
import tierRoutes from './routes/tiers.js';
import eventRoutes from './routes/events.js';
import postRoutes from './routes/posts.js';
import paymentRoutes from './routes/payments.js';
import walletRoutes from './routes/wallet.js';
import adminRoutes from './routes/admin.js';
import emailRoutes from './routes/emails.js';
import organisationRoutes from './routes/organisations.js';

const app = express();

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
// Three inline description images and an optional post cover can total 8 MB
// before base64 encoding. Keep the larger allowance specific to posts.
app.use('/api/posts', express.json({ limit: '12mb' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (!req.path.startsWith('/api/health')) {
      console.log(`[HTTP] ${req.method} ${req.path} -> ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  const connected = dbManager.isConnected;
  res.status(connected ? 200 : 503).json({
    status: connected ? 'healthy' : 'unhealthy',
    system: 'ReMember Membership Management System',
    timestamp: new Date().toISOString(),
    databaseMode: 'MongoDB (Mongoose)',
    version: '1.0.0'
  });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/tiers', tierRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/emails', emailRoutes);
app.use('/api/organisations', organisationRoutes);
app.use('/api/organizations', organisationRoutes);

// One Render web service serves the built website and the existing API.
// Local development can still run Vite separately when no build exists.
mountFrontend(app, { required: config.NODE_ENV === 'production' });

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('[Unhandled Error]', err);
  res.status(500).json({
    success: false,
    message: 'Internal Server Error',
    error: err.message
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `API endpoint '${req.method} ${req.originalUrl}' not found.`
  });
});

// Initialize database & Start Server
async function startServer() {
  try {
    await dbManager.init(config.MONGODB_URI);

    const server = app.listen(config.PORT, () => {
      console.log(`\n======================================================`);
      console.log(`🚀 ReMember Backend Server running on port ${config.PORT}`);
      console.log(`📡 Base API URL: http://localhost:${config.PORT}/api`);
      console.log(`🛡️  RBAC & JWT Security: ENABLED`);
      console.log(`💳 Integrated Payment Processor: ENABLED`);
      console.log(`🎟️  Google Wallet Pass Engine: ENABLED`);
      console.log(`✉️  Automated Email Dispatcher: ENABLED`);
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
