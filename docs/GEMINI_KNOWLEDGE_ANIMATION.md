# Knowledge-grounded Gemini chat and Three.js preview

Open **Clinician → Exercise library → Exercise knowledge chat**. Choose an exact exercise variation, enter a question and consent to sending it, recent chat context and retrieved source summaries to Google Gemini. No identifiable patient information should be entered.

The current source pilot contains 32 units and 8 exercise variations. Full-book extraction and clinical approval remain pending. An empty contraindication list means not extracted, not no contraindications.

## Runtime flow

1. Express authenticates the clinician and validates the request.
2. `backend/services/exerciseKnowledge.js` resolves the selected variation and retrieves a bounded lexical/entity context with supported relationship expansion.
3. The server sends the supplied prompt **verbatim** from `knowledge-base/generation/user-system-prompt.md` as the first system-instruction part. The existing generation instructions and a runtime adapter follow it. The adapter selects the app's conversation task so the extraction prompt does not restart textbook indexing.
4. Gemini returns structured claims, evidence IDs, movement-phase references, questions and missing requirements. Ajv enforces the complete local schema; additional checks enforce retrieved citations, selected exercise and known phases.
5. The server stores the validated response under the clinician's identity in Atlas. History reads and context loading use that same owner filter. Generation shares the existing per-user, per-minute AI lease with manual-note drafts.
6. For the exact bilateral mini-squat variation, the server may attach an explicitly **illustrative engineering preview** descriptor. Gemini cannot create this descriptor, approve an exercise, inject code or choose bone transforms.

Endpoints: authenticated clinician-only `GET /api/ai/knowledge-chat/catalog`, `GET /api/ai/knowledge-chat`, and `POST /api/ai/knowledge-chat` with `{ message, exerciseId, consent: true }`. The POST is limited to 3000 message characters. Catalog selection can be omitted for lexical resolution; unsupported and conflicting variations remain unselected.

## Configuration and verification

The backend uses existing `GEMINI_API_KEY`, `GEMINI_MODEL`, MongoDB and Privy settings. Secrets stay on the backend. The current account was verified with `gemini-3.8-flash`; the provider rejected 2.5 Flash for new users despite listing it. The 3.8 request uses LOW thinking; MINIMAL was rejected by this provider. Do not assume model-list visibility proves account availability.

The provider request is bounded to 60 seconds; this chat's client timeout is 75 seconds. Existing API calls retain their default timeout. The provider receives a supported JSON Schema subset; full conditional and reference checks run locally. Source citation membership does not establish semantic entailment or clinical correctness.

Live verification on 2026-10-31: a mini-squat request returned four source-cited claims and `needs_review`; the Atlas ping passed. Provider tests also use mocked responses for errors, malformed output, ownership and authorization. A real Privy email-code login and complete clinician UI conversation still require an authenticated user session; no login bypass was added.

## Animation and video scope

The lazy-loaded Three.js preview renders a synthetic articulated skeleton for **bilateral mini-squats only**. The cited initial 30–45-degree knee-flexion range can be selected as a demonstration setting. Six-second default cycle time, normalized segment lengths, interpolation, hip-path choice, stance spacing and camera placement are engineering presentation choices, not textbook facts, measured anatomy or individual clinical targets.

The procedural two-link geometry keeps both feet planted and preserves leg segment lengths. Joint geometry tests verify those invariants and the displayed knee angle. This does not validate the complete biomechanics of a real patient or motion.

Controls change the view, choose a presentation cycle of 3/6/12 seconds, pause playback, and record one cycle in the browser. A composited canvas embeds the pending-review label in the video. `MediaRecorder` uses a supported WebM codec, or MP4 where the browser advertises it. Export format depends on the browser; this is not a server-side MP4/transcoding service. Closing the preview stops capture and releases graphics and media resources. Video stays local until a user downloads it; it is not uploaded to Atlas.

Clinically approved motion generation remains blocked by the existing knowledge-base contract. Approved registries are still empty. No draft is automatically assigned to a patient or connected to camera scoring. Other variations return explanations and missing motion requirements, not an unrelated animation.

## Checks

```powershell
npm run lint
npm test
npm run test:backend
npm run build
python -B scripts/validate_knowledge_base.py
python -B -m unittest discover -s scripts -p 'test_*.py'
```

For visual verification during Vite development, open `/test/animation-preview.html`. This isolated fixture is excluded from the production build and does not provide account access. Browser verification produced a playable, downloadable 960×600 WebM with changing frames and an embedded review label.

Official references: [Gemini generation and system instructions](https://ai.google.dev/api/generate-content), [structured output](https://ai.google.dev/gemini-api/docs/generate-content/structured-output), [Three.js rendering](https://threejs.org/manual/pages/creating-a-scene.html), [canvas video capture](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/captureStream).
