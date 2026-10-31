import { EXERCISE_DEFINITIONS } from '../exercise/definitions.js';

// Fixed prototype template; these targets have not received clinical approval.
// Health-history personalization and eligibility screening are not implemented.
export function buildSelfGuidedPlan() {
  const items = [
    { ex: 'Squat', targetReps: 5, targetExcursionDeg: 30, note: 'Use a comfortable, shallow range. Stop for sharp pain, dizziness, or new symptoms.', referenceVersionId: 'demo-squat-v1' },
    { ex: 'Side Arm Raise', targetReps: 5, targetExcursionDeg: 45, note: 'Raise only as high as comfortable and keep the movement slow.', referenceVersionId: null },
    { ex: 'Toe Touch', targetReps: 5, targetExcursionDeg: 30, note: 'Keep your knees soft and reach only as far as comfortable.', referenceVersionId: 'demo-toe-touch-v1' },
  ];

  return {
    assignmentId: 'self-guided-starter',
    name: 'Mobility starter template',
    by: 'Kineticare starter template',
    v: 1,
    source: 'self-guided',
    generatedBy: 'starter-template-v1',
    requiresClinicianReview: true,
    schedule: { weeklyFrequency: 2 },
    items: items.map(item => ({
      ...item,
      t: 30,
      cameraView: EXERCISE_DEFINITIONS[item.ex === 'Squat' ? 'squat' : item.ex === 'Toe Touch' ? 'toeTouch' : 'armRaise'].cameraView,
    })),
  };
}

export function isSelfGuidedPlan(plan) {
  return plan?.source === 'self-guided';
}
