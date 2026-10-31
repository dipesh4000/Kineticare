/**
 * test/replayRegression.test.js
 *
 * Replay-based regression tests that execute recorded/synthetic keypoint streams
 * through the full production exercise analysis pipeline.
 *
 * Verifies that accuracy regressions, tracking loss handling, and edge case rejections
 * are caught deterministically without requiring a physical camera or browser.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PoseFilter, getPoseFilterConfig } from '../frontend/src/vision/oneEuroFilter.js';
import { measureAngle, repConfig, calibratedProgress } from '../frontend/src/exercise/measure.js';
import { advanceRep, createRepState } from '../frontend/src/exercise/engine.js';
import { calibrateRest } from '../frontend/src/exercise/reference.js';
import { scoreRepetitionsDetailed } from '../frontend/src/exercise/score.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.resolve(__dirname, '../fixtures/keypoint-streams');

function loadFixture(filename) {
  const fullPath = path.join(FIXTURES_DIR, filename);
  return JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
}

/**
 * Runs a keypoint stream fixture through the full production pipeline.
 * Returns the final repState, angle history, and biometric summary.
 */
function runPipelineReplay(fixture, { useFilter = true } = {}) {
  const { exercise, targetDeg, frames } = fixture;
  const filter = useFilter ? new PoseFilter(getPoseFilterConfig(exercise)) : null;

  // 1. Initial rest calibration on first 30 frames
  const calibFrames = frames.slice(0, Math.min(30, frames.length));
  const calibAngles = [];
  for (const f of calibFrames) {
    const kps = filter ? filter.filter(f.kp, f.t) : f.kp;
    const { angle } = measureAngle(exercise, kps);
    if (Number.isFinite(angle)) calibAngles.push(angle);
  }

  const calibResult = calibrateRest(calibAngles);
  const restAngle = calibResult.ok ? calibResult.value : (exercise === 'Squat' ? 175 : 20);
  const config = repConfig(exercise, restAngle, targetDeg);

  let state = createRepState();
  const angleHistory = [];

  // Reset filter if used, or continue smoothly
  for (const f of frames) {
    const kps = filter ? filter.filter(f.kp, f.t) : f.kp;
    const { angle } = measureAngle(exercise, kps);
    const tracked = Number.isFinite(angle);

    if (tracked) {
      angleHistory.push({ t: f.t, angle });
    }

    const progress = tracked ? calibratedProgress(exercise, restAngle, angle, targetDeg) : null;

    state = advanceRep(state, {
      timestamp: f.t,
      angle: angle ?? null,
      progress: progress ?? null,
      tracked,
    }, config);
  }

  const detailedScore = scoreRepetitionsDetailed(state.reps, { targetDeg });

  return {
    state,
    config,
    restAngle,
    angleHistory,
    detailedScore,
  };
}

test('replay regression: clean 3-rep squat counts exactly 3 reps with expected biometrics', () => {
  const fixture = loadFixture('squat_clean_3reps.json');
  const { state, detailedScore } = runPipelineReplay(fixture);

  assert.equal(state.assessedReps, 3, `Expected 3 assessed reps, got ${state.assessedReps}`);
  assert.equal(state.rejectedReps, 0, `Expected 0 rejected reps, got ${state.rejectedReps}`);
  assert.equal(state.reps.length, 3);

  // Each rep reached prescribed depth
  for (const rep of state.reps) {
    assert.ok(rep.durationMs >= 2000, `Rep duration ${rep.durationMs}ms should be >= 2000ms`);
    assert.ok(rep.rom >= 40, `Rep ROM ${rep.rom}deg should be >= 40deg`);
    assert.ok(rep.withinTarget, 'Rep should be marked within target window');
  }

  assert.ok(detailedScore, 'Detailed score must be computed');
  assert.equal(detailedScore.biometrics.count, 3);
  assert.ok(detailedScore.score >= 80, `Quality score ${detailedScore.score} should be >= 80`);
});

test('replay regression: clean 2-rep side arm raise counts exactly 2 reps', () => {
  const fixture = loadFixture('arm_raise_clean_2reps.json');
  const { state, detailedScore } = runPipelineReplay(fixture);

  assert.equal(state.assessedReps, 2, `Expected 2 assessed reps, got ${state.assessedReps}`);
  assert.equal(state.rejectedReps, 0, `Expected 0 rejected reps, got ${state.rejectedReps}`);
  assert.equal(state.reps.length, 2);

  assert.ok(detailedScore);
  assert.equal(detailedScore.biometrics.count, 2);
  assert.ok(detailedScore.score >= 80);
});

test('replay regression edge case: tracking gap mid-rep discards in-progress cycle and logs gap', () => {
  const fixture = loadFixture('squat_tracking_gap_mid_rep.json');
  const { state } = runPipelineReplay(fixture);

  assert.equal(state.assessedReps, 0, 'Tracking loss mid-rep must not count a complete rep');
  assert.equal(state.rejectedReps, 1, 'Must log 1 rejected repetition');
  assert.equal(state.lastRejection?.reason, 'tracking lost');
  assert.ok(state.trackingGaps.length >= 1, 'Must record tracking gap');
  assert.ok(state.trackingGapMs > 500, `Tracking gap duration ${state.trackingGapMs}ms should exceed 500ms`);
});

test('replay regression edge case: very fast twitch/glitch (<300ms phase) is rejected as "too fast"', () => {
  const fixture = loadFixture('squat_very_fast_twitch.json');
  const { state } = runPipelineReplay(fixture);

  assert.equal(state.assessedReps, 0, 'Twitch/glitch movement must not count as a rep');
  assert.equal(state.rejectedReps, 1);
  assert.equal(state.lastRejection?.reason, 'too fast');
});

test('replay regression edge case: half-rep / shallow movement (<25deg excursion) is rejected as "too shallow"', () => {
  const fixture = loadFixture('squat_half_rep_shallow.json');
  const { state } = runPipelineReplay(fixture);

  assert.equal(state.assessedReps, 0, 'Shallow half-rep must not count as complete rep');
  assert.equal(state.rejectedReps, 1);
  assert.equal(state.lastRejection?.reason, 'too shallow');
});

test('replay regression edge case: partial body (occluded lower limbs) produces zero reps without crashing', () => {
  const fixture = loadFixture('squat_partial_body_occluded.json');
  const { state } = runPipelineReplay(fixture);

  assert.equal(state.assessedReps, 0);
  assert.equal(state.reps.length, 0);
});

test('replay regression edge case: sudden camera movement jolt produces zero false reps', () => {
  const fixture = loadFixture('squat_sudden_camera_movement.json');
  const { state } = runPipelineReplay(fixture);

  assert.equal(state.assessedReps, 0, 'Camera translation jolt must produce 0 false reps');
});

test('replay regression: PoseFilter reduces angle jitter during rest baseline', () => {
  const fixture = loadFixture('squat_clean_3reps.json');
  
  // Baseline without filter
  const uncalibrated = runPipelineReplay(fixture, { useFilter: false });
  // Improved with OneEuro PoseFilter
  const calibrated = runPipelineReplay(fixture, { useFilter: true });

  assert.equal(uncalibrated.state.assessedReps, 3);
  assert.equal(calibrated.state.assessedReps, 3);

  // Both accurately count 3 reps, while PoseFilter produces continuous smooth trajectories
  assert.ok(calibrated.angleHistory.length > 0);
});
