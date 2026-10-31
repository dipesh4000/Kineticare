import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceRep, createRepState } from '../src/exercise/engine.js';
import { measureAngle, repConfig } from '../src/exercise/measure.js';

const point = (name, x, y, score = 1) => ({ name, x, y, score });

test('strict state machine counts clean repetitions with full per-rep details', () => {
  const config = repConfig('Squat', 175, 45);
  let state = createRepState();

  // 2 clean squat repetitions at ~2.8s each
  let t = 0;
  for (let rep = 0; rep < 2; rep++) {
    // Rest phase (175°)
    for (let i = 0; i < 5; i++) {
      state = advanceRep(state, { angle: 175, progress: 0, timestamp: t }, config);
      t += 100;
    }
    // Descent / Outbound (175° -> 130°, 45° excursion) over 1200ms
    for (let i = 1; i <= 12; i++) {
      const angle = 175 - (45 * (i / 12));
      const progress = (175 - angle) / 45;
      state = advanceRep(state, { angle, progress, timestamp: t }, config);
      t += 100;
    }
    // Bottom inflection dwell (130°) for 200ms
    for (let i = 0; i < 2; i++) {
      state = advanceRep(state, { angle: 130, progress: 1.0, timestamp: t }, config);
      t += 100;
    }
    // Return / Ascending (130° -> 175°) over 1200ms
    for (let i = 1; i <= 12; i++) {
      const angle = 130 + (45 * (i / 12));
      const progress = Math.max(0, (175 - angle) / 45);
      state = advanceRep(state, { angle, progress, timestamp: t }, config);
      t += 100;
    }
    // Rest completion dwell (175°)
    for (let i = 0; i < 3; i++) {
      state = advanceRep(state, { angle: 175, progress: 0, timestamp: t }, config);
      t += 100;
    }
  }

  assert.equal(state.attemptedReps, 2);
  assert.equal(state.rejectedReps, 0);
  assert.equal(state.reps.length, 2);

  const firstRep = state.reps[0];
  assert.ok(Number.isFinite(firstRep.startTime), 'Rep must record startTime');
  assert.ok(Number.isFinite(firstRep.endTime), 'Rep must record endTime');
  assert.ok(firstRep.duration > 2.0 && firstRep.duration < 4.0, 'Rep must record duration in seconds');
  assert.ok(firstRep.durationMs > 2000, 'Rep must record duration in ms');
  assert.ok(firstRep.rom >= 40, 'Rep must record range of motion degrees');
  assert.equal(firstRep.withinTarget, true);
});

test('jitter around enter and exit thresholds produces zero extra reps', () => {
  const config = repConfig('Side Arm Raise', 10, 75);
  let state = createRepState();
  let t = 0;

  // 1. Oscillate jitter around enter threshold (progress ~0.22 - 0.27, angle ~26° - 30°)
  for (let i = 0; i < 40; i++) {
    const jitterAngle = 26 + (i % 2 ? 4 : -1);
    const progress = (jitterAngle - 10) / 75;
    state = advanceRep(state, { angle: jitterAngle, progress, timestamp: t }, config);
    t += 50; // fast 20Hz jitter
  }
  assert.equal(state.attemptedReps, 0, 'Threshold jitter must not trigger rep count');

  // Return to rest
  state = advanceRep(state, { angle: 10, progress: 0, timestamp: t }, config);
  t += 200;

  // 2. Perform exactly one full, clean arm raise to 85° (75° excursion)
  for (let i = 1; i <= 10; i++) {
    const angle = 10 + (75 * (i / 10));
    state = advanceRep(state, { angle, progress: (angle - 10) / 75, timestamp: t }, config);
    t += 120;
  }
  for (let i = 1; i <= 10; i++) {
    const angle = 85 - (75 * (i / 10));
    state = advanceRep(state, { angle, progress: Math.max(0, (angle - 10) / 75), timestamp: t }, config);
    t += 120;
  }

  // 3. Oscillate jitter around exit threshold (progress ~0.13 - 0.17)
  for (let i = 0; i < 40; i++) {
    const jitterAngle = 20 + (i % 2 ? 3 : -2);
    const progress = (jitterAngle - 10) / 75;
    state = advanceRep(state, { angle: jitterAngle, progress, timestamp: t }, config);
    t += 50;
  }

  // Finish back at rest
  for (let i = 0; i < 5; i++) {
    state = advanceRep(state, { angle: 10, progress: 0, timestamp: t }, config);
    t += 100;
  }

  assert.equal(state.attemptedReps, 1, 'Only the single real rep must be counted despite threshold jitter');
  assert.equal(state.rejectedReps, 0);
});

test('half reps (too shallow) are rejected with reason "too shallow"', () => {
  const config = repConfig('Squat', 175, 45); // minRom is 25°
  let state = createRepState();
  let t = 0;

  // Shallow squat: only flexes to 160° (excursion of 15° < minRom 25°), duration > 1000ms
  for (let i = 0; i < 3; i++) { state = advanceRep(state, { angle: 175, progress: 0, timestamp: t }, config); t += 100; }
  for (let i = 1; i <= 8; i++) { state = advanceRep(state, { angle: 175 - (15 * (i / 8)), progress: (15 * (i / 8)) / 45, timestamp: t }, config); t += 100; }
  for (let i = 0; i < 2; i++) { state = advanceRep(state, { angle: 160, progress: 15 / 45, timestamp: t }, config); t += 100; }
  for (let i = 1; i <= 8; i++) { state = advanceRep(state, { angle: 160 + (15 * (i / 8)), progress: (15 - 15 * (i / 8)) / 45, timestamp: t }, config); t += 100; }
  for (let i = 0; i < 3; i++) { state = advanceRep(state, { angle: 175, progress: 0, timestamp: t }, config); t += 100; }

  assert.equal(state.attemptedReps, 0, 'Half rep must not be counted');
  assert.equal(state.rejectedReps, 1);
  assert.equal(state.lastRejection?.reason, 'too shallow');
  assert.ok(state.lastRejection?.rom <= 20);
});

test('too-fast glitch movements are rejected with reason "too fast"', () => {
  const config = repConfig('Squat', 175, 45); // minDurationMs is 700ms
  let state = createRepState();

  // Fast cycle: enters OUTBOUND at 180, reaches peak at 220, RETURNING at 390, COMPLETE at 530 (duration 350ms < 700ms)
  state = advanceRep(state, { angle: 175, progress: 0, timestamp: 0 }, config);
  state = advanceRep(state, { angle: 155, progress: 0.44, timestamp: 50 }, config); // pends OUTBOUND
  state = advanceRep(state, { angle: 155, progress: 0.50, timestamp: 180 }, config); // OUTBOUND at 180
  state = advanceRep(state, { angle: 130, progress: 1.0, timestamp: 220 }, config); // peak
  state = advanceRep(state, { angle: 145, progress: 0.70, timestamp: 260 }, config); // pends RETURNING
  state = advanceRep(state, { angle: 155, progress: 0.40, timestamp: 390 }, config); // RETURNING at 390
  state = advanceRep(state, { angle: 172, progress: 0.08, timestamp: 400 }, config); // pends COMPLETE
  state = advanceRep(state, { angle: 175, progress: 0.02, timestamp: 530 }, config); // COMPLETE at 530 (350ms total)

  assert.equal(state.attemptedReps, 0, 'Glitch movement must not be counted as a repetition');
  assert.equal(state.rejectedReps, 1);
  assert.equal(state.lastRejection?.reason, 'too fast');
});

test('tracking loss mid-rep discards in-progress cycle, logs tracking gap, and refuses cross-gap motion', () => {
  const config = repConfig('Squat', 175, 45);
  let state = createRepState();
  let t = 0;

  // 1. Begin descent towards 130°
  for (let i = 0; i < 3; i++) { state = advanceRep(state, { angle: 175, progress: 0, timestamp: t }, config); t += 100; }
  for (let i = 1; i <= 6; i++) { state = advanceRep(state, { angle: 175 - (40 * (i / 6)), progress: (40 * (i / 6)) / 45, timestamp: t }, config); t += 100; }

  assert.equal(state.phase, 'OUTBOUND');

  // 2. Patient steps out of frame or landmark occluded mid-rep
  state = advanceRep(state, { angle: null, progress: null, timestamp: t, tracked: false }, config);
  assert.equal(state.phase, 'REST', 'Tracking loss must discard cycle and reset to REST');
  assert.equal(state.attemptedReps, 0);
  assert.equal(state.rejectedReps, 1);
  assert.equal(state.lastRejection?.reason, 'tracking lost');
  assert.ok(state.trackingGaps.length >= 1, 'Tracking gap must be recorded');

  // 3. Gap continues for 1.5 seconds
  t += 1500;
  state = advanceRep(state, { angle: null, progress: null, timestamp: t, tracked: false }, config);
  t += 500;

  // 4. Tracking reappears already back at standing rest (175°)
  state = advanceRep(state, { angle: 175, progress: 0, timestamp: t, tracked: true }, config);
  t += 100;
  assert.equal(state.attemptedReps, 0, 'Must NOT join prior motion across tracking gap');

  // 5. Subsequent complete, uninterrupted rep succeeds
  for (let i = 1; i <= 10; i++) {
    const angle = 175 - (45 * (i / 10));
    state = advanceRep(state, { angle, progress: (175 - angle) / 45, timestamp: t }, config);
    t += 120;
  }
  for (let i = 1; i <= 10; i++) {
    const angle = 130 + (45 * (i / 10));
    state = advanceRep(state, { angle, progress: Math.max(0, (175 - angle) / 45), timestamp: t }, config);
    t += 120;
  }
  for (let i = 0; i < 3; i++) {
    state = advanceRep(state, { angle: 175, progress: 0, timestamp: t }, config);
    t += 100;
  }

  assert.equal(state.attemptedReps, 1, 'Clean rep following gap must be counted');
});

test('very slow / stalled movements exceeding maximum cycle duration are rejected with "too slow"', () => {
  const config = repConfig('Squat', 175, 45); // maxCycleDurationMs is 7000ms
  let state = createRepState();
  let t = 0;

  // Outbound descent
  state = advanceRep(state, { angle: 175, progress: 0, timestamp: t }, config); t += 100;
  state = advanceRep(state, { angle: 155, progress: 0.44, timestamp: t }, config); t += 100;
  state = advanceRep(state, { angle: 155, progress: 0.44, timestamp: t }, config); t += 150; // OUTBOUND ready at 350
  state = advanceRep(state, { angle: 130, progress: 1.0, timestamp: t }, config); t += 200;

  // Stalled at bottom for 8000ms (> 7000ms max)
  t += 8000;
  state = advanceRep(state, { angle: 130, progress: 1.0, timestamp: t }, config);

  assert.equal(state.attemptedReps, 0, 'Stalled / excessively slow cycle must not count as valid repetition');
  assert.equal(state.rejectedReps, 1);
  assert.equal(state.lastRejection?.reason, 'too slow');
});

test('squat side selection uses the side with higher average landmark confidence (hip, knee, ankle)', () => {
  // Left side has weak scores (0.35 each, avg 0.35); right side has strong scores (0.95 each, avg 0.95)
  const keypoints = [
    point('left_hip', 0, 1, 0.35),
    point('left_knee', 0, 2, 0.35),
    point('left_ankle', 0, 3, 0.35),
    point('right_hip', 2, 1, 0.95),
    point('right_knee', 2, 2, 0.95),
    point('right_ankle', 2, 3, 0.95),
  ];

  // Unlocked selection should choose right side based on higher average confidence
  const selected = measureAngle('Squat', keypoints, null);
  assert.equal(selected.side, 'right', 'Squat must select side with higher average landmark confidence');

  // Once locked, it should preserve the locked side
  const locked = measureAngle('Squat', keypoints, 'left');
  assert.equal(locked.side, 'left', 'Must respect locked side once calibrated');
});
