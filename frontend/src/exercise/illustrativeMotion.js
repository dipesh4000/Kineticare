// Synthetic, normalized display geometry. These dimensions and timing are engineering
// choices, not measured anatomy, textbook trajectories or a patient prescription.
export function miniSquatPose(time, durationSeconds, peakFlexionDegrees) {
  if (![time, durationSeconds, peakFlexionDegrees].every(Number.isFinite) || durationSeconds < 3 || durationSeconds > 12 || peakFlexionDegrees < 30 || peakFlexionDegrees > 45) throw new Error('Unsupported preview parameters.');
  const phase = ((time % durationSeconds) + durationSeconds) % durationSeconds / durationSeconds;
  const progress = (1 - Math.cos(phase * Math.PI * 2)) / 2;
  const angle = peakFlexionDegrees * progress * Math.PI / 180;
  const legLength = 0.48;
  const distance = 2 * legLength * Math.cos(angle / 2);
  const hipBack = -0.12 * Math.sin(angle);
  const hipHeight = Math.sqrt(distance ** 2 - hipBack ** 2);
  const triangleHeight = legLength * Math.sin(angle / 2);
  const kneeY = hipHeight / 2 - hipBack / distance * triangleHeight;
  const kneeZ = hipBack / 2 + hipHeight / distance * triangleHeight;
  const pelvis = [0, 0.1 + hipHeight, hipBack];
  const points = { pelvis, chest: [0, pelvis[1] + 0.42, hipBack], neck: [0, pelvis[1] + 0.6, hipBack], head: [0, pelvis[1] + 0.76, hipBack] };
  for (const [side, x] of [['left', -0.15], ['right', 0.15]]) {
    points[`${side}Hip`] = [x, pelvis[1], hipBack];
    points[`${side}Knee`] = [x, 0.1 + kneeY, kneeZ];
    points[`${side}Ankle`] = [x, 0.1, 0];
    points[`${side}Toe`] = [x, 0.025, 0.3];
    points[`${side}Heel`] = [x, 0.025, -0.1];
    const shoulderX = x * 1.55;
    points[`${side}Shoulder`] = [shoulderX, pelvis[1] + 0.54, hipBack];
    points[`${side}Elbow`] = [shoulderX * 1.25, pelvis[1] + 0.3, hipBack + 0.06];
    points[`${side}Wrist`] = [shoulderX * 1.3, pelvis[1] + 0.06, hipBack + 0.12];
  }
  return { points, kneeFlexionDegrees: angle * 180 / Math.PI, phaseName: phase < 0.5 ? 'Lowering' : 'Returning' };
}

export const SKELETON_SEGMENTS = [
  ['pelvis', 'chest'], ['chest', 'neck'], ['neck', 'head'], ['leftHip', 'rightHip'], ['leftShoulder', 'rightShoulder'],
  ...['left', 'right'].flatMap(side => [[`${side}Hip`, `${side}Knee`], [`${side}Knee`, `${side}Ankle`], [`${side}Ankle`, `${side}Toe`], [`${side}Toe`, `${side}Heel`], [`${side}Heel`, `${side}Ankle`], ['neck', `${side}Shoulder`], [`${side}Shoulder`, `${side}Elbow`], [`${side}Elbow`, `${side}Wrist`]]),
];

export function validateIllustrativeDescriptor(descriptor) {
  return descriptor?.id === 'mini-squat-illustration-v1' && descriptor.exercise_id === 'EX-KU-000001'
    && Array.isArray(descriptor.knee_range_degrees) && descriptor.knee_range_degrees.length === 2
    && descriptor.knee_range_degrees[0] === 30 && descriptor.knee_range_degrees[1] === 45;
}
