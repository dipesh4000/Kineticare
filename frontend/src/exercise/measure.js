import { armRaiseAngle, squatKneeAngle, toeTouchHipAngle, EXERCISE_DEFINITIONS } from './definitions.js';

// Exercises measured from a side view, one body side at a time. For these the joint angle
// shrinks as the movement deepens, so progress = rest angle - current angle.
const SIDE_ANGLE = { Squat: squatKneeAngle, 'Toe Touch': toeTouchHipAngle };

export const isSideExercise = name => name in SIDE_ANGLE;

export const exerciseMeta = name => ({
  Squat: { ...EXERCISE_DEFINITIONS.squat, key: 'squat', angleLabel: 'Knee angle' },
  'Toe Touch': { ...EXERCISE_DEFINITIONS.toeTouch, key: 'toe-touch', angleLabel: 'Hip angle' },
}[name] ?? { ...EXERCISE_DEFINITIONS.armRaise, key: 'arm-raise', angleLabel: 'Average shoulder angle' });

// Returns the angle to track and the body side used (kept stable once chosen).
export function measureAngle(name, keypoints, lockedSide = null) {
  const sideAngle = SIDE_ANGLE[name];
  if (sideAngle) {
    const available = ['left', 'right']
      .map(side => ({ side, angle: sideAngle(keypoints, side) }))
      .filter(result => Number.isFinite(result.angle));
    if (!available.length) return { angle: null, side: lockedSide };
    const selected = available.find(result => result.side === lockedSide) ?? available[0];
    return { angle: selected.angle, side: selected.side };
  }
  const angles = ['left', 'right'].map(side => armRaiseAngle(keypoints, side)).filter(Number.isFinite);
  return { angle: angles.length === 2 ? (angles[0] + angles[1]) / 2 : null, side: lockedSide };
}

// Positive when the person has moved away from rest in the assigned direction.
export const movementSignal = (name, rest, angle) => (isSideExercise(name) ? rest - angle : angle - rest);
