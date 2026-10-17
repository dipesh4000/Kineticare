# Kineticare frontend

Responsive React/Vite prototype for the clinician-to-patient physiotherapy workflow described in the repository-level `overview.md` and `plan.md`.

## Run locally

```powershell
npm.cmd install
npm.cmd run dev
```

Open the local URL printed by Vite. Camera access works on `localhost`; testing from a phone requires an HTTPS deployment or another secure browser context.

## Checks

```powershell
npm.cmd test
npm.cmd run test:rules
npm.cmd run lint
npm.cmd run build
```

The logic tests cover geometry, required-joint visibility, calibration, repetition transitions, tracking loss, and scoring. Firebase CLI 15 requires JDK 21 or newer for the Firestore rule tests.

## Firebase setup

1. Register a Firebase web app and enable Email/Password Authentication, Firestore, and Cloud Storage.
2. Copy `.env.example` to `.env.local` and enter the public web configuration values. Never add an Admin SDK credential to Vite environment variables.
3. Deploy the repository-root `firestore.rules`, `storage.rules`, and indexes with Firebase CLI.
4. Provision accounts through a trusted admin process. The browser must not create roles or relationships.

Required trusted records:

```text
users/{clinicianUid}: { role: "clinician", displayName: "..." }
users/{patientUid}:   { role: "patient", displayName: "...", summary: "..." }
relationships/{patientUid}: { clinicianUid: "...", active: true }
```

Set `VITE_USE_FIREBASE_EMULATORS=true` only while the Auth, Firestore, and Storage emulators are running. Without complete Firebase environment values, Kineticare intentionally opens a browser-local demo workspace with separate clinician and two-patient account choices.

## Current implementation status

- Firebase Authentication enforces provisioned patient/clinician routes; the fallback demo stores scoped records in browser storage.
- Firestore listeners and writes cover assignments, sessions, reviews, feedback, requests/replies, and immutable reference versions.
- Firestore and Storage rules deny unrelated accounts and protect roles, measurements, feedback ownership, and reference media.
- The active exercise library is limited to squat and bilateral side arm raise.
- Clinicians can record, segment five repetitions, preview, reject, and approve reference videos. Approved media uses protected Storage or IndexedDB in local mode.
- Assignment drafts, patient previews, reference pinning, per-exercise targets/notes, and published versions are implemented.
- The live view can request the camera, load MoveNet SinglePose Lightning, draw a pose overlay, and display the exercise-specific joint angle.
- Two-second stable rest calibration feeds the shared repetition engine. Tracking loss discards an incomplete repetition rather than joining movement across a gap.
- Camera/skeleton view switching, optional speech cues, pause/resume, partial saves, timing categories, recovery drafts, and measured summaries are implemented.
- Clinicians can review sessions, send linked feedback, and answer patient help/contact/question requests.
- The replay path is explicitly labeled and continues to use simulated timing and scores.

Patient workout video is processed locally and is not uploaded. Only approved clinician reference recordings are stored for authorized playback.
