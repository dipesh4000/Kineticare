# Kineticare Technical Implementation Plan

Version: 1.2 | Updated: 22 October 2026 | Status: UI refresh implemented; deployment preparation reviewed; cloud and device release checks pending

## Current implementation status — 22 October 2026

This status update supersedes older descriptions of the current UI and deployment setup below. Sections 3 and 23–26 preserve the original migration plan and the 17 October audit as historical context; they are not a fresh audit of today's code. Unverified acceptance gates remain open.

### Completed in the UI and deployment preparation pass

- Refreshed patient and clinician portals and sign-in with softer cards, clearer hierarchy, navigation icons, branded banners, and patient care shortcuts.
- Adopted a VS Code-style blue primary (`#007ACC`), deeper blue interaction states, pale blue selections, warm off-white backgrounds, dark slate text, and restrained sage, amber, and lavender accents.
- Recoloured the existing logo blue while preserving its design. The built-in Imagegen edit is saved as `frontend/public/logo-blue.png`; the original teal asset is retained. Updated brand headers, banners, report previews, favicon references, manifest colours, and the existing app icon palette.
- Added branded exercise-schedule and selected-session analysis previews. Doctors can open Schedule PDF and Analysis PDF from a patient record; patients can export their plan. Saving uses the browser's Print / Save as PDF destination rather than a direct PDF download.
- Removed the install-app button from the patient home screen at the user's request. Installation guidance elsewhere is outside this change.
- Rewrote `DEPLOYMENT.md` against the active code: Firebase provides shared authentication/records/media; the Neon/Drizzle scaffold is not connected to active API routes.
- Added root `vercel.json` for the static frontend build and SPA deep links. Corrected Firebase Hosting's public directory to `frontend/dist` and clarified environment-file placement and build-time variables in `.env.example`.
- Documented Vercel static-demo deployment, a same-origin Node full-stack prototype, Firebase account provisioning, and deployment limitations. No cloud deployment has been performed. The user manages deployment and all Git operations.

### Verified locally

- Production build and lint passed; all 19 existing exercise/patient-flow unit tests passed during the blue-theme pass.
- Patient and clinician screens were checked in the browser, including the blue logo and primary colour; no horizontal overflow was observed in the checked patient layout.
- Schedule and analysis previews were checked. Changing the doctor's selected session changed the exported date and results. The native PDF save and multipage output still need target-browser verification.
- The built Express server passed a local smoke check for `/api/health`, `/patient/home`, `/client/overview`, and the blue logo asset.
- The subsequent home-screen install-button removal passed targeted ESLint verification.
- Firestore emulator tests, Storage access checks, cloud deployment, and the full real-device/cross-account acceptance walkthrough were not completed in this pass.

### Next work and release gates

1. Publish a demo using the corrected `DEPLOYMENT.md` when the user is ready. Confirm HTTPS, direct-route refresh, logo assets, camera permissions, and both portals on the deployed hostname.
2. For shared accounts, configure all six Firebase web values, provision the first clinician, deploy restrictive rules, and verify invitation acceptance, reference playback, records, and feedback across separate accounts/devices. Check the clinician collection-group query and any required indexes.
3. Before real patient use, authenticate/authorize Express routes, persist exercise reports and runtime registry updates, and fix fabricated fallback score/consistency values when valid measurements are absent. The static frontend's report fallback currently does not persist a report.
4. Run Firestore rule tests and linked/unlinked-account checks; verify Storage rules and reference-media CORS. Local build success does not establish cloud access correctness.
5. Validate native Print / Save as PDF output in target browsers and test live exercise setup, tracking loss, draft recovery, and session saving on real devices.
6. Continue the agreed UX direction: simplify patient setup/live/summary around one clear action, improve tablet layouts, and make clinician review easier to scan. The completed palette refresh does not mean those workflow changes have shipped.
7. Treat Android packaging and offline support as later work. The manifest exists, but no service worker is registered; do not promise offline operation or guaranteed installation. Avoid unverified compliance claims.

See `DEPLOYMENT.md` for exact hosting settings, environment variables, commands, and the unchecked release checklist.

## 1. Objective and release contract

Build a responsive MVP in the existing React frontend. A clinician captures an exercise reference inside Kineticare, approves it, assigns a patient-specific target, and receives a real camera-measured patient session. Feedback must return to the patient. Complete this loop with squat first, then side arm raise. Use provisioned test accounts and team members for the demonstration. Work by acceptance gates rather than a fixed hackathon-hour budget.

This file combines the implementation plan with the dated status update above. Older planned requirements are not evidence that an integration or acceptance test is complete. `overview.md` explains the product and presentation story. No Git operations are part of this plan; the user manages Git.

## 2. Confirmed scope and working defaults

### Required for MVP

- Existing React/Vite application and patient/clinician layouts.
- Squat and side arm raise, each with an explicit supported camera view.
- Reference capture inside the application, playable approved reference videos on both devices, derived reference approval and versioning.
- Patient calibration independent of the clinician recording.
- Real pose overlay, repetitions, elapsed/active/paused/unassessed time, and transparent movement measurements.
- Patient-specific assignment targets, visible text cues, optional English speech.
- Persistent accounts, assignments, sessions, review status, and session-linked feedback across devices.
- Tracking loss, partial sessions, refresh recovery, explicit save status, and permissions tests.
- A clearly labeled replay fixture for regression checks and demonstration recovery.

### Deferred

Clinician arbitrary video-file uploads, more exercises, public registration, native apps, payment, automatic diagnosis, recovery estimates, generative medical advice, and custom LSTM training. Approved videos recorded inside Kineticare are included so the patient can view exercise instructions as in the reference demonstration. A learned classifier is not needed to measure a known assigned exercise.

### Defaults that may change after the first device check

Use MoveNet SinglePose Lightning in the browser. Evaluate Thunder on the same devices only if tracking quality is insufficient; changing estimator configuration versions invalidates compatible-reference assumptions until checked. Use Firebase Authentication, Firestore, Cloud Storage for approved in-app reference recordings, and Firebase Hosting for the shared test environment. Do not create a custom API server for standard authenticated CRUD. Use deterministic report text; no LLM service is required.

Squat starts with a side-view knee-angle measurement because it gives a directly interpretable visible signal in that view. The supplied PDF's frontal hip-drop method remains an alternative only if real-device tests justify it. Camera-view changes are explicit protocol changes, not a silent runtime fallback. Arm raise uses a frontal view. The UI tells the patient to reposition between exercises.

## 3. Starting code and migration

Historical starting point (17 October audit): the app now lives at `frontend/` relative to this file. At the original audit it had React Router routes and patient/clinician components under `src/patient`, `src/client`, and `src/components`; `src/data.js` held mutable demo fixtures. `src/patient/Live.jsx` rendered an animated SVG, fixed eight-second exercise duration, and random scores. `Pre.jsx` provided manual setup checkboxes. `Summary.jsx` appended session results to in-memory fixture data. These descriptions are the migration baseline, not today's implementation status.

Reuse these screens and styles. Do not replace the app with another scaffold or maintain a second implementation in the standalone `kineticare(demo` folder. Do not delete existing user work. Move fixture data behind a clearly labeled replay/demo path while real screens use authenticated persisted data.

Migration priorities:

1. Replace global `DATA.plan`, `DATA.sess`, and feedback mutation with patient-scoped records and reactive subscriptions.
2. Replace simulated live measurements with the camera pipeline.
3. Reset exercise state explicitly when exercise ID changes; route-state changes must not retain the previous timer or effect closure.
4. Remove side effects from React state updater functions; navigation and persistence must be driven by explicit session events.
5. Bind assignment and feedback writes to patient IDs and session IDs, not the currently selected display card alone.
6. Remove hardcoded adherence and claims of nine recognized exercises from real MVP views.
7. Give every displayed timestamp a real value and format in the viewer's locale; store UTC timestamps.

## 4. Architecture

```text
Clinician browser
  capture -> pose landmarks -> reference measurements -> review and approve
  patient selection -> assignment referencing an immutable reference version
                                  |
                     Firebase Auth + Firestore
                                  |
Patient browser                   |
  assignment -> playable approved reference video, animation, and instructions
  camera -> pose detector -> visibility gate -> calibration
         -> exercise measurements -> rep state machine -> live UI and cues
         -> local session draft -> persisted session -> clinician review
                                  |
                          session-linked feedback -> patient
```

Camera inference stays on the device. Firestore receives compact approved references, assignments, results, and feedback, not a stream of every camera frame. A clinician's explicitly approved in-app reference recording is stored as a versioned object so the assigned patient can play it on another device. Temporary rejected captures are discarded. A compact pose trace also supports a skeleton demonstration. Raw patient workout video is not uploaded or retained. This reference-video requirement supersedes version 1.0's local-preview-only simplification to match the supplied demo's instruction videos.

## 5. Dependencies and code organization

Keep React, Vite, React Router, and existing CSS. Add Firebase's web SDK and the TensorFlow.js pose-detection dependencies required by the chosen backend. Pin tested compatible versions during implementation; do not copy version numbers from a reference slide. Prefer Canvas 2D, native browser camera/speech APIs, and React state/context before adding UI, chart, state-management, or animation libraries.

Create modules only when a real responsibility needs them. Proposed organization:

```text
frontend/
  src/
    App.jsx                     existing route shell
    patient/                    existing views, wired to real data
    client/                     existing views plus ReferenceCapture.jsx
    components/                 existing shared controls
    auth/AuthProvider.jsx       auth state and route gating
    services/firebase.js        one SDK initialization
    services/records.js         direct Firestore reads/writes/subscriptions
    vision/usePoseCamera.js      camera and detector lifecycle
    vision/geometry.js          pure pixel-coordinate geometry
    exercise/definitions.js     the two supported protocols and required joints
    exercise/engine.js          pure timestamped rep state and metrics
    exercise/reference.js       calibration/reference extraction and validation
    session/SessionProvider.jsx session state and recovery draft
    fixtures/                   labeled reference/replay fixtures
  tests/                        small pure-logic and emulator tests
  public/models/                licensed, versioned model assets if self-hosted
  .env.example                  public client configuration names only
firebase.json                   hosting, rules, emulator configuration
firestore.rules                 deny by default and explicit permissions
storage.rules                   reference video ownership, linked reads, and size/type limits
firestore.indexes.json          only indexes required by actual queries
```

Paths are proposals, not a requirement to create empty scaffolding. Keep the exercise engine independent of React and Firebase so a replay and the live camera exercise the same logic.

## 6. Identity and access

Provision one clinician account and at least two patient accounts in a dedicated test Firebase project. Use email/password sign-in and a simple account picker that fills test email labels, not embedded passwords. No public self-registration in MVP. Role choice on screen is navigation, never authority.

Store user role profiles using trusted administrative provisioning. A patient must not write their own role, clinician link, or another user's record. Link each patient to a clinician in a protected relationship record. Gate client routes for usability and enforce the same restrictions in Firestore rules.

Permission contract:

| Record | Patient | Linked clinician |
| --- | --- | --- |
| Profile and relationship | Read own allowed fields | Read linked patient fields |
| Approved reference | Read only when assigned/authorized | Create own draft; publish a new immutable version |
| Assignment | Read own | Create/version for linked patient |
| Session | Create own valid result; read own; finalize once | Read linked records; cannot rewrite measurements |
| Review and feedback | Read own; mark own feedback read | Create review/feedback for linked session |
| Approved reference video | Read only the assigned authorized reference | Create own in-app capture; approve a new version |

Use separate review records so clinician review cannot alter patient measurement fields. Validate document field types, allowed keys, IDs, numeric bounds, statuses, ownership, and immutable fields in rules. Test denied access using the Firebase Emulator Suite, including direct SDK calls that bypass the UI. Protected role/relationship records are seeded through a trusted admin process, not browser code.

Apply equivalent access checks in Storage rules. Keep reference objects under versioned owner/reference paths; validate size and permitted video content types. Metadata validation does not prove video content is clinically correct. Read authorization must use the actual assignment/relationship, not a client-provided owner label. Fetch authorized media through the SDK and revoke temporary playback object URLs on cleanup; do not distribute permanent public download links. A reference is publishable only after its media upload completes and the clinician approves it. Handle failed/orphaned uploads, deletion, retention, and versioned access explicitly. Check project Storage availability and any required account configuration before implementation; do not silently substitute local-only video playback.

Firebase web configuration is public app configuration. Database access relies on authentication and rules. Never put Admin SDK credentials, service-account JSON, or a future generative-service secret in Vite client variables. Keep project secrets out of documentation and fixtures.

## 7. Record contracts

Use explicit IDs rather than patient names as keys. Every result includes schema and measurement versions. Use generated UUIDs once per draft and reuse them on retries.

| Collection or path | Important fields and invariants |
| --- | --- |
| `users/{uid}` | `role`, `displayName`, `createdAt`; role is administratively provisioned |
| `relationships/{patientUid}` | `clinicianUid`, `active`; trusted provisioning in MVP |
| `references/{referenceId}/versions/{versionId}` | `ownerUid`, `exerciseId`, `cameraView`, `status`, `estimatorVersion`, `featureVersion`, `rest`, `peak`, `referenceDurationMs`, `qualitySummary`, `poseTrace`, `mediaPath`, `mediaContentType`, `mediaDurationMs`, `createdAt`, `approvedAt`; published versions immutable |
| `patients/{patientUid}/assignments/{assignmentId}` | `clinicianUid`, `version`, `status`, `schedule`, `instructions`, `items[]`, `createdAt`; each item pins reference path and target snapshot |
| `patients/{patientUid}/sessions/{sessionId}` | identity, immutable assignment snapshot, measurements, state, provenance, `mode`, `createdAt`, `submittedAt` |
| `patients/{patientUid}/reviews/{sessionId}` | `clinicianUid`, `status`, `reviewedAt`, reviewer notes |
| `patients/{patientUid}/feedback/{feedbackId}` | `sessionId`, `clinicianUid`, `message`, `createdAt`, `readAt`; ownership and links validated |

Example finalized session shape (illustrative, not measured results):

```json
{
  "schemaVersion": 1,
  "sessionId": "generated-once-uuid",
  "patientUid": "test-patient-uid",
  "assignmentId": "assignment-uuid",
  "assignmentVersion": 1,
  "status": "completed",
  "mode": "live",
  "startedAtClient": "2026-10-17T10:00:00.000Z",
  "submittedAt": "server timestamp at write time",
  "exerciseResults": [{
    "exerciseId": "squat",
    "referenceVersionId": "reference-version-uuid",
    "cameraView": "side",
    "assigned": {"targetReps": 5, "maxActiveDurationMs": null},
    "measurementVersion": "squat-side-v1",
    "estimatorVersion": "record actual loaded model version",
    "elapsedMs": 30000,
    "activeMs": 18000,
    "pausedMs": 2000,
    "unassessedMs": 4000,
    "readyRestMs": 6000,
    "attemptedReps": 5,
    "assessedReps": 4,
    "withinTargetReps": 3,
    "trackingCoverage": 0.857,
    "movementScore": 78,
    "scoreType": "prototype movement score",
    "scoreComponents": {"reach": 0.8, "tempo": 0.7},
    "flags": ["tracking_gap"],
    "perRep": [],
    "targetSnapshot": {"targetProgress": 1, "tempoMinMs": 2000, "tempoMaxMs": 5000}
  }]
}
```

The example uses readable placeholders; implement actual Firestore Timestamp values and numeric ranges, not the placeholder strings. Scores, counts, and coverage above are examples only. `perRep` stores bounded rep summaries, not raw frame arrays. Set a tested maximum session size below Firestore document limits; split long per-rep histories into a subcollection if the limit is approached. For MVP, constrain assignment/session length and reject oversized writes explicitly.

## 8. Camera and inference lifecycle

1. Ask for camera access only from an explicit user action. Use a secure HTTPS origin on phones; localhost is for local development.
2. Open a video-only stream with `playsInline` and a muted preview. Read actual video dimensions after metadata loads.
3. Load and warm the pinned MoveNet model; display loading, retry, unsupported-device, and permission-error states.
4. Run one inference at a time. Skip stale frames instead of building a queue. Use frame timestamps rather than assuming a fixed FPS.
5. Keep current landmarks and canvas drawing in refs; throttle React telemetry updates to a readable rate.
6. Calculate geometry in original video pixel coordinates, or convert normalized coordinates back using both dimensions before measuring angles. Account for crop, aspect ratio, and device rotation.
7. Mirror only the preview and overlay consistently; keep anatomical left/right labels consistent in measurements and spoken cues.
8. On pause, tracking loss, hidden tab, navigation, sign-out, or unmount, apply the session policy and clean up camera tracks, animation callbacks, speech, listeners, and detector resources.
9. Rotation, camera movement, or changed view requires recalibration. Do not continue with stale resting coordinates.

SinglePose does not establish that nobody else is in the frame. Require a single-person setup and flag implausible identity jumps. Reliable multi-person exclusion is a later detector capability; do not claim it already exists.

## 9. Tracking quality and calibration

Check the joints needed by the selected exercise rather than demanding all facial landmarks. Begin with a configurable keypoint-score threshold (for example 0.3) and tune against observed failures; this is not a calibrated probability of correct form. Require a stable valid window before enabling capture/start. Use confidence, frame gaps, border clipping, and abrupt geometry changes together.

Capture approximately two seconds of stable patient rest. Estimate a robust median resting signal and scale from visible body geometry. Reject degenerate vectors, a near-zero torso scale, implausible jumps, and non-finite angles. Smooth valid measurements using a time-aware exponential filter. Do not smooth missing points into apparently valid poses.

On tracking loss, freeze feedback and measurement accumulation, invalidate any incomplete repetition, retain the lost interval, and ask the user to reposition. After a stable reacquisition, return to rest and begin a new repetition. Do not join movements across a hidden interval. A quality coverage indicator and an unable-to-assess state must be distinct from movement performance.

## 10. In-app reference capture

### Capture sequence

`SELECT EXERCISE -> CHECK VIEW -> CAPTURE 5 SECONDS REST -> CAPTURE FIVE REPS -> CAPTURE 5 SECONDS REST -> PREVIEW -> APPROVE or RETRY`

Use the same pose pipeline and feature definitions as patient sessions. Check supported MediaRecorder MIME types, record only after clear consent, and create a temporary object URL for preview. Save an approved in-app reference video for assigned patients to play across devices. If recording is unsupported, show an explicit unsupported state and offer another tested device; a skeleton-only fallback does not pass the playable-reference-video acceptance criterion. Never imply a video was saved when only pose data exists.

The clinician explicitly marks the beginning/end of each of five reference repetitions in the capture/review interface. Within each segment, derive rest-to-peak signal and duration from valid frames. This avoids trying to detect a reference repetition using an unknown reference target. Record whole cycles returning to rest. Use robust medians across accepted segments, sufficient valid coverage, and an exercise-specific minimum signal excursion. The five-second rest periods follow the revised recording guide; patient-session calibration may still use a shorter tested stable window.

Reject an incomplete cycle, low coverage, invalid view, or inadequate range. Never silently clamp a bad recording into an approved reference. Show measured values, allow retry, and require review before publication. Defaults, if offered for development, are visibly labeled and cannot impersonate an approved recording.

Persist the approved derived template and a compact downsampled pose trace in Firestore, and store the consented approved reference video separately in protected Storage. Bound sample count and payload size; never place video bytes in a Firestore document. Each new approval creates a version; old assignments keep the old version. Keep reference-media retention distinct from the rule that patient workout video stays local.

### Demonstration versus patient target

The recording supplies a reference movement and pace. The clinician must explicitly set or accept a patient-specific target. A patient's rest calibration sets the zero point; body-scale normalization and angle features address limited geometry differences. Neither calibration nor normalization eliminates viewpoint error or makes a healthy demonstrator's movement appropriate for every patient.

## 11. Exercise protocols

### Squat or mini-squat

Initial camera protocol: side view with the near shoulder, hip, knee, and ankle visible. Lock a usable side during setup; do not alternate sides frame by frame. Compute the knee angle at the knee from hip-knee-ankle pixel coordinates. A flexion signal can be `restKneeAngle - currentKneeAngle`, increasing during descent. Validate the angle and signal excursion before using it.

Track descent, peak, return, repetition duration, and achieved target range. Show the assigned target and temporal feedback. A single side view is not sufficient to measure frontal knee alignment or bilateral symmetry; do not score these. Clinician-reviewed torso inclination may be an additional visible metric only after its meaning and reliability are tested.

The frontal hip-drop idea from the supplied build PDF is an alternative protocol, not the initial release claim. It needs stationary camera validation and patient rest calibration; it cannot be substituted mid-session without changing reference/measurement version.

### Side arm raise

Initial camera protocol: frontal view, hips and both shoulders, elbows, and wrists visible. Measure the angle at each shoulder using hip-shoulder-elbow. Track both sides independently, compare against the assigned side/range, and detect complete raising/return cycles.

A bilateral assignment can display left/right difference, but unequal movement is a deviation from the assignment only when the clinician has configured a bilateral symmetry target. Support deliberately different left/right ranges without penalizing an intended limitation. Do not claim to measure scapular mechanics, muscle activation, or shoulder injury.

### Shared protocol metadata

Each exercise defines ID, name, camera view, required joints, feature units/direction, setup text, reference requirements, supported measurements, cue keys, and parameter version. Any general muscle information is a static clinician-reviewed explanation, never inferred activation from the camera.

## 12. Repetition engine and timing

Keep session state distinct from rep state.

Session states: `IDLE`, `PREPARING`, `CALIBRATING`, `READY`, `RUNNING`, `PAUSED`, `TRACKING_LOST`, `FINISHING`, `PENDING_SAVE`, `SAVED`, `SAVE_ERROR`, `ABORTED`.

Rep states: `REST`, `OUTBOUND`, `RETURNING`. Track `pMax`, phase transitions, elapsed valid movement time, peak flags, and quality coverage. Use timestamp-based debounce/dwell and hysteresis rather than a single noisy threshold crossing.

For a validated increasing signal:

```text
pRaw = (signal - patientRest) / assignedExcursion
pDisplay = clamp(pRaw, 0, 1)

REST -> OUTBOUND after pRaw > enterThreshold for the configured dwell
OUTBOUND -> RETURNING after a confirmed fall from the peak
RETURNING -> REST when pRaw < exitThreshold for the configured dwell
```

Require `assignedExcursion > minimumValidExcursion`. Preserve `pRaw` beyond 1 for overshoot detection; clamping is for the gauge only. Initial enter/exit thresholds may start near 0.25/0.15 but require testing. Completion of a movement cycle records an attempt; a shallow complete cycle remains visible even if it does not satisfy the assigned target. Track attempted, assessed, and within-target repetitions separately. Do not hide failed attempts by excluding them from every denominator.

Time categories per exercise must partition elapsed time: active assessed movement, ready/rest time, user-paused time, and unassessed tracking-loss time. Use a monotonic clock for elapsed intervals, UTC for record dates, and actual transitions rather than setInterval tick counts. Define coverage as `(elapsed - paused - unassessed) / (elapsed - paused)` where denominator is positive. Rest between sets is explicit and not active exercise time.

For repetition-based assignments, reaching prescribed within-target reps triggers a completion prompt. For timed assignments, reaching prescribed assessed active time triggers it. Stop remains available; incomplete work saves as partial. Do not automatically add exercises or prescribe extra repetitions based on a low score.

## 13. Score and cue contract

Label scores `Prototype movement score`. Show components and the assignment they reference. Do not use pose confidence or classification confidence as a quality score.

Start with a small configurable score using reach and tempo only. A proposed initial combination is `100 * (0.7 * reach + 0.3 * tempo)`; this weighting is an engineering default pending physiotherapist review, not a clinical standard. Use patient target bands with explicit upper as well as lower limits: exceeding the target is not automatically better. Store formula version and parameter snapshot.

Tracking gaps make affected repetitions unassessed, not zero. Include shallow assessed attempts in the relevant average, and show counts/coverage beside it. If there are no assessed repetitions or coverage falls below the tested release threshold, return `null` with a reason instead of an invented score. Compare historical scores only when exercise, target, view, and formula are compatible; otherwise annotate the change.

Cue priority: stop/user concern, tracking/setup, configured movement deviation, then encouragement. Speak at most one cue at a time, coalesce repeats, cancel queued speech, and show the same text banner. Support mute and a cooldown. Cues must say what was observed relative to the assignment; do not insist on greater depth when tracking is uncertain or the assigned limit has been reached. Large gauges and text complement color. Speech unavailability never blocks a session.

## 14. Assignments and sessions

Assignment creation requires a linked patient, supported exercise, approved reference version, valid finite targets, repetitions or time goal, rest settings, and clinician instructions. Reject negative, infinite, contradictory, and oversized values. Store per-exercise notes, not a single overwritten note for the whole library.

Capture the full assignment snapshot when a session begins. Live plan edits cannot silently alter an ongoing session. Keep a local draft with the generated session ID, completed rep summaries, and provenance; no raw video. Use bounded browser storage and a clear resume/discard prompt. After browser reload, restore summaries but start a fresh camera calibration and partial rep. Namespace drafts by authenticated UID and remove them on successful submission or explicit discard.

Write final measurements once under the stable session ID. Retries must be idempotent; if the same finalized ID already exists, confirm it rather than append a duplicate. Show pending/failed submission and retry controls. Mark saved only after confirmed server acknowledgement. Offline cached availability is not proof of delivery. MVP need not support offline sessions, but transient network loss must not erase a completed local draft.

Subscribe the clinician dashboard to bounded, indexed queries for linked patients/recent sessions. Show review status separately from performance flags. Feedback creation stores the selected session ID, sender ID, recipient scope, and server timestamp. Unsubscribe on route/account changes. Read receipts may update only the recipient's allowed field.

Adherence requires a scheduled denominator. Compute assigned occurrences and completed eligible sessions over a defined period/timezone; do not invent a weekly percentage from arbitrary saved sessions. Avoid double-counting retries or partial sessions. For MVP, display scheduled and completed counts before introducing a percentage.

## 15. UI integration checklist

| Existing area | Required change |
| --- | --- |
| Login | Real test-account authentication; provisioned roles; no role escalation |
| Clinician patient list | Query linked patients; patient-specific plans and history |
| Reference capture | Add capture/review/approve screen and version listing |
| Assignment editor | Select reference and patient target; persist version |
| Patient plan | Load own assignment; show reference animation and clinician instructions |
| Pre-exercise screen | Keep checklist; add actual framing, model readiness, and calibration |
| Live screen | Real video/canvas, state machine, reps, timing, measurements, accessible cues |
| Summary | Measured results, partial/unassessed distinction, real save state |
| Progress | Compatible measured history only; label fixtures separately |
| Clinician detail | Persisted results, exceptions, review state, and session-linked feedback |
| Patient feedback | Recipient-scoped messages with actual session context |
| Profile | Permission help, account state, camera controls, and draft management |

## 16. Error and recovery behavior

| Failure | Expected behavior |
| --- | --- |
| Permission denied or camera busy | Explain browser permission/device issue; retry without losing assignment |
| Model unavailable or backend unsupported | Visible load error; retry; explicit replay option for demo |
| Out of frame or low-confidence joints | Pause assessment; preserve gap duration; require stable rest on return |
| Camera rotated or moved | Invalidate calibration and ask to recalibrate |
| Page backgrounded or navigation | Pause measurement, stop resources as appropriate, preserve draft |
| Incomplete reference | Reject approval, explain failed checks, allow recapture |
| Empty plan or missing reference | Block start with useful guidance; do not crash on array access |
| Reference version unavailable | Resolve pinned version or report unavailable; never substitute silently |
| Save interrupted | Keep draft and stable ID; retry without duplicate session |
| Sign-out or account switch | Clear in-memory records, listeners, and camera; prevent draft leakage |
| No assessed reps | Show unassessed/incomplete summary and null score |
| Unexpected person/geometry jump | Treat as tracking uncertainty; do not promise full multi-person detection |

## 17. Implementation milestones and owners

| Gate | Owner focus | Work | Acceptance evidence |
| --- | --- | --- | --- |
| G0: establish baseline | All three | Run existing app, record current behavior, agree contracts and supported views | Patient/clinician routes work; no new scaffold; known issues listed |
| G1: camera and one exercise | P1 vision; P2 patient UI; P3 HTTPS/test backend | Camera, MoveNet, visibility, calibration, squat signal | Live landmarks and stable measurements on actual phone and laptop |
| G2: reference and repetitions | P1 measurement; P2 capture/cues; P3 records/media | Five reference segments, approval, playable instructions, patient calibration, rep logic and timing | Capture reference, play it on the other device, and pass replay/manual-count checks |
| G3: complete shared loop | P1 scoring; P2 patient/report views; P3 identity/sync | Accounts, linked assignments, session persistence, review and feedback | Separate devices complete the full loop and refresh preserves records |
| G4: second exercise | P1 arm protocol; P2 view transition; P3 permissions/queries | Bilateral arm raise, target configuration, compatible history | Both exercises assessed against reviewed targets |
| G5: MVP release | All three | Failure handling, clinician review, device matrix, demonstration rehearsal | Acceptance checklist and actual results recorded; three consecutive clean runs |

No gate passes on screenshots alone. Split ownership by modules and coordinate shared schema changes before integration. Story and testing are shared work for this three-person team.

## 18. Verification strategy

### Pure logic

Use a small Node built-in test suite around geometry, reference validation, timestamp accounting, rep state transitions, scoring, and summary aggregation. Test known angles, zero-length vectors, non-square video dimensions, incomplete/fast/shallow cycles, overshoot, frame gaps, pause/resume, and no-valid-data cases. Deterministic replay inputs run through the same engine as live sessions. Tests must verify expected behavior, not merely copy the score formula into another function.

### Permissions and storage

Use emulator tests for patient A versus patient B, unrelated clinicians, role self-edit attempts, measurement rewrites, feedback ownership, invalid IDs/fields, and duplicate finalization. Verify session/assignment version pinning and idempotent retries.

### Device and manual checks

Use the actual demo smartphone and laptop. For each exercise, record at least three ten-repetition trials across the three teammates where feasible, using varied pace and one deliberate invalid setup. Label these as convenience engineering trials. Compare manual versus detected counts and annotate missed, extra, shallow, and unassessed attempts. Measure camera-to-feedback latency and tracking coverage from timestamps. Record browser, device, lighting, camera view, estimator version, and reviewed target settings.

Initial engineering targets: no more than one missed or extra rep per ten clear supported reps in each clean trial; zero fabricated assessed reps during deliberate tracking loss; feedback latency p95 below 300 ms on each target device; completed session visible on the other online device within five seconds after server-confirmed save. These are proposed acceptance targets, not achieved results or clinical claims. Adjust targets transparently only when the tradeoff and observed evidence are recorded.

Ask the physiotherapist to review reference quality, targets, cue wording, score interpretation, and counterexamples. A public dataset may supplement this work but cannot replace it. Make no clinical accuracy claim from teammate trials.

Run frontend lint and production build once implementation changes are complete. Perform a full deployed HTTPS test because localhost success does not prove phone camera access or cross-device synchronization.

## 19. Release checklist

- [ ] Physiotherapist reviews both protocols and patient-facing cues.
- [ ] Reference capture, rejection, approval, and immutable version reuse work.
- [ ] Approved in-app reference videos play on the patient's device with permission checks.
- [ ] Patient rest calibration is separate from reference capture.
- [ ] Squat and arm raise count supported cycles with actual recorded test evidence.
- [ ] Timers partition elapsed time and do not depend on interval tick counts.
- [ ] Tracking loss cannot fabricate a score or join an incomplete rep across a gap.
- [ ] Targets are patient-specific; overshoot is not rewarded automatically.
- [ ] Scores are explained, versioned, and absent when unassessable.
- [ ] Clinician assigns; patient receives; patient saves; clinician reviews; feedback returns.
- [ ] The complete loop works on separate devices and survives refresh.
- [ ] Permissions deny unrelated accounts and protect roles and measurements.
- [ ] Save retry creates one finalized session only.
- [ ] Raw patient video is not uploaded; local reference capture is clearly explained.
- [ ] Every screen and action in section 23 has its specified behavior; no false success toasts.
- [ ] The full reference-demo parity walkthrough in section 24 succeeds for both exercises.
- [ ] Camera, speech, and subscriptions clean up on stop, navigation, and sign-out.
- [ ] Replay, fixtures, and illustrative charts are explicitly labeled.
- [ ] Lint, build, pure-logic checks, emulator checks, and deployed-device checks pass.
- [ ] Three consecutive full demonstrations succeed with a backup recording available.
- [ ] README contains setup, public environment names, test provisioning, model provenance, and measured limitations.

## 20. Full product roadmap

After MVP acceptance, add clinician uploads as a separate feature: authenticated object storage, file limits, MIME/content validation, ownership rules, draft processing states, pose extraction through the same versioned pipeline, clinician review, retention/deletion, and approved publication. Do not treat any uploaded video as a valid exercise automatically.

Add new exercises one at a time with protocol metadata and tests. Broader personalization, reminders, caregiver access, accessibility modes, clinic workspaces, and exports follow demonstrated need. Consider classification or learned assessment only after acquiring compatible licensed data, defining clinician labels, separating participants across train/test sets, and measuring generalization and uncertainty.

Before real patient use, define intended use and eligibility with clinicians, establish consent and retention, assess security and recovery, conduct representative user/clinical evaluation, and obtain jurisdiction-specific governance advice. Do not infer that completing this MVP establishes readiness for clinical deployment.

## 21. Risks and decisions to revisit

The largest technical risks are viewpoint sensitivity, reference quality, body-proportion differences, unsupported movement being mistaken for the assigned exercise, and misleading aggregation. A rep counter checks a supported movement pattern; it does not recognize every possible wrong exercise. Frame quality and assignment compatibility must stay visible.

The largest product risk is a report that looks impressive but does not save clinician time. Evaluate the actual review task: can the clinician quickly identify completed work, uncertain measurements, and a useful follow-up? Keep the first dashboard small enough to answer those questions.

Current defaults requiring evidence are squat side view, Lightning inference quality, latency targets, tracking thresholds, repetition thresholds, scoring weights, and reference compression. Document changes with version and observed reason. Do not add technology solely to match a reference presentation.

## 22. Official technical references

These support platform capability and implementation details; exercise rules, thresholds, release targets, and architecture choices above are project proposals.

- MoveNet model overview: https://www.tensorflow.org/hub/tutorials/movenet
- TensorFlow.js MoveNet configuration and custom model URL: https://github.com/tensorflow/tfjs-models/blob/master/pose-detection/src/movenet/README.md
- Pose detection JavaScript API: https://github.com/tensorflow/tfjs-models/blob/master/pose-detection/README.md
- Firebase authentication with Firestore rules: https://firebase.google.com/docs/firestore/security/get-started
- Firebase rules access patterns: https://firebase.google.com/docs/rules/basics
- Firestore atomic writes and transaction behavior: https://firebase.google.com/docs/firestore/manage-data/transactions
- Reference-media upload SDK: https://firebase.google.com/docs/storage/web/upload-files
- Reference-media access rules: https://firebase.google.com/docs/storage/security

Consult current official package documentation when implementation begins. No claimed pretrained exercise-classification accuracy, clinical threshold, or patient outcome is inherited from the supplied reference material.

## 23. Frontend screen and control audit

The user's latest scope is a complete product demonstration covering the existing frontend and the visible reference workflow, with two measured exercises. A camera counter alone does not satisfy it. This audit inspected source handlers and sampled the reference recording at one-second intervals throughout its 83 seconds, plus the supplied screenshots. It is not a claim that every browser interaction was exercised. No frontend source was changed during the audit.

Status vocabulary: navigation works at source level; local means in-memory only; simulated means manufactured input/results; placeholder means a toast or static value without the promised action. All rows remain acceptance work until tested in the integrated application.

| Screen and source | Existing controls and behavior | Required demo behavior |
| --- | --- | --- |
| Login: `components/Login.jsx` | Email/password inputs; show-password toggle works; patient/clinician buttons only navigate; forgot-password is a placeholder | Authenticate test accounts, preserve show-password behavior, enforce provisioned roles; reset flow or an explicitly labeled test-account recovery instruction, never claim an unsent email |
| Patient navigation: `patient/Layout.jsx` | Home, Plan, Progress, Feedback, Profile routes; tabs hidden during pre/live/summary | Every tab opens correct current-account content; navigation during exercise follows the draft/pause policy |
| Home notifications: `patient/Home.jsx` | Bell shows a hardcoded one-message toast | Show actual unread feedback/help-thread state and open the relevant record |
| Home search and exercise tiles | Search routes to Plan; Exercises/Progress/Feedback/Profile tiles navigate | Search filters the two supported assigned exercises; tiles retain current routes |
| Upcoming session and Start session | Shows fixture plan and Today; routes to Plan | Render assigned plan, real schedule and durations; start the correct patient plan |
| Latest feedback and Open feedback | Displays first global message; navigates | Correct patient's latest message; useful empty state; linked-session context |
| Recent sessions and See All | Fixture cards and link to Progress | Saved sessions with real dates, actual completion state, stable session IDs, and detail access |
| Do Again | Opens current plan without session context | Open repeat preparation for the current authorized assignment, show any changed targets, require confirmation; do not silently repeat an obsolete prescription |
| Contact clinician | Says Message sent without input or storage | Open a message composer, persist a patient-scoped request, show pending/sent state, and make it visible to the linked clinician; icon/label must describe messaging rather than imply a live call |
| This week and score trend | Fixed 67%, 2 of 3; seeded history | Derive completion from real schedule and show compatible measured score history |
| Plan: `patient/Plan.jsx` | Exercise cards, seconds, Instructions, Start plan; sets `all` only in first navigation | Show only two supported exercises and current instructions; preserve explicit single-exercise versus entire-plan mode through pre/live/summary |
| Pre: `patient/Pre.jsx` | Back, three manual setup checks, Begin exercise, I need help; checkbox values are not used | Keep manual checks, add actual readiness checks/calibration, view-specific guidance, playable reference clip, and a stored help request |
| Live: `patient/Live.jsx` | Simulated skeleton, eight-second timer, assigned label, Pause/Resume, simulated lighting toggle, Stop | Real camera/overlay, skeleton-only Canvas Live view, timer, reps, target gauge, text/speech, current exercise; pause/resume/stop preserve partial work |
| Tracking simulation control | Only toggles a boolean labeled poor lighting | Keep behind explicit test/replay controls; production live status comes from measured tracking, and low confidence is not diagnosed as poor lighting automatically |
| Summary: `patient/Summary.jsx` | Time chart, score chart, Save and finish pushes fixture array | Real per-exercise time and score charts with units and missing-data states; idempotent save and submission confirmation |
| Progress: `patient/Progress.jsx` | Session KPIs, trends, per-exercise score/time, fixed completion ring and history | All these views use persisted data, handle zero/one session, annotate incompatible targets, and link to session details |
| Feedback: `patient/Feedback.jsx` | Marks all global messages read during render; Ask a question is a toast | Recipient-scoped read updates outside render; actual reply composer and stored conversation tied to feedback/session |
| Profile: `patient/Profile.jsx` | Hardcoded patient/clinician, permission guidance, privacy, Sign out navigation | Authenticated profile, correct clinician, accurate media explanation, actual sign-out and resource cleanup |
| Clinician navigation: `client/Layout.jsx` | Overview, Patients, Exercise library, Settings, Sign out | Preserve all routes, derive active state correctly in nested patient routes, clear data on actual sign-out |
| Overview: `client/Overview.jsx` | Patient/review cards, fixed overdue/low-confidence cards, adherence chart, recent rows and Open | Correct linked-patient counts, scheduled overdue state, uncertainty flags, actual sessions; open the matching patient/session |
| Patients: `client/Patients.jsx` | Name/ID search filters local fixtures; Open patient routes | Search linked accounts; show persisted last session and scheduled completion; provide empty search state |
| Detail: `client/PatientDetail.jsx` | Back, Edit assignment, Send feedback, active plan, KPIs/trends, session table; only P-101 has global sessions | Full per-patient history, time and score charts, measured rep/quality fields, session detail and review state; no cross-patient data |
| Assigned versus Detected column | Both cells contain the same assigned string | Keep Assigned plus Measured exercise/status; never call a copied assignment an independent prediction; if classification is later added, store and label its actual result |
| Assignment: `client/Assign.jsx` | Plan name, checkboxes, numeric seconds, shared note, Assign; Save draft only toasts; preview is static text | Two supported options, per-exercise targets and notes, real patient-scoped draft persistence, saved version, and actual patient preview |
| Feedback composer: `client/SendFeedback.jsx` | Session dropdown, message, preview, Send; selected session value is ignored; writes global messages | Persist selected session ID and recipient; retain preview; validate linked patient/session and save acknowledgement |
| Library: `client/LibrarySettings.jsx` | Nine cards claiming recognized; no reference actions | Two supported cards with reviewed instructions, reference recording/review/playback and camera views; unsupported legacy classes cannot be assigned |
| Settings: `client/LibrarySettings.jsx` | Static clinician profile only | Accurate test-workspace/account details; settings controls only if actually implemented |
| Shared charts: `utils.jsx` | SVG charts and helpers assume populated 0-1 data | Handle empty and null values; adapt every axis/label to one score scale, proposed 0-100; use actual seconds and stable full exercise labels |
| Toasts: `components/Toast.jsx` | Global callback assigned during render; timeout can clear a newer toast | Provide a small stable notification mechanism with cleanup; show success only after the underlying operation succeeds |

Minimal communication addition needed to make existing buttons honest: `patients/{patientUid}/requests/{requestId}` stores `kind` (help/question/contact), optional `sessionId`/`feedbackId`, `message`, creator ID, `createdAt`, and status. Use a request thread/replies subcollection for subsequent messages. Only the patient and linked clinician may read/write their permitted fields. Clinician inbox access can live within Overview and patient detail; a new major chat product is not required. These are asynchronous messages, not a promise of immediate medical response or a live consultation.

Build check on 17 October 2026: `npm.cmd run build` passed (45 modules transformed). `npm.cmd run lint` reported 10 errors and one warning. Four errors are unused functions in the legacy standalone demo; six are React export/render-side-effect rules in `Toast.jsx` and `utils.jsx`; the warning is missing live-session effect dependencies. Clean up the active source and explicitly scope the legacy demo in lint configuration rather than disabling correctness rules globally. Passing compilation does not verify the simulated features.

## 24. Reference demo parity and full walkthrough

The recording's visible app sequence includes clinician login, patient selection, patient result charts, assignment/feedback controls, patient login/home/current doctor, doctor feedback and assignments, expandable exercise instructions with demonstration media, workout start/stop, and a Canvas Live control switching camera imagery and skeleton rendering. The supplied screenshots additionally show per-exercise time and score charts after the workout. The demo must include these behaviors for the chosen two exercises. Reference market slides, the MATLAB model designer, nine-class accuracy charts, and remote inference plots describe another project's architecture; they are not instructions to manufacture matching Kineticare results.

Required UI details beyond the existing shell:

- Patient exercise information exposes playable approved baseline media and written guidance, accessible from Instructions and the exercise library/plan.
- Canvas Live switches between camera-with-overlay and skeleton-only rendering while the same measured session continues. It neither restarts the timer nor swaps in manufactured results.
- Clinician and patient result screens both show time by exercise and prototype score by exercise, with repetition counts and uncertainty alongside them.
- Patient home identifies the assigned clinician and shows real reminders or due-plan state where a schedule exists. No placeholder meeting reminder is presented as scheduled care.
- Session feedback/assignment screens operate on saved records and round-trip across accounts.
- General exercise recognition remains explicitly outside the model capability. Display the selected supported exercise and evaluated pattern status; do not claim the reference video's LSTM is running.

Full demonstration checklist:

1. Sign in as clinician; show Overview, patient search, patient detail, library, and account settings.
2. Record or open reviewed in-app references for both exercises; play each clip and show its supported camera view.
3. Create a draft assignment for the test patient, reopen the draft, preview it, and publish a version with both exercises and time/rep targets.
4. Sign in as patient on the other device; show current clinician, assignment, notification state, and instructions/reference playback.
5. Complete setup checks, calibrate side-on, and perform five controlled squat cycles with actual timer and rep measurements.
6. Toggle camera/Canvas Live view, pause/resume, and demonstrate tracking loss without fabricated counts.
7. Reposition front-on, recalibrate, and perform five arm raises with separate measurements.
8. Finish, inspect both time/score charts, save, and refresh to show persistent history and progress.
9. Open the clinician's patient report; inspect both exercise results, flag/review state, and charts; send session-linked feedback.
10. Open patient feedback, acknowledge/read it, and send a question; show that the clinician can see the request.
11. Exercise Contact clinician and I need help through real stored request records; show a nonurgent asynchronous confirmation.
12. Demonstrate single-exercise versus whole-plan start, deliberate partial stop/save, and safe repetition of the current assignment.
13. Sign out and confirm account isolation; show the second patient has separate history.

The complete walkthrough can be recorded in multiple takes if necessary, but all actions operate on the same implementation and truthful records. A short pitch video may condense this sequence; it does not replace acceptance of the full flow.

## 25. Confirmed recording package

Use the revised two-page recording guide as a software-test capture protocol, with the user's chosen two exercises. Its mention of an existing LSTM does not establish that a model exists; the user confirmed otherwise.

| File | Purpose | Capture contract |
| --- | --- | --- |
| `squat_side_normal.mp4` | Main squat reference and counting check | Stable side-on full-body view, five seconds rest, five controlled complete cycles, five seconds rest |
| `arm_raise_front_normal.mp4` | Main arm-raise reference and counting check | Stable frontal full-body view, shoulders/elbows/wrists visible throughout, five seconds rest, five raises and returns, five seconds rest |
| `squat_front_normal.mp4` | Additional view robustness check | Five frontal squat cycles; not a third exercise and not interchangeable with the side-view measurement reference |

Landscape 1080p/30 FPS is the guide's preferred capture, not a hard browser or model requirement. Keep the camera fixed, whole body visible with space around it, even lighting, contrasting clothing, and no bystanders. Around 30 seconds is approximate; complete controlled cycles and the rest intervals matter more than hitting an exact clip duration. The guide's comfortable range is not a numeric target prescribed by this plan.

The two primary clips are required for the planned capture package. The frontal squat clip is an additional guide-listed test asset, not a new mandatory measurement protocol. Use a manifest linking each capture to exercise, camera view, consenting test participant alias, actual duration/FPS/dimensions, manual rep count, reference approval state, and measurement version. These recordings support software testing; clinical approval and model-training provenance are separate.

Record reference videos through Kineticare once capture is implemented. If the team records files earlier using a phone, keep them as local development fixtures. That does not add an unrestricted clinician upload feature to the MVP. Approved in-app capture storage and later arbitrary file uploads remain separate product features.

## 26. Audit closeout and implementation order

Keep the frontend's existing layouts and navigational coverage. Prioritize real data/authentication and honest button behavior alongside the vision engine, then complete media playback and dual live views, both exercises, result charts, feedback/requests, and the full walkthrough. This is an expansion of functional completeness within the two-exercise scope, not permission to add unrelated exercises or copy another project's accuracy claims.

The audit changes documentation only. Source bugs, simulated data, missing integrations, and lint failures are recorded for implementation, not represented as fixed. No Git commands were run.
