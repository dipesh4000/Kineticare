import test from 'node:test';
import assert from 'node:assert/strict';
import { angleAt } from '../src/vision/geometry.js';
import { armRaiseAngle, squatKneeAngle, toeTouchHipAngle } from '../src/exercise/definitions.js';
import { isSideExercise, measureAngle, movementSignal } from '../src/exercise/measure.js';
import { advanceRep, createRepState } from '../src/exercise/engine.js';
import { calibrateRest } from '../src/exercise/reference.js';
import { scoreRep, scoreRepetitions } from '../src/exercise/score.js';

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

test('toe touch hip angle shrinks as the person bends forward', () => {
  const upright = [point('left_shoulder', 0, 0), point('left_hip', 0, 1), point('left_knee', 0, 2)];
  assert.equal(toeTouchHipAngle(upright), 180);
  const bent = [point('left_shoulder', 1, 1), point('left_hip', 0, 1), point('left_knee', 0, 2)];
  assert.equal(toeTouchHipAngle(bent), 90);
  bent[1].score = 0.1;
  assert.equal(toeTouchHipAngle(bent), null);
});

test('side exercises pick one body side and keep it; movement signal follows direction', () => {
  const kp = [point('left_shoulder', 0, 0), point('left_hip', 0, 1), point('left_knee', 0, 2),
    point('right_shoulder', 0, 0), point('right_hip', 0, 1), point('right_knee', 1, 1)];
  const first = measureAngle('Toe Touch', kp, null);
  assert.equal(first.side, 'left');
  assert.equal(measureAngle('Toe Touch', kp, 'right').side, 'right');
  assert.equal(movementSignal('Squat', 170, 125), 45);
  assert.equal(movementSignal('Toe Touch', 175, 115), 60);
  assert.equal(movementSignal('Side Arm Raise', 10, 85), 75);
  assert.equal(isSideExercise('Side Arm Raise'), false);
});

test('a simulated toe-touch set is counted and scored per rep and overall', () => {
  const rest = 175;
  let state = createRepState();
  let t = 0;
  // 5 smooth reps, ~3s each, bending 60 degrees (target 60)
  for (let rep = 0; rep < 5; rep += 1) {
    for (let step = 0; step <= 30; step += 1) {
      const angle = rest - 60 * Math.sin(Math.PI * step / 30);
      state = advanceRep(state, { progress: movementSignal('Toe Touch', rest, angle) / 60, timestamp: t });
      t += 100;
    }
    for (let step = 0; step < 5; step += 1) { state = advanceRep(state, { progress: 0, timestamp: t }); t += 100; }
  }
  assert.equal(state.attemptedReps, 5);
  assert.equal(state.withinTargetReps, 5);
  const perRep = scoreRep(state.reps[0]);
  assert.ok(perRep.score >= 90);
  assert.equal(scoreRepetitions(state.reps).formulaVersion, 'reach-tempo-v1');
});

test('scoreRep penalises shallow and too-fast reps', () => {
  assert.equal(scoreRep({ peak: 1, durationMs: 3000 }).score, 100);
  assert.ok(scoreRep({ peak: 0.45, durationMs: 3000 }).score < 70);
  assert.ok(scoreRep({ peak: 1, durationMs: 1000 }).score < 90);
});

test('rep counter ignores implausible peaks and too-fast glitches', () => {
  const run = samples => samples.reduce((state, [progress, timestamp]) => advanceRep(state, { progress, timestamp }), createRepState());
  const glitch = run([[0, 0], [3, 100], [3, 300], [2.9, 600], [0, 900], [0, 1200], [0, 1500]]);
  assert.equal(glitch.attemptedReps, 0);
  assert.equal(glitch.rejectedReps, 1);
  const fast = run([[0, 0], [0.6, 100], [0.6, 250], [0.4, 350], [0.1, 400], [0.1, 550], [0.1, 700]]);
  assert.equal(fast.attemptedReps, 0);
  const good = run([[0, 0], [0.5, 500], [1, 1500], [1, 1700], [0.6, 2300], [0.6, 2400], [0.1, 3000], [0.1, 3200], [0.1, 3400]]);
  assert.equal(good.attemptedReps, 1);
  assert.equal(good.withinTargetReps, 1);
});
