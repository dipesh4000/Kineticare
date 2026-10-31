/**
 * Calibrates the patient's resting baseline pose over a short window of frames.
 *
 * Requirements:
 * - Minimum sample count (e.g. 10+ frames across calibration window).
 * - Stability check: computes the variance (and spread) of key angles over the window.
 *   Rejects the calibration if variance exceeds the stability threshold, preventing
 *   calibrating while the patient is still moving or adjusting stance.
 * - Extracts resting angle (median) and torso length baseline for body-scale normalization.
 *
 * @param {Array<number|{angle: number, torsoLength?: number}>} samples - Sampled angles or objects
 * @param {Object} options - Calibration thresholds
 * @returns {{ ok: boolean, value?: number, restAngle?: number, torsoLength?: number, variance?: number, stdDev?: number, reason?: string, code?: string }}
 */
export function calibrateRest(samples, {
  minimumSamples = 10,
  maximumSpread = 8,
  maxVariance = 8.0,
  detailed = false,
} = {}) {
  if (!Array.isArray(samples)) {
    return { ok: false, code: 'INVALID_INPUT', reason: 'Calibration requires an array of pose samples.' };
  }

  const isObjectSamples = samples.length > 0 && typeof samples[0] === 'object' && samples[0] !== null;

  // Support both raw numbers and sample objects { angle, torsoLength }
  const valid = samples
    .map(sample => (typeof sample === 'number' ? { angle: sample, torsoLength: null } : sample))
    .filter(sample => sample && Number.isFinite(sample.angle));

  if (valid.length < minimumSamples) {
    return {
      ok: false,
      code: 'INSUFFICIENT_SAMPLES',
      reason: 'Keep the required joints visible for two seconds.',
      sampleCount: valid.length,
      minimumSamples,
    };
  }

  const angles = valid.map(s => s.angle);
  const sorted = [...angles].sort((a, b) => a - b);
  const spread = sorted.at(-1) - sorted[0];

  // Variance & standard deviation of joint angles
  const meanAngle = angles.reduce((sum, a) => sum + a, 0) / angles.length;
  const variance = angles.reduce((sum, a) => sum + Math.pow(a - meanAngle, 2), 0) / angles.length;
  const stdDev = Math.sqrt(variance);

  // Stability rejection: patient is moving, adjusting, or jitter is excessive
  if (spread > maximumSpread || variance > maxVariance) {
    return {
      ok: false,
      code: 'UNSTABLE_REST_POSE',
      reason: 'Hold the resting position still and retry.',
      spread: +spread.toFixed(2),
      variance: +variance.toFixed(2),
      stdDev: +stdDev.toFixed(2),
    };
  }

  const middle = Math.floor(sorted.length / 2);
  const medianAngle = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  const value = +medianAngle.toFixed(1);

  if (!isObjectSamples && !detailed) {
    return { ok: true, value };
  }

  // Torso length baseline
  const torsoLengths = valid.map(s => s.torsoLength).filter(Number.isFinite);
  const avgTorsoLength = torsoLengths.length
    ? +(torsoLengths.reduce((sum, t) => sum + t, 0) / torsoLengths.length).toFixed(1)
    : null;

  return {
    ok: true,
    code: 'CALIBRATION_OK',
    value,
    restAngle: value,
    torsoLength: avgTorsoLength,
    variance: +variance.toFixed(2),
    stdDev: +stdDev.toFixed(2),
    sampleCount: valid.length,
  };
}
