# Deploy the whole ReMember app on Render

One Node.js web service serves both the React website and `/api` endpoints. MongoDB remains your database. The backend serves files from `frontend/dist`; production startup reports a clear error if the frontend was not built.

**Email on Render Free:** [Free web services block outbound SMTP ports 25, 465 and 587](https://render.com/docs/free). Use ReMember's **Gmail API transport over HTTPS** to keep Gmail and the Free plan. Follow [Gmail API setup](GMAIL_API_SETUP.md) once to enable the API and authorize your sending mailbox, then put its OAuth values in Render Environment. A Gmail password or App Password cannot bypass an SMTP network block.

SMTP remains available on hosts that allow it, including paid Render web service compute plans. Upgrading only the workspace plan does not remove Free instance restrictions. Port 25 is blocked on all Render services.

1. Commit and push the complete repository, including `frontend`, `backend` and `shared`, to the Git repository connected to Render.
2. Create or open a Node.js Web Service in Render. Leave Root Directory blank (repository root).
3. Set the Build Command to:

   ```sh
   npm ci --prefix frontend --include=dev && npm run build --prefix frontend && npm ci --prefix backend
   ```

   The frontend needs its development dependencies to build even when `NODE_ENV=production`.

4. Set the Start Command to:

   ```sh
   npm start --prefix backend
   ```

5. Set Health Check Path to `/api/health`.
6. In Environment, configure these values, replacing placeholders with your actual settings:

   ```dotenv
   NODE_ENV=production
   NODE_VERSION=22
   MONGODB_URI=your-existing-mongodb-connection-string
   JWT_SECRET=your-long-random-secret
   APP_WEB_URL=https://YOUR-ACTUAL-SERVICE.onrender.com
   APP_ORIGIN=https://YOUR-ACTUAL-SERVICE.onrender.com
   VITE_API_BASE_URL=/api
   MAIL_TRANSPORT=gmail-api
   GMAIL_CLIENT_ID=your-mail-oauth-client-id.apps.googleusercontent.com
   GMAIL_CLIENT_SECRET=your-mail-oauth-client-secret
   GMAIL_REFRESH_TOKEN=your-authorized-mailbox-refresh-token
   EMAIL_FROM=ReMember <your-account@gmail.com>
   NOMINATIM_USER_AGENT=ReMember/1.0 (+https://YOUR-ACTUAL-SERVICE.onrender.com)
   ```

   Obtain the Gmail values using the [local authorization helper](GMAIL_API_SETUP.md#2-authorize-the-sender-locally). Keep them on the backend; do not add them to `VITE_*` variables. Render supplies `PORT`. The default Nominatim endpoint needs no additional setting. If Google sign-in is used, retain its separate `GOOGLE_CLIENT_ID` and register your actual frontend origin in Google Cloud Console. MongoDB must permit connections from your backend host.

7. Choose Save, rebuild, and deploy. Open your Render website URL and confirm `/api/health` returns healthy. Test account sign-in, verification emails, both account tabs and an image upload.

Render Free sleeps after 15 idle minutes. Gmail API email works when the app is running, but the renewal reminder scheduler cannot run while the service sleeps. Use an always-on service for reliable unattended reminders. Keep one backend instance when using public Nominatim because its throttling is maintained in process memory. The [in-app payment gateway demo](PAYMENT_GATEWAY.md) needs no provider keys, external webhook, or separate terminal process. It simulates MYR payments without moving money; renewals require a member to complete another checkout. Google Wallet still requires its own credentials.

No frontend `.env` file or Vercel service is needed for this setup. `/api` is already the frontend default. Local development can continue with `npm run dev` in `frontend` and `npm start` in `backend`; Vite proxies API requests as before.

The separate [Vercel guide](VERCEL_DEPLOYMENT.md) remains available for the alternative frontend-on-Vercel setup.

## Gmail SMTP on a paid Render web service

In the backend web service's Environment settings, use:

```dotenv
MAIL_TRANSPORT=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_REQUIRE_TLS=true
SMTP_USER=your-account@gmail.com
SMTP_PASSWORD=your-google-app-password
EMAIL_FROM=ReMember <your-account@gmail.com>
```

Enable Google 2-Step Verification and generate an [App Password](https://support.google.com/accounts/answer/185833) for this app. The current password-based SMTP transport needs that app password rather than the normal Google account password. Availability can depend on account or organisation policy. Use the same Gmail address for `SMTP_USER` and the example `EMAIL_FROM`. The separate `EMAIL_SENDER_ADDRESS` variable does not configure the transport's sender.

Alternatively, use `SMTP_PORT=465` with `SMTP_SECURE=true`. Changing between 465 and 587 does not help on Render Free. Keep TLS enabled. Google sign-in's `GOOGLE_CLIENT_ID` does not authorize sending Gmail messages.

Save the variables and redeploy the backend. For password reset emails, also set `APP_WEB_URL` to the actual HTTPS website URL. Local `.env` values are not automatically copied into Render. For Gmail on a Free web service, use [Gmail API setup](GMAIL_API_SETUP.md) instead.

## Diagnose email failures

After deploying the diagnostic changes, Render logs distinguish these failure categories without printing credentials, verification codes, reset links, recipients or message contents:

| Log code | What to check |
| --- | --- |
| `ETIMEDOUT` | The email provider request timed out. Check network access. For SMTP, also check the service's compute plan and port restrictions. |
| `ECONNECTION`, `ECONNREFUSED` | SMTP could not connect. Check the service's compute plan first, then host, port and outbound connectivity. |
| `EAUTH`, often SMTP response `535` | Gmail rejected authentication. Check the full account address, App Password and account policy. A changed Google password revokes existing App Passwords. |
| `EDNS`, `ENOTFOUND`, `EAI_AGAIN` | Check `SMTP_HOST` and DNS connectivity. |
| `ETLS`, `ESOCKET` | Check port/TLS settings and provider connectivity; these codes can cover several connection failures. |
| `EENVELOPE`, `EMESSAGE` | Check sender authorization, recipient validity and provider sending restrictions. |

For Gmail API authorization, API enablement, sender and quota failures, use the [Gmail API troubleshooting steps](GMAIL_API_SETUP.md#troubleshooting). All three `GMAIL_*` values must match the mailbox authorization. External Google OAuth apps in Testing normally issue Gmail refresh tokens that expire after seven days; see the guide before relying on continuing delivery.

A failed verification email leaves the saved account unverified. After fixing delivery, use Resend code on the verification screen; the one-minute resend cooldown still applies. An RSVP or completed payment remains saved if its confirmation email fails. No automatic replay of failed confirmation emails is performed.
