export const postureOptions = {
  forwardHead: ['none', 'mild', 'moderate', 'severe'],
  shoulderLevel: ['level', 'left_high', 'right_high'],
  kyphosis: ['none', 'increased', 'decreased'],
  lordosis: ['neutral', 'increased', 'decreased'],
  pelvicTilt: ['neutral', 'anterior', 'posterior'],
  kneeAlignment: ['neutral', 'valgus_mild', 'valgus_marked', 'varus_mild', 'varus_marked'],
};
export const romFields = ['shoulderAbduction', 'kneeFlexion'];
export const strengthFields = ['quadriceps'];
export const restrictions = ['no_deep_squat_below_90'];
export const painSites = ['neck', 'shoulder_left', 'shoulder_right', 'upper_back', 'lower_back', 'hip_left', 'hip_right', 'knee_left', 'knee_right', 'ankle_left', 'ankle_right', 'other'];
export const functionalOptions = ['good', 'fair', 'poor', 'compensated', 'unable'];
export const somatotypes = ['ectomorph', 'mesomorph', 'endomorph', 'mixed'];
export const assessmentLabel = value => value.replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('_', ' ');
export const assessmentIsStale = (assessment, now = Date.now()) => now - new Date(assessment.assessedAt).getTime() > 8 * 7 * 86400000;
