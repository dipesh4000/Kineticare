# Kineticare Production Architecture: Neon DB, PWA/APK Packaging & Robust Pose Telemetry

Comprehensive architectural plan for deploying Kineticare to production with a Neon PostgreSQL database backend (via Drizzle ORM), Progressive Web App (PWA) installable APK distribution, enhanced computer vision tracking with temporal jitter filtering and body profile validation, and complete communication pathways between the mobile client and backend cloud services.

### User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural decisions were confirmed in Phase 1 and govern the system implementation:

- **Confirmed Decision 1 (Backend & Database)**: Deploy backend with a **Neon PostgreSQL database adapter using Drizzle ORM** (providing full relational persistence for patients, clinicians, exercises, assignments, sessions, and clinician issue reports).
- **Confirmed Decision 2 (Mobile Distribution)**: Package client as a **Progressive Web App (PWA) with installable APK builder (TWA / WebAPK)**, providing standalone mobile experience without requiring separate native codebase maintenance.
- **Confirmed Decision 3 (Camera Detection Robustness)**: Implement **Temporal joint angle smoothing** (EMA filter) to eliminate keypoint jitter, combined with **Automatic body alignment & side-profile check** (ensuring correct camera orientation before rep counting begins).

---

### 1. Overview & Core Concept

- **What It Does**: Kineticare provides on-device, camera-guided tele-rehabilitation for physical therapy patients (Dipesh) and attending clinicians (Dr. Aditi Yadav). The app runs real-time MoveNet pose tracking on-device with zero camera video uploads, while synchronizing assignments, structured clinical metrics, session reports, and exercise protocols through a centralized backend API.
- **Target Audience / Persona**:
  - *Patients*: Individuals recovering from orthopedic, musculoskeletal, or joint conditions performing prescribed home exercises with immediate biomechanical form feedback.
  - *Clinicians / Physical Therapists*: Doctors and physiotherapists managing patient caseloads, assigning custom targets, reviewing session evidence, and generating clinical SOAP notes.
  - *Developer / Administrator*: Technical team managing and expanding exercise protocols via standard REST endpoints and database migrations.
- **Key Value**: Bridges the consultation-to-home gap with clinical precision: patients move with confidence; clinicians receive objective range of motion (ROM), cadence, and fatigue telemetry without streaming gigabytes of raw video.

---

### 2. User Experience & Visual Design

#### Key User Flows

1. **Patient Mobile Setup & Installation**:
   - Patient visits the deployed URL on mobile browser; an in-app "Install App" prompt enables 1-tap installation to the home screen as a standalone WebAPK.
   - Launching the app opens in full-screen standalone mode with native system styling.
2. **Robust Pose Calibration & Workout**:
   - Patient selects an assigned exercise (e.g., Squat or Toe Touch).
   - **Pre-calibration validation**: The system checks lighting, distance, and automatically validates body orientation (e.g. verifying side profile by analyzing bilateral shoulder-to-hip alignment).
   - Once aligned, 2-second resting calibration locks baseline joint angles.
   - Live exercise runs with **temporal joint smoothing**: eliminates landmark flicker, delivers smooth angle gauges, and captures concentric/eccentric duration.
3. **Session Submission & Clinician Follow-up**:
   - Upon completion, telemetry (ROM, velocity, fatigue curve, repetitions) is submitted to the backend API (`POST /api/sessions`).
   - Attending clinician logs in, inspects patient progress, generates an automated SOAP note draft, or logs an exercise protocol report (`POST /api/reports/exercise`).

#### Visual Identity & Theme

- **Aesthetic Direction**: High-trust clinical minimalism. Clean, crisp white surfaces with deep medical navy and emerald reassurance accents. Zero generic decorative pills or artificial gradients.
- **Color Palette**:
  - *Primary Trust Navy*: `#1E2653` (headers, primary actions, branding)
  - *Pristine Background*: `#F8FAFC` (clinical white mode)
  - *Surface Card*: `#FFFFFF` with `#E2E8F0` hairline borders
  - *Clinical Reassurance Green*: `#0D825E` (badges, approved status, successful reps)
  - *Clinical Amber Alert*: `#B45309` (tracking warnings, form adjustments)
- **Typography**: Clean humanist system typography (`-apple-system`, `Segoe UI`, `Roboto`), strict numeric tabular alignment for degrees and durations, unboxed metadata separated by clean middots (`·`).

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Neon PostgreSQL with Drizzle ORM**
  - *Chosen Approach*: Define standard Drizzle ORM schema (`schema.ts`) with connection pooling support (`@neondatabase/serverless` / `pg`). Include both SQL migration scripts and a flexible in-memory/mock fallback so local development and CI tests run without external credentials.
  - *Why*: Provides developer flexibility to deploy to Vercel, Railway, or Render with instant branching, zero server maintenance, and strong relational integrity for patient-clinician-assignment relationships.
  - *Alternative Considered*: Firebase Firestore only (good for rapid prototyping, but user explicitly requested Neon PostgreSQL for unified SQL querying and custom backend control).
- **Decision 2: PWA + TWA APK Distribution vs Full Native Rewrite**
  - *Chosen Approach*: Equip the Vite frontend with `@vite-plugin-pwa` (or custom manifest & service worker), high-resolution icons (192x192, 512x512, maskable), and provide direct instructions/configuration for PWA Builder / Google Bubblewrap TWA generation.
  - *Why*: Allows 100% code reuse of WebGL TensorFlow.js acceleration without having to bridge camera streams across React Native native modules.

---

### 4. Technical Architecture & Data Strategy (Technical Reference)

#### End-to-End System Architecture

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
               │ (Configurable VITE_API_BASE_URL)
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
               │  - users                    │
               │  - assignments & plans      │
               │  - exercise_catalog         │
               │  - exercise_sessions        │
               │  - clinical_reports         │
               └─────────────────────────────┘
```

#### Database Schema Model (Drizzle ORM for Neon DB)

1. `users`: `id` (text/UUID), `email`, `role` (`patient` | `clinician`), `display_name`, `metadata` (JSONB)
2. `relationships`: `id`, `patient_id`, `clinician_id`, `active` (boolean), `created_at`
3. `exercises`: `id` (slug), `name`, `category`, `camera_view` (`side` | `front`), `primary_joint`, `normative_range` (JSONB), `instructions` (JSONB)
4. `assignments`: `id`, `patient_id`, `clinician_id`, `version`, `status` (`draft` | `published`), `items` (JSONB), `created_at`
5. `sessions`: `id`, `patient_id`, `assignment_id`, `exercise_name`, `reps_completed`, `overall_score`, `metrics` (JSONB: ROM, tempo, fatigue), `submitted_at`
6. `clinical_reports`: `id`, `exercise_id`, `patient_id`, `reported_by`, `reason`, `severity`, `notes`, `created_at`

#### Robust Pose Camera Upgrades

1. **Exponential Moving Average (EMA) Angle Smoother**:
   $$\theta_{\text{filtered}}(t) = \alpha \cdot \theta_{\text{raw}}(t) + (1 - \alpha) \cdot \theta_{\text{filtered}}(t-1)$$
   Prevents single-frame landmark flicker from generating false repetition inflection points.
2. **Body Alignment & Side-Profile Validation**:
   - For side-view exercises (`Squat`, `Toe Touch`), calculates the horizontal ratio between left and right shoulder/hip landmarks:
     $$\text{ProfileRatio} = \frac{|\Delta x_{\text{left-right}}|}{W_{\text{torso}}}$$
   - When $\text{ProfileRatio} > 0.45$, alerts the patient: *"Please turn side-on to the camera"*, preventing inaccurate planar angle measurements.

#### Mobile Deployment & APK Flow

1. **Frontend PWA Setup**:
   - Configure `manifest.json` with `id: '/'`, `display: 'standalone'`, and app icons.
   - Implement `usePWAInstall` with prompt button in the user profile and navigation header.
2. **Backend Deployment (Vercel / Node)**:
   - Provide `vercel.json` and standalone Express entrypoint with Neon DB environment configuration (`DATABASE_URL`).
3. **APK Generation**:
   - Document step-by-step export via PWABuilder.com / Google Bubblewrap CLI to produce signed release `.apk` and `.aab` (Google Play bundle) communicating with the deployed backend.
