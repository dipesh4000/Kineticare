import { namedKeypoints, visible } from './geometry.js';

/**
 * Pre-session validation and calibration quality checks.
 *
 * Each check returns { ok, code, message, ...details }.
 * When any check fails, human-readable instructions guide the patient
 * to adjust their stance or environment before calibration or workout can begin.
 */

export const MINIMUM_CONFIDENCE = 0.3;
export const MINIMUM_FPS = 15;
export const DEFAULT_MARGIN_RATIO = 0.05; // 5% border margin

/**
 * Computes torso length between shoulder and hip midpoints.
 */
export function measureTorsoLength(keypoints) {
  if (!keypoints || !keypoints.length) return null;
  const pts = namedKeypoints(keypoints);
  const ls = pts.left_shoulder, rs = pts.right_shoulder;
  const lh = pts.left_hip, rh = pts.right_hip;

  const leftVisible = visible([ls, lh], 0.25);
  const rightVisible = visible([rs, rh], 0.25);

  if (leftVisible && rightVisible) {
    const shoulderMid = { x: (ls.x + rs.x) / 2, y: (ls.y + rs.y) / 2 };
    const hipMid = { x: (lh.x + rh.x) / 2, y: (lh.y + rh.y) / 2 };
    const dist = Math.hypot(shoulderMid.x - hipMid.x, shoulderMid.y - hipMid.y);
    return dist > 0 ? +dist.toFixed(1) : null;
  }
  if (leftVisible) {
    const dist = Math.hypot(ls.x - lh.x, ls.y - lh.y);
    return dist > 0 ? +dist.toFixed(1) : null;
  }
  if (rightVisible) {
    const dist = Math.hypot(rs.x - rh.x, rs.y - rh.y);
    return dist > 0 ? +dist.toFixed(1) : null;
  }
  return null;
}

/**
 * Normalizes a pixel distance by torso length.
 */
export function normalizeDistance(distancePx, torsoLengthPx) {
  if (!Number.isFinite(distancePx) || !Number.isFinite(torsoLengthPx) || torsoLengthPx <= 0) {
    return null;
  }
  return +(distancePx / torsoLengthPx).toFixed(3);
}

/**
 * Check 1: Required landmarks visible above confidence threshold.
 */
export function checkLandmarksVisible(exerciseName, keypoints, minScore = MINIMUM_CONFIDENCE) {
  if (!keypoints || !keypoints.length) {
    return {
      ok: false,
      code: 'LANDMARKS_EMPTY',
      message: 'Step into camera view so your body is visible.',
    };
  }

  const pts = namedKeypoints(keypoints);

  if (exerciseName === 'Squat') {
    // Requires shoulder, hip, knee, and ankle on at least one side
    const leftSide = [pts.left_shoulder, pts.left_hip, pts.left_knee, pts.left_ankle];
    const rightSide = [pts.right_shoulder, pts.right_hip, pts.right_knee, pts.right_ankle];
    const leftOk = visible(leftSide, minScore);
    const rightOk = visible(rightSide, minScore);

    if (!leftOk && !rightOk) {
      return {
        ok: false,
        code: 'LANDMARKS_MISSING',
        message: 'Step back so your full body from shoulder to ankle is visible.',
        details: { leftOk, rightOk },
      };
    }
    return {
      ok: true,
      code: 'LANDMARKS_OK',
      message: 'Required landmarks are clearly visible.',
      details: { side: leftOk ? 'left' : 'right' },
    };
  }

  if (exerciseName === 'Side Arm Raise') {
    // Bilateral exercise: requires both shoulders, elbows, and hips
    const required = [
      pts.left_shoulder, pts.right_shoulder,
      pts.left_elbow, pts.right_elbow,
      pts.left_hip, pts.right_hip,
    ];
    if (!visible(required, minScore)) {
      return {
        ok: false,
        code: 'LANDMARKS_MISSING',
        message: 'Step back so both shoulders, elbows, and hips are visible.',
      };
    }
    return {
      ok: true,
      code: 'LANDMARKS_OK',
      message: 'Both arms and torso landmarks are clearly visible.',
    };
  }

  // Fallback (e.g. Toe Touch or generic)
  const leftSide = [pts.left_shoulder, pts.left_hip, pts.left_knee];
  const rightSide = [pts.right_shoulder, pts.right_hip, pts.right_knee];
  if (!visible(leftSide, minScore) && !visible(rightSide, minScore)) {
    return {
      ok: false,
      code: 'LANDMARKS_MISSING',
      message: 'Step into camera view so your shoulder, hip, and knees are visible.',
    };
  }
  return {
    ok: true,
    code: 'LANDMARKS_OK',
    message: 'Required landmarks are visible.',
  };
}

/**
 * Check 2: Body is inside the frame with a safety margin.
 */
export function checkFramingMargin(keypoints, frame = { width: 640, height: 480 }, marginRatio = DEFAULT_MARGIN_RATIO) {
  if (!keypoints || !keypoints.length) {
    return {
      ok: false,
      code: 'MARGIN_NO_BODY',
      message: 'Step into camera view.',
    };
  }

  const validPoints = keypoints.filter(p => p && Number.isFinite(p.x) && Number.isFinite(p.y) && (p.score ?? 1) >= 0.25);
  if (!validPoints.length) {
    return {
      ok: false,
      code: 'MARGIN_NO_BODY',
      message: 'Step into camera view.',
    };
  }

  const isNormalized = validPoints.every(p => p.x <= 1.05 && p.y <= 1.05);
  const maxXVal = isNormalized ? 1.0 : Math.max(...validPoints.map(p => p.x));
  const maxYVal = isNormalized ? 1.0 : Math.max(...validPoints.map(p => p.y));
  const width = isNormalized ? 1.0 : (frame?.width && frame.width > 640 ? frame.width : maxXVal > 640 ? Math.max(1280, maxXVal + 40) : (frame?.width || 640));
  const height = isNormalized ? 1.0 : (frame?.height && frame.height > 480 ? frame.height : maxYVal > 480 ? Math.max(720, maxYVal + 40) : (frame?.height || 480));

  const minX = width * marginRatio;
  const maxX = width * (1 - marginRatio);
  const minY = height * marginRatio;
  const maxY = height * (1 - marginRatio);

  const xValues = validPoints.map(p => p.x);
  const yValues = validPoints.map(p => p.y);
  const bodyMinX = Math.min(...xValues);
  const bodyMaxX = Math.max(...xValues);
  const bodyMinY = Math.min(...yValues);
  const bodyMaxY = Math.max(...yValues);

  if (bodyMinY < minY) {
    return {
      ok: false,
      code: 'MARGIN_TOP',
      message: 'Step back so your head is fully inside the frame.',
      details: { bodyMinY, minY },
    };
  }
  if (bodyMaxY > maxY) {
    return {
      ok: false,
      code: 'MARGIN_BOTTOM',
      message: 'Step back so your feet are fully inside the frame.',
      details: { bodyMaxY, maxY },
    };
  }
  if (bodyMinX < minX || bodyMaxX > maxX) {
    return {
      ok: false,
      code: 'MARGIN_HORIZONTAL',
      message: 'Center yourself in the camera frame.',
      details: { bodyMinX, bodyMaxX, minX, maxX },
    };
  }

  return {
    ok: true,
    code: 'MARGIN_OK',
    message: 'Body is well framed inside the screen.',
  };
}

/**
 * Check 3: View matches exercise (side view for squat, front view for arm raise)
 * using shoulder width relative to torso length.
 */
export function checkViewOrientation(exerciseName, keypoints) {
  if (!keypoints || !keypoints.length) {
    return {
      ok: false,
      code: 'VIEW_UNKNOWN',
      message: 'Step into camera view.',
    };
  }

  const pts = namedKeypoints(keypoints);
  const ls = pts.left_shoulder, rs = pts.right_shoulder;
  const lh = pts.left_hip, rh = pts.right_hip;

  const shouldersVisible = visible([ls, rs], 0.25);
  if (!shouldersVisible) {
    // If only one shoulder is visible, in side view this is common; check if hip is visible
    const oneSide = visible([ls, lh], 0.25) || visible([rs, rh], 0.25);
    if (exerciseName === 'Squat' || exerciseName === 'Toe Touch') {
      if (oneSide) {
        return {
          ok: true,
          code: 'VIEW_OK',
          message: 'Side view correctly oriented.',
          ratio: 0.15,
        };
      }
    }
    return {
      ok: false,
      code: 'VIEW_UNKNOWN',
      message: 'Position your upper body in camera view.',
    };
  }

  const shoulderDx = Math.abs(ls.x - rs.x);
  const torsoLength = measureTorsoLength(keypoints) || 100;
  const spreadRatio = shoulderDx / torsoLength;

  const isSideExercise = exerciseName === 'Squat' || exerciseName === 'Toe Touch';

  if (isSideExercise) {
    // In side view, shoulders overlap along camera ray (spreadRatio is small, usually < 0.38)
    // When facing front, spreadRatio is typically > 0.45
    if (spreadRatio > 0.42) {
      return {
        ok: false,
        code: 'VIEW_MISMATCH_SIDE',
        message: 'Turn so the camera sees your side.',
        ratio: +spreadRatio.toFixed(2),
      };
    }
    return {
      ok: true,
      code: 'VIEW_OK',
      message: 'Side view correctly oriented.',
      ratio: +spreadRatio.toFixed(2),
    };
  }

  // Front view exercise (e.g. Side Arm Raise)
  // In front view, shoulders are spaced wide (spreadRatio >= 0.30)
  // When turned sideways, shoulders overlap (spreadRatio < 0.25)
  if (spreadRatio < 0.28) {
    return {
      ok: false,
      code: 'VIEW_MISMATCH_FRONT',
      message: 'Face the camera directly with both arms visible.',
      ratio: +spreadRatio.toFixed(2),
    };
  }

  return {
    ok: true,
    code: 'VIEW_OK',
    message: 'Front view correctly oriented.',
    ratio: +spreadRatio.toFixed(2),
  };
}

/**
 * Check 4: Measured frame rate is above minimum.
 */
export function checkFrameRate(fps, minFps = MINIMUM_FPS) {
  if (fps == null || !Number.isFinite(fps) || fps < minFps) {
    return {
      ok: false,
      code: 'FPS_LOW',
      message: `Frame rate is low (${fps || 0} fps, minimum ${minFps} fps). Close background apps or switch to Fast tracking.`,
      fps: fps || 0,
      minFps,
    };
  }
  return {
    ok: true,
    code: 'FPS_OK',
    message: `Frame rate is stable (${fps} fps).`,
    fps,
    minFps,
  };
}

/**
 * Aggregates all pre-session validation checks.
 */
export function validatePreSession({
  exerciseName,
  keypoints,
  frame = { width: 640, height: 480 },
  fps = 30,
  minConfidence = MINIMUM_CONFIDENCE,
  minFps = MINIMUM_FPS,
  marginRatio = DEFAULT_MARGIN_RATIO,
}) {
  const landmarks = checkLandmarksVisible(exerciseName, keypoints, minConfidence);
  const framing = checkFramingMargin(keypoints, frame, marginRatio);
  const orientation = checkViewOrientation(exerciseName, keypoints);
  const frameRate = checkFrameRate(fps, minFps);

  const checks = { landmarks, framing, orientation, frameRate };
  const failingCheck = [landmarks, framing, orientation, frameRate].find(c => !c.ok) || null;

  return {
    ok: !failingCheck,
    checks,
    failingCheck,
    message: failingCheck ? failingCheck.message : 'Position and camera verified. Ready for resting setup.',
  };
}

