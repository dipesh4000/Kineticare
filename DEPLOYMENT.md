# Deploy Kineticare

Use [current Privy / Atlas / Gemini configuration](docs/PRIVY_ATLAS_SETUP.md). Firebase is not required.

1. Install Node.js 22.12+ and run npm install.
2. Set server-only PRIVY_APP_ID, PRIVY_APP_SECRET, MONGODB_URI, MONGODB_DB and optional Gemini settings using root .env.example.
3. Set the public VITE_PRIVY_APP_ID at frontend build time. Leave VITE_API_BASE_URL blank for same-origin hosting.
4. Run npm run build.
5. Run npm start behind an HTTPS reverse proxy. Set HOST/PORT for your host; local defaults bind to 127.0.0.1:3001.
6. Allow your HTTPS origin in Privy and enable email login. Restrict Atlas access to your backend.
7. Test signup with distinct patient/clinician emails, role persistence, invite expiry, consent, linking, exercise save, feedback, revocation and logout.

A frontend-only static deployment is insufficient. The local launcher is for development. Existing static-host configuration can build the frontend, but a same-origin /api backend is required for connected use.

Live email and cloud checks need configured credentials. Real-patient release also needs clinical validation, privacy/retention decisions, dependency review, backups and deployment security verification.

