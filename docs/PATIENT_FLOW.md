# Patient and clinician flow

Current Firebase-free flow, 30 October 2026.

## Patient

1. Authenticate with a Privy email code and complete a Patient profile. No invitation is required.
2. Use independent starter guidance, bundled demonstrations and camera sessions. Starter guidance is a fixed prototype; history-based AI prescriptions are not implemented.
3. Save sessions to Atlas and view history.
4. Optionally open Info, enter a clinician invite code, preview their identity, and explicitly confirm sharing consent.
5. Receive assignments and feedback while connected.
6. Revoke access from Info. Subsequent clinician requests are denied; your records remain.

## Clinician

1. Authenticate by email code and complete a Clinician profile. Self-registration does not verify professional credentials.
2. Create an invite code from Patients or Settings and share it with a patient. It expires after 24 hours.
3. The patient appears after consent. A code alone grants no record access.
4. Assign bundled-reference exercises, review sessions and send feedback.
5. Use Gemini exercise drafts for source-noted education requiring review. Drafts are not automatically assignable or camera-measured.

One clinician connection is active per patient. Bundled videos cover squat and toe touch. Firebase, reference recording/upload, and demo login bypasses have been removed.

See [setup](PRIVY_ATLAS_SETUP.md) and [roadmap](FEATURE_ROADMAP.md).

