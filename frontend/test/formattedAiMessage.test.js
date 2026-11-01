import test from 'node:test';
import assert from 'node:assert/strict';
import { parseClinicalBlocks, tokenizeInline, isRedFlagWarning } from '../src/components/clinicalTextParser.js';

test('parseClinicalBlocks parses structured clinical text with inlined bullets and red flags', () => {
  const sample = `Hello KS. Based on the principles in *Therapeutic Exercise: Foundations and Techniques*, here are the precise biomechanical cues to ensure safe, effective squat mechanics.

**Biomechanical Alignment & Cues** * **Proximal Stability:** Engage your core abdominal muscles to maintain a neutral lumbar spine. Avoid lumbar hyperextension (arching) or excessive flexion (rounding). * **Pelvic Positioning:** Maintain pelvic neutrality. Imagine a "shelf" on your pelvis that remains level as you descend. * **Knee Alignment:** Keep knees tracking over the second toe. Prevent knee valgus (caving inward) by actively driving knees outward against the resistance of your hips. * **Hip Hinge Mechanics:** Initiate the movement by pushing your hips back and down, rather than simply bending the knees. This emphasizes gluteal and hamstring engagement. * **Foot Pressure:** Distribute weight evenly across the foot (heel, big toe, and little toe) to maintain a stable base of support.

**Movement Pacing & Breathing** * **Eccentric Phase (Lowering):** Lower yourself in a controlled manner (2–3 seconds). Inhale during this reset phase. * **Concentric Phase (Rising):** Drive through your heels to return to standing. Exhale smoothly during this exertion phase. * **Safety:** Never hold your breath (Valsalva maneuver). Maintain rhythmic breathing throughout.

**Safety & Triage** * **Range of Motion:** Only descend to a pain-free range. If you experience sharp, focal, or pinching pain in the knee or hip, stop immediately. * **Regression:** If discomfort arises, reduce the depth of the squat or perform a partial squat (e.g., to a chair height) to maintain proper form. * **DOMS:** Mild, diffuse muscle soreness 24–48 hours post-exercise is normal. However, joint swelling or pain persisting beyond 48 hours requires regression and clinician review.

**Note on Your Recent Activity** Your recent sessions on Oct 31, 2026, show "Toe Touch" attempts with 0 completed reps. While this is a different movement pattern, the same principles of core stability, controlled pacing, and pain-free range apply. Ensure you are comfortable with foundational movements before progressing.

If you experience chest pain, dizziness, or sudden acute tearing pain, stop immediately and seek urgent medical evaluation.`;

  const blocks = parseClinicalBlocks(sample);

  // 1. Should have narrative greeting
  assert.equal(blocks[0].type, 'paragraph');
  assert.ok(blocks[0].body.includes('Hello KS'));

  // 2. Should have Biomechanical Alignment card
  const bioCard = blocks.find(b => b.type === 'card' && b.theme === 'biomechanics');
  assert.ok(bioCard, 'Biomechanics card should exist');
  assert.equal(bioCard.theme, 'biomechanics');
  assert.equal(bioCard.icon, '📐');
  assert.ok(bioCard.items.length >= 5, 'Should parse all 5 cues');
  assert.equal(bioCard.items[0].label, 'Proximal Stability');
  assert.equal(bioCard.items[1].label, 'Pelvic Positioning');
  assert.equal(bioCard.items[2].label, 'Knee Alignment');
  assert.equal(bioCard.items[3].label, 'Hip Hinge Mechanics');
  assert.equal(bioCard.items[4].label, 'Foot Pressure');

  // 3. Should have Movement Pacing card
  const pacingCard = blocks.find(b => b.type === 'card' && b.theme === 'pacing');
  assert.ok(pacingCard, 'Pacing card should exist');
  assert.equal(pacingCard.icon, '⏱️');
  assert.ok(pacingCard.items.length >= 3);
  assert.equal(pacingCard.items[0].label, 'Eccentric Phase (Lowering)');
  assert.equal(pacingCard.items[1].label, 'Concentric Phase (Rising)');

  // 4. Should have Safety & Triage card
  const safetyCard = blocks.find(b => b.type === 'card' && b.theme === 'safety');
  assert.ok(safetyCard, 'Safety card should exist');
  assert.equal(safetyCard.icon, '🛡️');
  assert.ok(safetyCard.items.length >= 3);
  assert.equal(safetyCard.items[0].label, 'Range of Motion');

  // 5. Should have Red Flag Emergency Alert
  const alertBlock = blocks.find(b => b.type === 'alert');
  assert.ok(alertBlock, 'Alert block should exist');
  assert.ok(alertBlock.body.includes('chest pain'));
  assert.ok(alertBlock.body.includes('seek urgent medical evaluation'));
});

test('tokenizeInline parses bold, italic and code markdown elements', () => {
  const tokens = tokenizeInline('Engage your **core** and *glutes* with `neutral spine`.');
  assert.equal(tokens.length, 7);
  assert.equal(tokens[0].value, 'Engage your ');
  assert.equal(tokens[1].type, 'bold');
  assert.equal(tokens[1].value, 'core');
  assert.equal(tokens[2].value, ' and ');
  assert.equal(tokens[3].type, 'italic');
  assert.equal(tokens[3].value, 'glutes');
  assert.equal(tokens[4].value, ' with ');
  assert.equal(tokens[5].type, 'code');
  assert.equal(tokens[5].value, 'neutral spine');
  assert.equal(tokens[6].value, '.');
});

test('isRedFlagWarning detects medical danger signs', () => {
  assert.ok(isRedFlagWarning('Stop immediately if you have chest pain'));
  assert.ok(isRedFlagWarning('Feeling sudden dizziness or acute tearing pain'));
  assert.ok(!isRedFlagWarning('Perform 10 reps of squats'));
});
