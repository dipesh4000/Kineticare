<p align="center">
  <img src="frontend/public/logo.png" width="140" alt="Kineticare official logo">
</p>

<h1 align="center">Kineticare</h1>
<p align="center"><strong>From prescribed movement to meaningful feedback.</strong></p>
<p align="center">Camera-guided home exercise connecting physical therapy patients and clinicians between appointments.</p>

<p align="center">
  <a href="#why-kineticare">The idea</a> ·
  <a href="#system-architecture">Architecture</a> ·
  <a href="#explore-the-experience">The experience</a> ·
  <a href="#how-it-works">The technology</a> ·
  <a href="#production-deployment--mobile-apk-workflow">Deployment & APK</a> ·
  <a href="DEPLOYMENT.md">Complete Deployment Guide</a>
</p>

<p align="center">
  <img src="docs/assets/pose-tracking-demo.svg" width="640" alt="Illustrated arm raise with synchronized pose landmarks and repetition feedback">
  <br><sub>Illustrated MoveNet workflow · On-device pose estimation with zero cloud video upload</sub>
</p>

---

## Why Kineticare?

An exercise plan is only the start of rehabilitation. At home, patients can forget the demonstration, feel unsure about their movement, or struggle to describe what happened. Between appointments, clinicians have limited visibility into that practice.

Kineticare connects those moments. A reviewed demonstration becomes an individual assignment; camera-observed movement becomes a concise session report; that report becomes an actionable conversation with the clinician.

The project bridges the distance between instructions given in a clinical consultation and exercises practiced at home, emphasizing objective telemetry over subjective recall while protecting patient privacy.

---

## System Architecture

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                            MOBILE CLIENT (APK / PWA)                        │
│                                                                             │
│   ┌─────────────────────┐   ┌──────────────────────┐   ┌────────────────┐   │
│   │ WebGL Camera Stream │──▶│ MoveNet Lightning    │──▶│ Temporal EMA   │   │
│   │ (On-Device 30fps)   │   │ Pose Estimation      │   │ Smoothing &    │   │
│   └─────────────────────┘   └──────────────────────┘   │ Side-Profile   │   │
│                                                        │ Alignment      │   │
│                                                        └───────┬────────┘   │
│                                                                │            │
│   ┌─────────────────────┐   ┌──────────────────────┐           ▼            │
│   │ Patient / Clinician │◀──│ Repetition Engine &  │◀──────────┘            │
│   │ UI Views & Prompts  │   │ Biomechanical Metrics│                        │
│   └──────────┬──────────┘   └──────────────────────┘                        │
└──────────────┼──────────────────────────────────────────────────────────────┘
               │
               │ HTTPS JSON API (/api/*)
               │ Configured via VITE_API_BASE_URL
               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    BACKEND SERVER (Vercel / Node.js)                        │
│                                                                             │
│   ┌───────────────────┐    ┌────────────────────┐    ┌──────────────────┐   │
│   │ /api/exercises    │    │ /api/analytics     │    │ /api/reports     │   │
│   │ Dynamic Registry  │    │ SOAP Notes & ROM   │    │ Issue Logging &  │   │
│   └─────────┬─────────┘    └─────────┬──────────┘    │ Video Staging    │   │
│             │                        │               └────────┬─────────┘   │
│             └────────────────┬───────┴────────────────────────┘             │
│                              ▼                                              │
│                 ┌──────────────────────────┐                                │
│                 │ Drizzle ORM Data Access  │                                │
│                 └────────────┬─────────────┘                                │
└──────────────────────────────┼──────────────────────────────────────────────┘
                               ▼
               ┌─────────────────────────────┐
               │    NEON POSTGRESQL CLOUD    │
               │  - users (Shyam & Dr. Aditi)│
               │  - assignments & plans      │
               │  - exercise_catalog         │
               │  - exercise_sessions        │
               │  - clinical_reports         │
               └─────────────────────────────┘
```

---

## The Care Loop

| Stage | What happens | What carries forward |
| --- | --- | --- |
| **Demonstrate** | A clinician records and approves an exercise reference | A playable, versioned demonstration |
| **Personalize** | The clinician chooses targets, repetitions, schedule, and notes | A patient-specific assignment |
| **Prepare** | The patient positions the camera, validates orientation, and calibrates | A stable starting pose |
| **Practice** | The app follows movement with temporal EMA smoothing and cues | Repetitions, range, tempo, and fatigue |
| **Review** | The patient submits a completed or partial session | A compact report with tracking gaps |
| **Respond** | The clinician reviews the record, generates SOAP notes, or flags issues | Guidance the patient can read and question |

---

## Explore the Experience

### Patient Portal (Shyam Yadav)
- **Guided Exercise Plans**: View assigned daily routines, review attending clinician instructions, and watch approved reference videos.
- **Robust Camera Experience**: Automatic distance and side-profile alignment checks ensure accurate planar joint angles before practice begins.
- **Live Form Guidance**: Real-time angle telemetry with Exponential Moving Average (EMA) jitter suppression, visual progress rings, and optional spoken coaching.
- **Recovery & Gaps**: Interrupted sessions save as resumable drafts; incomplete cycles or occlusions are reported transparently.

### Clinician Portal (Dr. Aditi Singh)
- **Caseload Dashboard**: Review patient compliance, range of motion (ROM) progression, and sessions requiring clinical review.
- **Exercise Reporting Workflow**: Flag protocol concerns, patient discomfort, tracking occlusion, or contraindications directly from the Exercise Library (`POST /api/reports/exercise`).
- **Demonstration Video Staging**: Preview and stage custom clinician demonstration recordings.
- **Automated SOAP Notes**: Instant clinical summaries formatted into Subjective, Objective, Assessment, and Plan for medical documentation.

---

## Supported Exercises & Biomechanics

| Exercise | Camera view | Biomechanical Joint Tracked |
| --- | --- | --- |
| **Squat / mini-squat** | Side | Knee flexion angle excursion and lowering/return timing |
| **Bilateral side arm raise** | Front | Bilateral shoulder abduction and raise/return cycle |
| **Standing toe touch** | Side | Hip flexion angle excursion and forward bend rhythm |

---

## How It Works

```mermaid
flowchart LR
    A["Camera Stream"] --> B["MoveNet SinglePose"]
    B --> C["EMA Jitter Smoothing"]
    C --> D["Orientation & Alignment Check"]
    D --> E["Exercise Angle Rules"]
    E --> F["Session Telemetry & Score"]
    F --> G["Clinician SOAP & Reports"]
```

1. **MoveNet SinglePose Lightning** executes directly inside the browser or mobile web view via WebGL.
2. **Temporal EMA Smoothing** ($\alpha = 0.35$) eliminates frame-to-frame keypoint noise without introducing latency.
3. **Body Orientation Validator** analyzes torso and shoulder spread ratios to alert patients if they are facing the wrong direction for side-view exercises.
4. **Repetition Engine** tracks concentric vs. eccentric durations, dwell times, and fatigue indices across repetitions.
5. **Session Submission** dispatches structured JSON metrics to the backend API without uploading raw video.

---

## Technology Stack

| Layer | Technology | Purpose |
| --- | --- | --- |
| **Client UI** | React 19, Vite, Tailwind CSS | Responsive patient & clinician white-mode interface |
| **Mobile PWA** | Web App Manifest, Service Worker | Installable APK via PWABuilder / Bubblewrap TWA |
| **Pose Estimation** | TensorFlow.js, MoveNet Lightning | 30+ FPS on-device computer vision (WebGL) |
| **Backend API** | Node.js, Express REST API | Exercise catalog, session evaluation, and issue logging |
| **Database** | Neon Cloud PostgreSQL + Drizzle ORM | Scalable serverless relational database |
| **Security & Privacy** | On-device processing | Zero video uploads across network (HIPAA-friendly) |

---

## Project Structure

```text
backend/
  config/      Server configuration and environment bindings
  db/          Neon PostgreSQL client and Drizzle ORM schema (users, plans, sessions, reports)
  routes/      Express routers: /api/exercises, /api/analytics, /api/reports, /api/health
  services/    Exercise registry, biomechanical calculations, SOAP note generation
  vercel.json  Vercel serverless deployment configuration
  server.js    Production fullstack server
frontend/
  public/      PWA manifest.json, brand icons, video demonstration assets
  src/
    auth/      Authentication context (Shyam Yadav & Dr. Aditi Singh)
    client/    Clinician dashboard, patient drilldowns, and reference capture
    components/PWAInstallButton, exercise telemetry charts, video player
    patient/   Setup, live practice with EMA smoother, summaries, and recovery progress
    exercise/  Exercise definitions, repetition engine, scoring
    vision/    Camera lifecycle, MoveNet, geometry, EMA filter, orientation validator
    records/   Shared records and local workspace state
    services/  Configurable API client (supports VITE_API_BASE_URL), Firebase, and media
    session/   Recoverable workout drafts
  test/        Automated biomechanics and security-rule checks
docs/          Project documentation and diagrams
DEPLOYMENT.md  Comprehensive deployment and APK packaging guide
```

---

## Production Deployment & Mobile APK Workflow

For the complete, step-by-step deployment instructions, refer to **[DEPLOYMENT.md](DEPLOYMENT.md)**.

### Summary:

1. **Database Setup (Neon PostgreSQL)**:
   - Create a free database on [neon.tech](https://neon.tech) and copy your `DATABASE_URL`.
   - The Drizzle ORM schema in `backend/db/schema.js` manages all tables with automatic local fallback.
2. **Backend Deployment (Vercel)**:
   - Deploy `backend/` to Vercel with environment variable `DATABASE_URL`.
   - Pre-configured `backend/vercel.json` serves the API at `https://your-backend.vercel.app/api/*`.
3. **Frontend & Mobile APK**:
   - Set `VITE_API_BASE_URL=https://your-backend.vercel.app` in `frontend/.env.production`.
   - Build static assets with `npm run build --workspace=frontend`.
   - Use [PWABuilder.com](https://www.pwabuilder.com) to package the live HTTPS URL into an installable Android APK (`.apk`) or Google Play Store bundle (`.aab`).

---

## Scope and Roadmap

- **Doctor Custom Video Upload (Phase 2)**: Stage 1 preview with local staging is currently active in the Exercise Library. Persistent cloud transcoding, adaptive streaming, and multi-tenant video distribution are scheduled for Phase 2.
- **Dynamic Exercise Expansion**: Developers can push new protocols directly via `backend/services/exerciseRegistry.js` or `POST /api/exercises`.
- **EHR Integration**: Export structured clinical SOAP notes to FHIR-compliant electronic medical records.
- **Direct Native Push Notifications**: Native push notifications for prescribed workout reminders in the installed APK.

---

## Documentation

| Document | Description |
| --- | --- |
| **[DEPLOYMENT.md](DEPLOYMENT.md)** | Step-by-step Neon DB, Vercel backend, and APK packaging guide |
| **[Frontend README](frontend/README.md)** | Local installation, run commands, and test checks |
| **[Project Overview](overview.md)** | Product vision, clinical rationale, and user journeys |
| **[Implementation Plan](plan.md)** | Baseline development roadmap and milestones |

---

<p align="center"><strong>Demonstrate. Practice. Understand. Respond.</strong></p>
