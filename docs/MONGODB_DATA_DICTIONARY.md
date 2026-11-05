# MongoDB Document Data Dictionary

This document describes ReMember's 12 MongoDB document types, based on the current [Mongoose models](../backend/models/index.js) and the application code that reads and writes them. Each section gives the document's purpose and a table of its stored fields. Reviewed on 4 November 2026.

Data types follow the application's Mongoose schemas. A `String` is stored text, including date/time values explicitly labelled as ISO 8601; a `Date` is a MongoDB date value. `Number` is the schema's numeric type, including monetary values and counters. `String[]`, `Number[]`, and `Object[]` denote arrays. Dotted names identify nested fields, and `[]` identifies an element of an embedded array. `Mixed` denotes flexible content whose inner fields are not fixed by the Mongoose schema. Optional fields may be absent, and some fields explicitly support `null`.

All top-level document identifiers are stored as strings. RSVP subdocuments have an automatically generated ObjectId. Mongoose also provides the `__v` version key; its presence depends on how a record was written. The exported name `Organization` aliases `Organisation` and refers to the same collection.

1. [User](#user)
2. [AuthChallenge](#authchallenge)
3. [Organisation](#organisation)
4. [OrganisationMembership](#organisationmembership)
5. [Tier](#tier)
6. [Event](#event)
7. [OrganisationPost](#organisationpost)
8. [PaymentCheckout](#paymentcheckout)
9. [Invoice](#invoice)
10. [Notification](#notification)
11. [EmailNotification](#emailnotification)
12. [ActivityLog](#activitylog)

## User

Collection: `users`

A User document stores a person's ReMember account, sign-in details, profile, email verification state, and notification preferences. One account can own or join several organisations. Organisation-specific membership roles, tiers, dates, and access states come from OrganisationMembership; the User document retains account-level security controls and some legacy membership fields.

| Field Name | Data Type | Short description |
| --- | --- | --- |
| `_id` | String | Unique account identifier; generated from an ObjectId and stored as text. |
| `name` | String | Full display name. |
| `firstName` | String | Given name. |
| `lastName` | String | Family name. |
| `country` | String | Account country used for profile and phone validation. |
| `email` | String | Unique account email address used for sign-in and messages. |
| `password` | String | Bcrypt password hash; required without a Google identity and excluded from queries by default. |
| `googleId` | String | Linked Google account subject identifier; excluded from queries by default. |
| `sessionVersion` | Number | Session revision checked against tokens; incrementing it invalidates existing sessions. |
| `passwordResetHash` | String | SHA-256 hash of the current password reset token; excluded from queries by default. |
| `passwordResetExpiresAt` | Date | Password reset token expiry time; excluded from queries by default. |
| `passwordResetSentAt` | Date | Latest password reset email reservation time, used to limit resends; excluded from queries by default. |
| `role` | String | Stored account role: `admin` or `member`; organisation ownership determines current admin permissions. |
| `status` | String | Account state: `active`, `pending`, `suspended`, `revoked`, or `expired`; suspension and revocation block sign-in. |
| `emailVerified` | Boolean | Whether the account email address has been confirmed. |
| `emailVerificationHash` | String | HMAC-SHA-256 hash of the email verification code; excluded from queries by default. |
| `emailVerificationExpiresAt` | Date | Email verification code expiry time; excluded from queries by default. |
| `emailVerificationSentAt` | Date | Latest verification email reservation time, used to limit resends; excluded from queries by default. |
| `emailVerificationAttempts` | Number | Failed attempts for the current verification code; excluded from queries by default. |
| `onboardingCompleted` | Boolean | Whether the person completed or skipped initial organisation setup. |
| `activeOrganisationId` | String | Selected organisation used as the account's portal context. |
| `tierId` | String | Legacy account tier identifier; current organisation tier comes from OrganisationMembership. |
| `tierName` | String | Legacy account tier name; current organisation tier comes from OrganisationMembership. |
| `membershipNumber` | String | Account's displayed member reference number. |
| `joinedDate` | String | Account registration timestamp stored as ISO text; organisation join dates are stored on memberships. |
| `expirationDate` | String | Legacy membership expiry stored as date text; current expiry comes from OrganisationMembership. |
| `phone` | String | Contact phone number, saved with its international calling code. |
| `bio` | String | Personal biography, limited to 500 characters. |
| `address` | Object | Embedded postal address. |
| `address.street` | String | Street address. |
| `address.city` | String | City or town. |
| `address.state` | String | State or region. |
| `address.postalCode` | String | Postal or ZIP code. |
| `address.country` | String | Postal address country. |
| `avatarUrl` | String | Profile image URL. |
| `notifications` | Object | Embedded account notification preferences. |
| `notifications.email` | Boolean | Enables organisation welcome emails and renewal reminders; defaults to `true`. |
| `notifications.events` | Boolean | Enables event notifications and reminders; defaults to `true`. |
| `notifications.eventReminderDays` | Number[] | Days before an event to create reminders; defaults to `[7, 1]`. |
| `notifications.marketing` | Boolean | Stored preference for marketing communications; defaults to `false`. |
| `createdAt` | Date | Time the account document was created, maintained by Mongoose. |
| `updatedAt` | Date | Time the account document was last updated, maintained by Mongoose. |
| `__v` | Number | Mongoose document version key, when present. |

## AuthChallenge

Collection: `authchallenges`

An AuthChallenge document tracks a short-lived, single-use step in Google sign-in or Google account registration. It links a signed flow token to a server-side record so that the same authentication step cannot be reused. Expired records are eligible for automatic removal through a MongoDB TTL index.

| Field Name | Data Type | Short description |
| --- | --- | --- |
| `_id` | String | Unique flow identifier, generated as a UUID and matched to the token's `jti` claim. |
| `purpose` | String | Flow purpose, currently `google-challenge` or `google-signup`. |
| `expiresAt` | Date | Deadline for consuming the challenge; also drives TTL cleanup. |
| `consumed` | Boolean | Whether the challenge has already been used; defaults to `false`. |
| `__v` | Number | Mongoose document version key, when present. |

## Organisation

Collection: `organisations`

An Organisation document represents a community managed through ReMember. It stores the community's public profile, discovery visibility, owner, branding, member count, and email templates. Its identifier connects the organisation to its tiers, memberships, events, posts, invoices, and notifications.

| Field Name | Data Type | Short description |
| --- | --- | --- |
| `_id` | String | Unique organisation identifier; generated from an ObjectId and stored as text. |
| `name` | String | Organisation display name. |
| `slug` | String | URL-friendly name generated from the organisation name. |
| `description` | String | Organisation introduction or purpose. |
| `category` | String | Organisation category; defaults to `Community & Networking`. |
| `visibility` | String | Discovery visibility: `public` or `private`. |
| `isPublic` | Boolean | Public discovery flag, maintained alongside `visibility`. |
| `logoUrl` | String | Organisation logo URL or image data URL. |
| `bannerUrl` | String | Organisation banner URL or image data URL. |
| `badgeColor` | String | Membership badge colour as a six-digit hex code; defaults to `#FFD700`. |
| `location` | String | Organisation location label; defaults to `Global Network`. |
| `website` | String | Organisation website address. |
| `contactEmail` | String | Organisation contact email address. |
| `memberCount` | Number | Cached count of active memberships, including the owner once. |
| `adminId` | String | User identifier of the organisation owner. |
| `adminName` | String | Stored name of the organisation owner. |
| `tags` | String[] | Searchable or descriptive organisation tags. |
| `joinRequirements` | String | Displayed joining requirements or invitation information. |
| `featured` | Boolean | Whether the organisation receives priority in discovery ordering. |
| `emailSettings` | Object | Embedded settings for organisation email templates. |
| `emailSettings.welcome` | Object | Welcome email settings. |
| `emailSettings.welcome.enabled` | Boolean | Enables welcome emails for eligible new members; defaults to `true`. |
| `emailSettings.welcome.subject` | String | Custom welcome email subject, up to 160 characters. |
| `emailSettings.welcome.body` | String | Custom welcome message template, up to 5,000 characters. |
| `emailSettings.renewal` | Object | Membership renewal reminder settings. |
| `emailSettings.renewal.enabled` | Boolean | Enables renewal reminder emails; defaults to `false`. |
| `emailSettings.renewal.subject` | String | Custom renewal reminder subject, up to 160 characters. |
| `emailSettings.renewal.body` | String | Custom renewal reminder message template, up to 5,000 characters. |
| `emailSettings.renewal.daysBefore` | Number | Days before expiry to send reminders; defaults to 30, with a range of 1-365. |
| `createdAt` | Date | Time the organisation document was created, maintained by Mongoose. |
| `updatedAt` | Date | Time the organisation document was last updated, maintained by Mongoose. |
| `__v` | Number | Mongoose document version key, when present. |

## OrganisationMembership

Collection: `organisationmemberships`

An OrganisationMembership document links a user to one organisation and holds that relationship's role, status, selected tier, subscription dates, and billing history. It supports cancellation, scheduled downgrades, credit calculations, and email/notification bookkeeping. A unique organisation-and-user pair prevents duplicate memberships in the same organisation.

| Field Name | Data Type | Short description |
| --- | --- | --- |
| `_id` | String | Unique membership identifier. |
| `organisationId` | String | Identifier of the organisation the user belongs to. |
| `userId` | String | Identifier of the associated user account. |
| `role` | String | Organisation role: `owner` or `member`; defaults to `member`. |
| `status` | String | Stored membership status: `active`, `pending`, `suspended`, `revoked`, `expired`, or `cancelled`. |
| `tierId` | String | Identifier of the membership's current tier. |
| `tierName` | String | Stored name of the current membership tier. |
| `joinedDate` | String (ISO 8601 date-time) | Date and time the user joined this organisation. |
| `expirationDate` | String (ISO 8601 date-time) | End of the membership's current access period. |
| `firstSubscribedAt` | String (ISO 8601 date-time) | Recorded start of the user's subscription history. |
| `cancelAtPeriodEnd` | Boolean | Whether cancellation takes effect after the remaining paid period. |
| `cancelledAt` | String (ISO 8601 date-time) | When the user requested or completed cancellation. |
| `scheduledTierId` | String | Identifier of a cheaper tier selected for the next renewal. |
| `scheduledTierEffectiveAt` | String (ISO 8601 date-time) | When the scheduled tier change becomes due. |
| `scheduledTierRequestedAt` | String (ISO 8601 date-time) | When the member requested the scheduled tier change. |
| `billingRevision` | Number | Revision counter used to detect concurrent changes and invalidate old checkout quotes. |
| `creditBalanceCents` | Number | Non-negative credit carried forward for this membership in MYR cents; defaults to `0`. |
| `billingPeriods` | Object[] | Recorded paid service periods used to calculate unused membership credit. |
| `billingPeriods[].tierId` | String | Tier associated with the recorded service period. |
| `billingPeriods[].periodStart` | String (ISO 8601 date-time) | Start of the recorded service period. |
| `billingPeriods[].periodEnd` | String (ISO 8601 date-time) | End of the recorded service period. |
| `billingPeriods[].valueCents` | Number | Non-negative service value of that period in MYR cents. |
| `billingPeriods[].billingInterval` | String | Billing interval associated with that service period, normally `monthly` or `yearly`. |
| `welcomeEmailEligible` | Boolean | Whether a new membership is eligible for its first welcome email; cleared when claimed. |
| `welcomeEmailSentAt` | String (ISO 8601 date-time) | When the email provider accepted the welcome email. |
| `welcomeEmailClaimedAt` | String (ISO 8601 date-time) | When a worker atomically claimed the welcome email attempt. |
| `welcomeEmailClaimToken` | String | Unique token identifying the worker's welcome email claim. |
| `renewalEmailSentAt` | String (ISO 8601 date-time) | When the provider accepted the latest renewal reminder. |
| `renewalEmailCycleKey` | String | Expiry date-time identifying the renewal cycle already reminded. |
| `renewalEmailClaimedAt` | String (ISO 8601 date-time) | Start of the temporary worker claim for a renewal reminder. |
| `renewalEmailClaimToken` | String | Unique token identifying the worker's renewal reminder claim. |
| `renewalEmailRetryAt` | String (ISO 8601 date-time) | Earliest time to retry an unsuccessful renewal reminder. |
| `notificationSnapshot` | Mixed (Object) | Last notified membership state: `status`, `tierId`, `tierName`, `cancelAtPeriodEnd`, and `scheduledTierId`; its inner shape is not schema-enforced. |
| `createdAt` | Date | Timestamp automatically set when the membership document is created. |
| `updatedAt` | Date | Timestamp automatically updated when the membership document changes. |
| `__v` | Number | Mongoose document version key, when present. |

## Tier

Collection: `tiers`

A Tier document defines a membership plan offered by an organisation, including its price, billing interval, benefits, and availability. Memberships and checkouts refer to a tier to determine what a member purchases, while event access can depend on the member's tier.

| Field Name | Data Type | Short description |
| --- | --- | --- |
| `_id` | String | Unique tier identifier. |
| `name` | String | Display name of the membership plan. |
| `organisationId` | String | Identifier of the organisation offering the tier. |
| `slug` | String | URL-friendly tier name. |
| `price` | Number | Price per billing interval in MYR; zero denotes a free plan. |
| `interval` | String | Billing interval, normally `monthly` or `yearly`; schema default is `yearly`. |
| `pricingKey` | String | Normalised interval and price in cents, such as `monthly:1000`, used to prevent duplicate pricing within an organisation. |
| `description` | String | Short explanation of the plan. |
| `perks` | String[] | Benefits included with the plan. |
| `isActive` | Boolean | Whether the tier is available for membership selection; defaults to `true`. |
| `maxMembers` | Number or null | Optional member limit; `null` means no configured limit. |
| `createdAt` | Date | Document creation time maintained by Mongoose. |
| `updatedAt` | Date | Most recent document update time maintained by Mongoose. |
| `__v` | Number | Mongoose document version key, when present. |

## Event

Collection: `events`

An Event document stores an organisation's event details, daily schedule, venue, capacity, and membership access rules. It embeds RSVP records so the application can track reservations, check attendance eligibility, and calculate available places.

| Field Name | Data Type | Short description |
| --- | --- | --- |
| `_id` | String | Unique event identifier. |
| `title` | String | Name of the event. |
| `organisationId` | String | Identifier of the organisation hosting the event. |
| `description` | String | Description of the event and its activities. |
| `date` | String | Event start date in `YYYY-MM-DD` format; retained for compatibility. |
| `time` | String | Display time range, generated from the first day's schedule for current events. |
| `startDate` | String | First event date in `YYYY-MM-DD` format. |
| `endDate` | String | Last event date in `YYYY-MM-DD` format. |
| `timeZone` | String | IANA time zone used to interpret the event schedule. |
| `schedule` | Object[] | Daily event sessions; these embedded records have no automatic `_id`. |
| `schedule[].date` | String | Session date in `YYYY-MM-DD` format. |
| `schedule[].startTime` | String | Session start time in local `HH:mm` format. |
| `schedule[].endTime` | String | Session end time in local `HH:mm` format. |
| `location` | String | Venue name or address. |
| `locationPlaceId` | String | Selected map place identifier, if available. |
| `locationLatitude` | Number or null | Venue latitude, from -90 to 90; `null` when unset. |
| `locationLongitude` | Number or null | Venue longitude, from -180 to 180; `null` when unset. |
| `category` | String | Event category, such as `Networking`. |
| `capacity` | Number | Maximum number of reservations; schema default is 100. |
| `allowedTiers` | String[] | Eligible tier names; also preserves the exact-name policy of older events. |
| `tierAccess` | String | Access policy: `all` or `minimum`; older records may omit this field. |
| `minimumTierId` | String | Lowest eligible tier when the access policy is `minimum`. |
| `imageUrl` | String | Event header image, currently saved as an uploaded image data URL. |
| `rsvps` | Object[] | Embedded reservation records for the event. |
| `rsvps[]._id` | ObjectId | Identifier automatically assigned by Mongoose to an RSVP subdocument. |
| `rsvps[].userId` | String | Identifier of the user who reserved a place. |
| `rsvps[].userName` | String | User's name recorded with the reservation. |
| `rsvps[].userEmail` | String | User's email address recorded with the reservation. |
| `rsvps[].rsvpDate` | String | ISO 8601 date and time when the reservation was made. |
| `createdAt` | Date | Document creation time maintained by Mongoose. |
| `updatedAt` | Date | Most recent document update time maintained by Mongoose. |
| `__v` | Number | Mongoose document version key, when present. |

## OrganisationPost

Collection: `organisationposts`

An OrganisationPost document stores a news item or announcement published by an organisation owner for its members. It holds the post's text, optional rich content and image, author details, and a flag used to retry delivery of in-app notifications.

| Field Name | Data Type | Short description |
| --- | --- | --- |
| `_id` | String | Unique post identifier. |
| `organisationId` | String | Identifier of the organisation publishing the post. |
| `title` | String | Post headline, limited to 120 characters. |
| `subtitle` | String | Supporting summary, limited to 200 characters. |
| `description` | String | Plain-text post body, limited to 1,000 characters. |
| `descriptionContent` | Mixed | Optional structured rich-text JSON containing formatted text and embedded images. |
| `imageUrl` | String | Optional post image, currently saved as an uploaded image data URL. |
| `authorId` | String | Identifier of the user who published the post. |
| `authorName` | String | Author's display name recorded with the post. |
| `notificationQueued` | Boolean | Whether member notifications still need delivery; cleared after successful processing. |
| `createdAt` | Date | Document creation time maintained by Mongoose. |
| `updatedAt` | Date | Most recent document update time maintained by Mongoose. |
| `__v` | Number | Mongoose document version key, when present. |

## PaymentCheckout

Collection: `paymentcheckouts`

A PaymentCheckout stores a short-lived, server-calculated membership payment quote and its processing state. It captures the user, organisation, target tier, price, available credit, and original membership state so confirmation can reject stale quotes and apply a successful payment once. Checkouts support demo card, online banking, and e-wallet payments; they do not store card numbers, verification codes, or banking credentials.

| Field Name | Data Type | Short description |
| --- | --- | --- |
| `_id` | String | Required checkout identifier, generated with a `pay_` prefix. |
| `reference` | String | Required, unique payment reference shown during checkout. |
| `membershipId` | String | Identifier of the organisation membership being paid for. |
| `organisationId` | String | Identifier of the organisation associated with the payment. |
| `organisationName` | String | Organisation name captured when checkout was created. |
| `userId` | String | Identifier of the user authorised to complete this checkout. |
| `userName` | String | User's name captured when checkout was created. |
| `userEmail` | String | User's email captured when checkout was created. |
| `tierId` | String | Identifier of the target membership tier. |
| `tierName` | String | Target tier name captured for the quote. |
| `amountCents` | Number | Amount due after applied credit, in MYR cents. |
| `intent` | String | Payment purpose: `join`, `renew`, or `upgrade`. |
| `subtotalCents` | Number | Full target tier price before credit, in cents. |
| `creditCents` | Number | Credit applied against the subtotal, in cents. |
| `unusedCreditCents` | Number | Verified unused paid value available for an upgrade, in cents. |
| `creditBalanceCents` | Number | Membership credit balance when the quote was created, in cents. |
| `creditUnavailable` | Boolean | Whether a paid upgrade lacks verifiable remaining paid periods for credit. |
| `carryForwardCents` | Number | Unused credit to retain after successful payment, in cents. |
| `periodStart` | String (ISO 8601) | Proposed start of the purchased membership period. |
| `periodEnd` | String (ISO 8601) | Proposed end of the purchased membership period. |
| `previousPeriodStart` | String (ISO 8601) | Start of the previously active paid period, when available. |
| `previousPeriodEnd` | String (ISO 8601) | End of the previously active paid period, when available. |
| `remainingDays` | Number | Days remaining in that period at quotation, including fractional days. |
| `totalDays` | Number | Total length of that period in days, including fractional days. |
| `sourceTierId` | String | Membership tier identifier captured to detect later membership changes. |
| `sourceTierName` | String | Membership tier name before this purchase. |
| `sourceExpirationDate` | String (ISO 8601) | Original membership expiry captured to detect stale quotes. |
| `sourceMembershipStatus` | String | Original membership status captured to detect stale quotes. |
| `sourceScheduledTierId` | String | Scheduled tier identifier captured to detect changed downgrade plans. |
| `sourceScheduledTierEffectiveAt` | String (ISO 8601) | Scheduled tier change date captured to detect changed downgrade plans. |
| `scheduledDowngrade` | Boolean | Whether renewal will apply a scheduled cheaper tier. |
| `sourceBillingRevision` | Number | Membership billing revision captured to detect stale quotes. |
| `sourcePeriods` | Object[] | Verified paid period snapshots used for credit and renewal calculations. |
| `sourcePeriods[].tierId` | String | Membership tier identifier for the captured paid period. |
| `sourcePeriods[].periodStart` | String (ISO 8601) | Start of the captured paid period. |
| `sourcePeriods[].periodEnd` | String (ISO 8601) | End of the captured paid period. |
| `sourcePeriods[].valueCents` | Number | Nonnegative recorded service value of the paid period, in cents. |
| `sourcePeriods[].billingInterval` | String | Billing frequency associated with the captured paid period. |
| `billingInterval` | String | Required target billing frequency: `monthly` or `yearly`. |
| `expiresAt` | String (ISO 8601) | Quote deadline; at most 15 minutes, earlier for an expiring upgrade. |
| `state` | String | Checkout state: `pending`, `paid`, `failed`, `cancelled`, or `expired`. |
| `paymentMethod` | String | Selected demo method: `card`, `online_banking`, or `ewallet`. |
| `completedAt` | String (ISO 8601) | Time checkout was paid, failed, or cancelled. |
| `createdAt` | Date | Time Mongoose created the checkout document. |
| `updatedAt` | Date | Time Mongoose last updated the checkout document. |
| `__v` | Number | Mongoose document version key, when present. |

## Invoice

Collection: `invoices`

An Invoice records a membership payment result for a user within an organisation. It preserves the billed tier, amount, payment status, purchased membership period, and any credit applied to a join, renewal, or upgrade. The current payment gateway creates simulated invoices for approved and declined demo payments; an invoice links back to its checkout so repeated confirmation cannot create duplicate billing records.

| Field Name | Data Type | Short description |
| --- | --- | --- |
| `_id` | String | Unique invoice document identifier. |
| `invoiceNumber` | String | Required, unique invoice reference shown to the user. |
| `organisationId` | String | Identifier of the organisation receiving the membership payment. |
| `userId` | String | Identifier of the billed user. |
| `userName` | String | User's name captured for the billing record. |
| `userEmail` | String | User's email captured for the billing record. |
| `tierId` | String | Identifier of the purchased membership tier. |
| `tierName` | String | Purchased tier name captured for the billing record. |
| `amount` | Number | Amount due after credit, in major currency units, such as MYR. |
| `currency` | String | Currency code; defaults to `MYR`. |
| `billingInterval` | String | Purchased billing frequency; defaults to `yearly`. |
| `paymentMethod` | String | Display label for the payment method used. |
| `paymentStatus` | String | Payment result: `paid`, `pending`, or `failed`; defaults to `paid`. |
| `transactionId` | String | Payment transaction reference; the demo uses the checkout reference. |
| `periodStart` | String (ISO 8601) | Start of the purchased membership period after successful payment. |
| `periodEnd` | String (ISO 8601) | End of the purchased membership period after successful payment. |
| `paidAt` | String (ISO 8601) | Time successful payment was confirmed. |
| `paymentCheckoutId` | String | Checkout identifier; unique when present as a string. |
| `intent` | String | Payment purpose: `join`, `renew`, or `upgrade`. |
| `subtotalCents` | Number | Full purchased tier price before credit, in cents. |
| `creditCents` | Number | Credit applied against the subtotal, in cents. |
| `unusedCreditCents` | Number | Verified unused paid membership value available for an upgrade, in cents. |
| `creditBalanceCents` | Number | Existing membership credit balance before this purchase, in cents. |
| `creditUnavailable` | Boolean | Optional unavailable-credit flag; current invoice writer does not copy it from checkout. |
| `carryForwardCents` | Number | Credit remaining after this purchase, in cents. |
| `coverageValueCents` | Number | Purchased period's full service value, including credit-funded value, in cents. |
| `sourceTierId` | String | Membership tier identifier before the quoted payment. |
| `sourceTierName` | String | Membership tier name before the quoted payment. |
| `scheduledDowngrade` | Boolean | Whether this renewal applies a previously scheduled cheaper tier. |
| `previousPeriodStart` | String (ISO 8601) | Start of the previously active paid period, when available. |
| `previousPeriodEnd` | String (ISO 8601) | End of the previously active paid period, when available. |
| `remainingDays` | Number | Days remaining in that period at quotation, including fractional days. |
| `totalDays` | Number | Total length of that period in days, including fractional days. |
| `simulated` | Boolean | Marks invoices produced by the demonstration payment gateway. |
| `createdAt` | Date | Time Mongoose created the invoice document. |
| `updatedAt` | Date | Time Mongoose last updated the invoice document. |
| `__v` | Number | Mongoose document version key, when present. |

## Notification

Collection: `notifications`

A Notification document stores one user's in-app alert about an organisation post, an upcoming event, or a membership change. It records the related organisation and source document so the interface can open the relevant content, while its read timestamp supports unread counts. Deterministic identifiers let background workers retry notification creation without duplicating the same alert for a user.

| Field Name | Data Type | Short description |
| --- | --- | --- |
| `_id` | String | Deterministic SHA-256 identifier derived from the recipient and notification event. |
| `userId` | String | Identifier of the user who receives the notification. |
| `type` | String | Alert category: `post`, `event`, or `membership`. |
| `title` | String | Short heading shown in the notification list. |
| `message` | String | Text explaining the alert. |
| `organisationId` | String | Identifier of the organisation associated with the alert. |
| `organisationName` | String | Stored organisation name displayed with the alert. |
| `postId` | String | Identifier of the related organisation post, when applicable. |
| `eventId` | String | Identifier of the related event, when applicable. |
| `membershipId` | String | Identifier of the related organisation membership, when applicable. |
| `readAt` | Date or null | When the user read the alert; `null` means unread. |
| `createdAt` | Date | Creation timestamp; post alerts use the post's creation time. |
| `updatedAt` | Date | Timestamp automatically updated when the notification changes. |
| `__v` | Number | Mongoose document version key, when present. |

## EmailNotification

Collection: `emailnotifications`

An EmailNotification document keeps a member-visible copy of an organisation welcome message, renewal reminder, payment receipt, or RSVP confirmation and records the delivery outcome. It helps the application display email history and distinguish provider acceptance, failure, and unavailable delivery. Verification and password reset messages use the mail transport directly and are not stored in this collection.

| Field Name | Data Type | Short description |
| --- | --- | --- |
| `_id` | String | Unique email notification identifier. |
| `organisationId` | String | Identifier of the organisation associated with the message. |
| `recipientEmail` | String | Email address of the intended recipient. |
| `recipientName` | String | Recipient's display name. |
| `type` | String | Message category, such as `REGISTRATION_WELCOME`, `MEMBERSHIP_RENEWAL`, `PAYMENT_CONFIRMATION`, or `EVENT_RSVP`. |
| `subject` | String | Email subject line. |
| `htmlContent` | String | HTML message body retained for the in-app email history. |
| `status` | String | Delivery state used by the app: `pending`, `sent`, `failed`, or `unavailable`; `sent` means provider acceptance. |
| `deliveryMethod` | String | Selected delivery transport: `smtp` or `gmail-api`; may be absent from historical records. |
| `sentAt` | String (ISO 8601 date-time) | When the provider accepted the message; does not confirm inbox delivery. |
| `createdAt` | Date | Timestamp automatically set when the email record is created. |
| `updatedAt` | Date | Timestamp automatically updated when the email record changes. |
| `__v` | Number | Mongoose document version key, when present. |

## ActivityLog

Collection: `activitylogs`

An ActivityLog document records a significant account, membership, administration, payment, or communication action. These records support audit history and troubleshooting by identifying the action, its organisation and associated user, when it happened, and additional context.

| Field Name | Data Type | Short description |
| --- | --- | --- |
| `_id` | String | Unique activity record identifier. |
| `action` | String | Action code, such as `POST_CREATED`, `STATUS_UPDATED`, or `PAYMENT_SUCCESS`. |
| `organisationId` | String | Organisation associated with the action, if applicable. |
| `userId` | String | Associated user's identifier; may identify the actor or affected member depending on the action. |
| `userName` | String | Associated user's name recorded for the action. |
| `userEmail` | String | Associated user's email address recorded for the action. |
| `actorRole` | String | Role category recorded for the actor, typically `admin`, `member`, or `system`. |
| `details` | Mixed (Object) | Action-specific context, such as changed fields, tier identifiers, payment amounts, or administrator identifiers. |
| `ipAddress` | String | Recorded request IP address; defaults to `127.0.0.1` when not supplied. |
| `timestamp` | String | ISO 8601 time of the activity; defaults to the current time. |
| `createdAt` | Date | Document creation time maintained by Mongoose. |
| `updatedAt` | Date | Most recent document update time maintained by Mongoose. |
| `__v` | Number | Mongoose document version key, when present. |
