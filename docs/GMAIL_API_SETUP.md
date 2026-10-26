# Gmail email on Render Free

ReMember can send verification, password reset, RSVP, payment, welcome and renewal emails through the Gmail API over HTTPS. This works with Render Free's network restrictions; [Render blocks outbound SMTP ports 25, 465 and 587 on Free web services](https://render.com/docs/free). Your Gmail or Google Workspace sending limits still apply.

Only the app's sending mailbox needs to authorize Gmail access. Members do not need to connect their own mailboxes. This authorization is separate from member Google sign-in (`GOOGLE_CLIENT_ID`) and Google Wallet. Keep their existing settings.

## 1. Configure Google Cloud

1. Open [Google Cloud Console](https://console.cloud.google.com/) and select or create a project for the sending mailbox integration.
2. Open APIs & Services → Library, find **Gmail API**, and enable it.
3. Open **Google Auth Platform** and configure Branding, Audience and Data Access. For a personal Gmail account, use an External audience. While the app is in Testing, add the Gmail account that will send messages as a test user.
4. Add only this sending scope under Data Access:

   ```text
   https://www.googleapis.com/auth/gmail.send
   ```

   This scope allows sending mail without reading the inbox. Google classifies it as sensitive; follow any verification requirements shown for your app and audience. See [Gmail scopes](https://developers.google.com/workspace/gmail/api/auth/scopes).

5. Create an OAuth client of type **Web application** for ReMember's server mail integration. Add this exact **Authorized redirect URI**:

   ```text
   http://127.0.0.1:53682/oauth2/callback
   ```

   Keep the scheme, IP, port and path exactly as written. The local setup helper receives the callback on your computer. Google permits local HTTP callbacks for testing; other web callbacks require HTTPS. See [Google's server OAuth setup](https://developers.google.com/identity/protocols/oauth2/web-server).

6. Save the client ID and client secret privately when Google displays them. Use a separate mail client rather than replacing your member sign-in client.

## 2. Authorize the sender locally

Do this on your computer, where you can open Google's consent page. The helper is not a Render startup or build command.

1. Install the existing backend dependencies if needed:

   ```sh
   npm ci --prefix backend
   ```

2. Create or edit the ignored `backend/.env` file. Preserve existing database and other app settings. Add:

   ```dotenv
   GMAIL_CLIENT_ID=your-mail-oauth-client-id.apps.googleusercontent.com
   GMAIL_CLIENT_SECRET=your-mail-oauth-client-secret
   EMAIL_FROM="ReMember <your-account@gmail.com>"
   ```

   Use the Gmail account you will authorize as `EMAIL_FROM`. If using a different From address, it must be an alias already configured and verified for that mailbox; see [Gmail send-as settings](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.settings.sendAs).

3. From the repository root, run:

   ```sh
   node backend/scripts/gmail-oauth.mjs
   ```

4. Open the printed consent link on the same computer. Sign in as the sending mailbox, check the requested permission, and grant it. Continue only for the Google Cloud app you just configured. The helper waits up to 10 minutes; Ctrl+C cancels it.
5. After authorization succeeds, the helper writes `MAIL_TRANSPORT=gmail-api` and `GMAIL_REFRESH_TOKEN` into the ignored `backend/.env`, preserving other settings. It binds only to the loopback address, validates OAuth state, and uses PKCE. It prints no access or refresh tokens and sends no test email.

Keep `backend/.env` private. Do not put any `GMAIL_*` values in frontend `VITE_*` variables, source control, screenshots or chat messages. `--help` prints instructions without starting authorization or editing the file.

## 3. Add the settings to Render

In the backend web service's **Environment**, copy these five settings from your private local file:

```dotenv
MAIL_TRANSPORT=gmail-api
GMAIL_CLIENT_ID=your-mail-oauth-client-id.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=your-mail-oauth-client-secret
GMAIL_REFRESH_TOKEN=the-refresh-token-saved-by-the-local-helper
EMAIL_FROM=ReMember <your-account@gmail.com>
```

Set `APP_WEB_URL` to the actual HTTPS website URL so password reset links open your deployed website. Save and redeploy. Render does not automatically receive values from your local `.env`.

The Gmail API transport does not use `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` or a Google App Password. `MAIL_TRANSPORT=gmail-api` explicitly selects it even if old SMTP values remain. With `MAIL_TRANSPORT=auto` (the default), Gmail OAuth settings select the Gmail API; otherwise the app uses SMTP. Prefer the explicit setting above for this deployment.

Open your deployed website and request a verification email using **Resend code**, respecting its one-minute cooldown. Confirm it arrives, and check spam if necessary. Other previously failed confirmation emails are not automatically replayed. A successful API response means Google accepted the message; it does not guarantee inbox placement.

## Keep authorization working

For an External app in **Testing**, Google normally expires Gmail refresh tokens after seven days. Before relying on ongoing mail delivery, change the intended app to **In production** and complete any verification or organisation policy requirements that apply. Then run the helper again and replace `GMAIL_REFRESH_TOKEN` in Render. Publishing alone does not extend a previously issued testing token. Google also lists revocation, inactivity, account changes and administrator policies as reasons tokens can stop working. See [Google's refresh-token expiration rules](https://developers.google.com/identity/protocols/oauth2#expiration).

This integration sends as one mailbox. Google consent may be revoked from that mailbox's Google account permissions; revoke it if you retire the app. If a token stops working, authorize again with the matching client ID and secret and update Render.

## Troubleshooting

### Repeated redirect mismatch with an apparently correct Web client

If the saved client ID and redirect URI match the request but Google still rejects it, the local helper also supports Google's [Desktop OAuth loopback flow](https://developers.google.com/identity/protocols/oauth2/native-app). This gives the local authorization tool a separate client; it does not require editing your website's Google sign-in client.

1. In the same Google Cloud project with Gmail API enabled, open Google Auth Platform → Clients → Create client and select **Desktop app**. Save its new client ID and client secret privately.
2. Replace only `GMAIL_CLIENT_ID` and `GMAIL_CLIENT_SECRET` in local `backend/.env` with the new Desktop client's pair. Keep `EMAIL_FROM` set to the sending Gmail address. Existing terminal environment variables take precedence over `.env`; ensure the client ID printed by the helper is the new one.
3. Stop any previous helper with Ctrl+C, then run from the repository root:

   ```sh
   node backend/scripts/gmail-oauth.mjs --desktop
   ```

4. Open its new consent link and authorize the sender. Desktop mode uses `http://127.0.0.1:53682/`; Desktop clients do not have a Web application's Authorized redirect URIs list.
5. After success, copy the new matching client ID, client secret and saved refresh token to Render, keep `MAIL_TRANSPORT=gmail-api` and `EMAIL_FROM`, then redeploy. A refresh token from the previous Web client must not be mixed with the Desktop client's credentials.

The helper still validates state, uses PKCE, listens only on loopback and requests only `gmail.send`. Testing audience and token-expiration rules above still apply.

### Other failures

| Symptom | Action |
| --- | --- |
| `redirect_uri_mismatch` on Google's page | Add exactly `http://127.0.0.1:53682/oauth2/callback` to this Web application client's Authorized redirect URIs. |
| Access denied while configuring an External app | Add the sending account as a test user, or check the app's publishing, verification and Workspace administrator restrictions. |
| Helper cannot listen on port 53682 | Close any other helper or application using that local port and run it again. |
| Helper receives no refresh token | Revoke the dedicated mail client's old grant in Google account permissions, then run the helper and grant consent again. |
| `invalid_grant` or authorization failure after deployment | Reauthorize the sender and update Render's refresh token. Confirm all three `GMAIL_*` values belong to the same client and authorization. Check the seven-day Testing rule. |
| API disabled, permission or sender failure | Enable Gmail API in the client's project, grant `gmail.send`, and use the authorized mailbox or its verified send-as alias. |
| Quota or rate-limit failure | Check Google's account sending limits and retry after the limit clears; requesting a new token does not increase quota. |
| App still reports SMTP connection errors | Check Render has `MAIL_TRANSPORT=gmail-api`, all three Gmail OAuth values and `EMAIL_FROM`, then redeploy the updated code. |

Render Free spins down after 15 idle minutes. User-triggered mail resumes with incoming requests, but the in-process renewal scheduler cannot run while the service sleeps. On wake it checks due reminders again while memberships remain valid. Reliable unattended reminder timing needs an always-on service. See [Render's idle service behavior](https://render.com/docs/free#spinning-down-on-idle).
