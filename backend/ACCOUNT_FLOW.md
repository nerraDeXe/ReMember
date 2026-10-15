# Account and organisation setup

New users create an account with first name, last name, email, password and country. Phone and bio are optional; bios are limited to 500 characters. No membership tier or organisation is assigned at signup.

New and reset passwords must contain at least 8 characters, a capital letter, a digit and a symbol, with a maximum of 72 UTF-8 bytes. Existing passwords still work until changed. Phone entry uses the selected country's calling code and is validated against that country's numbering plan. Saved numbers use `+` followed by digits, with no hyphens and at most 15 digits including the country code (the plus sign does not count). The same validation applies when editing a personal profile.

Both password and Google login create a 24-hour ReMember session. Selecting Remember Me on the login page creates a 30-day session instead, including when a new Google user completes their profile. Confirmation of an email does not extend the session. The browser signs out when the session expires, and the backend enforces the same deadline. Legacy `JWT_EXPIRES_IN` settings no longer control these durations.

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

## Password reset emails

The login page has a Forgot password link. Configure `APP_WEB_URL` to the frontend URL users can open:

```dotenv
APP_WEB_URL=http://localhost:5173
```

Use your actual HTTPS frontend URL in production. This setting is separate from `APP_ORIGIN` used by Google Wallet. The existing SMTP settings deliver password reset emails. Each reset link expires after 30 minutes, can be used once, and lives in the URL fragment so the reset token is not sent in ordinary HTTP access logs. Only a hash is saved in MongoDB; the token is not returned through the API or saved in the notification inbox. Requests have a one-minute cooldown and the same response for unknown emails. A completed reset invalidates all earlier account sessions and requires a fresh login. Google-only accounts should use Google sign-in; this form does not silently add a password to them.

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
