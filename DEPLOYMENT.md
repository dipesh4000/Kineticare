# Kineticare Production Deployment & Distribution Guide

Comprehensive, step-by-step guide for deploying the Kineticare fullstack tele-rehabilitation platform to production, setting up Neon serverless PostgreSQL with Drizzle ORM, deploying the backend to Vercel, and packaging the frontend into an installable Android APK.

---

## Architecture Overview

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                            MOBILE CLIENT (APK / PWA)                        │
│                                                                             │
│   ┌─────────────────────┐   ┌──────────────────────┐   ┌────────────────┐   │
│   │ WebGL Camera Stream │──▶ MoveNet Lightning     ──▶│ Temporal EMA   │   │
│   │ (On-Device 30fps)   │   │ Pose Estimation      │   │ Smoothing &    │   │
│   └─────────────────────┘   └──────────────────────┘   │ Side-Profile   │   │
│                                                        │ Alignment      │   │
│                                                        └───────┬────────┘   │
│                                                                │            │
│   ┌─────────────────────┐   ┌──────────────────────┐           ▼            │
│   │ Patient / Clinician │◀──  Repetition Engine &  ◀──────────┘            │
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
               │  - users                    │
               │  - assignments & plans      │
               │  - exercise_catalog         │
               │  - exercise_sessions        │
               │  - clinical_reports         │
               └─────────────────────────────┘
```

---

## 1. Prerequisites

- **Node.js**: v18.0.0 or higher
- **Neon Cloud Account**: Free account at [neon.tech](https://neon.tech)
- **Vercel Account**: [vercel.com](https://vercel.com) (or any Node.js hosting platform like Render, Railway, or Fly.io)
- **Google Play Developer Account** (optional, only if publishing to Google Play Store)

---

## 2. Step 1: Online Database Setup (Neon PostgreSQL)

Kineticare uses **Neon serverless PostgreSQL** managed through **Drizzle ORM** for scalable, zero-maintenance relational persistence.

1. **Create a Neon Project**:
   - Log into [console.neon.tech](https://console.neon.tech).
   - Click **Create Project** and choose a name (e.g., `kineticare-prod`).
   - Select your preferred cloud region (e.g., AWS `us-east-2` or `eu-central-1`).
2. **Obtain Connection String**:
   - Copy the connection string from the Neon dashboard. It looks like:
     ```text
     postgresql://neondb_owner:npg_AbCdEf12345@ep-cool-fog-12345.us-east-2.aws.neon.tech/neondb?sslmode=require
     ```
3. **Database Schema & Tables**:
   - The Drizzle schema is located at `backend/db/schema.js`.
   - The tables include:
     - `users`: Patient and clinician identities (Dipesh, Dr. Aditi Yadav).
     - `relationships`: Links patients to attending clinicians.
     - `exercises`: Biomechanical degree thresholds, camera angles, and instructions.
     - `assignments`: Prescribed exercise sets, reps, and targets.
     - `sessions`: Completed reps, ROM compliance, and fatigue curves.
     - `clinical_reports`: Flagged exercise issues, pain reports, and contraindications.

---

## 3. Step 2: Backend Deployment (Vercel)

The backend Express application is pre-configured for Vercel Serverless Functions via `backend/vercel.json`.

1. **Option A: Deploy via GitHub (Recommended)**:
   - Push your repository to GitHub.
   - Go to [vercel.com/new](https://vercel.com/new) and import the repository.
   - Set **Root Directory** to `./` (root) or `./backend`.
   - In **Environment Variables**, add:
     - `DATABASE_URL`: Your Neon PostgreSQL connection string.
     - `NODE_ENV`: `production`
   - Click **Deploy**.
   - Your backend API will be available at:
     ```text
     https://<your-project>.vercel.app/api/health
     ```

2. **Option B: Deploy via Vercel CLI**:
   ```bash
   npm install -g vercel
   vercel login
   vercel --prod
   ```

3. **Verify Backend Health**:
   ```bash
   curl https://<your-backend>.vercel.app/api/health
   ```
   Expected response:
   ```json
   {
     "status": "ok",
     "service": "Kineticare Tele-Rehabilitation Engine",
     "version": "2.1.0",
     "capabilities": [
       "pose_telemetry_analysis",
       "clinical_metrics_computation",
       "fatigue_detection",
       "eccentric_phase_timing",
       "soap_note_generation",
       "exercise_catalog_management",
       "clinical_issue_reporting"
     ]
   }
   ```

---

## 4. Step 3: Frontend Deployment

The frontend is a Vite React Single Page Application that can be deployed to any static host (Vercel, Netlify, Cloudflare Pages, Firebase Hosting, or GitHub Pages).

1. **Configure Production Backend URL**:
   - In `frontend/`, create a file named `.env.production`:
     ```env
     VITE_API_BASE_URL=https://<your-backend>.vercel.app
     ```
2. **Build the Production Bundle**:
   ```bash
   npm run build --workspace=frontend
   ```
   The compiled assets will be placed in `frontend/dist/`.
3. **Deploy Static Assets**:
   - If using Vercel, create a second project for the frontend pointing to `frontend/dist`.
   - If using Cloudflare Pages / Netlify: Set build command to `npm run build --workspace=frontend` and publish directory to `frontend/dist`.

---

## 5. Step 4: Packaging and Publishing the Android APK

Kineticare includes a Web App Manifest (`frontend/public/manifest.json`), high-resolution icons, and responsive mobile viewport controls, allowing you to generate an installable Android APK in minutes without rewriting code.

### Method A: PWABuilder (Recommended & Easiest)

1. Open [pwabuilder.com](https://www.pwabuilder.com).
2. Enter your deployed frontend HTTPS URL (e.g., `https://kineticare-app.vercel.app`).
3. Click **Start**. PWABuilder will audit your PWA manifest, service worker, and icons.
4. Click **Package for Stores** > **Android**.
5. Configure your package options:
   - **Package ID**: `com.kineticare.app`
   - **App Name**: `Kineticare`
   - **Launcher Name**: `Kineticare`
   - **Signing Key**: Select *New (generate my own)* for first-time builds.
6. Click **Download APK**.
   - You will receive a `.zip` containing:
     - `app-release-signed.apk` (can be directly sideloaded onto Android devices).
     - `app-release-bundle.aab` (ready to upload to the Google Play Console).

### Method B: Google Bubblewrap CLI (Advanced Developers)

```bash
# Install Bubblewrap CLI
npm install -g @bubblewrap/cli

# Initialize project from your live manifest
bubblewrap init --manifest https://<your-frontend-domain>/manifest.json

# Build the release APK and Android App Bundle (AAB)
bubblewrap build
```

---

## 6. How the APK Communicates with Your Backend

1. When the patient opens the installed APK on their smartphone, the app boots instantly in full-screen standalone mode.
2. The smartphone's GPU executes MoveNet SinglePose Lightning locally at 30+ FPS through WebGL.
3. When the user completes a session or a clinician flags an exercise, the app dispatches HTTPS requests directly to your Vercel backend URL defined by `VITE_API_BASE_URL`:
   - `POST https://your-backend.vercel.app/api/analytics/evaluate-session`
   - `POST https://your-backend.vercel.app/api/reports/exercise`
   - `GET  https://your-backend.vercel.app/api/exercises`
4. The Vercel backend reads and writes relational records directly to your Neon PostgreSQL database.

---

## 7. Environment Variables Reference

| Variable | Scope | Description | Example |
| --- | --- | --- | --- |
| `DATABASE_URL` | Backend | Neon PostgreSQL connection string with SSL | `postgresql://user:pass@ep-name.us-east-2.aws.neon.tech/neondb?sslmode=require` |
| `PORT` | Backend | Port for Node server (defaults to 3000) | `3000` |
| `NODE_ENV` | Backend | Node runtime environment | `production` |
| `VITE_API_BASE_URL` | Frontend | Target backend API URL for the APK/client | `https://your-backend.vercel.app` |
| `VITE_FIREBASE_API_KEY` | Optional | Firebase API Key (if using Firebase mode) | `AIzaSy...` |

---

## 8. Pre-Release Checklist

- [x] All 14 automated unit and biomechanical test suites passing (`npm test`).
- [x] Linter passing with zero warnings (`npm run lint`).
- [x] On-device pose detection running with Exponential Moving Average (EMA) smoothing.
- [x] Body alignment validation active for side-view exercises (Squat, Toe Touch).
- [x] PWA Manifest and high-resolution icons verified at `/manifest.json`.
- [x] In-app install button (`PWAInstallButton`) mounted and responsive across Android and iOS.
- [x] Zero camera frames uploaded across the network (HIPAA/GDPR compliance).
