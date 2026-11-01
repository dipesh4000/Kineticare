export function angleAt(a, vertex, c) {
  if (![a, vertex, c].every(point => Number.isFinite(point?.x) && Number.isFinite(point?.y))) return null;
  const first = { x: a.x - vertex.x, y: a.y - vertex.y };
  const second = { x: c.x - vertex.x, y: c.y - vertex.y };
  const scale = Math.hypot(first.x, first.y) * Math.hypot(second.x, second.y);
  if (!scale) return null;
  const cosine = Math.max(-1, Math.min(1, (first.x * second.x + first.y * second.y) / scale));
  return Math.acos(cosine) * 180 / Math.PI;
}

export function namedKeypoints(keypoints) {
  return Object.fromEntries(keypoints.map(point => [point.name, point]));
}

export function visible(points, minimumScore = 0.2) {
  return points.every(point => point && Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.score) && point.score >= minimumScore);
}

/**
 * Exponential Moving Average (EMA) smoother for real-time joint angles.
 * Reduces high-frequency jitter while preserving movement onset.
 */
export function smoothAngleEMA(rawAngle, previousAngle, alpha = 0.35) {
  if (!Number.isFinite(rawAngle)) return null;
  if (!Number.isFinite(previousAngle)) return rawAngle;
  // If sudden jump > 45 deg, step-limit change to prevent artifact spikes
  const delta = rawAngle - previousAngle;
  const clampedRaw = Math.abs(delta) > 45 ? previousAngle + Math.sign(delta) * 45 : rawAngle;
  return +(alpha * clampedRaw + (1 - alpha) * previousAngle).toFixed(1);
}

/**
 * Validates body alignment and camera orientation.
 * For side-view exercises (Squat, Toe Touch), detects whether the user is accidentally facing front.
 * For front-view exercises (Side Arm Raise), checks bilateral shoulder separation.
 */
export function checkBodyAlignment(exerciseName, keypoints) {
  if (!keypoints || !keypoints.length) {
    return { isAligned: false, orientation: 'unknown', message: 'Step into camera view' };
  }
  const pts = namedKeypoints(keypoints);
  const ls = pts.left_shoulder, rs = pts.right_shoulder;
  const lh = pts.left_hip, rh = pts.right_hip;

  const isSide = exerciseName === 'Squat' || exerciseName === 'Toe Touch';

  if (isSide) {
    // Both shoulders and hips visible with large horizontal distance indicates facing front
    if (visible([ls, rs, lh, rh], 0.3)) {
      const shoulderDx = Math.abs(ls.x - rs.x);
      const torsoDy = Math.abs((ls.y + rs.y) / 2 - (lh.y + rh.y) / 2) || 100;
      const shoulderSpreadRatio = shoulderDx / torsoDy;

      // In side view, shoulders align closely along x axis (ratio usually < 0.35)
      if (shoulderSpreadRatio > 0.55) {
        return {
          isAligned: false,
          orientation: 'front',
          message: 'Please turn side-on to the camera for accurate tracking',
          ratio: +shoulderSpreadRatio.toFixed(2),
        };
      }
    }
    return { isAligned: true, orientation: 'side', message: null };
  }

  // Front-view exercise (e.g. Side Arm Raise)
  if (visible([ls, rs], 0.25)) {
    const shoulderDx = Math.abs(ls.x - rs.x);
    const torsoHeight = visible([lh, rh], 0.2) ? Math.abs((ls.y + rs.y - lh.y - rh.y) / 2) : null;
    if (torsoHeight && shoulderDx / torsoHeight < 0.15) {
      return {
        isAligned: false,
        orientation: 'side',
        message: 'Please face the camera directly with both arms visible',
      };
    }
    return { isAligned: true, orientation: 'front', message: null };
  }

  return { isAligned: true, orientation: 'unknown', message: null };
}

/**
 * Validates user framing distance (ensuring essential limbs are within view)
 */
export function checkFramingDistance(exerciseName, keypoints, canvasHeight = 480) {
  if (!keypoints || !keypoints.length) return { ok: false, message: 'Position camera to see full body' };
  const pts = namedKeypoints(keypoints);
  const nose = pts.nose;
  const ankles = [pts.left_ankle, pts.right_ankle].filter(a => a && a.score >= 0.25);

  if (nose && nose.score >= 0.3 && ankles.length > 0) {
    const minAnkleY = Math.max(...ankles.map(a => a.y));
    const totalHeight = minAnkleY - nose.y;
    if (totalHeight < canvasHeight * 0.4) {
      return { ok: false, message: 'Step closer to the camera' };
    }
    if (totalHeight > canvasHeight * 0.95) {
      return { ok: false, message: 'Step back so full body fits in frame' };
    }
  }
  return { ok: true, message: null };
}
