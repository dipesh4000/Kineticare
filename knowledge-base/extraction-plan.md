# Exercise-first extraction and generation plan

## Completed pilot

32 atomic source-grounded units, 8 explicit exercise variations, 11 relationships, 5 topic clusters, 5 visually reviewed figure records and 1 reviewed box record. Chapters 6, 16, 17, 21 and 22 are **partial**; no chapter or full bookmarked section is declared complete. Primary exercise source pages: PDF 564, 638–640, 868–869, 920–921. General principles and muscle-function evidence use additional cited pages.

The pipeline prepares bounded lexical/entity context, identifies registered variations conservatively, supplies Gemini instructions and a strict output contract, and rejects ungrounded IDs or premature rendering. This is local integration machinery, not a live Gemini call or generated video.

## Next product checkpoint

1. Clinician reviews the bilateral mini-squat definition and source-specific historical cues; record approval or required changes with reviewer and date.
2. Select or author a licensed, reviewed rig and matching mini-squat motion asset or procedural movement. These are engineering artifacts, not extra textbook facts.
3. Specify coordinate system, rest pose, logical-to-bone mapping, units, contact behavior, phase boundaries and allowed parameter ranges. Verify feet remain planted and movement respects the reviewed variation.
4. Register the approved motion and rig. Resolve required metadata before setting an exercise render-ready. Application-authorized values must carry their origin; source ranges cannot silently become patient targets.
5. Feed retrieved evidence into Gemini, validate the response, preview with the renderer, and review the complete demonstration before user-facing release. Three.js/Blender integration remains separate work.

## Continue source curation

The source cursor is chapter 21, Closed-Chain (Weight-Bearing) Exercises, PDF 869 / printed 836. Mini-squats, wall slides and the introductory step-up/down passage have pilot records; partial/full lunges and following techniques remain unprocessed. Existing pilot extraction is selective; earlier chapter content remains pending.

Expand by named exercise variation and its supporting concepts, preserving the original book hierarchy and ID allocators. Prioritize closing information gaps in the existing eight profiles before adding many incomplete entries. Standing toe touch and the app's general bilateral side arm raise need their own verified source packets; full-can scaption is not a substitute.

## Per-exercise extraction checklist

- Exact name/variation, body position, laterality, equipment and support context.
- Starting posture, source-described sequence, phase-specific joint and muscle claims only when supported.
- Scoped numeric parameters with units and evidence; distinguish setup angle, motion plane, amplitude, progression ceiling and individual target.
- Stability requirements, compensations, source-qualified precautions and condition context.
- Figures, tables and boxes reviewed with source pages and explicit visual limitations.
- Missing details retained as unknown; engineering contact proposals stored separately from source claims.
- Exact aliases and exclusions for retrieval. Related anatomy is not evidence of phase activation.
- Clinical review and animation readiness tracked independently of extraction confidence.

## Maintenance and validation

Read the manifest and existing records before every continuation. Allocate monotonically increasing IDs. Store canonical units once; exercises, clusters and indexes refer to IDs. Update counts, chapter reports, global audit and the cursor together; rebuild indexes from canonical data.

Run `python scripts/validate_knowledge_base.py` and `python -m unittest discover -s scripts -p 'test_*.py'`. Structural checks cannot verify clinical truth or citation entailment; qualified source/clinical and motion reviews remain explicit requirements. Full-book contents reconciliation, table/figure inventory, glossary and index processing remain open.
