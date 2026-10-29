# Account and organisation setup

New users create an account with first name, last name, email, password and country. Phone and bio are optional; bios are limited to 500 characters. No membership tier or organisation is assigned at signup.

New and reset passwords must contain at least 8 characters, a capital letter, a digit and a symbol, with a maximum of 72 UTF-8 bytes. Existing passwords still work until changed. Phone entry uses the selected country's calling code and is validated against that country's numbering plan. Saved numbers use `+` followed by digits, with no hyphens and at most 15 digits including the country code (the plus sign does not count). The same validation applies when editing a personal profile.

Both password and Google login create a 24-hour ReMember session. Selecting Remember Me on the login page creates a 30-day session instead, including when a new Google user completes their profile. Confirmation of an email does not extend the session. The browser signs out when the session expires, and the backend enforces the same deadline. Legacy `JWT_EXPIRES_IN` settings no longer control these durations.

Users confirm their email with a six-digit code before they can create or join an organisation. Codes expire after 30 minutes, allow five attempts, and can be resent after one minute. Existing accounts also need to confirm their email before using organisation features.

After confirmation, users may create an organisation or browse public organisations. Setup requires at least one tier with a name, a MYR amount (0 for free), and a monthly or yearly interval. Creating an organisation grants its owner access to that organisation's admin dashboard. One account can own organisations and belong to others as a member.

The account home has My Organisations and My Memberships tabs. My Organisations contains owned organisation profiles, visibility, and Open Admin Portal actions. Owners arrive here after signing in. My Memberships contains joined memberships with Open Member Portal actions and Find Your Organisation discovery. Accounts without a selected organisation or owned organisations arrive at My Memberships; members with a selected organisation retain their dashboard after signing in. Both tabs remain open when the organisation context changes. Each portal identifies its organisation and contains only that organisation's dashboard, members, tiers, events, finances, and audit log. The navbar and sidebar return to the account home to choose a different portal. Owners are not automatically subscribed to a tier.

Membership, tier, event, invoice and admin permissions belong to the selected organisation. Free tiers activate on joining. Paid tiers remain pending until the in-app demo gateway confirms an approved payment; pending members can access checkout and their personal account, but cannot open the member dashboard or community content. Checkout supports preset card, online banking and e-wallet demos in MYR, a verification step, processing and receipts. No money is charged, and no real payment credentials are collected. Owners do not need a payment-provider account. Monthly/yearly membership periods renew through another member-initiated checkout; there are no automatic charges. See the [payment gateway guide](../docs/PAYMENT_GATEWAY.md).

The member portal combines its digital pass and subscription management at `/member/membership`. The overview shows subscription history and billing dates without starting a payment. Members explicitly choose an upgrade or overdue renewal. Upgrades begin a new billing period and apply verified unused paid time as credit; remaining excess credit is preserved. Paid cancellations retain access until expiry and can be undone before then. Free cancellations end access immediately. Cancelled memberships remain selectable for history and rejoining, but do not grant active community access after their paid period ends.

The admin directory reports **Cancelled** as soon as a member cancels, including paid cancellations scheduled for expiry. These rows show the remaining access date. Member access continues to follow the paid period independently of this reporting label. The Cancelled filter, CSV exports and status analytics use the same reporting rule; undoing cancellation restores the Active label. The directory refreshes while visible and when returning to the tab. Admin approval cannot silently undo a member's cancellation.

Members can schedule a cheaper tier for their next renewal. Current tier permissions and the paid expiry remain unchanged while the change is pending. After expiry, the selected cheaper paid tier is used for manual renewal checkout; free tiers activate without payment when the account refreshes. Pending changes can be cancelled or replaced. Subscription cancellation, a confirmed immediate upgrade or an administrative membership change removes the pending downgrade. Scheduling changes invalidate older checkout quotes, and unavailable tiers never silently grant access.

## Verification email setup

Use one mail transport in `backend/.env` or the deployment environment. For Gmail on Render Free, use the Gmail API over HTTPS:

```dotenv
MAIL_TRANSPORT=gmail-api
GMAIL_CLIENT_ID=your-mail-oauth-client-id.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=your-mail-oauth-client-secret
GMAIL_REFRESH_TOKEN=your-authorized-mailbox-refresh-token
EMAIL_FROM="ReMember <your-account@gmail.com>"
```

Follow the [Gmail API setup guide](../docs/GMAIL_API_SETUP.md) to enable the API, grant the sending mailbox's permission and obtain a refresh token with the local helper. These server credentials are separate from member Google sign-in. Set the sender to that mailbox or a verified send-as alias. Google OAuth apps in Testing normally issue Gmail refresh tokens that expire after seven days; the guide explains the production setup.

For SMTP on a host that allows outbound SMTP, use:

```dotenv
MAIL_TRANSPORT=smtp
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-user
SMTP_PASSWORD=your-smtp-password
EMAIL_FROM="ReMember <verified-sender@your-domain.com>"
```

For port 465, set `SMTP_SECURE=true`. Use the SMTP credentials and sender address supplied by your email provider, then restart the backend. TLS is required by default; `SMTP_REQUIRE_TLS=false` is only for a local test mail server that does not support TLS.

For Gmail, use `SMTP_HOST=smtp.gmail.com`, your full Gmail address as `SMTP_USER`, a [Google App Password](https://support.google.com/accounts/answer/185833) as `SMTP_PASSWORD`, and that address in `EMAIL_FROM`. App Passwords require 2-Step Verification and may be restricted by account policy. `EMAIL_FROM` controls the actual sender; `EMAIL_SENDER_ADDRESS` does not replace it.

[Render Free blocks Gmail's SMTP ports](https://render.com/docs/free). Use the implemented Gmail API transport there, or a paid web service compute plan for SMTP. `MAIL_TRANSPORT=auto` (the default) chooses Gmail API when Gmail OAuth settings are present, otherwise SMTP. The explicit setting avoids ambiguity when migrating existing SMTP deployments. See the [Render email setup and troubleshooting guide](../docs/RENDER_DEPLOYMENT.md).

Until mail delivery is configured, signup saves an unverified account and reports that the verification email could not be sent. Codes are never returned in API responses or saved with email delivery records.

## Automated confirmation emails

Event RSVPs and successful test payments use the same selected mail transport to send confirmations to the account email address. Email delivery records track whether the provider accepted the email, rejected it, or was unavailable. Provider acceptance does not confirm inbox placement. Check spam or the provider's delivery logs if an accepted message is missing.

A mail failure does not undo an RSVP or payment. Their API responses include `emailDelivery` and report mail failures separately. Historical records created before SMTP dispatch was connected were never emailed and are not automatically resent. Account verification and password reset messages are not saved with these delivery records.

## Organisation email settings

Organisation owners can open Communication → Email Settings in their admin portal to customise the subject and message for welcome emails and renewal reminders. These settings belong only to the selected organisation. Templates support `{memberName}`, `{organisationName}`, `{tierName}`, `{expiryDate}` and `{renewalDays}`. Messages use the selected mail transport and respect the member's email notification preference.

Welcome emails are enabled by default and attempted once when a new member's membership becomes active: immediately for a free tier, or after the first successful payment for a paid tier. Failed or unavailable welcome emails are recorded and are not automatically retried. Renewal reminders are initially disabled. Owners can enable them and choose 1–365 days before membership expiry (30 days by default). The running backend checks for due reminders every minute, records successful reminders for each membership expiry, and retries failed reminders after an hour while the membership is still valid. Suspended, expired or revoked memberships and organisation owners do not receive reminders.

## Communication and organisation posts

The admin portal's Communication menu contains Posts and Email Settings. Owners can publish, edit or delete a notice with a required title (up to 120 characters), subtitle (up to 200 characters), and description (up to 1,000 text characters, including spaces and line breaks). The description toolbar supports bold, italic, underline, numbered lists, and inserting up to three JPEG, PNG or WebP images of 2 MB each at the cursor. Formatting and inline images persist when editing and appear in the member feed. Existing plain-text descriptions remain readable and editable. The optional post cover image remains separate and has the same 2 MB image limit. Publishing makes a notice immediately visible in the selected organisation's member Communication feed; it does not send an email.

Descriptions are saved as validated structured content with a plain-text fallback. Only supported formatting and image attributes are accepted, and uploaded image bytes are checked by the API. The posts endpoint allows a 12 MB JSON request to accommodate a cover and three inline images after base64 encoding; other JSON endpoints retain their 10 MB limit.

Posts appear newest first with pagination. Members with accessible active, pending or expired memberships can read their organisation's notices; suspended or revoked associations cannot grant access. Members cannot create, edit or delete posts, and public organisation discovery does not expose them. Every request is scoped to the selected organisation, and the editor includes its organisation context to reject requests from stale pages after a selection change. Deleting an organisation removes its posts in the same transaction. Both portals group navigation by purpose and include a mobile page selector.

## Community events

Owners can upload an optional JPEG, PNG or WebP event header image of up to 2 MB. New events do not accept remote image URLs. Existing event images and legacy date/time text remain readable.

Event creation uses start and end dates and a separate pair of time selectors for every day in the inclusive range, up to 31 days. Same-day events use one pair. Each day's end time must be later than its start time. The chosen time zone is stored with the schedule and shown with event details; the default is Asia/Kuala_Lumpur. Member event listings, confirmed reservations and RSVP confirmation emails include the daily schedule.

New events must start tomorrow or later on the selected event's calendar; today and past dates are rejected by both the form and API. Rescheduling the start or changing its time zone follows the same rule, while unrelated corrections to existing past events remain allowed. Nonexistent local times during daylight saving changes are rejected. Registrations close at the first scheduled start, including for multi-day events between sessions. The API and database enforce the cutoff, so leaving an old page open cannot reserve a place after it begins.

Both portals show Upcoming, In progress or Ended using the stored event time zone and the final scheduled end. Their labels and RSVP controls update while the page stays open. Ended events remain in the event history and admin RSVP reports, while the member dashboard's upcoming list excludes them. Legacy events without an unambiguous stored time zone close RSVPs at the start of their default local date and are treated as ended after that date.

The location field searches OpenStreetMap venues and addresses when the owner presses Search or Enter. Selecting a result stores its label and coordinates. Editing the label clears the selected coordinates; owners can also enter an address manually. Members can open the saved venue in Google Maps from event details and confirmation emails. Selected search results use the exact coordinates for that link and display OpenStreetMap attribution.

Venue search uses a server proxy to Nominatim, with an identifying User-Agent, a bounded result cache, shared request throttling and a timeout. It needs no API key. The [public Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/) permits moderate, user-triggered searches, requires attribution and limits the whole application to one request per second. Autocomplete and bulk searches are prohibited. Run only one backend instance against the public endpoint; for multiple instances or higher traffic, set `NOMINATIM_BASE_URL` to a self-hosted or suitable hosted Nominatim-compatible search endpoint. This setting is the full `/search` URL and can be changed without a code update. Set `NOMINATIM_USER_AGENT` to identify your deployment with a public site URL or contact address; otherwise the service identifies itself as ReMember using `APP_WEB_URL`. Search only venue or address information intended for the event, since submitted queries are sent to the selected provider. Search failure leaves manual address entry available.

An event can allow all membership tiers or a selected minimum tier and every higher tier in the same organisation. Tier order uses the equivalent monthly price; monthly and yearly tiers with the same monthly price are equally eligible. The form previews eligible active tiers. The API checks eligibility when listing events and when accepting an RSVP, using tier IDs so renaming a tier does not change access. Existing active memberships in a deactivated tier retain their price-based eligibility. A deleted minimum tier cannot grant access. Event requests include organisation context so stale forms cannot publish to a newly selected organisation.

## Password reset emails

The login page has a Forgot password link. Configure `APP_WEB_URL` to the frontend URL users can open:

```dotenv
APP_WEB_URL=http://localhost:5173
```

Use your actual HTTPS frontend URL in production. This setting is separate from `APP_ORIGIN` used by Google Wallet. The selected mail transport delivers password reset emails. Each reset link expires after 30 minutes, can be used once, and lives in the URL fragment so the reset token is not sent in ordinary HTTP access logs. Only a hash is saved in MongoDB; the token is not returned through the API or saved with email delivery records. Requests have a one-minute cooldown and the same response for unknown emails. A completed reset invalidates all earlier account sessions and requires a fresh login. Google-only accounts should use Google sign-in; this form does not silently add a password to them.

## Google sign-in setup

1. Open Google Cloud Console / Google Auth Platform and configure the app's branding and audience (consent screen). If your app is in testing, add the Google accounts that will test it.
2. Create an OAuth client with application type **Web application**. Under **Authorized JavaScript origins**, add `http://localhost` and `http://localhost:5173` for local development. Add the exact HTTPS frontend origin when deploying. Origins contain no path. The popup flow does not need a redirect URI.
3. Copy its client ID into `backend/.env`:

   ```dotenv
   GOOGLE_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
   ```

4. Restart the backend and reload the frontend. No client secret or frontend environment variable is required for this Google Identity Services flow. This OAuth client ID is separate from Google Wallet credentials.

The login and register pages display Google's sign-in button. New Google users review editable first/last names and supply a country, optional phone, and optional bio before an account is created. Google supplies the email, which the form cannot change. Existing account emails are highlighted and redirected to the appropriate sign-in method; a Google identity is not silently linked to an existing password account. Google accounts are identified by their stable Google subject ID. A third-party email used with Google, outside Gmail or verified Workspace, still completes ReMember email verification.

Google credentials are verified on the backend with Google's official authentication library, including the client ID audience. Short-lived nonces and MongoDB challenges prevent reuse of a sign-in attempt. Signup completion has its own short-lived token and cannot be used as an account session. Temporary challenges expire automatically. The browser requires access to `https://accounts.google.com/gsi/client` and Google account services.

Official setup: https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid
Server verification: https://developers.google.com/identity/gsi/web/guides/verify-google-id-token

MongoDB must be reachable. Account data and uploaded profile photos are stored in MongoDB; there is no local database fallback. Old global tiers and account subscriptions are not automatically assigned to new organisations. Existing owners identified by an organisation's `adminId` retain ownership after email confirmation.

Organisation owners can upload, replace or remove a logo and banner from the edit form on My Organisations. JPEG, PNG and WebP images up to 2 MB each are saved as data URLs in the organisation's MongoDB record. Empty images display icons in the editor and directories. Existing HTTP(S) image URLs remain supported when editing other details.

## Checks

Run `npm test` in `backend`, and `npm test` and `npm run build` in `frontend`. The frontend tests cover account validation, expiry parsing, recovery and portal navigation. The backend tests exercise passwords, phone numbers, session lengths, verification, recovery and Google flows using mocked MongoDB, SMTP and Google token verification; they do not write to Atlas, send email, or call live Google services. A live Google popup sign-in requires your configured OAuth client ID and authorized frontend origin.
