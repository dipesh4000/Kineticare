# Kineticare

Kineticare is a responsive physiotherapy exercise companion that connects clinician-assigned home exercises with patient practice and clinician review. Clinicians configure exercise plans and review saved sessions; patients follow the plan, exercise with camera-based movement tracking, and receive feedback.

> **Project status:** This repository contains an MVP. Its movement measurements and scores are for demonstration and engineering evaluation, not diagnosis or validated clinical guidance. Exercise targets and patient-facing instructions should be reviewed by a qualified clinician before real-world use.

## What’s included

- Separate clinician and patient workflows, with role-based routes.
- An exercise library currently focused on side-view squats/mini-squats and front-facing bilateral side arm raises.
- Clinician reference capture, review, approval, and versioned reference media.
- Patient-specific exercise assignments, targets, notes, and reference demonstrations.
- Browser camera access and MoveNet pose estimation, with a skeleton overlay, rest calibration, repetition tracking, and movement measurements.
- Pause/resume, partial-session saving, timing categories, and session summaries.
- Clinician session review, patient-visible feedback, and patient requests or questions.
- A local demo workspace for trying the app without Firebase configuration.

Patient workout video is processed in the browser and is not uploaded. Approved clinician reference recordings are stored for playback by authorized users.

## Run locally

Requirements: Node.js/npm and a modern browser. Camera access is available on `localhost`; accessing the camera from another device requires HTTPS.

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

Open the local URL printed by Vite. Without a complete Firebase configuration, the app opens in local demo mode. Demo data is stored in the browser, so it is not a shared or production database.

## Firebase configuration

To use Firebase instead of local demo mode:

1. Create a Firebase project and register a web app.
2. Enable Email/Password Authentication, Cloud Firestore, and Cloud Storage.
3. Copy `frontend/.env.example` to `frontend/.env.local` and fill in the Firebase web app values.
4. Provision accounts through a trusted process. The app expects user profile documents at `users/{uid}` with a `role` of `patient` or `clinician`; patient-to-clinician access also requires the configured relationship records.
5. Configure and deploy Firestore and Storage security rules appropriate to the app’s data model before using real accounts or data.

Only Firebase client configuration belongs in Vite environment variables. **Never put service-account credentials or other Admin SDK secrets in `frontend/.env.local` or browser code.**

For local Firebase development, set `VITE_USE_FIREBASE_EMULATORS=true` in `.env.local` while the Auth, Firestore, and Storage emulators are running. The app connects to the standard local emulator ports.

## Checks

Run from `frontend/`:

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

The unit tests cover exercise geometry, required-joint visibility, calibration, repetition state transitions, tracking loss, and scoring. A Firestore rules test command is also available:

```powershell
npm.cmd run test:rules
```

That command requires a configured Firebase emulator environment; Firebase CLI 15 also requires JDK 21 or newer.

## Project layout

```text
frontend/
  src/
    auth/       Sign-in and role-based account state
    client/     Clinician screens and reference capture
    exercise/   Exercise definitions, calibration, repetition engine, scoring
    patient/    Patient plan, live session, summary, and progress screens
    records/    Local and Firebase-backed application records
    services/   Firebase and reference-media integrations
    session/    Session draft recovery
    vision/     Camera, pose estimation, and geometry
  test/         Exercise logic and Firestore rules tests
overview.md     Product scope, workflow, limitations, and presentation guidance
plan.md         Technical implementation plan and roadmap
```

## Product and technical notes

- [Project overview](./overview.md) describes the users, intended workflow, scope, and product limitations.
- [Technical implementation plan](./plan.md) records implementation decisions, architecture, and future work.
- [Frontend README](./frontend/README.md) contains frontend-specific setup and implementation notes.

The app is not a medical device and does not diagnose conditions, determine recovery, or establish that an exercise was performed safely. Prototype movement scores are explainable summaries of configured measurements, not clinically validated grades.
