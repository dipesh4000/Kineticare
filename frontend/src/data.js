// Camera-measured exercises (rep counting and scoring).
export const EXERCISES = ['Squat', 'Side Arm Raise', 'Toe Touch'];
// Exercises that only carry a demonstration video; the camera does not measure them.
export const VIDEO_ONLY_EXERCISES = [];
export const INSTRUCTIONS = {
  Squat: [
    ['Starting position', 'Stand side-on to the camera with your feet shoulder-width apart and your arms relaxed or crossed in front.'],
    ['Squat down', 'Bend your knees and push your hips back as if sitting into a chair. Keep your chest up and your heels on the floor.'],
    ['Stand up', 'Press through your heels and stand fully upright. Take about 2 to 5 seconds for each repetition.'],
    ['Breathing', 'Breathe in on the way down and out on the way up. Stop if you feel sharp pain.'],
  ],
  'Side Arm Raise': [
    ['Starting position', 'Face the camera with your feet shoulder-width apart and your arms relaxed at your sides.'],
    ['Raise', 'Lift both arms out to the sides, up to the height your clinician set. Keep your elbows soft and your shoulders down.'],
    ['Lower', 'Bring your arms down slowly and return to the starting position. Move slowly and stay in control.'],
    ['Breathing', 'Breathe out as you lift and in as you lower. Pause and tell your clinician if you feel discomfort.'],
  ],
  'Toe Touch': [
    ['Starting position', 'Stand side-on to the camera with your feet hip-width apart and your knees slightly bent.'],
    ['Reach down', 'Bend forward from your hips and let your arms hang towards your toes. Go only as far as is comfortable.'],
    ['Roll up', 'Return slowly to standing, taking about 2 to 5 seconds for each repetition.'],
    ['Breathing', 'Breathe out as you bend and in as you come up. Stop if you feel dizzy or feel pain.'],
  ],
};

export const ALL_EXERCISES = [...EXERCISES, ...VIDEO_ONLY_EXERCISES];

// Team-supplied demonstration clips shipped with the app (public/demo/*.mp4).
export const DEMO_REFERENCES = [
  { referenceId: 'demo-squat', versionId: 'demo-squat-v1', version: 1, exerciseName: 'Squat', cameraView: 'side',
    status: 'approved', mediaPath: 'demo:squat', demo: true, ownerUid: 'C-001' },
  { referenceId: 'demo-toe-touch', versionId: 'demo-toe-touch-v1', version: 1, exerciseName: 'Toe Touch', cameraView: 'side',
    status: 'approved', mediaPath: 'demo:toetouch', demo: true, ownerUid: 'C-001' },
];

export const DATA = {
  pts: [
    { id:'P-101', n:'Shyam Yadav', a:'Male, 27', last:'7 Sep 2026', adh:67, review:true },
    { id:'P-102', n:'Maya Roy', a:'Female, 41', last:'5 Sep 2026', adh:100, review:false },
    { id:'P-103', n:'Arun Das', a:'Male, 58', last:'No sessions yet', adh:0, review:false },
  ],
  plan: {
    name:'Mobility plan, week 3', v:2, by:'Dr. Aditi Singh',
    items:[
      { ex:'Squat', t:45, targetReps:5, targetExcursionDeg:45, note:'Stop if you feel sharp pain.',
        referenceId:'demo-squat', referenceVersionId:'demo-squat-v1', referencePath:'references/demo-squat/versions/demo-squat-v1' },
      { ex:'Side Arm Raise', t:45, targetReps:5, targetExcursionDeg:75, note:'Slow and controlled.' },
      { ex:'Toe Touch', t:45, targetReps:5, targetExcursionDeg:60, note:'Reach down only as far as is comfortable. Keep your knees soft.',
        referenceId:'demo-toe-touch', referenceVersionId:'demo-toe-touch-v1', referencePath:'references/demo-toe-touch/versions/demo-toe-touch-v1' },
    ]
  },
  sess: [
    { d:'24 Aug 2026', r:[{ex:'Squat',t:40,s:.6,c:'Medium'},{ex:'Side Arm Raise',t:52,s:.66,c:'Medium'}] },
    { d:'28 Aug 2026', r:[{ex:'Squat',t:42,s:.65,c:'Medium'},{ex:'Side Arm Raise',t:55,s:.72,c:'High'}] },
    { d:'2 Sep 2026',  r:[{ex:'Squat',t:44,s:.71,c:'Medium'},{ex:'Side Arm Raise',t:58,s:.78,c:'High'}] },
    { d:'5 Sep 2026',  r:[{ex:'Squat',t:45,s:.76,c:'High'},{ex:'Side Arm Raise',t:60,s:.82,c:'High'}] },
  ],
  fb: [
    { id:'F-1', from:'Dr. Aditi Singh', d:'6 Sep 2026', m:'Good consistency this week. Keep squats shallow for now and rest between exercises.', read:false }
  ]
};

export function createDemoWorkspace() {
  return {
    schemaVersion: 1,
    patients: structuredClone(DATA.pts),
    assignments: { 'P-101': structuredClone(DATA.plan) },
    assignmentDrafts: {},
    sessions: { 'P-101': structuredClone(DATA.sess) },
    feedback: { 'P-101': structuredClone(DATA.fb) },
    requests: { 'P-101': [] },
    references: structuredClone(DEMO_REFERENCES),
  };
}
