const clamp = value => Math.max(0, Math.min(1, value));

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
