export const DEFAULT_REP_CONFIG = {
  enterThreshold: 0.25,
  exitThreshold: 0.15,
  reversalDrop: 0.1,
  dwellMs: 120,
  targetMin: 0.9,
  targetMax: 1.1,
  maxPlausible: 1.6,
  minDurationMs: 600,
};

export function createRepState() {
  return {
    phase: 'REST', pending: null, peak: 0, startedAt: null, peakAt: null,
    attemptedReps: 0, assessedReps: 0, withinTargetReps: 0, rejectedReps: 0, reps: [],
  };
}

function pendingTransition(state, transition, timestamp, dwellMs) {
  if (state.pending?.transition !== transition) {
    return { ready: false, pending: { transition, since: timestamp } };
  }
  return { ready: timestamp - state.pending.since >= dwellMs, pending: state.pending };
}

export function advanceRep(previous, sample, config = DEFAULT_REP_CONFIG) {
  const { progress, timestamp, tracked = true } = sample;
  if (!tracked) return { ...previous, phase: 'REST', pending: null, peak: 0, startedAt: null, peakAt: null };
  if (!Number.isFinite(progress) || !Number.isFinite(timestamp)) return previous;

  const currentPeak = Math.max(previous.peak, progress);
  const state = {
    ...previous,
    peak: currentPeak,
    peakAt: progress >= previous.peak ? timestamp : (previous.peakAt || timestamp),
  };

  if (state.phase === 'REST') {
    if (progress <= config.enterThreshold) return { ...state, pending: null, peak: 0, peakAt: null };
    const transition = pendingTransition(state, 'OUTBOUND', timestamp, config.dwellMs);
    return transition.ready
      ? { ...state, phase: 'OUTBOUND', pending: null, peak: progress, startedAt: timestamp, peakAt: timestamp }
      : { ...state, pending: transition.pending };
  }

  if (state.phase === 'OUTBOUND') {
    if (state.peak - progress < config.reversalDrop) return { ...state, pending: null };
    const transition = pendingTransition(state, 'RETURNING', timestamp, config.dwellMs);
    return transition.ready
      ? { ...state, phase: 'RETURNING', pending: null }
      : { ...state, pending: transition.pending };
  }

  if (progress >= config.exitThreshold) return { ...state, pending: null };
  const transition = pendingTransition(state, 'COMPLETE', timestamp, config.dwellMs);
  if (!transition.ready) return { ...state, pending: transition.pending };

  const durationMs = timestamp - state.startedAt;
  if (state.peak > config.maxPlausible || durationMs < config.minDurationMs) {
    // Tracking glitch or a movement far outside the assigned range: do not count it as a repetition.
    return { ...state, phase: 'REST', pending: null, peak: 0, startedAt: null, peakAt: null, rejectedReps: (state.rejectedReps ?? 0) + 1 };
  }
  const withinTarget = state.peak >= config.targetMin && state.peak <= config.targetMax;
  const rawOutbound = (state.peakAt || (state.startedAt + Math.round(durationMs * 0.45))) - state.startedAt;
  const outboundMs = Math.max(150, Math.min(durationMs - 150, Math.round(rawOutbound)));
  const returnMs = Math.max(150, Math.round(durationMs - outboundMs));
  const eccentricRatio = outboundMs > 0 ? +(returnMs / outboundMs).toFixed(2) : 1;
  const rep = { peak: state.peak, durationMs, outboundMs, returnMs, eccentricRatio, withinTarget };
  return {
    ...state,
    phase: 'REST', pending: null, peak: 0, startedAt: null, peakAt: null,
    attemptedReps: state.attemptedReps + 1,
    assessedReps: state.assessedReps + 1,
    withinTargetReps: state.withinTargetReps + Number(withinTarget),
    reps: [...state.reps, rep],
  };
}
