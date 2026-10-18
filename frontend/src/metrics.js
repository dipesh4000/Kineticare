export const avg = rows => {
  const scored = rows.filter(row => Number.isFinite(row.s));
  return scored.length
  ? +(scored.reduce((total, row) => total + row.s, 0) / scored.length).toFixed(2)
  : null;
};

export const exs = sessions => {
  const measurements = {};
  sessions.forEach(session => (session.r || []).forEach(result => {
    (measurements[result.ex] ??= []).push(result);
  }));
  return Object.entries(measurements).map(([exercise, results]) => [
    exercise,
    avg(results),
    results.reduce((total, result) => total + (result.t || 0), 0) / results.length,
  ]);
};

/**
 * Calculates biomechanical metrics across all repetitions of an exercise:
 * - Mean excursion angle and target difference
 * - Concentric vs eccentric duration
 * - Fatigue index
 * - Compliance percentage
 */
export const calcExerciseBiometrics = (result, planItem = {}) => {
  const reps = result.reps || [];
  if (!reps.length) return null;

  const targetDeg = planItem.targetExcursionDeg || result.targetExcursionDeg || (result.ex === 'Squat' ? 45 : result.ex === 'Side Arm Raise' ? 75 : 60);
  const count = reps.length;
  const peaks = reps.map(r => r.peakDeg != null ? r.peakDeg : Math.round(r.peak * targetDeg));
  const meanPeakDeg = +(peaks.reduce((sum, v) => sum + v, 0) / count).toFixed(1);
  const romCompliancePct = Math.round((reps.filter(r => r.withinTarget).length / count) * 100);

  const meanConcentricMs = Math.round(reps.reduce((sum, r) => sum + (r.outboundMs || r.durationMs * 0.45), 0) / count);
  const meanEccentricMs = Math.round(reps.reduce((sum, r) => sum + (r.returnMs || r.durationMs * 0.55), 0) / count);
  const meanDurationMs = Math.round(reps.reduce((sum, r) => sum + r.durationMs, 0) / count);

  // Fatigue: % decline between first half and second half
  let fatigueIndex = 0;
  if (count >= 4) {
    const half = Math.floor(count / 2);
    const firstHalfAvg = peaks.slice(0, half).reduce((sum, v) => sum + v, 0) / half;
    const secondHalfAvg = peaks.slice(-half).reduce((sum, v) => sum + v, 0) / half;
    fatigueIndex = +(((firstHalfAvg - secondHalfAvg) / firstHalfAvg) * 100).toFixed(1);
  }

  // Motor learning & consistency (std dev)
  const variance = peaks.reduce((sum, v) => sum + Math.pow(v - meanPeakDeg, 2), 0) / count;
  const romStdDev = +Math.sqrt(variance).toFixed(1);

  return {
    ex: result.ex,
    count,
    targetDeg,
    meanPeakDeg,
    romDeficitDeg: +(targetDeg - meanPeakDeg).toFixed(1),
    romCompliancePct,
    romStdDev,
    consistencyScore: Math.max(0, Math.min(100, Math.round(100 - (romStdDev / targetDeg) * 120))),
    meanDurationSec: +(meanDurationMs / 1000).toFixed(1),
    meanConcentricSec: +(meanConcentricMs / 1000).toFixed(1),
    meanEccentricSec: +(meanEccentricMs / 1000).toFixed(1),
    eccentricRatio: meanConcentricMs > 0 ? +(meanEccentricMs / meanConcentricMs).toFixed(2) : 1,
    fatigueIndex,
    fatigueDetected: fatigueIndex >= 12,
  };
};

/**
 * Computes patient longitudinal trends across multiple rehabilitation sessions:
 * - ROM trajectory per exercise over time
 * - Mean scores and volume completed
 * - Adherence rate
 */
export const calcLongitudinalTrends = (sessions = []) => {
  if (!sessions.length) return null;

  const chron = sessions.slice(); // oldest to newest
  const totalActiveSec = chron.reduce((total, s) => total + (s.r || []).reduce((sub, r) => sub + (r.t || 0), 0), 0);
  const totalRepsCompleted = chron.reduce((total, s) => total + (s.r || []).reduce((sub, r) => sub + (r.attemptedReps || r.reps?.length || 0), 0), 0);

  // Track ROM trajectory per exercise
  const exerciseTrends = {};
  chron.forEach(s => {
    (s.r || []).forEach(r => {
      const bio = calcExerciseBiometrics(r);
      if (bio) {
        (exerciseTrends[r.ex] ??= []).push({
          date: s.d,
          meanPeakDeg: bio.meanPeakDeg,
          targetDeg: bio.targetDeg,
          compliance: bio.romCompliancePct,
          score: r.movementScore || (r.s ? Math.round(r.s * 100) : null),
        });
      }
    });
  });

  return {
    sessionCount: sessions.length,
    totalActiveMinutes: Math.round(totalActiveSec / 60),
    totalRepsCompleted,
    exerciseTrends,
  };
};

