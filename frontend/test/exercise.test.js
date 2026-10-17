import test from 'node:test';
import assert from 'node:assert/strict';
import { angleAt } from '../src/vision/geometry.js';
import { armRaiseAngle, squatKneeAngle } from '../src/exercise/definitions.js';
import { advanceRep, createRepState } from '../src/exercise/engine.js';
import { calibrateRest } from '../src/exercise/reference.js';
import { scoreRepetitions } from '../src/exercise/score.js';

const point = (name, x, y, score = 1) => ({ name, x, y, score });

test('geometry returns stable angles and rejects degenerate vectors', () => {
  assert.equal(angleAt({ x: 0, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 0 }), 90);
  assert.equal(angleAt({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 }), null);
});

test('exercise features use only visible required joints', () => {
  const squat = [point('left_hip', 0, 0), point('left_knee', 0, 1), point('left_ankle', 0, 2)];
  assert.equal(squatKneeAngle(squat), 180);
  squat[1].score = 0.2;
  assert.equal(squatKneeAngle(squat), null);

  const raise = [point('right_hip', 0, 1), point('right_shoulder', 0, 0), point('right_elbow', 1, 0)];
  assert.equal(armRaiseAngle(raise, 'right'), 90);
});

test('rep engine counts a complete target-reaching cycle after dwell', () => {
  const samples = [
    [0, 0], [0.3, 100], [0.35, 240], [1, 400],
    [0.8, 500], [0.7, 640], [0.1, 800], [0.05, 940],
  ];
  const result = samples.reduce(
    (state, [progress, timestamp]) => advanceRep(state, { progress, timestamp }),
    createRepState(),
  );
  assert.equal(result.attemptedReps, 1);
  assert.equal(result.withinTargetReps, 1);
  assert.equal(result.reps[0].peak, 1);
});

test('tracking loss discards an incomplete repetition', () => {
  let state = createRepState();
  state = advanceRep(state, { progress: 0.4, timestamp: 0 });
  state = advanceRep(state, { progress: 0.5, timestamp: 200 });
  state = advanceRep(state, { progress: 1, timestamp: 400 });
  state = advanceRep(state, { progress: 1, timestamp: 450, tracked: false });
  assert.equal(state.phase, 'REST');
  assert.equal(state.attemptedReps, 0);
  assert.equal(state.peak, 0);
});

test('rest calibration uses a stable median and rejects movement', () => {
  assert.deepEqual(calibrateRest([100, 101, 99, 100, 102, 98, 100, 101, 99, 100]), { ok: true, value: 100 });
  assert.equal(calibrateRest([90, 91, 92, 93, 94, 95, 96, 97, 98, 110]).ok, false);
});

test('prototype score explains reach and tempo components', () => {
  const result = scoreRepetitions([
    { peak: 1, durationMs: 3000 },
    { peak: 0.9, durationMs: 4000 },
  ]);
  assert.deepEqual(result, {
    score: 100,
    components: { reach: 1, tempo: 1 },
    formulaVersion: 'reach-tempo-v1',
  });
  assert.equal(scoreRepetitions([]), null);
});
