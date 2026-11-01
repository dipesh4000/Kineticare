import { angleAt, namedKeypoints, visible } from '../vision/geometry.js';

export const EXERCISE_DEFINITIONS = {
  squat: {
    id: 'squat',
    name: 'Squat or mini-squat',
    cameraView: 'side',
    measurementVersion: 'squat-side-v1',
    setup: 'Stand side-on with your shoulder, hip, knee, and ankle visible.',
  },
  toeTouch: {
    id: 'toe-touch',
    name: 'Standing toe touch',
    cameraView: 'side',
    measurementVersion: 'toe-touch-side-v1',
    setup: 'Stand side-on with your shoulder, hip, and knee visible, then bend forward and return upright.',
  },
  armRaise: {
    id: 'arm-raise',
    name: 'Bilateral side arm raise',
    cameraView: 'front',
    measurementVersion: 'arm-raise-front-v1',
    setup: 'Face the camera with both shoulders, elbows, wrists, and hips visible.',
  },
};

/**
 * Starting repetition state machine parameters.
 * NOTE: These are initial engineering defaults to be tuned on real patient/participant data.
 * They do not constitute clinically validated thresholds.
 */
export const EXERCISE_REP_PARAMETERS = {
  Squat: {
    name: 'Squat',
    joint: 'knee',
    direction: 'decreasing',
    upAngle: 165,             // degrees: standing extension
    downAngle: 130,           // degrees: flexion depth (default target 45° excursion from ~175°)
    hysteresisGap: 15,        // degrees gap between inflection and return thresholds
    minRom: 25,               // degrees: minimum knee excursion required to count
    minRomProgress: 0.65,     // ratio of target excursion
    minPhaseDurationMs: 300,  // ms: minimum phase duration (outbound and return)
    minDurationMs: 700,       // ms: minimum cycle duration to filter twitch/artifact
    maxCycleDurationMs: 7000, // ms: maximum duration before cycle is rejected as stalled
    targetMin: 0.9,           // prescribed target reach window lower bound
    targetMax: 1.1,           // prescribed target reach window upper bound
  },
  'Side Arm Raise': {
    name: 'Side Arm Raise',
    joint: 'shoulder',
    direction: 'increasing',
    upAngle: 70,              // degrees: elevation depth (for ~75° target)
    downAngle: 25,            // degrees: resting arms at sides
    hysteresisGap: 15,        // degrees gap between inflection and return thresholds
    minRom: 35,               // degrees: minimum shoulder abduction excursion required
    minRomProgress: 0.65,
    minPhaseDurationMs: 300,
    minDurationMs: 700,
    maxCycleDurationMs: 7000,
    targetMin: 0.9,
    targetMax: 1.1,
  },
  'Toe Touch': {
    name: 'Toe Touch',
    joint: 'hip',
    direction: 'decreasing',
    upAngle: 155,
    downAngle: 115,
    hysteresisGap: 15,
    minRom: 35,
    minRomProgress: 0.65,
    minPhaseDurationMs: 300,
    minDurationMs: 800,
    maxCycleDurationMs: 8000,
    targetMin: 0.9,
    targetMax: 1.1,
  },
};

export function squatSideConfidence(keypoints, side = 'left') {
  const points = namedKeypoints(keypoints);
  const joints = [points[`${side}_hip`], points[`${side}_knee`], points[`${side}_ankle`]];
  const valid = joints.filter(j => j && Number.isFinite(j.score));
  if (!valid.length) return 0;
  return valid.reduce((sum, j) => sum + j.score, 0) / joints.length;
}

export function squatKneeAngle(keypoints, side = 'left', minimumScore = 0.25) {
  const points = namedKeypoints(keypoints);
  const hip = points[`${side}_hip`];
  const knee = points[`${side}_knee`];
  const ankle = points[`${side}_ankle`];
  if (visible([hip, knee], minimumScore)) {
    if (visible([ankle], minimumScore)) {
      return angleAt(hip, knee, ankle);
    }
    // Fallback: if ankle has valid coords and score >= 0.1, use it
    if (ankle && Number.isFinite(ankle.x) && Number.isFinite(ankle.y) && (ankle.score ?? 0) >= 0.1) {
      return angleAt(hip, knee, ankle);
    }
  }
  return null;
}

export function armRaiseAngle(keypoints, side, minimumScore = 0.2) {
  const points = namedKeypoints(keypoints);
  const hip = points[`${side}_hip`];
  const shoulder = points[`${side}_shoulder`];
  const elbow = points[`${side}_elbow`];
  const wrist = points[`${side}_wrist`];
  if (visible([hip, shoulder, elbow], minimumScore)) {
    return angleAt(hip, shoulder, elbow);
  }
  if (visible([hip, shoulder, wrist], minimumScore)) {
    return angleAt(hip, shoulder, wrist);
  }
  return null;
}

export function toeTouchHipAngle(keypoints, side = 'left', minimumScore = 0.2) {
  const points = namedKeypoints(keypoints);
  const joints = [points[`${side}_shoulder`], points[`${side}_hip`], points[`${side}_knee`]];
  return visible(joints, minimumScore) ? angleAt(...joints) : null;
}
