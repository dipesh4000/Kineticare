import { angleAt, namedKeypoints, visible } from './geometry.js';
import { PoseFilter, DEFAULT_POSE_FILTER_CONFIG } from './oneEuroFilter.js';

export const POSE_MODES = {
  detailed: { label: 'Detailed · 33 landmarks', model: 'BlazePose', modelType: 'full', landmarks: 33 },
  balanced: { label: 'Balanced · 33 landmarks', model: 'BlazePose', modelType: 'lite', landmarks: 33 },
  fast: { label: 'Fast · 17 landmarks', model: 'MoveNet', landmarks: 17 },
};

export const POSE_CONNECTIONS = [
  ['nose', 'left_eye_inner'], ['left_eye_inner', 'left_eye'], ['left_eye', 'left_eye_outer'], ['left_eye_outer', 'left_ear'],
  ['nose', 'right_eye_inner'], ['right_eye_inner', 'right_eye'], ['right_eye', 'right_eye_outer'], ['right_eye_outer', 'right_ear'],
  ['mouth_left', 'mouth_right'], ['nose', 'left_eye'], ['nose', 'right_eye'], ['left_eye', 'left_ear'], ['right_eye', 'right_ear'],
  ['left_shoulder', 'right_shoulder'], ['left_shoulder', 'left_hip'], ['right_shoulder', 'right_hip'], ['left_hip', 'right_hip'],
  ...['left', 'right'].flatMap(side => [
    [`${side}_shoulder`, `${side}_elbow`], [`${side}_elbow`, `${side}_wrist`],
    [`${side}_wrist`, `${side}_thumb`], [`${side}_wrist`, `${side}_index`], [`${side}_wrist`, `${side}_pinky`], [`${side}_index`, `${side}_pinky`],
    [`${side}_hip`, `${side}_knee`], [`${side}_knee`, `${side}_ankle`],
    [`${side}_ankle`, `${side}_heel`], [`${side}_ankle`, `${side}_foot_index`], [`${side}_heel`, `${side}_foot_index`],
  ]),
];

export function poseSummary(pose, minimumScore = 0.2) {
  const points = pose?.keypoints ?? [];
  const tracked = points.filter(point => visible([point], minimumScore) && Number.isFinite(point.x) && Number.isFinite(point.y));
  return { visible: tracked.length, total: points.length, confidence: tracked.length ? Math.round(tracked.reduce((sum, point) => sum + point.score, 0) / tracked.length * 100) : 0 };
}

/**
 * Create a session-scoped pose filter.
 * Call once when the camera starts; pass the returned object to filterPose().
 *
 * @param {Partial<import('./oneEuroFilter.js').PoseFilterConfig>} config
 * @returns {PoseFilter}
 */
export function createPoseFilter(config = {}) {
  return new PoseFilter({ ...DEFAULT_POSE_FILTER_CONFIG, ...config });
}

/**
 * Apply a One Euro filter bank to a raw pose frame.
 * Replaces the former fixed-alpha smoothPose() in the hot loop.
 *
 * @param {PoseFilter} poseFilter  Instance returned by createPoseFilter().
 * @param {{keypoints: Array}} pose  Raw MoveNet / BlazePose output.
 * @param {number} timestamp  performance.now() value for this frame.
 * @returns {{keypoints: Array}|null}
 */
export function filterPose(poseFilter, pose, timestamp) {
  if (!pose) return null;
  return { ...pose, keypoints: poseFilter.filter(pose.keypoints, timestamp) };
}

/**
 * Legacy export — kept so existing tests that call smoothPose() keep passing.
 * New code should use createPoseFilter() + filterPose() instead.
 * @deprecated
 */
export function smoothPose(pose, previous, alpha = 0.7) {
  if (!pose) return null;
  const prior = namedKeypoints(previous?.keypoints ?? []);
  return { ...pose, keypoints: pose.keypoints.map(point => {
    const before = prior[point.name];
    if (!visible([point, before])) return point;
    return { ...point, x: before.x + alpha * (point.x - before.x), y: before.y + alpha * (point.y - before.y) };
  }) };
}

export function shoulderAngles(keypoints) {
  const points = namedKeypoints(keypoints ?? []);
  return Object.fromEntries(['left', 'right'].map(side => {
    const joints = ['hip', 'shoulder', 'elbow'].map(joint => points[`${side}_${joint}`]);
    return [side, visible(joints) ? angleAt(...joints) : null];
  }));
}

export function drawPose(canvas, video, pose, options = {}) {
  const mirrored = options?.mirrored ?? true;
  if (!canvas || !video.videoWidth || !video.videoHeight) return;
  if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  }
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (!pose) return;
  const points = namedKeypoints(pose.keypoints);
  const size = Math.max(2, canvas.width / 240);
  const color = name => name.startsWith('left') ? '#36e2bf' : name.startsWith('right') ? '#ffb866' : '#e4ddff';
  context.lineCap = 'round';
  for (const [from, to] of POSE_CONNECTIONS) {
    if (!visible([points[from], points[to]])) continue;
    context.lineWidth = size;
    context.strokeStyle = color(from);
    context.beginPath(); context.moveTo(points[from].x, points[from].y); context.lineTo(points[to].x, points[to].y); context.stroke();
  }
  for (const point of pose.keypoints) {
    if (!visible([point]) || !Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
    context.beginPath(); context.arc(point.x, point.y, size * 1.25, 0, Math.PI * 2);
    context.fillStyle = color(point.name); context.fill();
    context.lineWidth = size * 0.4; context.strokeStyle = '#101827'; context.stroke();
  }
  // When mirrored (front camera), counter-mirror labels so angle text stays readable.
  // When unmirrored (environment camera), render angle text normally.
  const angles = shoulderAngles(pose.keypoints);
  for (const side of ['left', 'right']) {
    if (!Number.isFinite(angles[side])) continue;
    const shoulder = points[`${side}_shoulder`];
    context.save(); context.translate(shoulder.x, shoulder.y - size * 5);
    if (mirrored) {
      context.scale(-1, 1);
    }
    context.font = `600 ${Math.round(size * 5)}px system-ui`;
    context.textAlign = 'center'; context.lineWidth = 4; context.strokeStyle = '#101827'; context.fillStyle = color(side);
    const label = `${Math.round(angles[side])}°`;
    context.strokeText(label, 0, 0); context.fillText(label, 0, 0); context.restore();
  }
}
