# Account and organisation setup

New users create an account with first name, last name, email, password and country. Phone and bio are optional; bios are limited to 500 characters. No membership tier or organisation is assigned at signup.

Users confirm their email with a six-digit code before they can create or join an organisation. Codes expire after 30 minutes, allow five attempts, and can be resent after one minute. Existing accounts also need to confirm their email before using organisation features.

After confirmation, users may create an organisation or browse public organisations. Setup requires at least one tier with a name, a USD amount (0 for free), and a monthly or yearly interval. Creating an organisation grants its owner access to that organisation's admin dashboard. One account can own organisations and belong to others as a member.

My Organisations is a standalone account page for organisation profiles, visibility, and choosing a portal. Owners arrive here after signing in, then choose Open Admin Portal for an organisation. Each portal identifies its organisation and contains only that organisation's dashboard, members, tiers, events, finances, and audit log. The navbar and sidebar return to My Organisations to choose a different portal. Joined organisations are listed separately with Open Member Portal. Owners are not automatically subscribed to a tier.

Membership, tier, event, invoice and admin permissions belong to the selected organisation. Free tiers activate on joining. Paid tiers remain pending until checkout completes. The existing checkout is a simulation and does not charge a payment card.

## Verification email setup

Set these variables in `backend/.env` or the deployment environment:

```dotenv
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-user
SMTP_PASSWORD=your-smtp-password
EMAIL_FROM="ReMember <verified-sender@your-domain.com>"
```

For port 465, set `SMTP_SECURE=true`. Use the SMTP credentials and sender address supplied by your email provider, then restart the backend. TLS is required by default; `SMTP_REQUIRE_TLS=false` is only for a local test mail server that does not support TLS.

Until SMTP is configured, signup saves an unverified account and reports that the verification email could not be sent. Codes are never returned in API responses or exposed in the in-app email inbox.

MongoDB must be reachable. Account data and uploaded profile photos are stored in MongoDB; there is no local database fallback. Old global tiers and account subscriptions are not automatically assigned to new organisations. Existing owners identified by an organisation's `adminId` retain ownership after email confirmation.

Organisation owners can upload, replace or remove a logo and banner from the edit form on My Organisations. JPEG, PNG and WebP images up to 2 MB each are saved as data URLs in the organisation's MongoDB record. Empty images display icons in the editor and directories. Existing HTTP(S) image URLs remain supported when editing other details.

## Checks

Run `npm test` in `backend`, and `npm test` and `npm run build` in `frontend`. The frontend tests cover account and portal navigation. The backend tests use mocked model operations and mail delivery; they do not write to Atlas or send email.
