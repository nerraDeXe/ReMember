# Deploy ReMember with Vercel

Use Vercel for the React frontend, an always-running Node.js web service for the Express backend, and your existing MongoDB database. This setup preserves the application's current image uploads and renewal email scheduler.

The repository includes a root `vercel.json` that builds only the frontend. The frontend reads `VITE_API_BASE_URL` at build time and calls that HTTPS backend directly. Local development still uses `/api` and the Vite proxy.

## 1. Push the complete repository

Commit the project to a Git repository and push it to your Git provider. Include `frontend`, `backend`, and `shared`, along with their package files and lockfiles. The apps import shared files using relative paths, so deploy from the complete repository.

Local `.env` files are ignored by Git and excluded from Vercel uploads. Enter deployment values in each host's environment settings. The frontend's `VITE_` variables are public browser configuration; MongoDB, JWT and SMTP credentials belong on the backend only.

## 2. Deploy the Express backend

Create a Node.js web service on an always-on host. For example, Render supports deploying [Express web services from a Git repository](https://render.com/docs/deploy-node-express-app).

Use these settings:

| Setting | Value |
| --- | --- |
| Repository | The complete ReMember repository |
| Root directory | Repository root; leave blank |
| Build command | `npm ci --prefix backend` |
| Start command | `npm start --prefix backend` |
| Health check path | `/api/health` |
| Instances | 1 when using the default public OpenStreetMap search provider |

Keep the host-provided `PORT`. Configure these backend environment variables using your actual values:

```dotenv
NODE_ENV=production
MONGODB_URI=mongodb+srv://your-database-connection
JWT_SECRET=your-new-long-random-secret
APP_WEB_URL=https://your-project.vercel.app

SMTP_HOST=your-smtp-provider
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-user
SMTP_PASSWORD=your-smtp-password
EMAIL_FROM=ReMember <verified-sender@your-domain.com>

NOMINATIM_USER_AGENT=ReMember/1.0 (+https://your-project.vercel.app)
```

Use the SMTP port and TLS settings required by your email provider. SMTP is needed for account verification, password recovery and member emails. Set a new strong `JWT_SECRET` instead of relying on the development fallback. Allow your backend host to connect to MongoDB using your database provider's network access settings.

Use the intended Vercel/custom frontend URL for `APP_WEB_URL`; update it after Vercel assigns the actual domain. The same applies to `NOMINATIM_USER_AGENT`.

A sleeping free web service will pause the in-process renewal scheduler. Render's free services [sleep when idle and block outbound SMTP ports](https://render.com/docs/free), so choose a service that stays running and supports your SMTP connection if you need all existing email features.

After deployment, open `https://YOUR-BACKEND-HOST/api/health`. It should return HTTP 200 with `"status":"healthy"`. Copy the backend's public HTTPS URL for the next step.

## 3. Import the frontend into Vercel

In Vercel, choose **Add New → Project** and import the same Git repository. Keep **Root Directory** at the repository root (`.`), rather than `frontend`, so the build can read `shared`.

The checked-in `vercel.json` supplies these settings:

| Setting | Value |
| --- | --- |
| Framework preset | Vite |
| Install command | `npm ci --prefix frontend` |
| Build command | `npm run build --prefix frontend` |
| Output directory | `frontend/dist` |

Add this Vercel environment variable before deploying:

```dotenv
VITE_API_BASE_URL=https://YOUR-BACKEND-HOST/api
```

Include `/api` at the end. Use a publicly reachable HTTPS URL, not `localhost`. Set it for Production and any Preview environment you plan to use. Vite [embeds these values during the build](https://vite.dev/guide/env-and-mode), so redeploy after changing the URL.

Click **Deploy**. Vercel builds the frontend and gives you a public URL. The SPA fallback in `vercel.json` follows [Vercel's Vite deployment guidance](https://vercel.com/docs/frameworks/frontend/vite).

## 4. Finish domain settings and verify

Update backend `APP_WEB_URL` and the OpenStreetMap User-Agent with the final frontend domain and restart/redeploy that service. If Google sign-in is enabled, set backend `GOOGLE_CLIENT_ID` and add the frontend's exact HTTPS origin under the Google OAuth web client's authorized JavaScript origins. Existing Google setup is described in [ACCOUNT_FLOW.md](../backend/ACCOUNT_FLOW.md).

Open the Vercel URL and verify registration/email confirmation, sign-in, both account tabs, joining an organisation, posting images, and event location search. Confirm browser API requests go to the configured backend, not the Vercel domain. The current backend already permits cross-origin requests with the Authorization header.

Use separate backend/database environments if preview deployments should not change production data. Payments and Google Wallet currently contain simulated integrations; hosting the application does not convert them into live payment or Wallet integrations.

## Why the backend is separate

The backend starts a continuous renewal scan and stores location-search throttling/cache in process memory. Posts can contain 12 MB JSON requests, while [Vercel Functions limit request and response payloads to 4.5 MB](https://vercel.com/docs/functions/limitations). An all-Vercel backend would need additional work: scheduled jobs, serverless database initialization, external image storage with direct uploads, smaller list responses, and shared location-provider throttling.

The recommended configuration keeps those existing features working without that migration. It serves only the frontend on Vercel; it does not deploy the backend there.
