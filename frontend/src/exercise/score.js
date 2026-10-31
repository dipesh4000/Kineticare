const clamp = value => Math.max(0, Math.min(1, value));

export function scoreRep(rep, { tempoMinMs = 2000, tempoMaxMs = 5000 } = {}) {
  const reach = rep.peak < 0.9 ? clamp(rep.peak / 0.9)
    : rep.peak <= 1.1 ? 1 : clamp(1 - (rep.peak - 1.1) / 0.5);
  const tempo = rep.durationMs < tempoMinMs ? clamp(rep.durationMs / tempoMinMs)
    : rep.durationMs <= tempoMaxMs ? 1 : clamp(tempoMaxMs / rep.durationMs);
  return { score: Math.round(100 * (0.7 * reach + 0.3 * tempo)), reach: +reach.toFixed(2), tempo: +tempo.toFixed(2) };
}

export function scoreRepetitions(reps, { tempoMinMs = 2000, tempoMaxMs = 5000 } = {}) {
  if (!reps.length) return null;
  const reach = reps.reduce((total, rep) => {
    if (rep.peak < 0.9) return total + clamp(rep.peak / 0.9);
    if (rep.peak <= 1.1) return total + 1;
    return total + clamp(1 - (rep.peak - 1.1) / 0.5);
  }, 0) / reps.length;
  const tempo = reps.reduce((total, rep) => {
    if (rep.durationMs < tempoMinMs) return total + clamp(rep.durationMs / tempoMinMs);
    if (rep.durationMs <= tempoMaxMs) return total + 1;
    return total + clamp(tempoMaxMs / rep.durationMs);
  }, 0) / reps.length;
  return {
    score: Math.round(100 * (0.7 * reach + 0.3 * tempo)),
    components: { reach: +reach.toFixed(2), tempo: +tempo.toFixed(2) },
    formulaVersion: 'reach-tempo-v1',
  };
}

export function scoreRepetitionsDetailed(reps, { targetDeg = 45, tempoMinMs = 2000, tempoMaxMs = 5000 } = {}) {
  const base = scoreRepetitions(reps, { tempoMinMs, tempoMaxMs });
  if (!base) return null;

  const count = reps.length;
  const meanPeak = reps.reduce((sum, r) => sum + r.peak, 0) / count;
  const meanDurationMs = Math.round(reps.reduce((sum, r) => sum + r.durationMs, 0) / count);
  const meanConcentricMs = Math.round(reps.reduce((sum, r) => sum + (r.outboundMs || r.durationMs * 0.45), 0) / count);
  const meanEccentricMs = Math.round(reps.reduce((sum, r) => sum + (r.returnMs || r.durationMs * 0.55), 0) / count);
  const withinTargetCount = reps.filter(r => r.withinTarget).length;

  let fatigueIndex = 0;
  if (count >= 4) {
    const half = Math.floor(count / 2);
    const firstHalfAvg = reps.slice(0, half).reduce((sum, r) => sum + r.peak, 0) / half;
    const secondHalfAvg = reps.slice(-half).reduce((sum, r) => sum + r.peak, 0) / half;
    fatigueIndex = +(((firstHalfAvg - secondHalfAvg) / firstHalfAvg) * 100).toFixed(1);
  }

  return {
    ...base,
    biometrics: {
      count,
      targetCompliancePct: Math.round((withinTargetCount / count) * 100),
      meanPeakDeg: Math.round(meanPeak * targetDeg),
      targetDeg,
      meanDurationSec: +(meanDurationMs / 1000).toFixed(1),
      meanConcentricSec: +(meanConcentricMs / 1000).toFixed(1),
      meanEccentricSec: +(meanEccentricMs / 1000).toFixed(1),
      eccentricRatio: meanConcentricMs > 0 ? +(meanEccentricMs / meanConcentricMs).toFixed(2) : 1,
      fatigueIndex,
      fatigueDetected: fatigueIndex >= 12,
    },
  };
}
