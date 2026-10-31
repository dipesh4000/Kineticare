import { armRaiseAngle, squatKneeAngle, toeTouchHipAngle, squatSideConfidence, EXERCISE_DEFINITIONS, EXERCISE_REP_PARAMETERS } from './definitions.js';
import { DEFAULT_REP_CONFIG } from './engine.js';

// Exercises measured from a side view, one body side at a time. For these the joint angle
// shrinks as the movement deepens, so progress = rest angle - current angle.
const SIDE_ANGLE = { Squat: squatKneeAngle, 'Toe Touch': toeTouchHipAngle };

export const isSideExercise = name => name in SIDE_ANGLE;

export const exerciseMeta = name => ({
  Squat: { ...EXERCISE_DEFINITIONS.squat, key: 'squat', angleLabel: 'Knee angle' },
  'Toe Touch': { ...EXERCISE_DEFINITIONS.toeTouch, key: 'toe-touch', angleLabel: 'Hip angle' },
}[name] ?? { ...EXERCISE_DEFINITIONS.armRaise, key: 'arm-raise', angleLabel: 'Shoulder angle (lower arm)' });

// Returns the angle to track and the body side used.
// For Squat, when not locked, selects the side with the higher average landmark confidence (hip, knee, ankle).
export function measureAngle(name, keypoints, lockedSide = null) {
  const sideAngle = SIDE_ANGLE[name];
  if (sideAngle) {
    const available = ['left', 'right']
      .map(side => ({
        side,
        angle: sideAngle(keypoints, side),
        confidence: squatSideConfidence(keypoints, side),
      }))
      .filter(result => Number.isFinite(result.angle));
    if (!available.length) return { angle: null, side: lockedSide };

    let selected;
    if (lockedSide && available.some(result => result.side === lockedSide)) {
      selected = available.find(result => result.side === lockedSide);
    } else if (name === 'Squat') {
      // Use the side with higher average landmark confidence
      selected = available.reduce((best, curr) => (curr.confidence > best.confidence ? curr : best), available[0]);
    } else {
      selected = available[0];
    }
    return { angle: selected.angle, side: selected.side };
  }
  const angles = ['left', 'right'].map(side => armRaiseAngle(keypoints, side)).filter(Number.isFinite);
  return { angle: angles.length === 2 ? Math.min(...angles) : null, side: lockedSide };
}

// Positive when the person has moved away from rest in the assigned direction.
export const movementSignal = (name, rest, angle) => (isSideExercise(name) ? rest - angle : angle - rest);

export function calibratedProgress(name, rest, angle, target) {
  if (![rest, angle, target].every(Number.isFinite) || target <= 0) return null;
  return movementSignal(name, rest, angle) / target;
}

// Builds the exercise-specific repetition configuration with hysteresis and timing constraints.
export function repConfig(name, rest, target) {
  const baseParams = EXERCISE_REP_PARAMETERS[name] || {};
  const targetDeg = target || (name === 'Squat' ? 45 : name === 'Side Arm Raise' ? 75 : 60);
  const availableRange = isSideExercise(name) ? (rest || 180) : 180 - (rest || 0);

  let upAngle = baseParams.upAngle;
  let downAngle = baseParams.downAngle;
  if (Number.isFinite(rest) && Number.isFinite(targetDeg)) {
    if (isSideExercise(name)) {
      upAngle = rest - (baseParams.hysteresisGap || 15);
      downAngle = rest - targetDeg;
    } else {
      downAngle = rest + (baseParams.hysteresisGap || 15);
      upAngle = rest + targetDeg;
    }
  }

  return {
    ...DEFAULT_REP_CONFIG,
    ...baseParams,
    rest,
    targetExcursionDeg: targetDeg,
    upAngle,
    downAngle,
    minRom: baseParams.minRom ?? Math.max(20, targetDeg * 0.65),
    maxPlausible: Math.max(DEFAULT_REP_CONFIG.maxPlausible, availableRange / targetDeg),
  };
}
