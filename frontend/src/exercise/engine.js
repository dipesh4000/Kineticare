export const DEFAULT_REP_CONFIG = {
  enterThreshold: 0.25,
  exitThreshold: 0.15,
  reversalDrop: 0.1,
  dwellMs: 120,
  targetMin: 0.9,
  targetMax: 1.1,
  maxPlausible: 1.6,
  minDurationMs: 600,
  minPhaseDurationMs: 150,
  maxCycleDurationMs: 7000,
  minRomProgress: 0.6,
};

export function createRepState() {
  return {
    phase: 'REST',
    pending: null,
    peak: 0,
    peakRom: 0,
    startedAt: null,
    peakAt: null,
    lastTrackedAt: null,
    attemptedReps: 0,
    assessedReps: 0,
    withinTargetReps: 0,
    rejectedReps: 0,
    reps: [],
    rejections: [],
    lastRejection: null,
    trackingGapMs: 0,
    trackingGaps: [],
  };
}

function pendingTransition(state, transition, timestamp, dwellMs) {
  if (state.pending?.transition !== transition) {
    return { ready: false, pending: { transition, since: timestamp } };
  }
  return { ready: timestamp - state.pending.since >= dwellMs, pending: state.pending };
}

/**
 * Advances repetition state using a strict four-phase state machine:
 * REST -> OUTBOUND -> RETURNING -> COMPLETE.
 *
 * Enforces:
 * - Hysteresis between enterThreshold and exitThreshold to prevent jitter double-counting.
 * - Minimum range of motion (minRom / minRomProgress).
 * - Minimum phase and cycle durations (rejecting too-fast glitches).
 * - Maximum cycle duration (rejecting stalled movements).
 * - Tracking loss mid-cycle discards the in-progress rep and logs a tracking gap.
 */
export function advanceRep(previous, sample, config = DEFAULT_REP_CONFIG) {
  const { timestamp, tracked = true } = sample;
  const targetDeg = config.targetExcursionDeg || 45;

  // Handle tracking interruption mid-cycle or at rest
  if (!tracked) {
    if (previous.phase !== 'REST') {
      const durationMs = previous.startedAt ? Math.max(0, timestamp - previous.startedAt) : 0;
      const rejection = {
        reason: 'tracking lost',
        startTime: previous.startedAt,
        endTime: timestamp,
        duration: +(durationMs / 1000).toFixed(2),
        durationMs,
        peak: previous.peak,
        rom: previous.peakRom || Math.round(previous.peak * targetDeg),
      };
      return {
        ...previous,
        phase: 'REST',
        pending: null,
        peak: 0,
        peakRom: 0,
        startedAt: null,
        peakAt: null,
        rejectedReps: (previous.rejectedReps || 0) + 1,
        rejections: [...(previous.rejections || []), rejection],
        lastRejection: rejection,
        trackingGapMs: (previous.trackingGapMs || 0) + durationMs,
        trackingGaps: [
          ...(previous.trackingGaps || []),
          { start: previous.startedAt, end: timestamp, durationMs },
        ],
      };
    }
    return { ...previous, pending: null, lastTrackedAt: null };
  }

  // Derive normalized progress and degrees of excursion
  let progress = sample.progress;
  let currentRom = 0;
  if (Number.isFinite(sample.angle) && Number.isFinite(config.rest)) {
    currentRom = Math.abs(sample.angle - config.rest);
    if (!Number.isFinite(progress) && targetDeg > 0) {
      progress = currentRom / targetDeg;
    }
  } else if (Number.isFinite(progress)) {
    currentRom = progress * targetDeg;
  }

  if (!Number.isFinite(progress) || !Number.isFinite(timestamp)) return previous;

  const currentPeak = Math.max(previous.peak, progress);
  const currentPeakRom = Math.max(previous.peakRom || 0, currentRom);
  const state = {
    ...previous,
    peak: currentPeak,
    peakRom: currentPeakRom,
    peakAt: progress >= previous.peak ? timestamp : (previous.peakAt || timestamp),
    lastTrackedAt: timestamp,
  };

  const dwellMs = config.dwellMs ?? 120;
  const enterThreshold = config.enterThreshold ?? 0.25;
  const exitThreshold = config.exitThreshold ?? 0.15;
  const reversalDrop = config.reversalDrop ?? 0.1;
  const maxCycleDurationMs = config.maxCycleDurationMs ?? 7000;

  // Stalled cycle check: if in-progress movement exceeds maximum cycle duration, reject as too slow
  if (state.phase !== 'REST' && state.startedAt && (timestamp - state.startedAt > maxCycleDurationMs)) {
    const durationMs = timestamp - state.startedAt;
    const rejection = {
      reason: 'too slow',
      startTime: state.startedAt,
      endTime: timestamp,
      duration: +(durationMs / 1000).toFixed(2),
      durationMs,
      peak: state.peak,
      rom: Math.round(state.peakRom || state.peak * targetDeg),
    };
    return {
      ...state,
      phase: 'REST',
      pending: null,
      peak: 0,
      peakRom: 0,
      startedAt: null,
      peakAt: null,
      rejectedReps: (state.rejectedReps || 0) + 1,
      rejections: [...(state.rejections || []), rejection],
      lastRejection: rejection,
    };
  }

  if (state.phase === 'REST') {
    if (progress <= enterThreshold) {
      return { ...state, pending: null, peak: 0, peakRom: 0, peakAt: null };
    }
    const transition = pendingTransition(state, 'OUTBOUND', timestamp, dwellMs);
    return transition.ready
      ? { ...state, phase: 'OUTBOUND', pending: null, peak: progress, peakRom: currentRom, startedAt: timestamp, peakAt: timestamp }
      : { ...state, pending: transition.pending };
  }

  if (state.phase === 'OUTBOUND') {
    if (state.peak - progress < reversalDrop) {
      return { ...state, pending: null };
    }
    const transition = pendingTransition(state, 'RETURNING', timestamp, dwellMs);
    return transition.ready
      ? { ...state, phase: 'RETURNING', pending: null }
      : { ...state, pending: transition.pending };
  }

  // Phase is RETURNING: waiting to return within exitThreshold of rest
  if (progress >= exitThreshold) {
    return { ...state, pending: null };
  }
  const transition = pendingTransition(state, 'COMPLETE', timestamp, dwellMs);
  if (!transition.ready) return { ...state, pending: transition.pending };

  // Cycle completed in order: validate ROM and timing constraints
  const durationMs = timestamp - state.startedAt;
  const rawOutbound = (state.peakAt || (state.startedAt + Math.round(durationMs * 0.45))) - state.startedAt;
  const outboundMs = Math.max(100, Math.min(durationMs - 100, Math.round(rawOutbound)));
  const returnMs = Math.max(100, Math.round(durationMs - outboundMs));
  const minDurationMs = config.minDurationMs ?? 600;
  const minPhaseDurationMs = config.minPhaseDurationMs ?? 150;
  const minRom = config.minRom ?? (config.minRomProgress ? config.minRomProgress * targetDeg : 0);
  const minRomProgress = config.minRomProgress ?? (config.minRom ? config.minRom / targetDeg : 0.6);

  let rejectReason = null;
  if (state.peak > config.maxPlausible) {
    rejectReason = 'implausible excursion';
  } else if (state.peak < minRomProgress || (config.minRom && state.peakRom < minRom)) {
    rejectReason = 'too shallow';
  } else if (durationMs < minDurationMs || outboundMs < minPhaseDurationMs || returnMs < minPhaseDurationMs) {
    rejectReason = 'too fast';
  } else if (durationMs > maxCycleDurationMs) {
    rejectReason = 'too slow';
  }

  if (rejectReason) {
    const rejection = {
      reason: rejectReason,
      startTime: state.startedAt,
      endTime: timestamp,
      duration: +(durationMs / 1000).toFixed(2),
      durationMs,
      peak: state.peak,
      rom: Math.round(state.peakRom || state.peak * targetDeg),
    };
    return {
      ...state,
      phase: 'REST',
      pending: null,
      peak: 0,
      peakRom: 0,
      startedAt: null,
      peakAt: null,
      rejectedReps: (state.rejectedReps || 0) + 1,
      rejections: [...(state.rejections || []), rejection],
      lastRejection: rejection,
    };
  }

  const withinTarget = state.peak >= config.targetMin && state.peak <= config.targetMax;
  const eccentricRatio = outboundMs > 0 ? +(returnMs / outboundMs).toFixed(2) : 1;
  const rep = {
    startTime: state.startedAt,
    endTime: timestamp,
    duration: +(durationMs / 1000).toFixed(2),
    durationMs,
    outboundMs,
    returnMs,
    eccentricRatio,
    peak: state.peak,
    rom: Math.round(state.peakRom || state.peak * targetDeg),
    withinTarget,
  };

  return {
    ...state,
    phase: 'REST',
    pending: null,
    peak: 0,
    peakRom: 0,
    startedAt: null,
    peakAt: null,
    attemptedReps: state.attemptedReps + 1,
    assessedReps: state.assessedReps + 1,
    withinTargetReps: state.withinTargetReps + Number(withinTarget),
    reps: [...state.reps, rep],
  };
}
