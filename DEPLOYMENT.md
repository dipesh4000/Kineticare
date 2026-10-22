# Kineticare Web Deployment Guide

Reviewed against this checkout on October 22, 2026. Run commands from the directory containing the root `package.json`, `firebase.json`, `frontend/`, and `backend/`.

## Choose the deployment you need

| Goal | Hosting | Accounts and records | API |
| --- | --- | --- | --- |
| Public UI / hackathon demo | Vercel static site (Section 2) | Browser-local demo, or Firebase after setup | No Express server; analytics and SOAP use the existing browser fallback |
| Full-stack prototype | Render Node web service (Section 3) | Firebase after setup, otherwise browser-local demo | Express and the frontend share one origin |
| Real patient use | Not release-ready yet | Firebase rules and account provisioning must be verified | Resolve the concrete limitations in Section 7 first |

**Recommended for sharing the current UI:** use the Vercel demo route. For the complete prototype with its API endpoints, use the single-service Node route. Neither route requires Neon.

The active architecture is:

- React/Vite frontend with on-device pose processing.
- Without all six Firebase configuration values: demo identities, browser-local records, and IndexedDB reference videos. Different devices do not share this data.
- With all six values: Firebase Authentication, Firestore records, and Firebase Storage reference videos.
- Express API for analytics, SOAP generation, an exercise registry, and in-memory exercise reports.

`backend/db/` contains a Neon/Drizzle scaffold, but active API routes do not import it and its database dependencies are not installed. Setting `DATABASE_URL` does not enable persistent records. The previous deployment guide's Neon instructions did not match the running application.

## 1. Build and verify locally

Use **Node.js 22.12 or newer in the Node 22 line**, or a newer supported LTS release. The installed Vite package requires Node `^20.19.0 || >=22.12.0`; Node 18 is insufficient.

```powershell
npm ci
npm run lint
npm test
npm run build
```

The build output is `frontend/dist`. The existing unit suite currently contains 19 tests. Run checks yourself before each release; a checked box in documentation is not evidence of a new successful run.

To test the built frontend and API together:

```powershell
npm start
```

Open `http://localhost:3000`. If another process uses that port, stop it or set a different `PORT` before starting. `npm start` runs `backend/server.js`, which serves both `/api/*` and `frontend/dist`, including the SPA fallback for deep links.

`npm run dev` runs Vite with a development-only `/api` middleware. `npm run preview` previews static assets only; it is not a production API server.

## 2. Vercel: publish the web UI / demo

The root `vercel.json` configures a static build and SPA routing. It does **not** deploy Express.

1. Import the repository in the Vercel dashboard yourself.
2. Set **Root Directory** to the application directory containing the root `package.json` and `vercel.json`. If this application sits inside another repository directory, select that directory. Do not select `frontend/dist` or `backend`.
3. Use the following project settings (also supplied by the root configuration):

   | Setting | Value |
   | --- | --- |
   | Framework preset | Other |
   | Install command | `npm ci` |
   | Build command | `npm run build` |
   | Output directory | `frontend/dist` |
   | Node version | 22.x, at least 22.12 |

   Keeping the application root includes the `backend/services` modules imported by the frontend and the API modules loaded by `frontend/vite.config.js` during the build.

4. For a UI demo, leave **all six** `VITE_FIREBASE_*` values blank. This intentionally shows the labelled demo login.
5. Leave `VITE_API_BASE_URL` blank. Set `VITE_USE_FIREBASE_EMULATORS=false` if defining it.
6. Deploy, then run Section 6's browser checks on the HTTPS address.

On this static deployment, `/api/*` is not an API endpoint. Browser-side analytics and SOAP generation fall back to the calculations already bundled with the frontend. The exercise-issue report fallback returns a success-shaped response but does **not** persist a report. Do not demonstrate that as durable submission.

For shared accounts on Vercel, complete Section 4, configure all six Firebase values in the deployment environment, and rebuild. Firebase-backed records work independently of Express; the static API limitations above remain.

Vite reads `VITE_*` variables at **build time**. After changing them in the dashboard, redeploy. Never put database passwords, service-account keys, or other server secrets in a `VITE_*` variable.

See [Vercel's Vite SPA guidance](https://vercel.com/docs/frameworks/frontend/vite) and [rewrite configuration](https://vercel.com/docs/routing/rewrites).

## 3. Full-stack prototype: one Node web service

A single Node service avoids introducing cross-origin API requests. For example, create a **Web Service** on Render with these settings:

| Setting | Value |
| --- | --- |
| Root directory | Application directory containing the root `package.json` |
| Runtime | Node |
| Node version | 22.x, at least 22.12, or a newer supported LTS |
| Build command | `npm ci --include=dev && npm run build` |
| Start command | `npm start` |
| Health check | `/api/health` |
| Environment | `NODE_ENV=production`, `HOST=0.0.0.0` |
| API base | Leave `VITE_API_BASE_URL` blank |

Allow the host to supply `PORT`; `backend/config/index.js` reads it. Build-time dependencies are needed to compile Vite, so do not omit dev dependencies during the build. Set the Firebase variables before building if using shared accounts.

After deployment, open `/api/health` on the same HTTPS domain. It should return JSON with `status: "ok"`, service `Kineticare Tele-Rehabilitation Engine`, and version `2.1.0`.

Do not configure a separate API domain without implementing and testing CORS first. The Express app currently has no cross-origin middleware. The old `backend/vercel.json` is a separate legacy backend configuration, not the root static-site deployment path described above; it has not been verified as a full-stack Vercel deployment.

See [Render's Node/Express deployment guide](https://render.com/docs/deploy-node-express-app).

## 4. Firebase: shared accounts, records, and reference media

Skip this section only for a browser-local demo.

### Configure the project

1. Create a Firebase project and register a Web App.
2. Enable Authentication's **Email/Password** provider.
3. Create Cloud Firestore and a Storage bucket; confirm the project's billing requirements in the Firebase console.
4. Add your deployed hostname under Authentication's authorized domains and configure email verification/reset templates for that environment.
5. Supply **all six** variables below in the hosting provider's build environment. For local builds, copy `.env.example` to `frontend/.env.local` and fill them there. Vite's root is `frontend/`; a root `.env` is not loaded automatically by this configuration.

```dotenv
VITE_FIREBASE_API_KEY=<web-app-api-key>
VITE_FIREBASE_APP_ID=<web-app-app-id>
VITE_FIREBASE_AUTH_DOMAIN=<project>.firebaseapp.com
VITE_FIREBASE_MESSAGING_SENDER_ID=<sender-id>
VITE_FIREBASE_PROJECT_ID=<project-id>
VITE_FIREBASE_STORAGE_BUCKET=<actual-bucket-name-from-web-app-config>
VITE_USE_FIREBASE_EMULATORS=false
VITE_API_BASE_URL=
```

The frontend enables Firebase only when **every** configuration value is present. Partial configuration leaves the application in demo mode. These Firebase web configuration values identify the app; Firestore/Storage rules enforce access. Do not replace them with an Admin SDK private key.

### Publish rules and indexes yourself

The Firebase CLI is already a frontend dev dependency. From the application root:

```powershell
npx firebase login
npx firebase deploy --project <project-id> --only firestore:rules,firestore:indexes,storage
```

Keep the checked-in restrictive rules; do not enable Firestore or Storage test mode for a deployed app. `firestore.indexes.json` currently declares no custom indexes. The clinician uses a collection-group `versions` query filtered by `ownerUid`; verify that query after deployment and create any index requested by Firestore, then record the resulting configuration in this file. Index deployment alone does not verify query authorization.

The media loader uses Firebase Storage `getBlob`. Configure bucket CORS for your **actual frontend HTTPS origin** with GET access so clinician reference media can load. CORS does not replace Storage rules. See [Firebase's direct-download/CORS instructions](https://firebase.google.com/docs/storage/web/download-files#cors_configuration).

### Provision the first clinician

The app has no public clinician registration screen. Use the trusted Firebase console to:

1. Create an Email/Password Authentication user for the clinician.
2. Copy that account's UID.
3. Create a Firestore document at `users/<that-uid>` with string fields:

```json
{
  "email": "doctor@example.com",
  "displayName": "Dr. Example",
  "role": "clinician"
}
```

Use the real account email. Do not create a demo UID such as `C-001` for an unrelated Auth account. The client cannot grant itself the clinician role under the rules.

The clinician signs in and creates a patient invitation by email. The patient opens the site, chooses the invited-patient account option, creates an account with that exact email, verifies the email, and signs in again. Invitation creation does **not** send an invitation email; share the site address separately. Acceptance creates the patient profile and clinician relationship transactionally.

In Firebase mode there are no seeded shared patients or reference records. The clinician needs to record/approve a reference before publishing an assignment that requires one. Verify media playback from a separate patient account/device.

### Firebase Hosting alternative

If you choose Firebase Hosting for the static frontend instead of Vercel, the checked-in `firebase.json` now points to `frontend/dist` and rewrites app routes to `/index.html`.

```powershell
npm run build
npx firebase deploy --project <project-id> --only hosting
```

This deploys static files, not Express. Section 2's static API limitations still apply. See [Firebase Hosting configuration](https://firebase.google.com/docs/hosting/full-config).

## 5. PWA and Android packaging come after web validation

The web manifest and blue icons are included. There is **no registered service worker or offline app-shell cache**, so do not promise offline operation or a guaranteed install prompt. Pose-model loading also needs to be tested on the target network/device. Browser install availability varies.

Validate the deployed manifest and real icon dimensions before Android packaging. Use PWABuilder only after the HTTPS site works on a real phone. A store-ready TWA additionally needs signing and Digital Asset Links for the actual hostname; the presence of a manifest alone does not make an APK/AAB release-ready. Keep signing keys private. Android packaging is not required to publish the web app.

## 6. Post-deployment checks

Leave these unchecked until you actually verify them on the deployed environment:

- [ ] Open the HTTPS site and confirm the blue logo, primary buttons, and mobile navigation.
- [ ] Refresh `/patient/home` and `/client/overview` directly; these must load the app and perform the normal auth redirect rather than return a host 404.
- [ ] Confirm demo login appears only for an intentional demo build; shared-account builds must show credential sign-in.
- [ ] In Firebase mode, verify clinician login, invitation acceptance, and patient login on separate devices.
- [ ] Record/approve a reference, publish an exercise plan, and play that reference as the linked patient.
- [ ] Complete camera setup and a session on a real phone over HTTPS; check framing, tracking loss, pause/resume, and saved results.
- [ ] Verify a patient cannot read another patient's records and an unrelated clinician cannot access them.
- [ ] On a Node deployment, confirm `/api/health` returns JSON and check analytics/SOAP requests in the network panel.
- [ ] Export an exercise schedule and the selected session analysis using the browser's **Print / Save as PDF** destination. Check multipage output and patient/session details. This feature is not a one-click PDF download and native print support must be checked in the target browser.
- [ ] Confirm invite/referral text, copy, and placeholders are appropriate for the audience.
- [ ] Run `npm run test:rules --workspace=frontend` with the required Java runtime and Firestore emulator available before shared-record release. This suite is separate from the 19 unit tests; it does not test Storage rules.

## 7. Concrete limitations before real patient use

A demo can be published, but the current build should not be described as ready for clinical production:

- **Unauthenticated Express API:** the API does not validate Firebase ID tokens or enforce clinician/patient relationships. `GET /api/reports/exercise` exposes its process's reports, and write routes accept callers without authentication. Add server-side authorization before entering real patient information into these endpoints.
- **Nonpersistent reports and registry changes:** exercise reports and runtime exercise registrations live in process memory and can disappear on restart or across server instances. The frontend's offline report fallback does not persist its returned report either.
- **Missing-score fallback:** analytics fallback paths still contain default score/consistency values when no valid repetitions are available. Fix this before using the output for clinical decisions; missing measurements must remain unavailable.
- **Security-rule verification:** run the Firestore rule suite, verify Storage access and the clinician collection-group query, and test linked/unlinked accounts in the actual Firebase project.
- **Privacy scope:** patient live camera processing occurs in the browser; approved clinician reference recordings can be uploaded. This is not evidence of HIPAA/GDPR compliance. Do not make unverified compliance claims.

This review verifies source configuration and local checks, not a live cloud release, cloud permissions, billing settings, or a completed native PDF save. No deployment is performed by this guide.
