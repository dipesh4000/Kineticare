import test from 'node:test';
import assert from 'node:assert/strict';
import { OneEuroFilter, PoseFilter } from '../src/vision/oneEuroFilter.js';

function stdDev(samples) {
  if (samples.length < 2) return 0;
  const mean = samples.reduce((acc, v) => acc + v, 0) / samples.length;
  const variance = samples.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (samples.length - 1);
  return Math.sqrt(variance);
}

test('OneEuroFilter significantly reduces jitter on a stationary signal (lower standard deviation)', () => {
  const filter = new OneEuroFilter(1.0, 0.007, 1.0);
  const baseline = 200;
  const dtMs = 33.33; // ~30 fps
  const rawValues = [];
  const filteredValues = [];

  // Deterministic high-frequency jitter around 200
  for (let i = 0; i < 150; i++) {
    const jitter = Math.sin(i * 1.7) * 4 + Math.cos(i * 3.1) * 3;
    const raw = baseline + jitter;
    const time = i * dtMs;
    const filtered = filter.filter(raw, time);

    if (i >= 20) { // allow 20 frames of warmup
      rawValues.push(raw);
      filteredValues.push(filtered);
    }
  }

  const rawSd = stdDev(rawValues);
  const filteredSd = stdDev(filteredValues);

  assert.ok(rawSd > 2.5, `Raw jitter standard deviation should be significant (was ${rawSd})`);
  assert.ok(
    filteredSd < rawSd * 0.45,
    `Filtered standard deviation (${filteredSd.toFixed(3)}) should be less than 45% of raw (${rawSd.toFixed(3)})`
  );
});

test('OneEuroFilter tracks a rapid step change within a few frames without sluggish lag', () => {
  const filter = new OneEuroFilter(1.0, 0.007, 1.0);
  const dtMs = 33.33; // 30 fps

  // Establish stationary position at x = 100
  for (let i = 0; i < 20; i++) {
    filter.filter(100, i * dtMs);
  }

  // Rapid step change to x = 300 (e.g. quick arm elevation or leg displacement)
  const stepStartFrame = 20;
  const outputs = [];
  for (let i = 0; i < 10; i++) {
    const t = (stepStartFrame + i) * dtMs;
    const val = filter.filter(300, t);
    outputs.push(val);
  }

  // Within 5 frames (~166ms at 30fps), adaptive cutoff should track at least 85% of the 200px step
  const frame5Value = outputs[4];
  const percentReached = (frame5Value - 100) / (300 - 100);
  assert.ok(
    percentReached >= 0.85,
    `Should reach >= 85% of step change by frame 5 (reached ${(percentReached * 100).toFixed(1)}%, value: ${frame5Value})`
  );
});

test('PoseFilter rejects low-confidence keypoints, marks them untracked, and flushes after timeout', () => {
  const poseFilter = new PoseFilter({ minScore: 0.3, resetAfterMs: 500 });

  // Frame 1: confident keypoint
  const f1 = poseFilter.filter([{ name: 'left_wrist', x: 100, y: 150, score: 0.85 }], 0);
  assert.equal(f1[0].tracked, true);
  assert.equal(f1[0].x, 100);

  // Frame 2: low confidence / occlusion (score 0.15 < 0.3)
  const f2 = poseFilter.filter([{ name: 'left_wrist', x: 999, y: 999, score: 0.15 }], 100);
  assert.equal(f2[0].tracked, false);
  // Coordinates are returned for inspection but marked untracked and NOT fed into filter state
  assert.equal(f2[0].x, 999);

  // Frame 3: returns before timeout (300ms < 500ms resetAfterMs)
  const f3 = poseFilter.filter([{ name: 'left_wrist', x: 102, y: 152, score: 0.9 }], 300);
  assert.equal(f3[0].tracked, true);
  // Continuity is maintained with Frame 1 rather than contaminated by Frame 2's 999
  assert.ok(f3[0].x < 110, `Keypoint should stay close to 100, got ${f3[0].x}`);

  // Frame 4: long occlusion exceeding resetAfterMs (lost at 500ms, stays missing past 1100ms > 500ms threshold)
  poseFilter.filter([{ name: 'left_wrist', x: 0, y: 0, score: 0.1 }], 500);
  poseFilter.filter([{ name: 'left_wrist', x: 0, y: 0, score: 0.1 }], 1100);

  // Frame 5: reappears at a completely different position (x = 500)
  const f5 = poseFilter.filter([{ name: 'left_wrist', x: 500, y: 400, score: 0.95 }], 1200);
  assert.equal(f5[0].tracked, true);
  // Because filter reset after timeout, it instantly snaps to 500 without gliding from 100
  assert.equal(f5[0].x, 500, `Should reset immediately to 500 after long absence, got ${f5[0].x}`);
});
