export const DEFAULT_REP_CONFIG = {
  enterThreshold: 0.25,
  exitThreshold: 0.15,
  reversalDrop: 0.1,
  dwellMs: 120,
  targetMin: 0.9,
  targetMax: 1.1,
};

export function createRepState() {
  return {
    phase: 'REST', pending: null, peak: 0, startedAt: null,
    attemptedReps: 0, assessedReps: 0, withinTargetReps: 0, reps: [],
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
  if (!tracked) return { ...previous, phase: 'REST', pending: null, peak: 0, startedAt: null };
  if (!Number.isFinite(progress) || !Number.isFinite(timestamp)) return previous;

  const state = { ...previous, peak: Math.max(previous.peak, progress) };
  if (state.phase === 'REST') {
    if (progress <= config.enterThreshold) return { ...state, pending: null, peak: 0 };
    const transition = pendingTransition(state, 'OUTBOUND', timestamp, config.dwellMs);
    return transition.ready
      ? { ...state, phase: 'OUTBOUND', pending: null, peak: progress, startedAt: timestamp }
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

  const withinTarget = state.peak >= config.targetMin && state.peak <= config.targetMax;
  const rep = { peak: state.peak, durationMs: timestamp - state.startedAt, withinTarget };
  return {
    ...state,
    phase: 'REST', pending: null, peak: 0, startedAt: null,
    attemptedReps: state.attemptedReps + 1,
    assessedReps: state.assessedReps + 1,
    withinTargetReps: state.withinTargetReps + Number(withinTarget),
    reps: [...state.reps, rep],
  };
}
