# Privy, Atlas and Gemini setup

Updated 30 October 2026. Current Firebase-free setup; start fresh without account migration. No existing cloud resources are deleted.

## Privy email authentication

Create a Privy app, enable Email login and allow http://localhost:3000 plus your production HTTPS origin. The UI uses email only and disables automatic wallet creation. Copy the public app ID to root .env as PRIVY_APP_ID and frontend/.env.local as VITE_PRIVY_APP_ID. Set PRIVY_APP_SECRET only in root .env. Never expose secrets in VITE variables.

Privy's SDK manages email codes, login, token refresh and logout. The backend verifies access tokens before reading Atlas profiles. First-time users enter their name and choose Patient or Clinician. Roles cannot be changed through signup after creation. Clinician self-registration does not imply professional verification.

## Atlas

Set MONGODB_URI to your TLS-enabled Atlas connection string and MONGODB_DB to kineticare (or your chosen database). Restrict the database user to this database and allow only your backend through Atlas network controls. The browser never receives the URI.

Collections are created on first use: users, relationships, careInvites, patientRecords, exerciseDrafts, exerciseReports and aiGenerationLeases. Unique _id keys protect identity and immutable record keys. Optional TTL indexes on careInvites.expiresAt and aiGenerationLeases.expiresAt with expireAfterSeconds 0 clean up expired documents. Invite expiry is checked by the API independently of cleanup.

## Patient consent and clinician access

Clinicians generate a cryptographically random invite code from Patients or Settings. The code expires after 24 hours. Patients enter it under Info, preview the clinician's name/verification state, then explicitly consent to share saved sessions, progress and care messages and receive plans and feedback. Knowing a code alone does not grant access. One clinician connection is active at a time; revoke before changing clinicians.

Revocation denies subsequent clinician API requests without deleting patient records. Previously downloaded records cannot be remotely erased. Assignments from a revoked clinician are no longer active. All clinician patient reads and writes are authorized against the current Atlas relationship.

## Demonstrations and Gemini

Only bundled static videos are supported. Squat and toe touch have videos; side arm raise is camera-supported but cannot be newly assigned until a bundled reference is supplied. Firebase Storage, recordings, upload forms and migration scripts have been removed.

Set GEMINI_API_KEY and an available generateContent model ID in GEMINI_MODEL. In clinician Exercise Library, provide an exercise brief, edition/chapter/page and your original summary of the reference. Explicitly permit sending those fields to Google and exclude patient-identifying information. Structured responses are validated and saved as pending review. Decisions persist; drafts do not automatically become assignable or measured exercises.

Kisner & Colby may be cited in your source notes. The supplied sixth-edition (2012) PDF is not uploaded, reproduced, indexed or used for training. Check generated content against the actual source and current guidance. Patient-history AI recommendations and clinically reviewed independent-use rules remain pending.

## Run and deploy

Use Node.js 22.12+ (24 recommended). Run npm install. Root .env.example identifies server/client settings. Restart the launcher after configuration changes. Double-click Launch-Kineticare.exe or Launch-Kineticare.cmd, or run npm run dev. Frontend runs on 3000; backend on 3001. Ctrl+C stops the launcher's servers. Existing processes are never killed to free a port.

For production, run npm run build and npm start behind a trusted HTTPS reverse proxy. Express serves frontend/dist and /api under one origin. Set HOST/PORT for your host and allow the HTTPS domain in Privy. Static-only hosting cannot provide connected features. Do not expose the local HTTP development server as production. SDK tokens are sent as Bearer headers over HTTPS; the app does not implement its own password store. Configure Privy abuse controls and verify email delivery, expiry and logout on your deployment.

Checks: npm test, npm run test:backend, npm run lint and npm run build. Live Privy email delivery, Atlas connectivity and cross-device cloud access require your configured accounts. Automated checks do not establish clinical validity or privacy compliance.

Primary references: [Privy setup](https://docs.privy.io/basics/react/setup), [token verification](https://docs.privy.io/authentication/user-authentication/access-tokens), [MongoDB Node driver](https://www.mongodb.com/docs/drivers/node/current/connect/mongoclient/).

## Local verification and remaining gates

On 30 October 2026: 20 frontend tests, five backend integration tests, lint, production build and the compiled Windows launcher smoke test passed. Tests cover unauthenticated rejection, immutable roles and sessions, verified-provider email use, consent preview, invalid/expired invite codes, linking and denied clinician access after revocation. Cloud email delivery, Atlas persistence and cross-device login/logout require configured accounts and were not exercised.

After a non-forced compatible audit fix, npm reported 31 dependency advisory entries (10 moderate, 21 high), primarily in Privy's transitive wallet-related dependency tree. Wallet creation is disabled in the app, but this is not evidence that the advisories are harmless. The audit's proposed forced downgrade changes Privy's major version and was not applied. Dependency remediation/provider review remains a production release gate. Vite also reports large dependency chunks. No live-patient or production-security sign-off is implied by the local checks.
