# Deploy the whole ReMember app on Render

One Node.js web service serves both the React website and `/api` endpoints. MongoDB remains your database. The backend serves files from `frontend/dist`; production startup reports a clear error if the frontend was not built.

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
   MONGODB_URI=your-existing-mongodb-connection-string
   JWT_SECRET=your-long-random-secret
   APP_WEB_URL=https://YOUR-ACTUAL-SERVICE.onrender.com
   APP_ORIGIN=https://YOUR-ACTUAL-SERVICE.onrender.com
   VITE_API_BASE_URL=/api
   SMTP_HOST=your-smtp-host
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=your-smtp-user
   SMTP_PASSWORD=your-smtp-password
   EMAIL_FROM=ReMember <your-verified-sender@example.com>
   NOMINATIM_USER_AGENT=ReMember/1.0 (+https://YOUR-ACTUAL-SERVICE.onrender.com)
   ```

   Keep the port/TLS combination required by your SMTP provider; port 465 uses `SMTP_SECURE=true`. Render supplies `PORT`. The default Nominatim endpoint needs no additional setting. If Google sign-in is used, retain `GOOGLE_CLIENT_ID` and register your actual frontend origin in Google Cloud Console. MongoDB must permit connections from your backend host.

7. Choose Save, rebuild, and deploy. Open your Render website URL and confirm `/api/health` returns healthy. Test account sign-in, verification emails, both account tabs and an image upload.

Use an always-on service with outbound SMTP support to retain scheduled reminders and the current email integration. Keep one backend instance when using public Nominatim because its throttling is maintained in process memory. Hosting does not replace the existing simulated payment/Wallet integrations with live ones.

No frontend `.env` file or Vercel service is needed for this setup. `/api` is already the frontend default. Local development can continue with `npm run dev` in `frontend` and `npm start` in `backend`; Vite proxies API requests as before.

The separate [Vercel guide](VERCEL_DEPLOYMENT.md) remains available for the alternative frontend-on-Vercel setup.
