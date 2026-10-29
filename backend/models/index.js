import mongoose from 'mongoose';
import { POST_LIMITS } from '../../shared/posts.js';
import { DEFAULT_MEMBERSHIP_BADGE_COLOR, isBadgeColor } from '../../shared/membershipBadges.js';

// Define Mongoose schemas for live Mongo connections
const userSchema = new mongoose.Schema({
  _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  name: { type: String, required: true },
  firstName: { type: String },
  lastName: { type: String },
  country: { type: String },
  email: { type: String, required: true, unique: true },
  password: { type: String, required() { return !this.googleId; }, select: false },
  googleId: { type: String, select: false },
  sessionVersion: { type: Number, default: 0 },
  passwordResetHash: { type: String, select: false, index: true },
  passwordResetExpiresAt: { type: Date, select: false },
  passwordResetSentAt: { type: Date, select: false },
  role: { type: String, enum: ['admin', 'member'], default: 'member' },
  status: { type: String, enum: ['active', 'pending', 'suspended', 'revoked', 'expired'], default: 'active' },
  emailVerified: { type: Boolean, default: false },
  emailVerificationHash: { type: String, select: false },
  emailVerificationExpiresAt: { type: Date, select: false },
  emailVerificationSentAt: { type: Date, select: false },
  emailVerificationAttempts: { type: Number, default: 0, select: false },
  onboardingCompleted: { type: Boolean, default: false },
  activeOrganisationId: { type: String },
  tierId: { type: String },
  tierName: { type: String },
  membershipNumber: { type: String, required: true },
  joinedDate: { type: String, default: () => new Date().toISOString() },
  expirationDate: { type: String },
  phone: { type: String, default: '' },
  bio: { type: String, default: '', maxlength: 500 },
  address: {
    street: { type: String, default: '' },
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    postalCode: { type: String, default: '' },
    country: { type: String, default: '' }
  },
  avatarUrl: { type: String },
  googleWallet: {
    passObjectId: { type: String },
    saveUrl: { type: String },
    lastSyncedAt: { type: String },
    syncStatus: { type: String }
  },
  notifications: {
    email: { type: Boolean, default: true },
    events: { type: Boolean, default: true },
    marketing: { type: Boolean, default: false }
  }
}, { timestamps: true });

userSchema.index({ googleId: 1 }, { unique: true, sparse: true });

const authChallengeSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  purpose: { type: String, required: true },
  expiresAt: { type: Date, required: true, expires: 0 },
  consumed: { type: Boolean, default: false }
});
export const AuthChallenge = mongoose.models.AuthChallenge || mongoose.model('AuthChallenge', authChallengeSchema);

const tierSchema = new mongoose.Schema({
  _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  name: { type: String, required: true },
  organisationId: { type: String, index: true },
  slug: { type: String, required: true },
  price: { type: Number, required: true, min: 0 },
  interval: { type: String, default: 'yearly' }, // monthly or yearly
  description: { type: String },
  perks: [{ type: String }],
  isActive: { type: Boolean, default: true },
  maxMembers: { type: Number, default: null }
}, { timestamps: true });

const eventSchema = new mongoose.Schema({
  _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  title: { type: String, required: true },
  organisationId: { type: String, index: true },
  description: { type: String, required: true },
  date: { type: String, required: true }, // YYYY-MM-DD
  time: { type: String, default: '18:00 - 21:00 EST' },
  startDate: { type: String },
  endDate: { type: String },
  timeZone: { type: String },
  schedule: [{ _id: false, date: String, startTime: String, endTime: String }],
  location: { type: String, default: 'Innovation Center Ballroom & Hybrid Stream' },
  locationPlaceId: { type: String, default: '' },
  locationLatitude: { type: Number, default: null, min: -90, max: 90 },
  locationLongitude: { type: Number, default: null, min: -180, max: 180 },
  category: { type: String, default: 'Networking' },
  capacity: { type: Number, default: 100 },
  allowedTiers: [{ type: String }], // e.g. ['Bronze Explorer', 'Silver Patron', 'Gold VIP', 'Platinum Elite']
  // No default: historical allowedTiers lists retain their exact-name policy.
  tierAccess: { type: String, enum: ['all', 'minimum'] },
  minimumTierId: { type: String },
  imageUrl: { type: String },
  rsvps: [{
    userId: String,
    userName: String,
    userEmail: String,
    rsvpDate: String
  }]
}, { timestamps: true });

const organisationPostSchema = new mongoose.Schema({
  _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  organisationId: { type: String, required: true },
  title: { type: String, required: true, maxlength: POST_LIMITS.title },
  subtitle: { type: String, required: true, maxlength: POST_LIMITS.subtitle },
  description: { type: String, required: true, maxlength: POST_LIMITS.description },
  descriptionContent: { type: mongoose.Schema.Types.Mixed },
  imageUrl: { type: String, default: '' },
  authorId: { type: String, required: true },
  authorName: { type: String, required: true },
}, { timestamps: true });
organisationPostSchema.index({ organisationId: 1, createdAt: -1, _id: -1 });

const invoiceSchema = new mongoose.Schema({
  _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  invoiceNumber: { type: String, required: true, unique: true },
  organisationId: { type: String, index: true },
  userId: { type: String, required: true },
  userName: { type: String, required: true },
  userEmail: { type: String, required: true },
  tierId: { type: String, required: true },
  tierName: { type: String, required: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'MYR' },
  billingInterval: { type: String, default: 'yearly' },
  paymentMethod: { type: String, default: 'Payment gateway (demo)' },
  paymentStatus: { type: String, enum: ['paid', 'pending', 'failed'], default: 'paid' },
  transactionId: { type: String },
  periodStart: { type: String },
  periodEnd: { type: String },
  paidAt: { type: String },
  paymentCheckoutId: { type: String },
  intent: { type: String, enum: ['join', 'renew', 'upgrade'] },
  subtotalCents: { type: Number },
  creditCents: { type: Number },
  unusedCreditCents: { type: Number },
  creditBalanceCents: { type: Number },
  creditUnavailable: { type: Boolean },
  carryForwardCents: { type: Number },
  coverageValueCents: { type: Number },
  sourceTierId: { type: String },
  sourceTierName: { type: String },
  scheduledDowngrade: { type: Boolean },
  previousPeriodStart: { type: String },
  previousPeriodEnd: { type: String },
  remainingDays: { type: Number },
  totalDays: { type: Number },
  simulated: { type: Boolean }
}, { timestamps: true });
invoiceSchema.index({ paymentCheckoutId: 1 }, { unique: true, partialFilterExpression: { paymentCheckoutId: { $type: 'string' } } });

const activityLogSchema = new mongoose.Schema({
  _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  action: { type: String, required: true },
  organisationId: { type: String, index: true },
  userId: { type: String },
  userName: { type: String },
  userEmail: { type: String },
  actorRole: { type: String, default: 'member' }, // 'admin' | 'member' | 'system'
  details: { type: Object },
  ipAddress: { type: String, default: '127.0.0.1' },
  timestamp: { type: String, default: () => new Date().toISOString() }
}, { timestamps: true });

const emailNotificationSchema = new mongoose.Schema({
  _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  organisationId: { type: String, index: true },
  recipientEmail: { type: String, required: true },
  recipientName: { type: String, required: true },
  type: { type: String, required: true },
  subject: { type: String, required: true },
  htmlContent: { type: String, required: true },
  status: { type: String, default: 'pending' },
  // No default: historical records were saved without a provider delivery attempt.
  deliveryMethod: { type: String, enum: ['smtp', 'gmail-api'] },
  sentAt: { type: String }
}, { timestamps: true });

const organisationSchema = new mongoose.Schema({
  _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  name: { type: String, required: true },
  slug: { type: String, required: true },
  description: { type: String, required: true },
  category: { type: String, default: 'Community & Networking' },
  visibility: { type: String, enum: ['public', 'private'], default: 'public' },
  isPublic: { type: Boolean, default: true },
  logoUrl: { type: String },
  bannerUrl: { type: String },
  badgeColor: { type: String, default: DEFAULT_MEMBERSHIP_BADGE_COLOR, validate: { validator: isBadgeColor, message: 'Choose a valid organisation badge colour.' } },
  location: { type: String, default: 'Global Network' },
  website: { type: String },
  contactEmail: { type: String },
  memberCount: { type: Number, default: 0 },
  adminId: { type: String },
  adminName: { type: String },
  tags: [{ type: String }],
  joinRequirements: { type: String, default: 'Open enrollment for verified members' },
  featured: { type: Boolean, default: false },
  emailSettings: {
    welcome: {
      enabled: { type: Boolean, default: true },
      subject: { type: String, maxlength: 160 },
      body: { type: String, maxlength: 5000 }
    },
    renewal: {
      enabled: { type: Boolean, default: false },
      subject: { type: String, maxlength: 160 },
      body: { type: String, maxlength: 5000 },
      daysBefore: { type: Number, min: 1, max: 365, default: 30 }
    }
  }
}, { timestamps: true });

const organisationMembershipSchema = new mongoose.Schema({
  _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  organisationId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  role: { type: String, enum: ['owner', 'member'], default: 'member' },
  status: { type: String, enum: ['active', 'pending', 'suspended', 'revoked', 'expired', 'cancelled'], default: 'active' },
  tierId: { type: String },
  tierName: { type: String },
  joinedDate: { type: String, default: () => new Date().toISOString() },
  expirationDate: { type: String },
  firstSubscribedAt: { type: String },
  cancelAtPeriodEnd: { type: Boolean, default: false },
  cancelledAt: { type: String },
  scheduledTierId: { type: String },
  scheduledTierEffectiveAt: { type: String },
  scheduledTierRequestedAt: { type: String },
  billingRevision: { type: Number, default: 0 },
  creditBalanceCents: { type: Number, min: 0, default: 0 },
  billingPeriods: [{ _id: false, tierId: String, periodStart: String, periodEnd: String,
    valueCents: { type: Number, min: 0 }, billingInterval: String }],
  welcomeEmailEligible: { type: Boolean, default: false },
  welcomeEmailSentAt: { type: String },
  welcomeEmailClaimedAt: { type: String },
  welcomeEmailClaimToken: { type: String },
  renewalEmailSentAt: { type: String },
  renewalEmailCycleKey: { type: String },
  renewalEmailClaimedAt: { type: String },
  renewalEmailClaimToken: { type: String },
  renewalEmailRetryAt: { type: String },
}, { timestamps: true });
organisationMembershipSchema.index({ organisationId: 1, userId: 1 }, { unique: true });

// A checkout fixes the server's price for a short-lived demonstration payment.
// No card numbers, verification codes, or bank credentials are stored.
const paymentCheckoutSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  reference: { type: String, required: true, unique: true },
  membershipId: { type: String, required: true },
  organisationId: { type: String, required: true },
  organisationName: { type: String, required: true },
  userId: { type: String, required: true },
  userName: { type: String, required: true },
  userEmail: { type: String, required: true },
  tierId: { type: String, required: true },
  tierName: { type: String, required: true },
  amountCents: { type: Number, required: true },
  intent: { type: String, enum: ['join', 'renew', 'upgrade'] },
  subtotalCents: { type: Number },
  creditCents: { type: Number },
  unusedCreditCents: { type: Number },
  creditBalanceCents: { type: Number },
  creditUnavailable: { type: Boolean },
  carryForwardCents: { type: Number },
  periodStart: { type: String },
  periodEnd: { type: String },
  previousPeriodStart: { type: String },
  previousPeriodEnd: { type: String },
  remainingDays: { type: Number },
  totalDays: { type: Number },
  sourceTierId: { type: String },
  sourceTierName: { type: String },
  sourceExpirationDate: { type: String },
  sourceMembershipStatus: { type: String },
  sourceScheduledTierId: { type: String },
  sourceScheduledTierEffectiveAt: { type: String },
  scheduledDowngrade: { type: Boolean },
  sourceBillingRevision: { type: Number },
  sourcePeriods: [{ _id: false, tierId: String, periodStart: String, periodEnd: String,
    valueCents: { type: Number, min: 0 }, billingInterval: String }],
  billingInterval: { type: String, enum: ['monthly', 'yearly'], required: true },
  expiresAt: { type: String, required: true },
  state: { type: String, enum: ['pending', 'paid', 'failed', 'cancelled', 'expired'], default: 'pending' },
  paymentMethod: { type: String, enum: ['card', 'online_banking', 'ewallet'] },
  completedAt: { type: String }
}, { timestamps: true });

export const User = mongoose.models.User || mongoose.model('User', userSchema);
export const Tier = mongoose.models.Tier || mongoose.model('Tier', tierSchema);
export const Event = mongoose.models.Event || mongoose.model('Event', eventSchema);
export const OrganisationPost = mongoose.models.OrganisationPost || mongoose.model('OrganisationPost', organisationPostSchema);
export const Invoice = mongoose.models.Invoice || mongoose.model('Invoice', invoiceSchema);
export const ActivityLog = mongoose.models.ActivityLog || mongoose.model('ActivityLog', activityLogSchema);
export const EmailNotification = mongoose.models.EmailNotification || mongoose.model('EmailNotification', emailNotificationSchema);
export const Organisation = mongoose.models.Organisation || mongoose.model('Organisation', organisationSchema);
export const Organization = Organisation;
export const OrganisationMembership = mongoose.models.OrganisationMembership || mongoose.model('OrganisationMembership', organisationMembershipSchema);
export const PaymentCheckout = mongoose.models.PaymentCheckout || mongoose.model('PaymentCheckout', paymentCheckoutSchema);
