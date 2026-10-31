import test from 'node:test';
import assert from 'node:assert/strict';
import { angleAt } from '../src/vision/geometry.js';
import { armRaiseAngle, squatKneeAngle, toeTouchHipAngle } from '../src/exercise/definitions.js';
import { isSideExercise, measureAngle, movementSignal, calibratedProgress, repConfig } from '../src/exercise/measure.js';
import { advanceRep, createRepState } from '../src/exercise/engine.js';
import { calibrateRest } from '../src/exercise/reference.js';
import { scoreRep, scoreRepetitions } from '../src/exercise/score.js';
import { POSE_CONNECTIONS, poseSummary, shoulderAngles, smoothPose } from '../src/vision/poseOverlay.js';

const point = (name, x, y, score = 1) => ({ name, x, y, score });

test('detailed overlay covers hands, heels, toes and face without reporting missing landmarks as tracked', () => {
  const names = new Set(POSE_CONNECTIONS.flat());
  for (const side of ['left', 'right']) for (const joint of ['thumb', 'index', 'pinky', 'heel', 'foot_index', 'eye_inner', 'eye_outer', 'ear']) assert.ok(names.has(`${side}_${joint}`));
  const pose = { keypoints: [point('nose', 20, 30, 0.9), point('left_wrist', 10, 20, 0.1), point('right_wrist', NaN, 20, 0.9)] };
  assert.deepEqual(poseSummary(pose), { visible: 1, total: 3, confidence: 90 });
  assert.deepEqual(poseSummary(null), { visible: 0, total: 0, confidence: 0 });
});

test('pose smoothing reduces jitter without fabricating missing or invalid joints', () => {
  const before = { keypoints: [point('left_elbow', 10, 20)] };
  const current = { keypoints: [point('left_elbow', 20, 30), point('right_elbow', 40, 50, 0.1)] };
  const smoothed = smoothPose(current, before, 0.5);
  assert.deepEqual(smoothed.keypoints[0], point('left_elbow', 15, 25));
  assert.deepEqual(smoothed.keypoints[1], current.keypoints[1]);
  assert.equal(smoothPose(null, before), null);
  assert.equal(poseSummary({ keypoints: [point('left_elbow', NaN, 20)] }).visible, 0);
  assert.equal(smoothPose({ keypoints: [point('left_elbow', 30, 40)] }, { keypoints: [point('left_elbow', NaN, 20)] }).keypoints[0].x, 30);
});

test('a unilateral arm raise cannot satisfy the bilateral target and occlusion is unassessed', () => {
  const points = [point('left_hip', 0, 1), point('left_shoulder', 0, 0), point('left_elbow', -1, 0), point('right_hip', 2, 1), point('right_shoulder', 2, 0), point('right_elbow', 2, 1)];
  assert.deepEqual(shoulderAngles(points), { left: 90, right: 0 });
  assert.equal(measureAngle('Side Arm Raise', points).angle, 0);
  points.at(-1).score = 0.1;
  assert.equal(measureAngle('Side Arm Raise', points).angle, null);
});

test('arm raises count from zero-degree rest, including overshoots of a shallow target', () => {
  const rest = calibrateRest(Array(20).fill(0));
  assert.equal(rest.ok, true);
  assert.equal(calibratedProgress('Side Arm Raise', null, 45, 45), null);
  assert.equal(calibratedProgress('Side Arm Raise', rest.value, 45, 0), null);
  for (const peakAngle of [45, 90]) {
    let state = createRepState();
    for (let rep = 0; rep < 3; rep++) {
      for (let step = 0; step <= 40; step++) {
        const angle = step < 5 || step > 35 ? 0 : peakAngle * Math.sin(Math.PI * (step - 5) / 30);
        const radians = angle * Math.PI / 180;
        const points = ['left', 'right'].flatMap((side, i) => [
          point(`${side}_hip`, i * 2, 1), point(`${side}_shoulder`, i * 2, 0),
          point(`${side}_elbow`, i * 2 + (i ? 1 : -1) * Math.sin(radians), Math.cos(radians)),
        ]);
        state = advanceRep(state, {
          progress: calibratedProgress('Side Arm Raise', rest.value, measureAngle('Side Arm Raise', points).angle, 45),
          timestamp: (rep * 41 + step) * 100,
        }, repConfig('Side Arm Raise', rest.value, 45));
      }
    }
    assert.equal(state.attemptedReps, 3);
    assert.equal(state.rejectedReps, 0);
    assert.equal(state.withinTargetReps, peakAngle === 45 ? 3 : 0);
  }
});

test('front-view arm alignment is independent of camera resolution', async () => {
  const { checkBodyAlignment } = await import('../src/vision/geometry.js');
  for (const scale of [0.1, 1, 3]) {
    const points = [point('left_shoulder', 100 * scale, 100 * scale), point('right_shoulder', 200 * scale, 100 * scale), point('left_hip', 110 * scale, 250 * scale), point('right_hip', 190 * scale, 250 * scale)];
    assert.equal(checkBodyAlignment('Side Arm Raise', points).isAligned, true);
  }
});

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
  assert.ok(good.reps[0].outboundMs > 0);
  assert.ok(good.reps[0].returnMs > 0);
  assert.ok(good.reps[0].eccentricRatio > 0);
});

test('biomechanical evaluation computes concentric/eccentric phases, ROM deficit, and clinical flags', async () => {
  const { evaluateExerciseRepetitions, generateSoapNote } = await import('../../backend/services/analytics.js');
  const reps = [
    { peak: 1.0, durationMs: 3200, outboundMs: 1400, returnMs: 1800, withinTarget: true },
    { peak: 0.98, durationMs: 3100, outboundMs: 1300, returnMs: 1800, withinTarget: true },
    { peak: 0.95, durationMs: 3300, outboundMs: 1400, returnMs: 1900, withinTarget: true },
    { peak: 0.82, durationMs: 2900, outboundMs: 1300, returnMs: 1600, withinTarget: false },
    { peak: 0.80, durationMs: 2800, outboundMs: 1200, returnMs: 1600, withinTarget: false },
  ];
  const evalResult = evaluateExerciseRepetitions(reps, { ex: 'Squat', targetExcursionDeg: 45, targetReps: 5 });
  assert.equal(evalResult.scored, true);
  assert.equal(evalResult.repsCount, 5);
  assert.ok(evalResult.meanPeakDeg > 0);
  assert.ok(evalResult.fatigue.indexPct > 0);
  assert.ok(evalResult.clinicalFlags.length > 0);
  assert.ok(evalResult.patientTips.length > 0);

  const soap = generateSoapNote({ n: 'John Doe', id: 'P-101' }, { d: '18 Oct 2026', r: [{ ex: 'Squat', reps }] }, { avgScore: 88, exercises: [evalResult], allFlags: evalResult.clinicalFlags });
  assert.ok(soap.formattedText.includes('[S] SUBJECTIVE'));
  assert.ok(soap.formattedText.includes('[O] OBJECTIVE'));
  assert.ok(soap.formattedText.includes('[A] ASSESSMENT'));
  assert.ok(soap.formattedText.includes('[P] PLAN'));
});

test('smoothAngleEMA suppresses high-frequency jitter and sudden spikes', async () => {
  const { smoothAngleEMA } = await import('../src/vision/geometry.js');
  assert.equal(smoothAngleEMA(null, 50), null);
  assert.equal(smoothAngleEMA(50, null), 50);

  // Smooth transition with alpha = 0.35
  const smoothed = smoothAngleEMA(60, 50, 0.35);
  assert.equal(smoothed, 53.5);

  // Large jump clamping
  const clamped = smoothAngleEMA(150, 50, 0.5);
  // delta 100 > 45, clamped to 50 + 45 = 95, 0.5 * 95 + 0.5 * 50 = 72.5
  assert.equal(clamped, 72.5);
});

test('checkBodyAlignment flags front-facing stance during side-view squat', async () => {
  const { checkBodyAlignment } = await import('../src/vision/geometry.js');
  // Wide shoulders relative to torso in front view
  const frontPose = [
    { name: 'left_shoulder', x: 200, y: 100, score: 0.9 },
    { name: 'right_shoulder', x: 320, y: 100, score: 0.9 },
    { name: 'left_hip', x: 220, y: 250, score: 0.9 },
    { name: 'right_hip', x: 300, y: 250, score: 0.9 },
  ];
  const check = checkBodyAlignment('Squat', frontPose);
  assert.equal(check.isAligned, false);
  assert.equal(check.orientation, 'front');
  assert.ok(check.message.includes('turn side-on'));

  // Side view where shoulders are closely aligned
  const sidePose = [
    { name: 'left_shoulder', x: 250, y: 100, score: 0.9 },
    { name: 'right_shoulder', x: 265, y: 100, score: 0.9 },
    { name: 'left_hip', x: 245, y: 250, score: 0.9 },
    { name: 'right_hip', x: 255, y: 250, score: 0.9 },
  ];
  const sideCheck = checkBodyAlignment('Squat', sidePose);
  assert.equal(sideCheck.isAligned, true);
  assert.equal(sideCheck.orientation, 'side');
});

