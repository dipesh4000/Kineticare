# Deploy Kineticare

Use [current Privy / Atlas / Gemini configuration](docs/PRIVY_ATLAS_SETUP.md). Firebase is not required.

1. Install Node.js 22.12+ and run npm install.
2. Set server-only PRIVY_APP_ID, PRIVY_APP_SECRET, MONGODB_URI, MONGODB_DB and optional Gemini settings using root .env.example.
3. Set the public VITE_PRIVY_APP_ID at frontend build time. Leave VITE_API_BASE_URL blank for same-origin hosting.
4. Run npm run build.
5. Run npm start behind an HTTPS reverse proxy. Set HOST/PORT for your host; local defaults bind to 127.0.0.1:3001.
6. Allow your HTTPS origin in Privy and enable email login. Restrict Atlas access to your backend.
7. Test signup with distinct patient/clinician emails, role persistence, invite expiry, consent, linking, exercise save, feedback, revocation and logout.

## Vercel (frontend + backend in one project)

1. Set the Vercel project's Root Directory to this repository root (where `package.json` and `vercel.json` live), not `frontend` or `backend`. Use Node.js 22.x.
2. Root `vercel.json` configures `npm ci --include=dev --include=optional`, `npm run build`, and the `frontend/dist` output. It routes `/api` requests to `api/index.js` and frontend page URLs to `index.html`. Root `package.json` pins Node.js to 22.x. Keep the native platform entries in `package-lock.json`; Linux builds need the Rolldown, Tailwind Oxide, and Lightning CSS Linux binaries even when development happens on Windows.
3. In Vercel Environment Variables, set `PRIVY_APP_ID`, `PRIVY_APP_SECRET`, `MONGODB_URI`, `MONGODB_DB`, and `VITE_PRIVY_APP_ID`. Add `GEMINI_API_KEY` and `GEMINI_MODEL` for AI features. Apply variables to the required Production/Preview environments. Keep `VITE_API_BASE_URL` unset for same-origin requests. Local `.env` files are excluded from the API function bundle.
4. Allow the deployed HTTPS domain in Privy and ensure MongoDB Atlas allows connections from the deployed backend. Redeploy after changing build-time `VITE_*` variables.
5. After deploying, check `/api/health` returns JSON, refresh a frontend page directly, then test login and record saving. Health confirms the API runs; login and saved records verify Privy and Atlas connectivity.

The root deployment uses the serverless API entry without starting a listening server. `backend/vercel.json` is an older standalone backend configuration and is not used by this root deployment. The local launcher remains for development.

Live email and cloud checks need configured credentials. Real-patient release also needs clinical validation, privacy/retention decisions, dependency review, backups and deployment security verification.

