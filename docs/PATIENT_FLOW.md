# Doctor and patient flow

## Doctor

1. Sign in with a provisioned clinician account.
2. Open Patients and add a patient's name and email.
3. In Firebase mode, this creates a pending invitation. Share the app URL with the patient; automatic invitation-email delivery is not implemented. The patient must sign up with that email, verify it using Firebase's verification email, and sign in. Claiming the invitation atomically creates a patient profile and clinician relationship. Patients cannot provision clinician roles or claim another email's invitation.
4. Once linked, open the patient and edit their assignment. Select exercises, clinician-approved references, repetition and angle targets, instructions, and weekly frequency. Capture missing references in the exercise library first.
5. Save a draft or publish the next version. Published versions stay immutable; an older published draft does not replace the active version.
6. Review saved sessions, per-exercise results, trends, and patient streaks. Send feedback linked to a saved session.

## Patient

1. Sign in to see the current clinician and assigned plan.
2. Start the whole workout or practice one exercise. Review the demonstration and complete preparation checks.
3. Start the camera, calibrate, and exercise with the existing repetition counter, angle feedback, and voice guidance. Pause or stop when needed.
4. Finishing below the assigned repetition target saves a partial result. Stopping a workout leads to its summary rather than starting another exercise.
5. Save the summary to persist the session and make it visible to the doctor. Replays remain labeled as simulated and do not contribute to measured progress or streaks.
6. Read clinician feedback and review progress.

## Streak policy

- One completed live workout with assessed repetitions counts per local calendar day.
- Multiple workouts on one day count once. Partial, unmeasured, and replay sessions do not count.
- Yesterday's streak remains current until today ends. Missing a day resets the current streak; the best streak remains.
- Follow prescribed rest days; the streak does not change the clinician's schedule.

## Local demo

With Firebase unconfigured, add a demo patient using the same form. The new patient appears on the login screen, with separate assignments, history, feedback, and streaks. These records are browser-local and are not authenticated accounts or a cross-device service.

Browser walkthrough verified: add a new patient, save and publish a squat assignment, switch to that patient, complete preparation, run and save a replay, confirm a zero streak, open the saved result as doctor, and send feedback back to that patient.

## Verification and remaining setup

- `npm test`: exercise measurement, email validation, replay classification, and streak checks.
- `npm run lint` and `npm run build`.
- `npm run test:rules --workspace=frontend`: Firebase emulator tests for invitation claims, doctor queries, account isolation, immutable sessions, feedback permissions, and reference access. Requires Java 21 or newer.
- Connected use requires Firebase configuration, Email/Password authentication, authorized deployment domains, deployed Firestore/Storage rules and indexes, and an initially provisioned clinician account. These have not been deployed by this change.
- Real-camera performance and verification-email delivery still need checks on the configured project and intended patient devices. The browser walkthrough used replay and did not request camera access.
