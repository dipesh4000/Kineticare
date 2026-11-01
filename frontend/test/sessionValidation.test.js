import test from 'node:test';
import assert from 'node:assert/strict';

import {
  checkLandmarksVisible,
  checkFramingMargin,
  checkViewOrientation,
  checkFrameRate,
  validatePreSession,
  measureTorsoLength,
  normalizeDistance,
  estimatePatientDistance,
  checkPatientDistance,
  MIN_OPTIMAL_DISTANCE_M,
  MAX_OPTIMAL_DISTANCE_M,
} from '../src/vision/sessionValidation.js';
import { calibrateRest } from '../src/exercise/reference.js';

const pt = (name, x, y, score = 0.9) => ({ name, x, y, score });

test('geometric view test: correctly detects side-view vs front-view orientation', () => {
  // Front-view pose: shoulders and hips are broad horizontally
  const frontPose = [
    pt('left_shoulder', 220, 120),
    pt('right_shoulder', 340, 120),
    pt('left_hip', 240, 260),
    pt('right_hip', 320, 260),
  ];

  // Side-view pose: shoulders align closely on x-axis
  const sidePose = [
    pt('left_shoulder', 270, 120),
    pt('right_shoulder', 285, 120),
    pt('left_hip', 265, 260),
    pt('right_hip', 275, 260),
  ];

  // 1. Squat requires side view
  const squatFrontCheck = checkViewOrientation('Squat', frontPose);
  assert.equal(squatFrontCheck.ok, false);
  assert.equal(squatFrontCheck.code, 'VIEW_MISMATCH_SIDE');
  assert.equal(squatFrontCheck.message, 'Turn so the camera sees your side.');

  const squatSideCheck = checkViewOrientation('Squat', sidePose);
  assert.equal(squatSideCheck.ok, true);
  assert.equal(squatSideCheck.code, 'VIEW_OK');

  // 2. Side Arm Raise requires front view
  const armRaiseSideCheck = checkViewOrientation('Side Arm Raise', sidePose);
  assert.equal(armRaiseSideCheck.ok, false);
  assert.equal(armRaiseSideCheck.code, 'VIEW_MISMATCH_FRONT');
  assert.equal(armRaiseSideCheck.message, 'Face the camera directly with both arms visible.');

  const armRaiseFrontCheck = checkViewOrientation('Side Arm Raise', frontPose);
  assert.equal(armRaiseFrontCheck.ok, true);
  assert.equal(armRaiseFrontCheck.code, 'VIEW_OK');
});

test('checkLandmarksVisible: asserts all required joints are tracked above confidence threshold', () => {
  // Complete squat left side
  const validSquatPose = [
    pt('left_shoulder', 270, 100, 0.85),
    pt('left_hip', 270, 200, 0.88),
    pt('left_knee', 270, 300, 0.82),
    pt('left_ankle', 270, 400, 0.80),
  ];
  assert.equal(checkLandmarksVisible('Squat', validSquatPose).ok, true);

  // Missing or occluded ankle on both sides
  const missingAnkleSquat = [
    pt('left_shoulder', 270, 100, 0.85),
    pt('left_hip', 270, 200, 0.88),
    pt('left_knee', 270, 300, 0.82),
    pt('left_ankle', 270, 400, 0.15), // below 0.3 threshold
  ];
  const missingCheck = checkLandmarksVisible('Squat', missingAnkleSquat);
  assert.equal(missingCheck.ok, false);
  assert.equal(missingCheck.code, 'LANDMARKS_MISSING');
  assert.ok(missingCheck.message.includes('shoulder to ankle'));

  // Arm raise requires bilateral upper body
  const validArmRaise = [
    pt('left_shoulder', 220, 120, 0.85),
    pt('right_shoulder', 340, 120, 0.85),
    pt('left_elbow', 180, 180, 0.80),
    pt('right_elbow', 380, 180, 0.80),
    pt('left_hip', 240, 260, 0.85),
    pt('right_hip', 320, 260, 0.85),
  ];
  assert.equal(checkLandmarksVisible('Side Arm Raise', validArmRaise).ok, true);

  // One arm occluded
  const occludedArmRaise = [
    ...validArmRaise.slice(0, 3),
    pt('right_elbow', 380, 180, 0.1), // occluded
    ...validArmRaise.slice(4),
  ];
  const armRaiseCheck = checkLandmarksVisible('Side Arm Raise', occludedArmRaise);
  assert.equal(armRaiseCheck.ok, false);
  assert.equal(armRaiseCheck.code, 'LANDMARKS_MISSING');
});

test('checkFramingMargin: blocks start when body touches or crosses screen margins', () => {
  const frame = { width: 640, height: 480 };

  // Centered body comfortably within 5% margins (x in [32, 608], y in [24, 456])
  const wellFramed = [
    pt('nose', 320, 50),
    pt('left_shoulder', 280, 120),
    pt('right_shoulder', 360, 120),
    pt('left_ankle', 290, 430),
    pt('right_ankle', 350, 430),
  ];
  assert.equal(checkFramingMargin(wellFramed, frame, 0.05).ok, true);

  // Head cropped off at top (y < 24)
  const headCropped = [
    pt('nose', 320, 10), // too close to top
    pt('left_ankle', 290, 400),
  ];
  const topCheck = checkFramingMargin(headCropped, frame, 0.05);
  assert.equal(topCheck.ok, false);
  assert.equal(topCheck.code, 'MARGIN_TOP');
  assert.ok(topCheck.message.includes('head is fully inside'));

  // Feet cropped at bottom (y > 456)
  const feetCropped = [
    pt('nose', 320, 100),
    pt('left_ankle', 290, 470), // too close to bottom edge
  ];
  const bottomCheck = checkFramingMargin(feetCropped, frame, 0.05);
  assert.equal(bottomCheck.ok, false);
  assert.equal(bottomCheck.code, 'MARGIN_BOTTOM');
  assert.ok(bottomCheck.message.includes('feet are fully inside'));

  // Stepped off to the left (x < 32)
  const leftCropped = [
    pt('left_shoulder', 15, 150),
    pt('nose', 40, 80),
  ];
  const sideCheck = checkFramingMargin(leftCropped, frame, 0.05);
  assert.equal(sideCheck.ok, false);
  assert.equal(sideCheck.code, 'MARGIN_HORIZONTAL');
  assert.ok(sideCheck.message.includes('Center yourself'));
});

test('checkFrameRate: rejects frame rates below the minimum threshold', () => {
  assert.equal(checkFrameRate(24, 15).ok, true);
  const lowFps = checkFrameRate(10, 15);
  assert.equal(lowFps.ok, false);
  assert.equal(lowFps.code, 'FPS_LOW');
  assert.ok(lowFps.message.includes('Frame rate is low'));
});

test('validatePreSession: composite check blocks workout start with human-readable guidance', () => {
  // Bad stance: facing front for Squat
  const wrongOrientation = validatePreSession({
    exerciseName: 'Squat',
    keypoints: [
      pt('left_shoulder', 220, 120),
      pt('right_shoulder', 340, 120),
      pt('left_hip', 240, 260),
      pt('right_hip', 320, 260),
      pt('left_knee', 240, 360),
      pt('left_ankle', 240, 440),
    ],
    fps: 30,
  });
  assert.equal(wrongOrientation.ok, false);
  assert.equal(wrongOrientation.failingCheck.code, 'VIEW_MISMATCH_SIDE');
  assert.equal(wrongOrientation.message, 'Turn so the camera sees your side.');

  // Clean stance: side view squat well-framed
  const validSquat = validatePreSession({
    exerciseName: 'Squat',
    keypoints: [
      pt('left_shoulder', 270, 100),
      pt('right_shoulder', 285, 100),
      pt('left_hip', 265, 220),
      pt('right_hip', 275, 220),
      pt('left_knee', 270, 320),
      pt('left_ankle', 270, 430),
    ],
    fps: 28,
  });
  assert.equal(validSquat.ok, true);
  assert.equal(validSquat.failingCheck, null);
  assert.ok(validSquat.message.includes('Ready for resting setup'));
});

test('calibrateRest: requires stable resting pose and rejects movement variance', () => {
  // 1. Stable rest pose: small noise around 175° (variance < 1.0)
  const stableSamples = Array.from({ length: 20 }, (_, i) => ({
    angle: 175 + (i % 3 ? 0.3 : -0.3),
    torsoLength: 150 + (i % 2),
  }));

  const stableResult = calibrateRest(stableSamples, { minimumSamples: 10, maxVariance: 8.0 });
  assert.equal(stableResult.ok, true);
  assert.equal(stableResult.code, 'CALIBRATION_OK');
  assert.equal(Math.round(stableResult.value), 175);
  assert.equal(Math.round(stableResult.torsoLength), 151);
  assert.ok(stableResult.variance < 1.0);

  // 2. Unstable pose: patient still moving or bending during calibration window (variance > 8.0)
  const movingSamples = [
    175, 172, 168, 163, 158, 152, 148, 145, 150, 157, 165, 170,
  ].map(angle => ({ angle, torsoLength: 150 }));

  const unstableResult = calibrateRest(movingSamples, { minimumSamples: 10, maxVariance: 8.0 });
  assert.equal(unstableResult.ok, false);
  assert.equal(unstableResult.code, 'UNSTABLE_REST_POSE');
  assert.equal(unstableResult.reason, 'Hold the resting position still and retry.');
  assert.ok(unstableResult.variance > 8.0);

  // 3. Insufficient samples (< 10)
  const tooFew = Array.from({ length: 5 }, () => ({ angle: 175, torsoLength: 150 }));
  const fewResult = calibrateRest(tooFew, { minimumSamples: 10 });
  assert.equal(fewResult.ok, false);
  assert.equal(fewResult.code, 'INSUFFICIENT_SAMPLES');
});

test('measureTorsoLength & normalizeDistance: extracts torso baseline and normalizes movement distances', () => {
  const pose = [
    pt('left_shoulder', 200, 100),
    pt('right_shoulder', 300, 100), // mid: (250, 100)
    pt('left_hip', 200, 260),
    pt('right_hip', 300, 260),       // mid: (250, 260) -> torso length = 160px
  ];

  const torso = measureTorsoLength(pose);
  assert.equal(torso, 160);

  // Normalization: 80px displacement / 160px torso = 0.500 torso lengths
  const normalized = normalizeDistance(80, torso);
  assert.equal(normalized, 0.5);

  assert.equal(normalizeDistance(80, null), null);
  assert.equal(normalizeDistance(80, 0), null);
});


test('estimatePatientDistance & checkPatientDistance: calculates patient distance and validates optimal range', () => {
  const frame = { width: 640, height: 480 };

  // 1. Optimal distance: torso is ~125px on 480px frame -> 0.525 / (125/480) ≈ 2.0m
  const optimalPose = [
    pt('left_shoulder', 270, 100),
    pt('right_shoulder', 285, 100),
    pt('left_hip', 265, 225),
    pt('right_hip', 275, 225),
  ];
  const optimal = estimatePatientDistance(optimalPose, frame);
  assert.equal(optimal.ok, true);
  assert.equal(optimal.status, 'optimal');
  assert.equal(optimal.code, 'DISTANCE_OK');
  assert.equal(optimal.distanceMeters, 2.0);
  assert.ok(optimal.message.includes('Optimal camera distance'));

  // 2. Too close: patient is standing right next to camera (< 1.6m)
  // Torso is ~220px on 480px frame -> 0.525 / (220/480) ≈ 1.1m
  const closePose = [
    pt('left_shoulder', 270, 50),
    pt('right_shoulder', 285, 50),
    pt('left_hip', 265, 270),
    pt('right_hip', 275, 270),
  ];
  const close = checkPatientDistance(closePose, frame);
  assert.equal(close.ok, false);
  assert.equal(close.status, 'too_close');
  assert.equal(close.code, 'DISTANCE_TOO_CLOSE');
  assert.equal(close.distanceMeters, 1.1);
  assert.ok(close.message.includes('Step back from camera'));

  // 3. Too far: patient is too far back (> 3.2m)
  // Torso is ~60px on 480px frame -> 0.525 / (60/480) ≈ 4.2m
  const farPose = [
    pt('left_shoulder', 270, 100),
    pt('right_shoulder', 285, 100),
    pt('left_hip', 265, 160),
    pt('right_hip', 275, 160),
  ];
  const far = checkPatientDistance(farPose, frame);
  assert.equal(far.ok, false);
  assert.equal(far.status, 'too_far');
  assert.equal(far.code, 'DISTANCE_TOO_FAR');
  assert.equal(far.distanceMeters, 4.2);
  assert.ok(far.message.includes('Step closer to camera'));

  // 4. Missing/empty keypoints
  assert.equal(estimatePatientDistance([]).ok, false);
  assert.equal(estimatePatientDistance(null).code, 'DISTANCE_UNKNOWN');

  // 5. Fallback to shoulder width when hips are occluded
  const shoulderOnlyPose = [
    pt('left_shoulder', 200, 120),
    pt('right_shoulder', 300, 120),
    pt('left_hip', 200, 260, 0.1),
    pt('right_hip', 300, 260, 0.1),
  ];
  const shoulderEst = estimatePatientDistance(shoulderOnlyPose, frame);
  assert.equal(shoulderEst.ok, true);
  assert.equal(shoulderEst.status, 'optimal');
  assert.equal(shoulderEst.distanceMeters, 2.0);
});

test('validatePreSession: distance validation blocks calibration when patient is too close or too far', () => {
  const frame = { width: 640, height: 480 };

  // Stance where body is too close to camera (< 1.6m)
  const tooCloseValidation = validatePreSession({
    exerciseName: 'Squat',
    keypoints: [
      pt('left_shoulder', 270, 50),
      pt('right_shoulder', 285, 50),
      pt('left_hip', 265, 270),
      pt('right_hip', 275, 270),
      pt('left_knee', 270, 360),
      pt('left_ankle', 270, 440),
    ],
    frame,
    fps: 30,
  });
  assert.equal(tooCloseValidation.ok, false);
  assert.equal(tooCloseValidation.checks.distance.status, 'too_close');
  assert.equal(tooCloseValidation.failingCheck.code, 'DISTANCE_TOO_CLOSE');
  assert.ok(tooCloseValidation.message.includes('Step back from camera'));

  // Stance where body is too far from camera (> 3.2m)
  const tooFarValidation = validatePreSession({
    exerciseName: 'Squat',
    keypoints: [
      pt('left_shoulder', 270, 100),
      pt('right_shoulder', 285, 100),
      pt('left_hip', 265, 160),
      pt('right_hip', 275, 160),
      pt('left_knee', 270, 210),
      pt('left_ankle', 270, 260),
    ],
    frame,
    fps: 30,
  });
  assert.equal(tooFarValidation.ok, false);
  assert.equal(tooFarValidation.checks.distance.status, 'too_far');
  assert.equal(tooFarValidation.failingCheck.code, 'DISTANCE_TOO_FAR');
  assert.ok(tooFarValidation.message.includes('Step closer to camera'));
});
