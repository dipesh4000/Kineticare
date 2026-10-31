# Kineticare — End-to-End Project Overview

Kineticare is a tele-rehabilitation platform that uses on-device computer vision to guide patients through physiotherapy home exercises and lets clinicians remotely monitor, assign, and respond to those sessions. No video is ever transmitted — the camera stays local and only structured biomechanical telemetry reaches the server.

---

## 1. Repository Layout

```
Kineticare/
├── backend/                 # Node.js Express 5 API
│   ├── config/              # Port, host, env loader
│   ├── routes/              # Express routers (auth, records, ai, analytics, exercises, reports)
│   ├── services/            # MongoDB client, Privy auth, analytics engine, exercise registry
│   ├── test/                # Backend integration tests (Node built-in test runner)
│   └── server.js            # Entry point — mounts /api and serves frontend/dist
│
├── frontend/                # React 19 SPA (Vite 8, Tailwind 4)
│   ├── src/
│   │   ├── auth/            # Privy AuthProvider + AuthContext
│   │   ├── client/          # Clinician screens (Overview, Patients, PatientDetail, Assign, Library)
│   │   ├── components/      # Shared UI (Login, Toast, MovementReport, ExportPdf, charts…)
│   │   ├── exercise/        # Kinematics engine (FSM, scoring, definitions, measure)
│   │   ├── patient/         # Patient screens (Home, Workout, Live, Summary, Progress, Profile…)
│   │   ├── records/         # RecordsProvider — workspace data context
│   │   ├── services/        # API client, atlasRecords connector, media helper
│   │   ├── session/         # Session draft persistence + profiler
│   │   ├── vision/          # MoveNet hook (usePoseCamera) + geometry math
│   │   ├── App.jsx          # React Router tree + role-gated route guards
│   │   └── main.jsx         # Root render: AuthProvider → RecordsProvider → App
│   └── package.json
│
├── scripts/                 # Dev launcher (launch.mjs), smoke tests, launch.test.mjs
├── docs/                    # Setup guides, feature roadmap, patient flow spec
├── .env                     # Backend secrets (never committed)
├── package.json             # npm workspaces root — backend deps + workspace scripts
└── vercel.json              # Current: frontend-only static deploy config
```

---

## 2. Tech Stack

### Backend
| Concern | Technology |
|---|---|
| Runtime | Node.js 22+ (ESM, `"type": "module"`) |
| Framework | Express 5 |
| Database | MongoDB Atlas — native `mongodb` driver v7 (no Mongoose) |
| Auth | Privy (`@privy-io/node`) — JWT Bearer token verification |
| AI | Google Gemini API — called via raw `fetch()`, structured JSON output mode |
| Crypto | Node built-in `node:crypto` — SHA-256 invite hashing, `randomUUID`, `randomBytes` |
| Test runner | Node built-in `node --test` |

### Frontend
| Concern | Technology |
|---|---|
| Framework | React 19 |
| Build tool | Vite 8 |
| Styling | Tailwind CSS 4 |
| Routing | React Router DOM 7 |
| Auth | `@privy-io/react-auth` — email OTP, no passwords |
| Computer Vision | TensorFlow.js 4 — WebGL backend, `@tensorflow-models/pose-detection` (MoveNet) |
| Test runner | Node built-in `node --test` |

---

## 3. Architecture

```
Browser (patient or clinician)
│
├── TensorFlow.js (WebGL)
│   └── MoveNet Lightning/Thunder (17 keypoints, local GPU)
│       └── geometry.js → joint angles via arccos dot product
│           └── EMA smoothing (α = 0.35) + step limiter (>45° cap)
│               └── FSM engine.js → rep counting with dwell hysteresis
│
├── React SPA
│   ├── AuthProvider (Privy JWT)
│   └── RecordsProvider (workspace cache)
│       └── fetch /api/* with Bearer token
│
└── Express 5 backend (port 3001)
    ├── requirePrivy → verifies JWT with Privy server SDK
    ├── requireProfile → loads user from MongoDB users collection
    └── Route handlers → MongoDB Atlas (patientRecords, users, relationships, careInvites…)
```

The camera feed never leaves the browser. Only computed numbers (rep count, peak excursion degrees, duration, eccentric ratio) are posted to the backend.

---

## 4. Authentication & Identity

1. User visits `/` — Privy email OTP modal opens.
2. Privy issues a short-lived JWT access token to the browser.
3. Every API request attaches `Authorization: Bearer <token>`.
4. `requirePrivy` middleware calls Privy's server SDK to verify the token and extracts `privyId`.
5. `requireProfile` looks up the user document in MongoDB by `_id = privyId`.
6. `req.identity` is set to the full user profile with `role: 'patient' | 'clinician'`.
7. Route handlers branch on role — patients and clinicians share the same auth path but see different data.

**Registration** is separate from login: after first sign-in, if no profile document exists, the frontend prompts for `displayName` and `role`, which are posted to `POST /api/auth/register`.

---

## 5. Data Model (MongoDB Collections)

### `users`
```js
{
  _id: privyId,          // Privy user ID (string)
  email: string,
  role: 'patient' | 'clinician',
  displayName: string,
  professionalVerified: boolean,
  createdAt: ISO string
}
```

### `relationships`
```js
{
  _id: patientId,        // One row per patient (max one active relationship)
  clinicianUid: string,
  active: boolean,
  consentVersion: string,
  consentAt: ISO string,
  revokedAt?: ISO string
}
```

### `careInvites`
```js
{
  _id: SHA256(code),     // Raw code never stored
  clinicianUid: string,
  expiresAt: Date,       // 24-hour TTL
  createdAt: Date
}
```

### `patientRecords`
A single collection acting as a key-value store for all patient data:
```js
{
  _id: `${patientId}:${kind}:${id}`,
  patientId: string,
  kind: 'sessions' | 'assignments' | 'feedback' | 'requests' | 'reviews',
  data: { ...kind-specific payload }
}
```

### `exerciseDrafts`
```js
{
  _id: UUID,
  ownerUid: clinicianId,
  exercise: { name, description, steps[], precautions[] },
  reference: string,
  status: 'pending-review' | 'reviewed' | 'rejected',
  provider: 'gemini',
  model: string,
  capability: 'unmeasured'
}
```

### `aiGenerationLeases`
Rate-limit guard: one document per `clinicianId:minuteBucket`, inserted with `insertOne`. Duplicate key = 429.

### `exerciseReports`
Safety/incident reports filed by any authenticated user about a specific exercise.

---

## 6. API Routes

All routes are prefixed `/api`.

### Auth (`/api/auth`)
| Method | Path | Role | Purpose |
|---|---|---|---|
| GET | `/me` | any | Load own profile |
| POST | `/register` | any (unregistered) | Create profile with name + role |
| GET | `/relationship` | patient | Get current clinician link |
| POST | `/invite-code` | clinician | Generate 24h invite code |
| POST | `/link` | patient | Redeem invite + consent |
| POST | `/revoke` | patient | Instantly sever clinician link |

### Records (`/api/records`)
| Method | Path | Purpose |
|---|---|---|
| GET | `/workspace` | Load full workspace (patients, sessions, assignments, feedback, requests) |
| POST | `/:patientId/saveSession` | Patient submits completed session |
| POST | `/:patientId/saveAssignmentDraft` | Clinician saves draft assignment |
| POST | `/:patientId/publishAssignment` | Clinician publishes assignment to patient |
| POST | `/:patientId/sendFeedback` | Clinician sends session-linked feedback |
| POST | `/:patientId/markFeedbackRead` | Patient marks feedback as read |
| POST | `/:patientId/createRequest` | Patient sends a message/question/help request |
| POST | `/:patientId/markSessionReviewed` | Clinician marks a session as reviewed |
| POST | `/:patientId/replyToRequest` | Clinician replies to a request |
| POST | `/:patientId/resolveRequest` | Clinician closes a request |

### AI (`/api/ai`) — clinician only
| Method | Path | Purpose |
|---|---|---|
| GET | `/drafts` | List own exercise drafts |
| POST | `/drafts` | Generate new Gemini exercise draft |
| POST | `/drafts/:id/review` | Approve or reject a draft |

### Analytics (`/api/analytics` and `/api/clinical`)
| Method | Path | Purpose |
|---|---|---|
| POST | `/evaluate-session` | Score reps: ROM, tempo, eccentric ratio, fatigue index, clinical flags |
| POST | `/soap-note` | Generate structured SOAP note from session data |

### Exercises (`/api/exercises`)
| Method | Path | Purpose |
|---|---|---|
| GET | `/` | Full exercise catalog |
| GET | `/:id` | Single exercise detail |

### Reports (`/api/reports`)
| Method | Path | Purpose |
|---|---|---|
| POST | `/exercise` | File a safety/incident report |
| GET | `/exercise` | List own reports |

### Health
| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Service status, version, capability list |

---

## 7. Computer Vision Pipeline

All processing happens in the browser. Nothing is uploaded.

```
Webcam (MediaStream)
  ↓
usePoseCamera.js — requestAnimationFrame loop, ~30fps
  ↓
TensorFlow.js MoveNet (WebGL) — 17 keypoints with confidence scores [0,1]
  ↓
geometry.js
  ├── namedKeypoints() — maps array indices to body part names
  ├── angleAt(A, V, B) — arccos dot product, clamped to [-1,1]
  ├── EMA filter (α=0.35) + step limiter (cap jumps >45°)
  ├── checkSideOrientation() — shoulder span / torso height ratio >0.45 → warn
  └── checkDistance() — nose-to-ankle pixel span vs frame height
  ↓
definitions.js — extracts the correct joint triple per exercise
  ├── squatKneeAngle()    — hip → knee → ankle (side view)
  ├── toeTouchHipAngle()  — shoulder → hip → knee (side view)
  └── armRaiseAngle()     — hip → shoulder → elbow (front view)
  ↓
measure.js — normalises raw angle to [0,1] progress signal
  ↓
engine.js — Repetition FSM
  REST → OUTBOUND → RETURNING → COMPLETE → REST
  Dwell hysteresis: 120ms per transition
  Validity: duration ≥600ms, peak ≤160% of target
  Output per rep: { peak, durationMs, outboundMs, returnMs, eccentricRatio, withinTarget }
  ↓
score.js / analytics.js — per-rep scoring
  ├── ROM compliance (55% weight)
  ├── Tempo score (30% weight)
  └── Eccentric control ratio (15% weight)
  → overallScore, consistencyScore, fatigueIndex, clinicalFlags[], patientTips[]
```

---

## 8. Patient Flow

```
Login (Privy OTP)
  ↓
/patient/home  — dashboard: today's plan, session history, feedback, weekly chart
  ↓
/patient/workout — select exercise from assignment or self-guided list
  ↓
/patient/pre  — camera permission check, framing guidance
  ↓
/patient/live  — full-screen HUD
                  ├── Canvas skeleton overlay
                  ├── Rep counter ring
                  ├── Real-time audio cues (Web Speech API)
                  └── Guidance text ("Lower your hips", "Stand upright")
  ↓
/patient/sum  — session summary: rep breakdown, score, tempo, active time
  ↓
POST /api/records/:id/saveSession → MongoDB
  ↓
/patient/prog  — historical progress charts
/patient/fb    — clinician feedback thread
/patient/me    — profile, care connection status, revoke access
```

---

## 9. Clinician Flow

```
Login (Privy OTP)
  ↓
/client/overview  — at-a-glance panel: active patients, pending sessions, flags
  ↓
POST /api/auth/invite-code  — generate 24h care invite
  (patient redeems via /patient/me → POST /api/auth/link)
  ↓
/client/patients  — roster list
  ↓
/client/patients/:id  — patient detail
  ├── Session timeline with reviewed/pending status
  ├── Session-linked feedback thread (POST /api/records/:id/sendFeedback)
  └── Mark session reviewed (POST /api/records/:id/markSessionReviewed)
  ↓
/client/patients/:id/assign  — assignment builder
  ├── Choose exercise, set target degrees + reps
  ├── Attach bundled reference video
  ├── Save draft → POST /api/records/:id/saveAssignmentDraft
  └── Publish → POST /api/records/:id/publishAssignment
  ↓
/client/library  — AI exercise draft tool
  ├── Input brief + textbook reference + notes
  ├── POST /api/ai/drafts → Gemini generates JSON (name, description, steps, precautions)
  └── Review/approve → POST /api/ai/drafts/:id/review
```

---

## 10. Consent & Privacy Architecture

- **Zero video** — MediaStream frames are never encoded or sent anywhere. The backend only receives numbers.
- **Cryptographic invites** — 24 random bytes → base64url code given to patient. SHA-256 hash stored in `careInvites`. Raw code never persisted.
- **24-hour expiry** — invite documents have a `expiresAt` field checked on every redemption attempt.
- **Explicit consent step** — `POST /api/auth/link` requires `consent: true` and the correct `clinicianUid` as a second confirmation step.
- **One-to-one relationships** — a patient can only have one active clinician link at a time.
- **One-click revocation** — `POST /api/auth/revoke` sets `active: false` immediately, blocking all subsequent clinician queries.
- **Isolated data access** — all records queries include an `active: true` relationship check before returning patient data.
- **AI safety gate** — Gemini drafts land as `status: 'pending-review'` and `capability: 'unmeasured'`. They cannot be assigned to patients until the clinician manually reviews and approves them.
- **Rate limiting** — Gemini generation is rate-limited to once per minute per clinician via a MongoDB lease document, preventing runaway API cost.

---

## 11. Workspace Data Pattern

The frontend loads everything via a single `GET /api/records/workspace` call on startup. The backend returns a unified snapshot:

```json
{
  "patients": [...],
  "assignments": { "patientId": {...} },
  "assignmentDrafts": { "patientId": {...} },
  "sessions": { "patientId": [...] },
  "feedback": { "patientId": [...] },
  "requests": { "patientId": [...] },
  "relationship": { "clinicianUid": "...", "clinicianName": "..." },
  "references": [...]
}
```

This is stored in `RecordsProvider` (React Context) and used throughout the app without further network calls until a mutation triggers a refresh.

---

## 12. Exercises

Three exercises are implemented end-to-end:

| Exercise | Camera | Joint measured | Signal direction |
|---|---|---|---|
| Squat / mini-squat | Side-on | Knee (hip→knee→ankle) | Angle decreases on descent |
| Standing toe touch | Side-on | Hip hinge (shoulder→hip→knee) | Angle decreases on forward bend |
| Bilateral side arm raise | Front-facing | Shoulder abduction (hip→shoulder→elbow) | Angle increases on raise |

Bundled reference videos are served from `frontend/public/` and validated server-side by `referenceId` + `referenceVersionId` before an assignment can be published.

---

## 13. Running Locally

```bash
# 1. Install all workspaces
npm install

# 2. Create root .env (see .env.example)
#    Required: PRIVY_APP_ID, PRIVY_APP_SECRET, MONGODB_URI
#    Optional: GEMINI_API_KEY, GEMINI_MODEL

# 3. Create frontend/.env.local
#    VITE_PRIVY_APP_ID=<same as backend PRIVY_APP_ID>

# 4. Start both servers (kills occupied ports automatically)
npm run dev
# → backend on http://localhost:3001
# → frontend on http://localhost:3000

# Run tests
npm test              # frontend kinematics + FSM tests
npm run test:backend  # backend auth + consent integration tests
```

---

## 14. Known Limitations

- **2D only** — single-camera vision cannot detect out-of-plane rotation, knee valgus/varus, or spinal alignment.
- **Three exercises** — squat, toe touch, and side arm raise are the only implemented modalities.
- **Not an FDA device** — this is a prototype. Clinical deployment would require regulatory review.
- **Vercel deployment** — the current `vercel.json` only deploys the frontend. A unified config that also deploys `backend/server.js` as a serverless function is needed for full cloud deployment (see DEPLOYMENT.md).
- **Native addons** — `utf-8-validate` and `bufferutil` are transitive ws/socket.io dependencies with native addons. They do not affect any active route code but may cause install warnings on systems without build tools.
