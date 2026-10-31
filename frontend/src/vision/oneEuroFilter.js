/**
 * One Euro Filter for real-time keypoint smoothing.
 *
 * Reference: Géry Casiez, Nicolas Roussel, Daniel Vogel.
 * "1€ Filter: A Simple Speed-based Low-pass Filter for Noisy Input in Interactive Systems."
 * CHI 2012. https://doi.org/10.1145/2207676.2208639
 *
 * Parameter Tuning Guide
 * ──────────────────────
 * minCutoff (Hz, default: 1.0)
 *   The cutoff frequency at low speeds (when stationary).
 *   - Increase (e.g. 1.5 - 2.0 Hz): Reduces lag when moving slowly, but allows more jitter at rest.
 *   - Decrease (e.g. 0.5 - 0.8 Hz): Heavily suppresses resting tremor / landmark jitter, but adds slight lag to slow movements.
 *
 * beta (speed coefficient, default: 0.007)
 *   Governs how much the cutoff frequency rises with speed (cutoff = minCutoff + beta * |velocity|).
 *   - Increase (e.g. 0.015 - 0.02): When a limb moves fast (e.g. ballistic arm raise or quick squat descent),
 *     the filter opens up to eliminate lag and catch rapid directional reversals.
 *   - Decrease (e.g. 0.001 - 0.003): Clamps smoothing closer to fixed low-pass; smooths fast movement more but increases lag.
 *
 * dCutoff (Hz, default: 1.0)
 *   Cutoff frequency for the derivative (velocity) calculation.
 *   - Usually left at 1.0 Hz; increase if speed adaptation reacts too slowly to sudden acceleration.
 *
 * minScore (default: 0.3)
 *   MoveNet confidence gate. Coordinates with score < minScore are marked untracked and bypassed
 *   so detection glitches do not corrupt filter state.
 *
 * resetAfterMs (default: 1000)
 *   When a keypoint remains untracked longer than this window, filter memory is flushed so the
 *   joint does not snap across screen space when re-detected.
 */

export function alpha(cutoff, dt) {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
}

export class LowPassFilter {
  #initialized = false;
  #value = 0;

  filter(x, a) {
    if (!this.#initialized) {
      this.#initialized = true;
      this.#value = x;
      return x;
    }
    this.#value = a * x + (1 - a) * this.#value;
    return this.#value;
  }

  get lastValue() {
    return this.#value;
  }

  reset() {
    this.#initialized = false;
    this.#value = 0;
  }
}

export class OneEuroFilter {
  #xFilter = new LowPassFilter();
  #dxFilter = new LowPassFilter();
  #lastTime = null;

  constructor(minCutoff = 1.0, beta = 0.007, dCutoff = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
  }

  filter(x, timestamp) {
    if (!Number.isFinite(x) || !Number.isFinite(timestamp)) {
      return x;
    }

    if (this.#lastTime === null) {
      this.#lastTime = timestamp;
      return this.#xFilter.filter(x, 1.0);
    }

    const dt = Math.max((timestamp - this.#lastTime) / 1000, 1e-4);
    this.#lastTime = timestamp;

    // Estimate derivative (speed) from prior filtered position
    const dx = (x - this.#xFilter.lastValue) / dt;
    const aD = alpha(this.dCutoff, dt);
    const dxHat = this.#dxFilter.filter(dx, aD);

    // Speed-adaptive cutoff
    const cutoff = this.minCutoff + this.beta * Math.abs(dxHat);
    const aX = alpha(cutoff, dt);
    return this.#xFilter.filter(x, aX);
  }

  reset() {
    this.#xFilter.reset();
    this.#dxFilter.reset();
    this.#lastTime = null;
  }
}

export const DEFAULT_POSE_FILTER_CONFIG = {
  minCutoff: 1.0,
  beta: 0.007,
  dCutoff: 1.0,
  minScore: 0.3,
  resetAfterMs: 1000,
};

export const EXERCISE_FILTER_CONFIGS = {
  default: { ...DEFAULT_POSE_FILTER_CONFIG },
  Squat: {
    minCutoff: 1.0,
    beta: 0.008,
    dCutoff: 1.0,
    minScore: 0.3,
    resetAfterMs: 1000,
  },
  'Side Arm Raise': {
    minCutoff: 1.2,
    beta: 0.015,
    dCutoff: 1.0,
    minScore: 0.3,
    resetAfterMs: 1000,
  },
  'Toe Touch': {
    minCutoff: 1.0,
    beta: 0.008,
    dCutoff: 1.0,
    minScore: 0.3,
    resetAfterMs: 1000,
  },
};

export function getPoseFilterConfig(exerciseName = 'default') {
  return EXERCISE_FILTER_CONFIGS[exerciseName] ?? EXERCISE_FILTER_CONFIGS.default;
}

export class PoseFilter {
  constructor(config = {}) {
    this._cfg = { ...DEFAULT_POSE_FILTER_CONFIG, ...config };
    this._banks = new Map();
  }

  _bankFor(name) {
    if (!this._banks.has(name)) {
      this._banks.set(name, {
        x: new OneEuroFilter(this._cfg.minCutoff, this._cfg.beta, this._cfg.dCutoff),
        y: new OneEuroFilter(this._cfg.minCutoff, this._cfg.beta, this._cfg.dCutoff),
        lostAt: null,
      });
    }
    return this._banks.get(name);
  }

  filter(keypoints, timestamp) {
    if (!Array.isArray(keypoints)) return keypoints;

    return keypoints.map(kp => {
      if (!kp || typeof kp !== 'object') return kp;
      const bank = this._bankFor(kp.name || 'default');
      const confident = Number.isFinite(kp.score) && kp.score >= this._cfg.minScore
        && Number.isFinite(kp.x) && Number.isFinite(kp.y);

      if (!confident) {
        if (bank.lostAt === null) bank.lostAt = timestamp;
        if (timestamp - bank.lostAt >= this._cfg.resetAfterMs) {
          bank.x.reset();
          bank.y.reset();
        }
        return { ...kp, tracked: false };
      }

      if (bank.lostAt !== null && timestamp - bank.lostAt >= this._cfg.resetAfterMs) {
        bank.x.reset();
        bank.y.reset();
      }
      bank.lostAt = null;
      const fx = bank.x.filter(kp.x, timestamp);
      const fy = bank.y.filter(kp.y, timestamp);
      return { ...kp, x: fx, y: fy, tracked: true };
    });
  }

  reset() {
    this._banks.clear();
  }
}
