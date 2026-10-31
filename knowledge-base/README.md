# Kineticare textbook knowledge base

The source-curated pilot contains **32 knowledge units, 8 exercise profiles, 11 supported relationships and 5 clusters**, sampled from chapters 6, 16, 17, 21 and 22 of the supplied sixth-edition PDF. Full-book extraction and clinical approval are pending. No exercise is marked ready to render.

Only chapters containing extracted knowledge have a `knowledge-units.jsonl` file. Pending chapters retain metadata and extraction status; create their collection when the first source-grounded unit is added. Empty placeholder collections are omitted.

## Product-facing deliverables

| Exercise variation | Source printed pages | Important distinction |
| --- | --- | --- |
| Bilateral mini-squat | 835–836 | Initial partial range, not every squat |
| Standing wall slide | 836 | Wall support and source-specific range qualification |
| Forward step-up/down | 836 | Explicit concentric/eccentric quadriceps phases |
| Modified supine bridge | 531 | Neutral spine; advanced bridge variations separate |
| Bilateral standing heel raise | 887 | Level surface; not an eccentric-only protocol |
| Assisted eccentric heel lowering | 888 | Sound-limb reset and affected-side lowering |
| Standing band shoulder external rotation | 605 | Arm at side; elbow setup is not shoulder ROM |
| Standing full-can scaption | 606–607 | Scapular plane, not a frontal arm raise |

Each profile records source-backed technique and phases, exact variation aliases, evidence IDs, scoped source parameters, missing information and review status. Proposed contact requirements are marked **engineering interpretations requiring review**, never attributed to the textbook as exact motion geometry.

`generation/gemini-system-instructions.md` and `schemas/generation-plan.schema.json` define the Gemini contract. `scripts/knowledge_base.py` provides local lexical/entity retrieval, exact variation matching, bounded context assembly and post-generation validation. No Gemini key, cloud connection, Three.js renderer or Blender process is needed to inspect this pilot.

## Source and navigation

- Bibliographic details: `book-metadata.json`; source fingerprint: SHA-256.
- Original hierarchy: `structure/book-hierarchy.json`, preserving raw bookmark titles and nesting.
- Page references: `structure/page-map.json`, using one-based PDF page numbers and embedded page labels. Verify the visible printed page whenever extracting a claim.
- Brief contents: PDF pages 14–15. Detailed contents: PDF pages 16–32. Arrow legend: PDF page 33.
- One uploader bookmark is excluded. The inventory does not establish that every bookmark agrees with the visible contents; reconciliation remains explicit review work.

Domain and body-region vocabularies come from the supplied brief. Entity, alias and cluster collections now reference extracted pilot units. Five relevant figures and one exercise-progression box have review records in `sources/`; the rest of the book's visuals remain unreviewed. Relevant source pages were read with continuation text; seven exercise pages were also rendered and inspected visually.

## Continue extraction

1. Read `manifest.json`, existing units and retrieval indexes. Preserve all assigned IDs.
2. Read the exercise-first checkpoint in `extraction-plan.md`. Reconcile relevant chapter headings and subsections with the visible contents and chapter pages. The manifest cursor identifies the next unprocessed source location, not a claim that prior chapters are complete.
3. Read each complete relevant page, including footnotes and continuation pages. Render relevant figures, tables and boxes; never infer image content from surrounding text.
4. Write concise, original, self-contained units using `schemas/knowledge-unit.schema.json`. Keep absent collections empty and unknown optional scalars null. Source identity, source pages and concept text are required for an admitted unit; park unresolved candidates in the review report.
5. Preserve clinical qualifications. Anatomical capability and retrieval association do not establish exercise-specific activation. Do not manufacture phases, dosage or joint angles.
6. Use supported relationships only. Store units once and reference IDs in clusters/indexes. Keep clinician guidance and animation parameters distinct.
7. Update chapter reports, global audit, ID allocators, all indexes, counts and the next unprocessed section cursor together. Use `partial` until the whole chapter has been reviewed.
8. Run the validator. Passing it establishes structural consistency, not clinical accuracy or completeness.

## Local commands

From the workspace root, using Python with `jsonschema`:

```powershell
python scripts/validate_knowledge_base.py
python -m unittest discover -s scripts -p 'test_*.py'
python scripts/query_knowledge_base.py "show me a mini squat"
python scripts/query_knowledge_base.py "which muscles work during a step up"
python scripts/query_knowledge_base.py "single leg bridge"
python scripts/query_knowledge_base.py "mini squat" --validate-plan knowledge-base/examples/mini-squat-review-plan.json
python scripts/query_knowledge_base.py --reindex
```

The query command prints a system instruction, retrieved context and a JSON Schema response contract. It does not call Gemini. To save a payload use `--output` with a new workspace JSON path; exports are noncanonical snapshots. `--reindex` rebuilds references from canonical collections. Query selection is a conservative lexical pilot, not unrestricted natural-language understanding; the backend must still resolve variation, laterality and user intent.

Runtime checks require the `jsonschema` Python package. The original one-time initializer has been removed; continue from the canonical records and manifest rather than regenerating or overwriting the pilot.

## Application boundary

The main application uses Express, Privy and MongoDB Atlas. `backend/routes/ai.js` currently accepts manually authored reference notes; it does not retrieve this knowledge base. The existing frontend skeleton is a camera-landmark canvas overlay, not a generated 3D exercise animation. Keep this folder and its supporting scripts together at the application repository root.

This directory is not yet connected to that application. No patient behavior, cloud data or existing Gemini prompt has been changed. The local context builder is the integration entry point: use its system instruction and bounded context in the server's Gemini request, adapt the JSON Schema to the chosen provider interface, then pass the response through `validate_plan` before any renderer sees it.

No rig or motion asset exists yet. The motion registry and rig catalog are empty deliberately. A reviewed exercise plus matching motion template, approved rig, validated contacts and authorized parameters are needed for rendering. Structural checks do not establish that a model's cited claim is semantically entailed, that a motion is biomechanically correct, or that an exercise is suitable for a patient.
