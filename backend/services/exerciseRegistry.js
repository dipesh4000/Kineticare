/**
 * Kineticare Exercise Registry Service
 * Allows developers to push updates, define new biomechanical joint angles,
 * set normative rehab targets, and expand the clinical exercise catalog.
 */

// In-memory registry with pre-loaded clinical rehabilitation protocols
export const EXERCISE_REGISTRY = [
  {
    id: 'squat',
    name: 'Squat or mini-squat',
    category: 'Lower Extremity',
    cameraView: 'side',
    primaryJoint: 'Knee flexion',
    trackingSide: 'unilateral',
    defaultTargetDeg: 45,
    normativeRangeDeg: [30, 90],
    tempoMinMs: 2000,
    tempoMaxMs: 5000,
    eccentricRatioOptimal: [1.2, 2.0],
    clinicalIndication: 'Quadriceps strengthening, knee joint stabilization, functional sit-to-stand training, post-op ACL/meniscal recovery.',
    contraindications: 'Acute unhealed tibial fracture, severe patellofemoral pain flare-up.',
    instructions: [
      { step: 1, title: 'Starting position', text: 'Stand side-on to the camera with feet shoulder-width apart and arms relaxed.' },
      { step: 2, title: 'Descent (concentric/lowering)', text: 'Hinge at the hips and bend your knees as if sitting into a chair. Keep heels flat on the floor.' },
      { step: 3, title: 'Return', text: 'Drive through your heels to return fully upright. Maintain a 3-4 second tempo.' },
    ],
    status: 'active',
  },
  {
    id: 'arm-raise',
    name: 'Bilateral side arm raise',
    category: 'Upper Extremity',
    cameraView: 'front',
    primaryJoint: 'Shoulder abduction',
    trackingSide: 'bilateral',
    defaultTargetDeg: 75,
    normativeRangeDeg: [45, 120],
    tempoMinMs: 2000,
    tempoMaxMs: 5000,
    eccentricRatioOptimal: [1.0, 1.8],
    clinicalIndication: 'Rotator cuff reconditioning, deltoid recruitment, adhesive capsulitis mobility recovery.',
    contraindications: 'Acute rotator cuff full-thickness tear without surgical clearance, severe subacromial impingement.',
    instructions: [
      { step: 1, title: 'Starting position', text: 'Face the camera upright with feet shoulder-width apart and arms at your sides.' },
      { step: 2, title: 'Elevation', text: 'Lift both arms simultaneously to the prescribed shoulder height.' },
      { step: 3, title: 'Controlled Lowering', text: 'Lower arms smoothly over 2-3 seconds to maximize eccentric control.' },
    ],
    status: 'active',
  },
  {
    id: 'toe-touch',
    name: 'Standing toe touch',
    category: 'Spine & Posterior Chain',
    cameraView: 'side',
    primaryJoint: 'Hip flexion / forward bend',
    trackingSide: 'unilateral',
    defaultTargetDeg: 60,
    normativeRangeDeg: [40, 90],
    tempoMinMs: 2000,
    tempoMaxMs: 5000,
    eccentricRatioOptimal: [1.0, 1.6],
    clinicalIndication: 'Posterior chain mobility, hamstring flexibility, spinal flexion rhythm.',
    contraindications: 'Acute lumbar disc herniation with radiculopathy, acute sciatica.',
    instructions: [
      { step: 1, title: 'Starting position', text: 'Stand side-on with feet hip-width apart and soft knees.' },
      { step: 2, title: 'Reach down', text: 'Hinge forward from the hips, reaching towards toes only as far as comfortable.' },
      { step: 3, title: 'Roll up', text: 'Return slowly to upright standing position.' },
    ],
    status: 'active',
  },
];

/**
 * Returns all active exercises
 */
export function getAllExercises() {
  return EXERCISE_REGISTRY.filter(ex => ex.status === 'active');
}

/**
 * Returns an exercise by ID or name
 */
export function getExerciseById(idOrName) {
  const query = String(idOrName).toLowerCase();
  return EXERCISE_REGISTRY.find(ex => ex.id === query || ex.name.toLowerCase() === query) || null;
}

/**
 * Adds a new exercise protocol (allows developer / admin to push new exercises)
 */
export function registerNewExercise(newEx) {
  if (!newEx.name || !newEx.cameraView) {
    throw new Error('Exercise must include name and cameraView');
  }
  const id = newEx.id || newEx.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const existing = EXERCISE_REGISTRY.findIndex(ex => ex.id === id);
  const exerciseRecord = {
    id,
    name: newEx.name,
    category: newEx.category || 'General Mobility',
    cameraView: newEx.cameraView,
    primaryJoint: newEx.primaryJoint || 'Target Joint',
    trackingSide: newEx.trackingSide || 'unilateral',
    defaultTargetDeg: Number(newEx.defaultTargetDeg) || 45,
    normativeRangeDeg: newEx.normativeRangeDeg || [30, 90],
    tempoMinMs: Number(newEx.tempoMinMs) || 2000,
    tempoMaxMs: Number(newEx.tempoMaxMs) || 5000,
    eccentricRatioOptimal: newEx.eccentricRatioOptimal || [1.0, 1.8],
    clinicalIndication: newEx.clinicalIndication || 'General rehabilitation.',
    contraindications: newEx.contraindications || 'None specified.',
    instructions: newEx.instructions || [],
    status: 'active',
    createdAt: new Date().toISOString(),
  };

  if (existing >= 0) {
    EXERCISE_REGISTRY[existing] = { ...EXERCISE_REGISTRY[existing], ...exerciseRecord };
  } else {
    EXERCISE_REGISTRY.push(exerciseRecord);
  }
  return exerciseRecord;
}
