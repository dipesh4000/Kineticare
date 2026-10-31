# Kineticare

Camera-guided home exercise for independent patients and clinician-connected care.

## Current architecture

- React/Vite frontend with on-device BlazePose tracking (33 landmarks), plus a MoveNet fast mode (17 landmarks).
- Privy email verification codes for signup and login. Wallet creation is disabled.
- Express backend verifies Privy tokens and enforces account roles and patient consent.
- MongoDB Atlas stores profiles, patient–clinician connections, assignments, sessions, reviews, messages and Gemini exercise drafts.
- Demonstrations are bundled static assets. There are no video uploads, Firebase services, or account migration requirements in this version.

## Start locally

Use Node.js 22.12+ (24 recommended).

1. Run `npm install` in this folder.
2. Copy `.env.example` to root `.env`; configure `PRIVY_APP_ID`, `PRIVY_APP_SECRET`, `MONGODB_URI` and `MONGODB_DB`.
3. Put `VITE_PRIVY_APP_ID=your-app-id` in `frontend/.env.local`. It must match the backend app ID.
4. Enable Email login in the Privy dashboard and allow `http://localhost:3000` as a development origin.
5. Double-click `Launch-Kineticare.exe` / `Launch-Kineticare.cmd`, or run `npm run dev`.
6. Visit `http://localhost:3000`. Authenticate with an email code, then select Patient or Clinician and enter your name.

The launcher checks Node.js 22.12+, project files, installed dependencies and available ports, then starts frontend on 3000 and backend on 3001. It prints the ready URL after the frontend, backend health endpoint and API proxy respond successfully, with a 30-second startup timeout. Ctrl+C or a server failure stops its servers. It does not kill processes already occupying a port. Node.js and installed dependencies are required by the executable. Set `PORT` / `FRONTEND_PORT` in root `.env` to use other ports. Set `KINETICARE_NO_PAUSE=1` to suppress the CMD launcher's error pause in scripts.

[Full Privy / Atlas / Gemini setup](docs/PRIVY_ATLAS_SETUP.md)

## User flows

Patients register without an invitation and may use the app independently. The current independent plan is a fixed prototype template: health-history personalization and clinical eligibility screening are not implemented.

Clinicians self-register. This does not verify professional credentials. In Patients or Settings, they create an invite code, valid for 24 hours. Patients enter it under Info, review the clinician, and explicitly consent to share their recorded sessions, progress, and care messages. One clinician connection is active at a time. Revocation denies subsequent clinician requests without deleting patient records.

The clinician can publish plans using available bundled references, inspect shared sessions, and send feedback. Camera tracking supports squat, side arm raise and toe touch; bundled videos currently cover squat and toe touch. Arm raise cannot be newly assigned until its bundled reference exists.

Gemini exercise drafts are available in the clinician Exercise Library. They use original clinician-provided reference notes, with explicit permission to send those fields to Google. Drafts remain unmeasured and unavailable for automatic patient assignment.

## Verification

[Patient and clinician product test walkthrough](docs/PRODUCT_TEST_WALKTHROUGH.md), including phone camera checks, generation, assignment, messaging and current limitations.

- `npm test`: exercise logic and patient-flow tests.
- `npm run test:backend`: authentication boundary, immutable records, signup role, consent and revocation tests.
- `npm run lint`, `npm run build`: frontend checks.
- `node scripts/smoke-launcher.mjs`: Windows executable test on temporary ports 3330/3331; stops its own test process tree.
- `node scripts/smoke-launcher.mjs --cmd`: same startup checks through the Windows CMD launcher.
- `node --test scripts/launch.test.mjs`: invalid ports, occupied ports and CMD exit-code checks.

Live email delivery, Privy dashboard settings, Atlas connectivity and authenticated cross-device use require configured cloud accounts. Local tests do not establish clinical validity.

Privy's transitive dependency advisories remain after compatible audit fixes; see the setup guide's release gates before production use.

## Deployment

Deploy Express and the built frontend under the same HTTPS origin. Keep Privy secrets, Gemini keys and Atlas credentials only on the backend. Static-only hosting cannot provide signup records, care connections or AI generation. See [deployment notes](DEPLOYMENT.md).

The user manages all Git operations.


## Knowledge-grounded chat and animation previews

Clinicians can open Exercise Library to ask Gemini with retrieved textbook evidence, inspect source citations and render a labelled mini-squat engineering preview as a downloadable video. The supplied extraction prompt is included verbatim as a system instruction, followed by runtime instructions. Other variations remain text-only until compatible reviewed motions exist. This feature does not approve exercises or enable patient assignment. See [setup, endpoints and verification](docs/GEMINI_KNOWLEDGE_ANIMATION.md).
