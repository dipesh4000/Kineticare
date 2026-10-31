# Patient history, clinician suggestions, consultations, and expanded movement analysis

> Auth and storage update, 30 October 2026: public Privy email-code registration, Atlas profiles/relationships, patient-consented invite-code linking and bundled videos replace this document's older Firebase invitation/storage assumptions. See [current setup](PRIVY_ATLAS_SETUP.md). History-based recommendations and consultations below remain planned.

Date: 29 October 2026 · Status: validated for technical planning; implementation and clinical validation pending.

This document records the validation first, then the proposed implementation plan. It does not announce shipped features. It supersedes the older two-exercise restriction for future development; existing functionality remains the baseline. The user manages all Git operations.

## 1. Validation verdict

**Proceed in stages.** The existing React, Firebase, and exercise-engine architecture can support this direction without replacing the app. Start with structured patient history and trustworthy measurements, then add explainable clinician suggestions and consultation requests. Evaluate a model with more landmarks before committing to a replacement. Expand exercises in reviewed batches rather than promising automatic analysis of every movement.

| Proposal | Validation result | Required adjustment / evidence |
| --- | --- | --- |
| Patient history during onboarding and in Profile | Technically feasible; currently absent | Add a separate, versioned health record with patient edits and clinician review. Keep role and relationship fields protected. |
| Exercise suggestions on the doctor's side | Feasible as decision support; clinical usefulness unverified | Use reviewed eligibility rules, history, and compatible measured sessions. Require clinician approval before publishing assignments. |
| Book a personal clinician online or offline | Feasible; no scheduling infrastructure exists | Interpret offline as an in-person appointment. Start with request-and-confirm scheduling, then add transactional slots. Booking does not grant medical-record access. |
| More exercises of many kinds | Feasible as a catalog; automatic tracking is exercise-specific | Separate demonstration-only, timed/self-reported, and camera-measured capabilities. Each measured movement needs its own validated protocol. |
| Superior pose model with more tracking points | A 33-landmark candidate exists; superiority in this app is unproven | Benchmark against MoveNet on the same recordings and target devices. Landmark count is a capability difference, not an accuracy result. |
| Reuse Kinotek's analysis | Product patterns are publicly visible; its underlying method is not established by reviewed pages | Build original calculations and reports from documented definitions. Do not claim equivalent algorithms, accuracy, clinical validity, or access to its training data. |

Validation completed here: source inspection, workflow/dependency review, and public primary-source research. Not completed: real-camera benchmarking, clinician sign-off, patient study, production security verification, scheduling integration, or regulatory assessment. No numerical clinical accuracy claim is justified by this review.

## 2. What exists in this checkout

| Area | Observed implementation | Implication for the plan |
| --- | --- | --- |
| Identity/onboarding | `services/onboarding.js` accepts a verified-email invitation and creates one clinician relationship | Add history after account activation. Public self-registration and multiple treating clinicians are separate changes. |
| Patient Profile | `patient/Profile.jsx` displays identity, clinician, privacy, and diagnostics | Add a reusable history form here and in onboarding. No medical-history editor exists today. |
| Records | `records/RecordsProvider.jsx` and `services/firebaseRecords.js` support local demo/Firebase assignments, sessions, messages, and references | Extend these paths rather than adding a second database. New records require rules, subscriptions, and migration defaults. |
| Doctor review | `client/PatientDetail.jsx` shows sessions, analysis, trends, reports, feedback, and assignment actions | Add history review and suggestions here; preserve the existing assignment editor as the publishing path. |
| Catalog | `data.js`, `exercise/definitions.js`, `exercise/measure.js`, backend registry, and reference rules include squat, side arm raise, and toe touch | Older two-exercise docs are stale. Three code-supported movements do not establish clinical validation. |
| Measurement dispatch | Unknown names in `exercise/measure.js` fall through to arm-raise measurement | Make unsupported exercises fail explicitly before expanding the catalog. A catalog entry alone must never enable camera scoring. |
| Pose | `vision/usePoseCamera.js` loads MoveNet SinglePose Lightning and provides named pixel keypoints | Model choice is currently fixed. Overlay and geometry assume the current coordinate/confidence contract. |
| Analytics | `metrics.js`, backend analytics, and API fallback compute overlapping metrics; some missing values become defaults | Reconcile definitions and missing-data behavior before using metrics to recommend care. Patient detail currently evaluates a saved session with the current plan, which can misinterpret older targets. |
| Authorization | Firestore user records are immutable after invitation; relationship is one active clinician per patient; reference exercise names are allowlisted | History cannot simply be added to the existing user editor. Marketplace discovery needs separately sanitized provider records. |
| Express | `routes/api.js` mounts routers without authentication middleware; exercise writes mutate an in-memory registry | Sensitive endpoints need verified identities, authorization, validation, and durable storage. Do not send patient history to today's unprotected routes. |
| Consultation | Existing contact/help requests are asynchronous messages | They are reusable UX patterns, not booked appointments, availability, or video calls. |

Current release gaps already documented in `plan.md` and `DEPLOYMENT.md` remain open. This review does not certify any configured cloud deployment.

## 3. Kinotek research and product translation

Kinotek's [homepage](https://kinotek.com/) describes movement reports, 3D presentation, and analytics-informed exercise programming. Its [medical page](https://kinotek.com/medical-professionals) emphasizes explaining progress to patients. These are vendor descriptions, not independent evidence of Kineticare's future performance. Reviewed on 29 October 2026.

The useful design inference is an understandable loop: assess a supported movement, explain the observation, review the trend, and let a professional choose the next program. Implement that loop with Kineticare's own data and calculations:

| Product pattern | Kineticare proposal | Evidence required |
| --- | --- | --- |
| Clear movement report | Per-exercise excursion, completed reps, timing, prescribed target, and tracking coverage | Defined units, source repetitions, and reproducible calculations |
| Progress explanation | Baseline/current comparison and trend with assignment/model changes marked | Comparable protocol, camera view, measurement version, and targets |
| Personalized programming | Suggested candidates with reasons, exclusions, and clinician actions | Reviewed rules, current history, usable sessions, and approval record |
| Accessible visual explanation | Existing charts plus paired left/right values where actually captured | Separate side measurements; today's averaged arm angle cannot reconstruct asymmetry |

Do not copy branding, report assets, proprietary scores, or unsupported claims. The reviewed pages do not provide a reproducible scoring formula or a technical recipe for reproducing Kinotek's system. A single ordinary camera's inferred depth also does not establish equivalence to a different capture setup.

## 4. Patient history: onboarding and ongoing updates

After invitation acceptance, offer **Complete your health history**. Existing patients see the same entry point on Home/Profile. Save drafts, show completion state, allow optional questions to be skipped or marked unknown, and preserve access to existing clinician-approved plans. Missing information blocks suggestion generation when required; it must not silently become a negative medical finding.

Use one form for onboarding and **Profile → Health history**:

- Current concern: body region, affected side, onset/date if known, patient description, current limitations, and goals.
- Relevant prior injuries, surgeries and dates if known, ongoing conditions, and clinician-specified restrictions or clearance requirements.
- Symptoms and patient-reported pain using a clinician-approved question/scale; record timing and date rather than treating a profile answer as current forever.
- Current treatment and relevant medications only where the reviewing clinician defines a purpose; avoid collecting unrestricted sensitive details by default.
- Mobility aids, available equipment, preferred exercise environment, and accessibility needs.
- Optional age information only where eligibility requires it; collect the minimum necessary. Launch default: adult users; pediatric/proxy flows need a separate reviewed design.
- Separate permissions for care-team sharing, optional research use, and optional recordings. Camera permission is not a blanket health-data consent.

Label every entry as patient-reported. Clinician verification is separate and tied to the exact revision. Editing reviewed information creates a new pending-review revision; it does not retain an old approval badge. Save author, timestamps, schema version, consent version, and revision ID. Keep clinician observations separate from patient statements.

Include a lightweight symptom check before/after sessions if adopted by the clinician-reviewed protocol. Worsening symptoms or a new restriction should surface for professional review and suppress automatic progression suggestions. The software must not invent emergency-triage criteria or change treatment from free-text interpretation.

Acceptance: a patient saves onboarding history, refreshes, edits it in Profile, and the linked clinician sees the revision as unreviewed. Another patient or unrelated clinician cannot read it. An update never changes account roles, assignments, or the treating relationship.

## 5. Clinician exercise suggestions

Add **History & suggestions** to patient detail with history review state, a progress summary, and a small candidate list. Each candidate contains the exercise, proposed action, supporting observations, excluded/unknown factors, data quality, and rule version. Actions: **Add to assignment draft**, **Edit**, **Dismiss with reason**, and **Request clarification**. Publishing remains an explicit clinician action in the existing assignment editor.

### Initial implementation: reviewed rules

Use a small pure rules module over structured inputs, shared by authorized generation and tests. No learned recommendation model, vector database, or LLM is needed for the first version. Put safety-critical eligibility and persistence checks in a trusted service; browser previews may explain a result but cannot grant approval or bypass rules.

Processing order:

1. Validate linked clinician identity and load the latest history revision plus review/consent state.
2. Select measured sessions for the relevant exercise/protocol; exclude replay, unmeasured results, duplicates, and incompatible model/measurement versions. Treat partial sessions explicitly, using only valid completed repetitions where the rule permits.
3. Use the original assignment snapshot/version for each session. Do not reevaluate old work against today's targets. Represent absent values as unknown; preserve real zero values.
4. Apply reviewed eligibility/exclusion criteria before ranking. Unknown restrictions, conflicting information, stale history, or poor tracking produce **Needs review / insufficient evidence**.
5. Rank eligible candidates by clinician-defined goals and compatible progress. Give inspectable reasons and input session IDs; never turn a prototype score into a recovery diagnosis or probability of benefit.
6. Save the candidate set, source revisions, rule version, and generation time. Recheck freshness when the clinician adds it to a draft and again at publication.
7. Record clinician edits, approval/dismissal, and the resulting assignment version. Invalidate pending suggestions when history, restrictions, rules, catalog capability, or relevant records change.

Examples of system behavior, not treatment rules: poor tracking suggests camera/setup review; inadequate history asks for clarification; a clinician-approved progression rule may propose an eligible change after its configured evidence window. Specific thresholds, dose, contraindications, symptom escalation, and progression criteria require clinician authorship and review before activation.

For new patients without compatible sessions, support history-based eligible candidates only when the reviewed protocol permits it, otherwise request assessment. Never manufacture improvement or start at a generic prescription. LLM-written summaries can be evaluated later, after deterministic safety and provenance work; they must not authorize treatment.

Acceptance: the same inputs and rule version produce the same reasons. Tests cover absent history, new symptoms, restriction conflicts, zero scores, replay-only history, low coverage, incompatible targets, stale approvals, and clinician rejection. Publishing a suggestion requires a linked clinician and preserves the assignment audit trail.

## 6. Personal clinician discovery and booking

Patient Home/Profile gets **Find a clinician / Book a consultation**. Initially offer the linked clinician and a curated list of verified providers. Identify professional type accurately, such as physiotherapist or physician; do not label every provider a doctor. Filters: online/in-person, specialty, language, approximate location, and availability if maintained. Show verification status, clinic address for in-person care, appointment duration, fee if known, and cancellation terms.

### First release: request and confirm

1. Choose provider and online or in-person mode; enter preferred times with a visible timezone and a short reason.
2. Submit an idempotent request and show **Requested — awaiting confirmation**. A preferred time is not a reservation.
3. Provider reviews and proposes/confirms a time; patient accepts changes to time, mode, provider, or fee. Store revisions and actor history.
4. Show the confirmed visit on patient and provider screens. Support decline, cancellation, reschedule requests, completed, and no-show states with authorized transitions.
5. For online care, the provider supplies an approved external meeting link through a protected appointment record; an in-app video platform is later work. Validate link schemes/hosts and show the destination. For in-person care, show the verified clinic address and visit instructions.

Suggested state flow: `requested → proposed → confirmed → completed / no-show`, with `declined / cancelled` terminal states where permitted. A provider can confirm the patient's unchanged request directly. Rescheduling keeps the existing confirmed visit until a replacement is accepted; preserve a revision history rather than overwriting the date silently.

Do not attach full medical history to booking requests. Directory access and appointment participation must not expose session/history records. For the first release, booking another provider does not replace the current treating clinician or grant chart access. Patient-approved transfer through a trusted process is separate. Full multi-clinician care requires redesigning today's one-clinician relationship rules and queries.

### Later: real slot reservation

Add provider availability, UTC timestamps plus an IANA display timezone, duration, buffers, holidays, and cancellation windows. Claim slots in a trusted atomic transaction with a unique provider/slot constraint or lock document; include existing confirmed appointments when checking conflicts. Use idempotency keys, expiring holds if payments require them, and explicit failure/retry behavior. Two requests for the same slot must yield at most one confirmation. Integrate calendar/video/payment services only after choosing providers and confirming operational requirements. Do not expose credentials in Vite variables.

Acceptance: both parties see persisted status after refresh; unrelated users cannot read requests or meeting links; patient consent is required for changed terms; online/in-person details match the mode; cancellation/rescheduling preserve history. Notifications say sent only after actual delivery acknowledgment. In-app state is sufficient for the initial version; email/SMS automation is a separate integration.

## 7. Exercise expansion and measurement capabilities

Use stable exercise IDs across frontend, backend, assignments, references, and rules, with versioned definitions and legacy-name mapping. Maintain one reviewed source of catalog metadata consumed by both sides. Do not duplicate condition matching independently in the UI and registry.

Each entry declares: region/category, supported population, equipment, setup/view, instructions/media, clinician-reviewed indications and exclusions, dose fields, required landmarks, measurement method/version, compatible model, confidence/coverage requirements, reference status, reviewer/date, and capability status.

Separate clinical review status from technical capability:

| Capability | Available behavior | Must not imply |
| --- | --- | --- |
| Demonstration-only | Approved instructions/video and explicit completion report | Automatic movement scoring |
| Timed/self-reported | Duration/sets and patient-reported completion | Camera-verified repetitions or ROM |
| Camera-measured | Only the metrics/view/model validated for that protocol | Recognition of any arbitrary exercise |

Candidate batches for clinical prioritization: existing three movements first; then simple seated/standing single-joint movements; then supported bilateral and functional exercises; later balance, floor, complex multi-joint, and fine hand movements. These are research candidates, not approved prescriptions. Fine finger articulation requires a hand-specific assessment/model; additional body landmarks do not solve every movement.

For every measured addition: specify landmarks and angle/phase conventions, implement explicit dispatch, define calibration and loss-of-tracking behavior, obtain approved reference media, compare against annotated recordings, and review clinician wording. Check that lowering/return labels match the actual exercise rather than assuming outbound always means concentric. Unsupported motion must produce an honest unmeasured result. Catalog and reference updates must be durable, authenticated, and versioned; the current in-memory POST is not production publishing.

Acceptance: an unsupported exercise cannot fall through to another exercise's scoring; demonstration-only work never generates fabricated telemetry; each measured entry passes geometry, repetition, tracking-loss, reference, and assignment compatibility checks.

## 8. Pose-model evaluation and upgrade

The [TensorFlow.js pose-detection documentation](https://github.com/tensorflow/tfjs-models/tree/master/pose-detection) describes MoveNet's 17 points and BlazePose's 33, and warns that confidence values are not calibrated across models. Google's [Pose Landmarker overview](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker) documents 33 landmarks and Lite/Full/Heavy variants. These establish candidates, not superiority on Kineticare devices.

**Proposed experiment:** compare current MoveNet Lightning with a 33-landmark BlazePose configuration through the already installed package. Evaluate MediaPipe Tasks Pose Landmarker Full as a second integration path if needed; do not ship two new runtimes by default. Lite is a constrained-device candidate and Heavy is worth testing only if measured benefits justify cost. MoveNet Thunder can be a 17-point accuracy/latency comparator, but it does not fulfill the request for more points.

Implementation constraints:

- Normalize named landmarks, coordinate space, timestamps, confidence/visibility, optional inferred world coordinates, and model/version metadata at the camera boundary. Avoid creating a general plugin platform.
- Convert normalized image coordinates to a consistent pixel/aspect-correct space before feeding existing angle geometry. Keep world-coordinate calculations separate and explicitly versioned.
- Recalibrate confidence thresholds and temporal smoothing per model; don't copy the current `0.3` cutoff blindly. Preserve tracking-loss safeguards and stable side selection.
- Keep useful extra heel/foot/hand-body points for supported measurements and overlay; save compact metrics by default, not a new continuous body-landmark archive.
- Preserve on-device inference, camera/skeleton switching, pause/stop cleanup, and responsive controls. Google's [Web guide](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js) notes synchronous detection blocks the UI thread; evaluate a worker if choosing Tasks.
- Pin runtime/model versions, record asset checksums/licenses, and host compatible model/WASM assets reliably. Confirm CSP, HTTPS, download failures, and device/browser support.
- Fallback to MoveNet only for exercises supported by that model. Never switch measurement model silently within a scored set; stop/recalibrate and start a separately labeled segment or session.

### Benchmark and release decision

Create consented, versioned test recordings with manually counted repetitions, annotated tracking gaps, camera views, and clinician-reviewed angle references where reliable. Cover all three current movements, candidate new movements, occlusion, incorrect view, clothing/lighting, seated users, assistive devices, and varied participants. Separate tuning recordings from a held-out evaluation set. Replay fixtures test software; they do not establish performance on actual mobile cameras.

Report per exercise/device: rep-count error, angle error where a valid reference exists, usable tracking coverage, left/right stability, false counts during missing tracking, model load time, median/p95 inference and callback interval, sustained memory, responsiveness, and thermal/battery behavior. Use low/mid-range Android and iPhone Safari plus a desktop browser. The current hook estimates each frame but calls exercise logic at about 10 Hz; evaluate counting/latency end to end, not only detector FPS.

Before the benchmark, agree numerical pass/fail thresholds with the clinician reviewer and freeze the dataset split. Suggested engineering starting goals, not clinical claims: no false completed rep across an annotated tracking gap; no regression on the held-out rep tests; usable exercise updates around 10 Hz on the baseline phone; responsive pause/stop; no sustained memory growth across repeated starts/stops. Angle-error limits must be protocol-specific and reviewer-approved.

Promote a candidate only if it enables needed landmarks and meets the predeclared measurement/device gates. More points with worse reliability is a rejected upgrade. Version session/reference/measurement metadata and split trend lines when comparability changes; do not rewrite historical results. If no candidate passes, retain MoveNet for existing protocols and keep new dependent exercises unmeasured.

## 9. Data and authorization design

Proposed Firestore records below are design targets, not existing deployed collections:

| Path / record | Core data and ownership |
| --- | --- |
| `patients/{uid}/healthHistory/{revisionId}` | Immutable submitted history revision, author, schema/consent versions, timestamps. Separate draft/current pointer with revision checks to avoid lost updates. |
| `patients/{uid}/historyReviews/{reviewId}` | Linked clinician's review of one history revision; verification/clarification state, author/time, reviewed restrictions. Patient cannot write clinician approval. |
| `patients/{uid}/suggestions/{suggestionId}` | History/review/session/assignment IDs, catalog/rule/model versions, candidates, reasons, missing-data state, clinician decision, and resulting draft/version. |
| `providerDirectory/{providerId}` | Sanitized public professional profile, verified qualifications/status, clinic, modes, languages, and contact policy. Trusted provisioning only; no patient data. |
| `appointments/{appointmentId}` | Patient/provider IDs, mode, proposed/confirmed UTC times and display zones, status/revision, minimal reason, terms, idempotency key, and audit events. Private meeting details restricted to participants. |
| Catalog definitions / review records | Durable exercise IDs/versions, clinical approval, technical capability, reference links, and supported models. Publishing restricted to authorized reviewers/admins. |
| Existing sessions and assignments | Add history/rule provenance when relevant plus detector/model, landmark schema, protocol and scoring versions, and original target snapshot. Preserve immutable historical measurements. |

Use Firebase as the shared record system. Keep a compatible local demo schema with empty defaults for older workspaces; label seeded history and suggestions as demo data. Avoid storing real health history in the unauthenticated shared-browser demo. No Neon migration is required for this roadmap.

Protect history through scoped rules; retain immutable identity/role fields in `users`. Only the patient and authorized treating clinician can access history. Appointment participation grants access to appointment data only. Providers manage availability/status, patients manage their requests/consents, and trusted transactions enforce slot confirmation. Add field allowlists, length/type/range limits, revision checks, server timestamps, and audit ownership restrictions. Do not log health narratives or meeting URLs in general analytics.

For new trusted endpoints, verify Firebase ID tokens, authorize the resource/relationship on every request, validate payloads, and apply request limits. Admin SDK operations bypass rules, so service checks and rule tests are both needed. Configure narrowly scoped CORS when API/frontend origins differ. Keep generation and clinical approvals distinct; a server-generated candidate is not clinician approval.

Before real-patient launch, define retention/export/deletion and relationship-revocation behavior for history, reviews, appointments, and derived suggestions; consent withdrawal must stop future optional sharing. Confirm target jurisdiction, professional verification, age eligibility, and applicable clinical/privacy requirements with appropriate reviewers. This document does not claim legal compliance or medical-device clearance.

## 10. Delivery phases and acceptance gates

Work by gates, with estimates only after provider/scope decisions and a short model experiment. History, consultation requests, and model research can progress independently after common authorization/data foundations; recommendations depend on reviewed history/catalog and trustworthy analytics.

| Phase | Work | Gate to continue |
| --- | --- | --- |
| 0 — Trustworthy baseline | Fix unknown-exercise fallthrough, fake analytics defaults, original-target lookup, version compatibility, and clinical phase labels; secure/persist relevant API writes | Missing/replay data cannot become positive evidence; current three protocols have reproducible measurements and authorization checks |
| 1 — History | Reusable onboarding/Profile form, revision/review records, linked doctor view, local demo defaults, Firestore rules | Save/edit/review across accounts works; stale review invalidates; unrelated access denied |
| 2 — Clinician suggestions | Reviewed catalog/rule definitions, deterministic evaluation, provenance, patient-detail UI, add-to-draft and approval | Reviewed test cases pass; insufficient data abstains; no automatic prescription or stale acceptance |
| 3 — Consultation requests | Verified directory, online/in-person selection, proposals/confirmation, status history, protected visit details | Complete request/confirm/cancel/reschedule flow across both roles, with no chart-access escalation |
| 4 — Pose research and promotion | Same-recording comparison, adapter experiment, target-device benchmark, versioned rollout/fallback | Predeclared measurement/performance gates pass; supported features and honest model labeling verified |
| 5 — Catalog expansion | Stable IDs, unified metadata, capability status, reviewed batches, measurements and references | Each batch passes clinical/content review and per-exercise software/device gates |
| 6 — Scheduling automation and pilot | Atomic slots, optional calendar/video/payments/notifications, operational support, small clinician-supervised pilot | Conflict/concurrency tests, provider operations, access checks, and agreed pilot outcomes reviewed |

Minimal useful release: phases 0–3 using the existing supported exercises, a curated clinician list, reviewed suggestions, and manual booking confirmation. Phase 4 can run as an early research task; it need not block history or booking. Expand more demanding measured exercises only after their model/protocol gates pass. No EHR integration, new database, custom video-call infrastructure, or recommendation-model training is required for that release.

## 11. File-level implementation map

| Existing area | Planned change |
| --- | --- |
| `frontend/src/services/onboarding.js`, auth flow, `App.jsx` | Post-activation history entry; preserve invitation/role protections; add consultation routes when implemented |
| `patient/Profile.jsx`, `patient/Home.jsx` | History editor/status and booking entry points |
| `client/PatientDetail.jsx`, `client/Assign.jsx` | History review, evidence-backed suggestions, accept into existing assignment draft |
| `records/RecordsProvider.jsx`, `services/firebaseRecords.js` | New subscriptions/mutations, demo defaults, provenance and migration handling |
| `data.js`, `exercise/definitions.js`, `exercise/measure.js`, backend registry | Stable IDs, shared catalog metadata, explicit capability dispatch and reviewed protocols |
| `metrics.js`, `services/api.js`, `backend/services/analytics.js` | Consistent definitions, unknown values, original assignment snapshots, comparable trends |
| `vision/usePoseCamera.js`, `vision/geometry.js`, `patient/Live.jsx`, reference capture | Candidate model adapter, extra landmarks, coordinate normalization, confidence tuning, versioned outputs |
| `backend/routes/`, trusted Firebase integration | Authorized suggestions/appointments/catalog persistence; no sensitive data through current unprotected routes |
| `firestore.rules`, `storage.rules`, indexes, `frontend/test/` | New access matrices, query indexes, record immutability, provider/patient separation, measurement regression checks |

Add small history, suggestion, and appointment modules only as those features are implemented; this roadmap does not scaffold unused code.

## 12. Verification and decisions still needed

Implementation checks: existing `npm test`, `npm run lint`, and `npm run build`; targeted rules/emulator checks; trusted-endpoint authorization tests; appointment concurrency tests when slot booking is added; cross-account walkthroughs; and the pose/device benchmark. No application tests were rerun for this documentation-only update.

Product defaults proposed here: adult users, invitation-based activation, one treating clinician, curated verified providers, both visit modes, manual confirmation, no payment requirement, on-device movement processing, and clinician-approved recommendations. These are planning assumptions, not user-confirmed requirements.

Before implementing the dependent feature, settle:

1. Launch country/region, professional types, provider verification owner, and clinician reviewer for history and exercise protocols.
2. Whether open patient registration and multiple treating clinicians are required at launch. Both exceed today's invitation/single-relationship design.
3. Provider operations: consultation length/fees, cancellation rules, who confirms visits, and the selected video/calendar/payment services if any.
4. The first exercise expansion batch, approved references/clinical rules, minimum supported phones/browsers, evaluation participants, and predeclared model thresholds.
5. Health-history retention/deletion/sharing requirements and what clinical evidence is required before a real-patient pilot.

Recommended next implementation slice after this review: phase 0 plus health-history collection/review. It supplies the data and trust foundation needed for useful doctor-side suggestions.
