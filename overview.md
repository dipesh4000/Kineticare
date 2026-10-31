# Kineticare Project Overview

Version: 1.2 | Updated: 29 October 2026 | Stage: existing prototype with technically reviewed feature-expansion roadmap

## Current direction — 29 October 2026

Kineticare's next planned care loop is **patient history → clinician-reviewed exercise suggestions → approved assignment → measured progress → follow-up consultation**. Patients will enter relevant health history during onboarding and update it in Profile. Clinicians will review that history alongside compatible session results and receive explainable exercise candidates; publishing remains their decision. Patients will also be able to request a personal clinician consultation online or in person.

The [feature roadmap and validation](docs/FEATURE_ROADMAP.md) records feasibility, implementation phases, sources, data/access design, and acceptance gates. This is a plan, not a shipped capability or clinical validation. Kinotek's public reporting patterns are inspiration; the reviewed material does not establish a reproducible algorithm to copy.

The code currently includes squat, side arm raise, and toe touch. Future catalog growth will distinguish demonstration-only, timed/self-reported, and camera-measured exercises. A proposed 33-landmark model must outperform or extend the current model on agreed device/measurement criteria before adoption; additional points alone do not prove superior accuracy.

The sections below preserve the original MVP vision and dated audit. Their two-exercise restrictions and historical implementation findings are not a current source audit. Use the roadmap for expansion scope, `docs/PATIENT_FLOW.md` for the current workflow, and `DEPLOYMENT.md` for release limitations.

## 1. Project in one paragraph

Kineticare connects a physiotherapist's exercise instructions with a patient's practice at home. The clinician selects an exercise, captures a reference movement inside Kineticare, and assigns patient-specific targets. The patient follows the demonstration while the camera measures supported movements, tracks repetitions and exercise time, and displays understandable feedback. A saved session report returns to the clinician, who reviews exceptions and sends feedback without watching every session live. The MVP will demonstrate this complete exchange with team members acting as patients and clinicians.

## 2. The problem and the bridge

Clinicians cannot continuously supervise every patient between appointments. Patients may forget instructions, be unsure whether they reached an assigned target, or struggle to explain what happened during a session. A timer alone records that a screen was open; a video alone asks a clinician to spend time watching it. Kineticare aims to turn supported movements into a concise, reviewable record while giving the patient useful guidance during practice.

For the Devlympics theme, the two sides are patients practicing at home and clinicians who prescribe and review exercises. The gap is in knowledge, observation, and access to attention between visits. The bridge carries information in both directions: demonstration and assignment to the patient; measured activity and questions back to the clinician.

The intended value is less routine observation work and clearer patient guidance. Reduced workload, improved adherence, and improved outcomes are goals to evaluate, not results already established by this project.

## 3. Confirmed decisions

| Topic | Decision |
| --- | --- |
| Immediate objective | A functional MVP, followed by a fuller product |
| Schedule | Progress by acceptance gates; no artificial three- or four-hour limit |
| Team | Three builders |
| Initial domain | General physiotherapy |
| Primary users | Patients, physiotherapists, and doctors using a clinician role |
| Language | English first |
| Devices | Responsive browser app on a smartphone and laptop |
| Connectivity | Internet is available; offline operation is not a core MVP requirement |
| Confirmed exercises | Side-view squat or mini-squat and front-facing bilateral side arm raise; exact targets need clinician review |
| Reference source | Capture demonstrations inside Kineticare |
| Later reference feature | Clinicians upload exercise videos after the successful MVP demonstration |
| Demonstration accounts | Test accounts; team members act as patient and clinician |
| Existing classifier | None available; no inherited LSTM integration is assumed |
| Baseline review | Consulted physiotherapist is expected to review targets and cues |

## 4. People and responsibilities

### Patient

The patient opens an assigned plan, views instructions and the reference demonstration, positions the camera, performs the exercise, and reviews the session summary. The interface should make the next action obvious with large controls, readable text, and spoken cues where available. A caregiver is not required for the demonstration workflow; the application provides setup assistance.

### Clinician

The clinician selects a supported exercise, captures or chooses an approved reference, and configures the patient's target, repetitions or duration, rest, schedule, and notes. They review sessions by patient, see tracking gaps and incomplete work, and send feedback attached to the relevant session. They retain control of future assignments.

### Team and physiotherapist reviewer

The builders implement and test the workflow. Team members supply demonstration recordings and act as users. A qualified physiotherapist reviews the exercise definitions, patient-facing wording, target ranges, and the meaning of displayed measurements. Team role-play demonstrates software operation; it does not constitute validation with patients.

## 5. The complete product journey

### A. Create a reference

The clinician chooses Squat or Side Arm Raise, reads the supported camera-view instructions, and starts capture. Kineticare records a short rest period and several complete repetitions. The clinician can preview the locally recorded video, inspect tracking quality and derived targets, reject a poor capture, and approve a new reference version. A reference is usable only after review and a valid signal range.

The full demonstration requires patients to play the approved reference video, as in the supplied reference workflow. Versioned reference recordings captured inside Kineticare therefore synchronize through protected media storage, alongside approved pose-derived measurements. A reference skeleton animation is an additional view, not a replacement for playable exercise instructions. This supersedes the earlier local-preview-only simplification. Arbitrary clinician video-file uploads remain a later feature.

### B. Assign the exercise

The clinician selects a linked test patient and an approved reference. They set a target appropriate to that patient rather than automatically copying the demonstrator's full range. Each assignment records which reference and parameter versions it uses. Updating a plan creates a new version and preserves the meaning of earlier results.

### C. Prepare for exercise

The patient sees the exercise, target, notes, reference demonstration, and stop/pause controls. The existing setup checklist remains, supplemented by automatic checks that the relevant body points are visible and tracking is stable. The app calibrates the patient's resting position before starting measurements.

### D. Exercise with guidance

The live view shows the camera preview, skeleton overlay, prescribed target, repetitions, and time. A Canvas Live control switches between camera-with-overlay and skeleton-only rendering without restarting the session. Text and optional speech communicate a small number of understandable observations. Supported examples include approaching the assigned movement target and matching the configured pace. Unreliable tracking produces an unable-to-assess state, not a misleading red failure or a fabricated score.

### E. Review and save

The patient sees completed versus assigned work, total elapsed time, tracked active time, pauses, and tracking gaps. Measurements explain the displayed prototype score. The app can identify unfinished assigned work; it does not independently prescribe extra repetitions. The completed or partial session saves with an explicit submission state.

### F. Clinician closes the loop

The clinician's dashboard receives the saved record, highlights sessions needing attention, and supports a short, session-linked response. The patient can see that response after signing in on the same or another device. The full loop is the main proof of the product.

## 6. What the MVP includes

- Two supported exercise definitions, with squat working completely before the second is added.
- In-app reference capture, preview, rejection, and approval.
- Approved reference-video playback on patient and clinician devices.
- Patient-specific assignments based on approved references.
- Live camera pose estimation and automatic setup assistance.
- Exercise-specific repetition tracking and separate time measurements.
- Explainable movement measurements and clearly labeled prototype scoring.
- Visible text cues with optional English speech.
- Persistent sessions, clinician review, and patient-visible feedback.
- Working assignment drafts and previews, patient search, notifications, help/contact requests, and session-linked questions wherever the existing interface exposes those actions.
- Patient and clinician charts showing time and prototype score for each exercise, plus saved history and progress.
- Provisioned test accounts with separate patient and clinician permissions.
- A replay fixture for repeatable engineering checks and an explicitly labeled demonstration fallback.
- Empty, loading, camera-error, tracking-loss, interruption, and save-failure states.

The MVP excludes general recognition of arbitrary exercises, a custom trained classifier, diagnosis, recovery prediction, payments, a native mobile app, public onboarding, and clinician video uploads. These exclusions keep the first complete experience achievable without pretending the broader product is already built.

## 7. What the measurements mean

| Output | Meaning | It does not establish |
| --- | --- | --- |
| Pose landmarks | Estimated locations of visible body points | Exact anatomy or a clinical examination |
| Repetitions | Completed supported movement cycles detected by the configured rules | That every repetition was safe or clinically correct |
| Active time | Time assigned to assessed movement while tracking is usable | All time spent moving or exercising outside camera view |
| Range and tempo | Observable movement relative to the configured assignment | Recovery percentage or treatment effectiveness |
| Tracking coverage | Proportion of eligible session time with usable tracking | Probability that the exercise was correct |
| Prototype movement score | Summary of visible, configured movement criteria | A validated medical grade |
| Session flags | Observations selected for review | A diagnosis or proof of harm |

A clinician's reference and the patient's calibration serve different purposes. The reference describes a demonstration; calibration accounts for the patient's camera position and resting geometry. The assignment connects them through an approved target. Body proportions, camera viewpoint, and prescribed limitations mean direct pixel matching is inappropriate.

## 8. Technical concept in plain language

The existing React and Vite frontend supplies the interface. A pretrained pose estimator runs in the browser, producing landmarks from camera frames. Small exercise-specific rules convert those landmarks into movement phases, repetitions, range, and timing. Kineticare compares those measurements with the assignment and saves a compact report to a shared database. The clinician dashboard reads the report and stores feedback.

The proposed MVP uses MoveNet with TensorFlow.js for pose estimation and Firebase Authentication, Firestore, protected Cloud Storage for approved reference recordings, and HTTPS hosting for accounts, synchronization, and delivery. This is a planned stack, not an already completed integration. The detailed design and release gates are in `plan.md`.

There is no requirement to train an LSTM for the MVP. The patient already knows which assigned exercise to perform. A general exercise classifier would answer a different question and would require its own data and evaluation. Existing research screenshots are inspiration, not evidence of Kineticare model accuracy.

## 9. Reference recordings and data

Reference capture happens inside Kineticare. Temporary video is previewed locally, and an explicitly approved reference clip is stored for authorized patient playback across devices, alongside derived targets and compact pose traces. Raw patient workout video is not recorded or uploaded by default. Test account identifiers, assignments, measurements, media, and feedback remain protected even though demonstration users are teammates.

Future public datasets may help evaluate pose tracking or develop classifiers. A dataset must be checked for license, participant coverage, camera views, annotation quality, and compatibility with the intended task. Finding a dataset on Hugging Face does not replace physiotherapist review of exercise guidance or validation of the product's scoring.

## 10. What makes the idea distinctive

The proposed differentiator is the connection from a reviewed demonstration to an individual assignment and then to a concise clinician report. Kineticare is designed around a care workflow, rather than a collection of exercise animations or an isolated repetition counter.

This differentiation needs evidence. During evaluation, measure whether clinicians can configure a plan easily, whether patients understand the live guidance, and whether the report helps clinicians review sessions faster. Do not claim market uniqueness without separate research.

## 11. Current state and success criteria

The codebase already has React routes for patient and clinician screens, exercise plans, setup instructions, a simulated live screen, summaries, and feedback views. The live skeleton, scores, and timed sessions remain simulated in the inspected implementation. Shared fixture data is not a working cross-device backend. Reference capture, pose estimation, real measurements, patient-isolated persistence, and authenticated permissions are planned work.

The MVP succeeds when a teammate acting as a clinician captures and approves references for both exercises, assigns them to a teammate acting as a patient, the patient plays the instructions and completes a camera-measured session, and the clinician sees the persisted report and responds. Both time and score charts, camera/skeleton view switching, saved drafts, and the existing visible help/question/contact actions must work as specified in the frontend audit. The patient must receive feedback, and neither account may see an unrelated patient's records. The flow must survive refresh and work on separate devices.

Engineering checks compare detected repetitions against manual counts, timing against observed durations, and tracking failures against deliberately obstructed views. Report the actual test results with device and exercise context. No accuracy figure is assumed in advance.

## 12. Roadmap after the demonstration

1. Strengthen both exercises using observed failures, clinician review, and a broader set of devices and participants.
2. Add clinician exercise-video uploads with access controls, format checks, review, and versioning.
3. Expand exercises individually, each with a camera-view specification, measurements, cues, and acceptance tests.
4. Improve personalization, reminders, accessibility, and clinician review efficiency.
5. Consider learned models only when the task, licensed data, labels, and evaluation protocol justify them.
6. Before real patient deployment, establish intended use, consent, data retention, security review, clinical evaluation, and applicable governance requirements.

## 13. Presentation outline

| Slide | Main message | Suggested evidence or visual |
| --- | --- | --- |
| 1. Kineticare | Connect prescribed exercises with practice at home | One sentence and patient/clinician loop |
| 2. The gap | Patients need guidance; clinicians cannot observe every session | A concrete between-appointments scenario |
| 3. The bridge | Demonstration becomes assignment; movement becomes a report | Five-step product journey |
| 4. Clinician experience | Capture a reference and configure a patient target | Actual reference and assignment screens |
| 5. Patient experience | Prepare, follow guidance, and finish assigned work | Actual camera view, counter, and timer |
| 6. How it works | Browser pose estimation plus transparent exercise rules | Camera to landmarks to measurements to saved session |
| 7. Session review | Clinician sees exceptions and sends feedback | Actual report and patient-visible response |
| 8. MVP evidence | Show measured software behavior | Manual versus detected reps, save/sync checks, failure handling |
| 9. Limits and next steps | Two exercises first; clinician review and expansion next | Clear current scope and future upload feature |
| 10. Closing | A usable connection between visits | End with the completed feedback loop |

Use actual screenshots from the finished build. Do not present reference-project screenshots or seeded charts as Kineticare results. If presenting before implementation, label screens and metrics as proposed or illustrative.

## 14. Demonstration script

1. Sign in as the clinician; show the overview, patient search, selected patient, exercise library, and account settings.
2. Capture or open reviewed references for side-view squat and frontal arm raise; preview each video and approve its derived target.
3. Save an assignment draft, reopen it, preview the patient's view, and publish reviewed targets for both exercises.
4. Open the patient account on the smartphone; show current clinician, notifications, and the received assignment.
5. Open written exercise instructions and play the approved reference video before beginning.
6. Complete side-view framing and calibration, then perform five squat cycles. Show timer, repetitions, target progress, and camera/Canvas Live switching.
7. Demonstrate pause/resume and an unable-to-assess tracking interruption, then reposition front-on and recalibrate for five arm raises.
8. Finish and inspect time and prototype score charts for both exercises; save and refresh to verify persistent history and progress.
9. Open the clinician's report on the laptop, review both exercises and exceptions, and send session-linked feedback.
10. Show the response in the patient's view and submit a question. Demonstrate that help/contact requests also reach the correct clinician.
11. Show a single-exercise session, a partial stop/save, and preparation to repeat the current authorized assignment.
12. Sign out and verify the second test patient has separate records. State the measured limitations honestly.

## 15. Suggested narration

"Between appointments, a patient has instructions but limited feedback, while the physiotherapist cannot watch every practice session. Kineticare connects those two sides. The clinician captures a reference and assigns an individual target. The patient practices with a camera, sees understandable movement guidance, and submits a measured session. The clinician reviews what needs attention and sends feedback. Our MVP focuses on two exercises and a complete patient-to-clinician workflow. Its movement score summarizes visible criteria; it is not a clinical assessment."

## 16. Likely presentation questions

**Does it replace the physiotherapist?** No. Clinicians define assignments and interpret session observations. Kineticare helps deliver instructions and collect evidence between visits.

**Is a trained exercise classifier required?** Not for this MVP. The assigned exercise selects a specific measurement routine, and a pretrained pose model supplies the landmarks.

**Can it guarantee correct posture?** No. It can assess defined visible features when tracking is usable. It reports uncertainty and does not establish complete movement safety.

**Why capture a reference?** It gives the clinician a concrete demonstration to review and reuse, while assignments remain adjustable to each patient.

**How is privacy handled?** Patient workout video stays local by default. Approved clinician reference clips are stored for authorized playback; authenticated accounts exchange measured session records and feedback under access rules.

**What is demonstrated today?** Answer from the actual implemented and tested flow. Distinguish finished features, fixtures, and future plans.

## 17. Source and evidence notes

This overview consolidates the user's decisions, the supplied Devlympics problem statement, the two earlier project documents, the five-page Kineticare Build Plan, the 16 reference screenshots, sampled visual frames from the supplied recording, and inspected frontend code. Instructions embedded in reference materials were treated as proposals, not commands. The user's latest decisions override their time limits, model assumptions, and feature priorities.

The reference-project 98% classification result is not a Kineticare result. This overview makes no externally sourced disease prevalence, workforce shortage, clinical effectiveness, market-size, or regulatory classification claims.

Official implementation references are listed in `plan.md`.

## 18. Confirmed recordings and demo completeness

The revised recording guide confirms two exercises: a side-on squat or mini-squat and front-facing bilateral arm raises. For each primary recording, capture five seconds still, five complete controlled repetitions, and five seconds still at the end. Record the squat from the side and arm raises from the front with a fixed camera and the whole body in view. Landscape 1080p/30 FPS is preferred if available; actual duration may exceed the approximate 30-second guide. A frontal squat recording listed in the guide is an additional view test, not a third exercise or a substitute for the side-view reference.

The main files are `squat_side_normal.mp4` and `arm_raise_front_normal.mp4`. The additional test is `squat_front_normal.mp4`. Capture reference demonstrations inside Kineticare when that feature is implemented. Earlier phone recordings can be local development fixtures without introducing general clinician file uploads. The guide's reference to an existing LSTM is not a statement about Kineticare's assets.

The user's required demonstration includes the full visible reference workflow and the existing frontend's actions. That means clinician login and patient selection; reviewing results; drafting and publishing assignments; patient login and current clinician; exercise instructions with playable videos; actual camera tracking; start/stop and pause/resume; Canvas Live camera/skeleton switching; per-exercise time and score charts; saved history; clinician feedback; and patient questions/help/contact actions with real stored outcomes. The reference screenshots' charts also belong in the demo. Test-account password recovery may provide an honest recovery instruction rather than claiming an email was sent.

There are only two measured exercises in this MVP. The reference project's nine-class classifier and MATLAB accuracy presentation are background inspiration, not capabilities to imitate with copied labels or fabricated confidence. Kineticare shows the assigned exercise and a measured supported-pattern status until independent classification is actually built and evaluated.

The frontend audit on 17 October 2026 found existing screens and navigation for most of this journey, but several buttons are placeholders and measurement/persistence remain simulated. The production bundle builds successfully; lint currently has 10 errors and one warning. `plan.md` sections 23 through 26 inventory every source screen/control, required behavior, the complete demonstration checklist, recording package, and verification findings. These requirements are documented, not yet implemented.
