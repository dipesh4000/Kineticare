/**
 * Generator script for realistic 17-keypoint MoveNet streams for replay regression testing.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '../fixtures/keypoint-streams');

function createSidePose(kneeAngleDeg, { confidence = 0.95, offsetX = 0, offsetY = 0, hideLegs = false } = {}) {
  // Vertex at knee. Leg segments: femur = 100px, tibia = 100px.
  // Ankle fixed at (320 + offsetX, 440 + offsetY).
  const ankle = { x: 320 + offsetX, y: 440 + offsetY };
  
  // Angle of tibia from vertical forward: let tibia tilt forward slightly as knee flexes
  const rad = (kneeAngleDeg * Math.PI) / 180;
  // Knee position
  const tibiaAngle = Math.max(0, (180 - kneeAngleDeg) * 0.35) * (Math.PI / 180);
  const knee = {
    x: ankle.x + 100 * Math.sin(tibiaAngle),
    y: ankle.y - 100 * Math.cos(tibiaAngle),
  };
  
  // Hip position: vector from knee to hip rotated by kneeAngleDeg from knee->ankle
  // Vector knee->ankle:
  const vKA = { x: ankle.x - knee.x, y: ankle.y - knee.y };
  const baseAngle = Math.atan2(vKA.y, vKA.x);
  const hipAngle = baseAngle - rad;
  const hip = {
    x: knee.x + 100 * Math.cos(hipAngle),
    y: knee.y + 100 * Math.sin(hipAngle),
  };
  
  // Torso / shoulder (120px above hip, leaning slightly forward as squat deepens)
  const leanAngle = Math.max(0, (180 - kneeAngleDeg) * 0.3) * (Math.PI / 180);
  const shoulder = {
    x: hip.x - 120 * Math.sin(leanAngle),
    y: hip.y - 120 * Math.cos(leanAngle),
  };
  
  const head = { x: shoulder.x + 10, y: shoulder.y - 50 };
  const elbow = { x: shoulder.x + 20, y: shoulder.y + 60 };
  const wrist = { x: shoulder.x + 30, y: shoulder.y + 110 };

  const legConf = hideLegs ? 0.05 : confidence;

  return [
    { name: 'nose', x: head.x, y: head.y, score: confidence },
    { name: 'left_eye', x: head.x + 5, y: head.y - 5, score: confidence },
    { name: 'right_eye', x: head.x - 5, y: head.y - 5, score: confidence * 0.7 },
    { name: 'left_ear', x: head.x + 15, y: head.y, score: confidence },
    { name: 'right_ear', x: head.x - 15, y: head.y, score: confidence * 0.5 },
    { name: 'left_shoulder', x: shoulder.x, y: shoulder.y, score: confidence },
    { name: 'right_shoulder', x: shoulder.x - 15, y: shoulder.y, score: confidence * 0.6 },
    { name: 'left_elbow', x: elbow.x, y: elbow.y, score: confidence },
    { name: 'right_elbow', x: elbow.x - 15, y: elbow.y, score: confidence * 0.5 },
    { name: 'left_wrist', x: wrist.x, y: wrist.y, score: confidence },
    { name: 'right_wrist', x: wrist.x - 15, y: wrist.y, score: confidence * 0.5 },
    { name: 'left_hip', x: hip.x, y: hip.y, score: confidence },
    { name: 'right_hip', x: hip.x - 15, y: hip.y, score: confidence * 0.6 },
    { name: 'left_knee', x: knee.x, y: knee.y, score: legConf },
    { name: 'right_knee', x: knee.x - 15, y: knee.y, score: legConf * 0.6 },
    { name: 'left_ankle', x: ankle.x, y: ankle.y, score: legConf },
    { name: 'right_ankle', x: ankle.x - 15, y: ankle.y, score: legConf * 0.6 },
  ];
}

function createFrontArmRaisePose(armAngleDeg, { confidence = 0.95 } = {}) {
  const rad = (armAngleDeg * Math.PI) / 180;
  const ls = { x: 260, y: 150 };
  const rs = { x: 380, y: 150 };
  const lh = { x: 280, y: 270 };
  const rh = { x: 360, y: 270 };

  // Arms abduct outwards and upwards
  // At 0 deg: elbows at (260, 210), wrists at (260, 270)
  // At 90 deg: elbows at (200, 150), wrists at (140, 150)
  const leftElbow = {
    x: ls.x - 60 * Math.sin(rad),
    y: ls.y + 60 * Math.cos(rad),
  };
  const leftWrist = {
    x: leftElbow.x - 60 * Math.sin(rad),
    y: leftElbow.y + 60 * Math.cos(rad),
  };
  const rightElbow = {
    x: rs.x + 60 * Math.sin(rad),
    y: rs.y + 60 * Math.cos(rad),
  };
  const rightWrist = {
    x: rightElbow.x + 60 * Math.sin(rad),
    y: rightElbow.y + 60 * Math.cos(rad),
  };

  return [
    { name: 'nose', x: 320, y: 90, score: confidence },
    { name: 'left_eye', x: 310, y: 85, score: confidence },
    { name: 'right_eye', x: 330, y: 85, score: confidence },
    { name: 'left_ear', x: 295, y: 90, score: confidence },
    { name: 'right_ear', x: 345, y: 90, score: confidence },
    { name: 'left_shoulder', x: ls.x, y: ls.y, score: confidence },
    { name: 'right_shoulder', x: rs.x, y: rs.y, score: confidence },
    { name: 'left_elbow', x: leftElbow.x, y: leftElbow.y, score: confidence },
    { name: 'right_elbow', x: rightElbow.x, y: rightElbow.y, score: confidence },
    { name: 'left_wrist', x: leftWrist.x, y: leftWrist.y, score: confidence },
    { name: 'right_wrist', x: rightWrist.x, y: rightWrist.y, score: confidence },
    { name: 'left_hip', x: lh.x, y: lh.y, score: confidence },
    { name: 'right_hip', x: rh.x, y: rh.y, score: confidence },
    { name: 'left_knee', x: 280, y: 370, score: confidence },
    { name: 'right_knee', x: 360, y: 370, score: confidence },
    { name: 'left_ankle', x: 280, y: 460, score: confidence },
    { name: 'right_ankle', x: 360, y: 460, score: confidence },
  ];
}

// 1. Clean 3-rep Squat (fps ~30, dt ~33ms)
function generateCleanSquats() {
  const frames = [];
  let t = 0;
  const dt = 33;

  // 1s standing rest (~175 deg)
  for (let i = 0; i < 30; i++, t += dt) {
    frames.push({ t, kp: createSidePose(175 + (Math.sin(i) * 0.5)) });
  }

  // 3 repetitions
  for (let rep = 0; rep < 3; rep++) {
    // Descent (45 frames ~ 1.5s): 175 -> 130 deg (excursion = 45 deg, exactly 1.0 progress on 45 deg target)
    for (let i = 0; i < 45; i++, t += dt) {
      const progress = (1 - Math.cos((i / 45) * Math.PI)) / 2;
      const angle = 175 - 45 * progress;
      frames.push({ t, kp: createSidePose(angle) });
    }
    // Brief dwell at bottom (6 frames ~ 200ms)
    for (let i = 0; i < 6; i++, t += dt) {
      frames.push({ t, kp: createSidePose(130) });
    }
    // Ascent (45 frames ~ 1.5s): 130 -> 175 deg
    for (let i = 0; i < 45; i++, t += dt) {
      const progress = (1 - Math.cos((i / 45) * Math.PI)) / 2;
      const angle = 130 + 45 * progress;
      frames.push({ t, kp: createSidePose(angle) });
    }
    // Rest pause between reps (30 frames ~ 1s)
    for (let i = 0; i < 30; i++, t += dt) {
      frames.push({ t, kp: createSidePose(175) });
    }
  }

  return {
    name: 'squat_clean_3reps.json',
    exercise: 'Squat',
    targetDeg: 45,
    expectedReps: 3,
    frames,
  };
}

// 2. Clean 2-rep Side Arm Raise
function generateCleanArmRaises() {
  const frames = [];
  let t = 0;
  const dt = 33;

  // 1s rest (arms down ~15 deg)
  for (let i = 0; i < 30; i++, t += dt) {
    frames.push({ t, kp: createFrontArmRaisePose(15) });
  }

  for (let rep = 0; rep < 2; rep++) {
    // Raise (50 frames ~ 1.65s): 15 -> 95 deg (80 deg excursion)
    for (let i = 0; i < 50; i++, t += dt) {
      const progress = (1 - Math.cos((i / 50) * Math.PI)) / 2;
      const angle = 15 + 80 * progress;
      frames.push({ t, kp: createFrontArmRaisePose(angle) });
    }
    // Hold (8 frames ~ 260ms)
    for (let i = 0; i < 8; i++, t += dt) {
      frames.push({ t, kp: createFrontArmRaisePose(95) });
    }
    // Lower (50 frames ~ 1.65s): 95 -> 15 deg
    for (let i = 0; i < 50; i++, t += dt) {
      const progress = (1 - Math.cos((i / 50) * Math.PI)) / 2;
      const angle = 95 - 80 * progress;
      frames.push({ t, kp: createFrontArmRaisePose(angle) });
    }
    // Rest (30 frames ~ 1s)
    for (let i = 0; i < 30; i++, t += dt) {
      frames.push({ t, kp: createFrontArmRaisePose(15) });
    }
  }

  return {
    name: 'arm_raise_clean_2reps.json',
    exercise: 'Side Arm Raise',
    targetDeg: 75,
    expectedReps: 2,
    frames,
  };
}

// 3. Edge Case: Tracking Gap Mid-Rep
function generateTrackingGapMidRep() {
  const frames = [];
  let t = 0;
  const dt = 33;

  // 1s standing rest
  for (let i = 0; i < 30; i++, t += dt) {
    frames.push({ t, kp: createSidePose(175) });
  }

  // Descent to bottom (40 frames ~ 1.3s)
  for (let i = 0; i < 40; i++, t += dt) {
    const angle = 175 - 45 * (i / 40);
    frames.push({ t, kp: createSidePose(angle) });
  }

  // Tracking lost for 25 frames (~825ms) while at peak excursion and during return!
  for (let i = 0; i < 25; i++, t += dt) {
    frames.push({ t, kp: createSidePose(130, { confidence: 0.1 }) }); // low confidence < 0.3
  }

  // Tracking recovers when patient is already back standing at rest (175)
  for (let i = 0; i < 40; i++, t += dt) {
    frames.push({ t, kp: createSidePose(175) });
  }

  return {
    name: 'squat_tracking_gap_mid_rep.json',
    exercise: 'Squat',
    targetDeg: 45,
    expectedReps: 0,
    expectedRejection: 'tracking lost',
    frames,
  };
}

// 4. Edge Case: Very Fast Movement (< 700ms total cycle, reaching full depth)
function generateVeryFastRep() {
  const frames = [];
  let t = 0;
  const dt = 33;

  for (let i = 0; i < 30; i++, t += dt) {
    frames.push({ t, kp: createSidePose(175) });
  }

  // Full excursion (45 deg) completed in 7 frames down (~230ms < 300ms minPhaseDurationMs)
  for (let i = 0; i < 7; i++, t += dt) {
    const angle = 175 - 45 * ((i + 1) / 7);
    frames.push({ t, kp: createSidePose(angle) });
  }
  // and 7 frames up (~230ms < 300ms minPhaseDurationMs, total ~460ms < 700ms minDurationMs)
  for (let i = 0; i < 7; i++, t += dt) {
    const angle = 130 + 45 * ((i + 1) / 7);
    frames.push({ t, kp: createSidePose(angle) });
  }

  for (let i = 0; i < 30; i++, t += dt) {
    frames.push({ t, kp: createSidePose(175) });
  }

  return {
    name: 'squat_very_fast_twitch.json',
    exercise: 'Squat',
    targetDeg: 45,
    expectedReps: 0,
    expectedRejection: 'too fast',
    frames,
  };
}

// 5. Edge Case: Half Rep / Shallow Movement (below minRom: 25 deg)
function generateHalfRepShallow() {
  const frames = [];
  let t = 0;
  const dt = 33;

  for (let i = 0; i < 30; i++, t += dt) {
    frames.push({ t, kp: createSidePose(175) });
  }

  // Descent only 15 deg (175 -> 160 deg), normal 1.5s tempo
  for (let i = 0; i < 45; i++, t += dt) {
    const progress = (1 - Math.cos((i / 45) * Math.PI)) / 2;
    frames.push({ t, kp: createSidePose(175 - 15 * progress) });
  }
  // Ascent 1.5s
  for (let i = 0; i < 45; i++, t += dt) {
    const progress = (1 - Math.cos((i / 45) * Math.PI)) / 2;
    frames.push({ t, kp: createSidePose(160 + 15 * progress) });
  }

  for (let i = 0; i < 30; i++, t += dt) {
    frames.push({ t, kp: createSidePose(175) });
  }

  return {
    name: 'squat_half_rep_shallow.json',
    exercise: 'Squat',
    targetDeg: 45,
    expectedReps: 0,
    expectedRejection: 'too shallow',
    frames,
  };
}

// 6. Edge Case: Partial Body (Legs and ankles occluded / outside frame)
function generatePartialBodyOccluded() {
  const frames = [];
  let t = 0;
  const dt = 33;

  for (let i = 0; i < 90; i++, t += dt) {
    frames.push({ t, kp: createSidePose(175, { hideLegs: true }) });
  }

  return {
    name: 'squat_partial_body_occluded.json',
    exercise: 'Squat',
    targetDeg: 45,
    expectedReps: 0,
    frames,
  };
}

// 7. Edge Case: Sudden Camera Movement / Translation Jolt
function generateSuddenCameraMovement() {
  const frames = [];
  let t = 0;
  const dt = 33;

  for (let i = 0; i < 30; i++, t += dt) {
    frames.push({ t, kp: createSidePose(175) });
  }

  // Jolt: camera bumped, image jumps +250px X, +150px Y for 2 frames then returns
  frames.push({ t: t, kp: createSidePose(175, { offsetX: 250, offsetY: 150 }) });
  t += dt;
  frames.push({ t: t, kp: createSidePose(175, { offsetX: 250, offsetY: 150 }) });
  t += dt;

  for (let i = 0; i < 30; i++, t += dt) {
    frames.push({ t, kp: createSidePose(175) });
  }

  return {
    name: 'squat_sudden_camera_movement.json',
    exercise: 'Squat',
    targetDeg: 45,
    expectedReps: 0,
    frames,
  };
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const generators = [
  generateCleanSquats,
  generateCleanArmRaises,
  generateTrackingGapMidRep,
  generateVeryFastRep,
  generateHalfRepShallow,
  generatePartialBodyOccluded,
  generateSuddenCameraMovement,
];

for (const gen of generators) {
  const fixture = gen();
  const filePath = path.join(OUT_DIR, fixture.name);
  fs.writeFileSync(filePath, JSON.stringify(fixture, null, 2), 'utf-8');
  console.log(`Wrote ${fixture.name} (${fixture.frames.length} frames, expected: ${fixture.expectedReps} reps)`);
}
