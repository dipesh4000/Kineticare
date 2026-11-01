# Kineticare: patient and clinician acceptance walkthrough

Use two different email accounts and separate browser profiles (or a regular window plus an incognito window). Choose Patient for one account and Clinician for the other. Existing account roles cannot be changed through signup. Use synthetic test records rather than real patient information.

## 1. Start the full product

1. Configure root `.env` with Privy, Atlas and Gemini settings using `docs/PRIVY_ATLAS_SETUP.md`. Set the matching public Privy app ID in `frontend/.env.local`. Keep server secrets out of VITE variables.
2. Run `npm run dev` from the project root. This starts both the frontend and backend. The normal ports are 3000 and 3001. `npm run dev:frontend` alone is not enough for login, saved records or generation. If a port is occupied, stop your existing launcher or select different ports; do not accidentally use a Vite fallback on the backend's port.
3. Open the ready URL printed by the launcher. Check that login and workspace loading complete without a backend error.
4. For testing on an actual phone, use an HTTPS deployment with the backend/API configured. Opening your laptop's plain HTTP LAN address on a phone usually prevents camera access. `localhost` on your phone refers to the phone, not your laptop. Allow the actual web origin in Privy.
5. Confirm the UI is the current build. Local changes are not automatically deployed to Vercel. Reopen the updated deployment if you installed an older PWA.

## 2. Clinician: creation workspace

Open **Exercise library**.

| Action | Pass condition |
| --- | --- |
| Open Movement studio | Exercise choices, movement cues and a 3D preview appear together on desktop; they stack on a phone. |
| Select Side Arm Raise | A solid 3D mannequin raises both arms symmetrically and lowers them to rest. |
| Change arm height to 45°, 75° and 90° | Peak displayed angle changes to the selected height. Feet and torso stay in place. |
| Select Front, 3/4 view and Side | View changes without stopping the page or distorting the body. |
| Change tempo; pause and play | Cycle speed changes; pause freezes the movement; play resumes. |
| Export preview video | One complete cycle renders, then a playable/downloadable video appears. It remains labelled illustrative. |
| Select Squat | The squat preview loads with its supported 30°/45° range. |
| Select Toe Touch | Its bundled demonstration video loads. There is no invented 3D motion for it. |
| Open Create a guide | Exercise choice, three brief presets and the review panel are visible. |
| Leave consent unchecked | Generate stays disabled. |
| Select Bilateral mini-squat and Patient-friendly guide | Optionally request “Explain the return phase in simple language.” Check consent, then generate. |
| Wait for the result | A success notification, movement phases, guide, source cards and review gaps appear. On a phone, the result scrolls into view. |
| Open source evidence and review gaps | References and unresolved requirements can be inspected. They are not silently treated as approved. |
| Copy draft & review notes | Clipboard contains the guide and its review limitations. |
| Reload the real app | Saved guide history comes from the backend, rather than disappearing with component state. |
| Generate immediately again | A rate-limit message may appear. Wait at least one minute before retrying. |
| Use Movement breakdown and Precautions & evidence | Each preset requests the matching output, rather than reusing an unrelated free-text question. |

If generation fails, use the actual error: missing Gemini configuration, unavailable model, quota or timeout. A saved guide is education; it does not automatically become an exercise assignment. The source catalog currently has eight variations and does not include an exact bilateral side arm raise. Use Movement studio for its illustrative animation rather than substituting full-can/scaption as if it were the same movement.

## 3. Connect the accounts

1. Clinician: open **Patients** or **Settings**, then **Create invite code**.
2. Patient: open **Info**, enter the code and select **Review clinician**.
3. Confirm the displayed clinician is correct. Before consenting, the clinician must not have access to the patient's records.
4. Patient: check sharing consent and select **Confirm connection**.
5. Clinician: the patient should appear in Patients after the workspace refresh (normally within about five seconds).
6. Reload both windows. The connection must persist.

## 4. Clinician: assign and update a plan

1. Open the linked patient and select **Edit assignment**.
2. Select Squat and Toe Touch, which currently have bundled references. Verify the reference is preselected when choosing an exercise.
3. Set distinct test targets and instructions, name the plan, and choose sessions per week.
4. Save a draft. Reload and verify it is restored; the patient's active plan must not change merely because a draft was saved.
5. Review Patient preview and select **Publish patient plan**. Verify the patient sees the new name, exercises, targets and notes after refresh.
6. Publish a second version with a changed target. Future sessions must use the new version; saved old sessions must remain unchanged.
7. Select Side Arm Raise in a new assignment: it currently has an illustrative preview but **no approved bundled reference**, so publishing it must be blocked with an actionable error. Save as draft should work. This is a current product gap, not a failed camera test. Do not bypass reference validation to finish a demo.

To test real arm tracking now, use a separate unassigned patient account's self-guided starter plan. Once a clinician plan is published, it replaces that starter plan. Use the linked patient's Squat/Toe Touch sessions for the assignment-to-results round trip.

## 5. Patient: camera and repetition acceptance

On the unassigned test patient, open **Workout → Side Arm Raise → Practice**. Review the preview, complete the camera checklist, then choose **Continue to camera**, then **Start exercise** below the preview. Use a stable phone, even lighting and enough distance to include your hips, both shoulders and elbows; keep hands/feet visible if you want those extra landmarks to be tracked too.

| Scenario | Expected result |
| --- | --- |
| Choose Detailed mode | BlazePose full (MediaPipe runtime) loads; the quality panel identifies 33 possible landmarks. First use downloads model assets. |
| Stand facing camera, arms at sides | Setup collects a stable rest position and shows Tracking movement. Do not begin reps before this. |
| Watch the overlay | Left and right sides have different colors. Confident face, hand and foot landmarks connect to the body. Hidden joints are not fabricated. |
| Compare left/right shoulder readouts | Both update independently. These are camera estimates; detection confidence is not a clinical accuracy score. |
| Perform five slow full raises and returns | A repetition increments after the complete return, not while the arms remain raised. Compare the on-screen count with your manual count. |
| Lift only one arm | It must not satisfy a bilateral target through angle averaging. |
| Hold both arms up | It must not count repeated reps while holding still. |
| Raise past the assigned target | A plausible movement can count, but the range check should mark it outside target. Never raise further just to make a counter increment. |
| Move one elbow/hip out of view | Required measurement becomes unassessed; an incomplete rep is discarded rather than guessed. Return to rest before retrying. |
| Pause mid-rep, then resume | Incomplete movement does not become a completed rep. Earlier completed reps remain. |
| Recalibrate after completing reps | Rest position resets; previously completed reps remain. |
| Try Balanced mode in a fresh attempt | BlazePose lite (MediaPipe runtime) still provides 33 landmarks, with a different speed/accuracy tradeoff. |
| Try Fast mode in a fresh attempt | MoveNet Lightning provides 17 landmarks, explicitly labelled as such. Do not expect finger/heel landmarks in this mode. |
| Deny camera access | A permission error and retry path appear. Re-enable permission in the browser, then retry. |
| Verify distance in checklist | The 5-point checklist shows “Camera distance: X.X m (Optimal)”. 1.8–2.8 m is the recommended range. |
| Test “Too close” stance (< 1.6 m) | Checklist shows ⚠️ Camera distance: Too close. Alert prompt instructs “Step back from camera (~X.X m). Recommended distance is 1.8–2.8 m.” Calibration is blocked until stepped back. |
| Test “Too far” stance (> 3.2 m) | Checklist shows ⚠️ Camera distance: Too far. Alert prompt instructs “Step closer to camera (~X.X m).” Calibration is blocked until stepped forward. |
| Check live distance in tracking HUD | Quality panel displays real-time distance: [X.Xm | Distance (Optimal)]. Color is green for optimal, amber for too close/far. |
| Test live drift distance alert | While doing reps, step forward < 1.6 m. A yellow pill appears: “📏 Distance Alert: Too close to camera (~X.Xm)”. Spoken voice cue says: “Step back from the camera.” Stepping back clears the alert. |
| Flip camera on phone (Front ↔ Back) | Tap “🔄 Back cam” (top-right of camera or bottom action bar). Feed switches to the rear environment camera. Video and pose overlay un-mirror (normal orientation) and joint angles stay legible. Tap “🔄 Front cam” to return to mirrored selfie mode. |
| Finish exercise | Summary shows the attempted reps, on-target reps and measurement results. Calibrated baseline distance is saved with session metrics. |
| Save the summary | Session appears in Progress/Workout after a reload. Merely viewing the summary does not save it. |

Repeat Squat and Toe Touch from the linked patient's published plan. Stand side-on for these exercises. For a full workout, verify the next measured exercise opens and all results reach the final summary. Stop an exercise partway through and verify it is saved as partial, not completed.

Test a stationary rest position for 15 seconds: it should not add reps. Repeat a manually counted set on each intended device and mode. Record phone/browser, mode, visible joints, frame rate, expected count and actual count. Test real camera input separately from replay: replay is simulated and does not prove camera accuracy.

## 6. Clinician: results and care communication

1. Save a measured session as the linked patient. Open that patient as clinician; the new session should appear after refresh.
2. Check the exercise names, targets, rep count, score and selected session. Mark the session reviewed; reload and confirm the review persists.
3. Generate a SOAP progress note and inspect it. Copy or insert its plan into the feedback draft, review it, then send feedback/reminder.
4. Patient: open Feedback. Read the message, ask a question and submit it.
5. Clinician: open the request, reply and resolve it. Patient should see the reply and resolved state.
6. Patient: request help before an exercise. Check the success/error notification and corresponding clinician request.
7. Test printable reports and check that content fits both mobile and print views.
8. Notifications here are in-app toasts/statuses and workspace updates. There is no background push, email or SMS notification delivery implemented.

## 7. Boundaries, persistence and mobile recovery

- Sign out and sign back in as both accounts. Records must persist in Atlas; the UI must not expose the other role's pages.
- Patient revokes clinician access under Info. Subsequent clinician access to those records must be denied; the patient retains their records.
- During a test save/generation, disconnect the network. The UI must show a failure rather than claim success. Reconnect and retry without losing entered values.
- Refresh after saving a session and check it did not create a duplicate. Check that replay remains visibly labelled simulated and does not become measured progress.
- Check 360px, 390px and 430px mobile widths, landscape and desktop; controls, bottom navigation, review notes and notifications must remain reachable without horizontal scrolling.
- Confirm camera tracks stop after leaving the exercise. Backgrounding the tab, switching apps and restoring a phone browser need real-device checks.

## 8. Automated and visual checks

From the project root:

```powershell
npm test
npm run test:backend
npm run lint
npm run build
```

With Vite running, development-only fixtures are available:

- `/test/pose-model-preview.html`: actual production model inference on the bundled squat video; no camera or patient records. Choose each mode and Verify model. Detailed/Balanced should return up to 33 landmarks with finite coordinates; Fast up to 17. Stop when done.
- `/test/mobile-ux-preview.html`: synthetic patient/clinician layouts at phone width.
- `/test/mobile-ux-preview.html?screen=%2Fpreview%2Fgeneration`: synthetic generation workflow. It never calls Gemini and is not proof of cloud generation or persistence.

The fixtures are excluded from the production app entry/build. Automated checks cover geometry, bilateral measurement, reps, animation constraints, authentication/consent boundaries and API contracts. They cannot establish real-device pose accuracy, live cloud delivery or clinical validity.

## Verification recorded for this change

- 36 frontend tests and 14 backend tests passed; lint and the production build passed. Vite still warns about large dependency chunks.
- Actual browser inference on the bundled squat video returned finite, drawn landmarks in Detailed (33), Balanced (33) and Fast (17) modes. Detailed uses the MediaPipe runtime because the tested TFJS BlazePose runtime returned invalid coordinates on this browser.
- The 3D arm preview's range, view, tempo, pause and one-cycle video export were exercised in the browser.
- Synthetic generation submission, result review and phone-width layouts were checked. This did not call live Gemini or test real cloud account persistence.
- Live phone camera performance, physical arm-raise counts and the two-account cloud flow still require the device/account acceptance checks above.

## Meeting calendar and current camera startup

Clinician: open Overview and select Schedule beside Upcoming meetings. Enter a title, future local date/time, duration, and optionally select a linked patient and paste an HTTPS meeting link. Save the meeting. It should appear in Upcoming meetings and add a dot to that date in the calendar. Select the date to filter its meetings; Today returns to the seven-day window with today in the middle (fourth column). Cancel a test meeting and confirm that its marker/list entry is removed. Linked patients see their appointments on Home after the workspace refresh; personal clinician meetings remain private. These meetings are stored in Atlas, not in an external calendar, and do not create a video call or email invitation.

Camera setup now ends with a regular Start exercise button below the demonstration and tracking choice. Balanced 33-landmark tracking is the default for phones.

A 5-point pre-session validation system verifies:
1. Required body landmarks visible
2. Safety margins (no head/feet clipping)
3. Camera distance (1.8m–2.8m optimal, pinhole anthropometric projection with torso baseline)
4. Exercise viewing orientation (side-on for Squats/Toe Touches, front-facing for Arm Raises)
5. Stable frame rate (min 15 fps)

Real-time audio and visual distance alerts notify patients when they step too close (< 1.6m) or too far (> 3.2m). On mobile devices, patients can tap "🔄 Flip camera" (top-right tag or action bar) to toggle between the front selfie camera (mirrored) and the back environment camera (unmirrored) for stand-mounted or clinician-guided recording. The camera preview stays hidden until start; pause/finish controls are unavailable during model loading or failure. A failure shows its reason and Retry camera setup / Try Fast tracking. Restarting setup preserves completed reps and discards the unfinished rep.

The production build includes the pinned MediaPipe runtime, WASM, and Full/Lite model files under `pose/0.5.1675469404/`. Deploy the entire `frontend/dist` directory, including `pose/`, and restart the frontend/backend after updating code. Startup no longer depends on the jsDelivr CDN. Loading has a 45-second timeout; the first use still needs to download files from the app's own host.

To check production tree shaking and asset loading locally, run `npm exec --workspace frontend -- vite build --config test/vite.production-preview.config.js` and serve `frontend/dist/verification` as a separate static root. Its `/test/pose-model-preview.html` uses the compiled production loader. Do not publish these synthetic fixtures as the main app. A normal `npm run build` removes that nested verification output.

The current production verification confirmed 33-landmark inference using only same-origin runtime scripts, meeting creation/date filtering/cancellation in the UI, a single static Start exercise action below the preview, and today at index 3 on both mobile calendars without horizontal overflow at 360px. Live phone camera input and configured Atlas/Privy accounts remain device/account checks.
