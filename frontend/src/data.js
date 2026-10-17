export const EXERCISES = ['Squat', 'Side Arm Raise'];

export const DATA = {
  pts: [
    { id:'P-101', n:'Siyam Ahamed', a:'Male, 27', last:'7 Sep 2026', adh:67, review:true },
    { id:'P-102', n:'Maya Roy', a:'Female, 41', last:'5 Sep 2026', adh:100, review:false },
    { id:'P-103', n:'Arun Das', a:'Male, 58', last:'No sessions yet', adh:0, review:false },
  ],
  plan: {
    name:'Mobility plan, week 3', v:2, by:'Dr. Sarah Khan',
    items:[
      { ex:'Squat', t:45, targetReps:5, targetExcursionDeg:45, note:'Stop if you feel sharp pain.' },
      { ex:'Side Arm Raise', t:45, targetReps:5, targetExcursionDeg:75, note:'Slow and controlled.' },
    ]
  },
  sess: [
    { d:'24 Aug 2026', r:[{ex:'Arm Rotation',t:52,s:.66,c:'Medium'},{ex:'Squat',t:40,s:.6,c:'Medium'},{ex:'Hip Rotation',t:55,s:.69,c:'High'}] },
    { d:'28 Aug 2026', r:[{ex:'Arm Rotation',t:55,s:.72,c:'High'},{ex:'Squat',t:42,s:.65,c:'Medium'},{ex:'Hip Rotation',t:58,s:.74,c:'High'}] },
    { d:'2 Sep 2026',  r:[{ex:'Arm Rotation',t:58,s:.78,c:'High'},{ex:'Squat',t:44,s:.71,c:'Medium'},{ex:'Hip Rotation',t:61,s:.8,c:'High'}] },
    { d:'5 Sep 2026',  r:[{ex:'Arm Rotation',t:60,s:.82,c:'High'},{ex:'Squat',t:45,s:.76,c:'High'},{ex:'Hip Rotation',t:57,s:.84,c:'High'}] },
  ],
  fb: [
    { id:'F-1', from:'Dr. Sarah Khan', d:'6 Sep 2026', m:'Good consistency this week. Keep squats shallow for now and rest between exercises.', read:false }
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
    references: [],
  };
}
