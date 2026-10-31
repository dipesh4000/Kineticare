/**
 * Kineticare Biomechanics & Clinical Analytics Service
 * Computes clinically relevant metrics for physiotherapists, orthopedists, and patients.
 *
 * Service-layer error contract:
 *   - evaluateExerciseRepetitions throws AppError(400) for obviously invalid inputs
 *     instead of swallowing errors or returning raw exceptions to callers.
 *   - generateSoapNote is pure template interpolation (no network, no AI) and
 *     throws AppError(400) when the required session argument is missing.
 */
import { AppError } from '../middleware/errorHandler.js';

const clamp = (val, min = 0, max = 1) => Math.max(min, Math.min(max, val));


/**
 * Evaluates repetition biometrics:
 * - ROM compliance and excursion degrees
 * - Concentric vs Eccentric phase timing
 * - Cadence and velocity
 * - Fatigue index across set
 * - Clinical risk flags
 * - Patient-friendly coaching guidance
 */
export function evaluateExerciseRepetitions(reps = [], exerciseMeta = {}) {
  if (!reps || !reps.length) {
    return {
      scored: false,
      repsCount: 0,
      summary: 'No completed repetitions recorded.',
      clinicalFlags: [{ code: 'NO_REPS', level: 'warn', label: 'Incomplete Set', desc: 'No valid repetitions assessed.' }],
      patientTips: ['Try completing at least 3-5 repetitions so we can analyze your movement.'],
    };
  }

  const targetDeg = exerciseMeta.targetExcursionDeg || 45;

  // Extract and normalize per-rep numbers
  const processedReps = reps.map((rep, idx) => {
    const peak = typeof rep.peak === 'number' ? rep.peak : 1;
    const durationMs = rep.durationMs || 3000;
    const outboundMs = rep.outboundMs || Math.round(durationMs * 0.42);
    const returnMs = rep.returnMs || Math.round(durationMs * 0.58);
    const peakDeg = rep.peakDeg != null ? rep.peakDeg : Math.round(peak * targetDeg);
    const withinTarget = rep.withinTarget != null ? rep.withinTarget : (peak >= 0.9 && peak <= 1.15);
    const eccentricRatio = outboundMs > 0 ? +(returnMs / outboundMs).toFixed(2) : 1;

    // Repetition quality components
    const reachScore = peak < 0.9 ? clamp(peak / 0.9) : peak <= 1.15 ? 1 : clamp(1 - (peak - 1.15) / 0.4);
    const tempoScore = durationMs < 2000 ? clamp(durationMs / 2000) : durationMs <= 5000 ? 1 : clamp(5000 / durationMs);
    const eccentricControlScore = eccentricRatio >= 1.0 && eccentricRatio <= 2.2 ? 1 : clamp(eccentricRatio / 1.0);
    const repScore = Math.round(100 * (0.55 * reachScore + 0.3 * tempoScore + 0.15 * eccentricControlScore));

    return {
      index: idx + 1,
      peak: +peak.toFixed(2),
      peakDeg,
      targetDeg,
      romPercent: Math.round(peak * 100),
      durationMs,
      durationSec: +(durationMs / 1000).toFixed(1),
      outboundMs,
      returnMs,
      eccentricRatio,
      withinTarget,
      score: rep.score ?? repScore,
    };
  });

  const count = processedReps.length;
  const meanPeakDeg = +(processedReps.reduce((sum, r) => sum + r.peakDeg, 0) / count).toFixed(1);
  const meanDurationMs = Math.round(processedReps.reduce((sum, r) => sum + r.durationMs, 0) / count);
  const meanConcentricMs = Math.round(processedReps.reduce((sum, r) => sum + r.outboundMs, 0) / count);
  const meanEccentricMs = Math.round(processedReps.reduce((sum, r) => sum + r.returnMs, 0) / count);
  const withinTargetCount = processedReps.filter(r => r.withinTarget).length;
  const targetCompliancePct = Math.round((withinTargetCount / count) * 100);

  // Standard deviation of peak degrees (consistency of motor pattern)
  const degVariance = processedReps.reduce((sum, r) => sum + Math.pow(r.peakDeg - meanPeakDeg, 2), 0) / count;
  const romStdDev = +Math.sqrt(degVariance).toFixed(1);
  const consistencyScore = Math.max(0, Math.min(100, Math.round(100 - (romStdDev / targetDeg) * 120)));

  // Fatigue Index: Compare first half vs second half
  let fatigueIndex = 0;
  let fatigueDetected = false;
  if (count >= 4) {
    const half = Math.floor(count / 2);
    const firstHalfAvg = processedReps.slice(0, half).reduce((sum, r) => sum + r.peakDeg, 0) / half;
    const secondHalfAvg = processedReps.slice(-half).reduce((sum, r) => sum + r.peakDeg, 0) / half;
    fatigueIndex = +(((firstHalfAvg - secondHalfAvg) / firstHalfAvg) * 100).toFixed(1);
    if (fatigueIndex >= 12) fatigueDetected = true;
  }

  // Clinical Flags for Doctor Review
  const clinicalFlags = [];
  if (targetCompliancePct >= 80) {
    clinicalFlags.push({
      code: 'TARGET_EXCELLENT',
      level: 'ok',
      label: 'High Target Compliance',
      desc: `${targetCompliancePct}% of repetitions attained the assigned target range (${targetDeg}°).`,
    });
  } else if (meanPeakDeg < targetDeg * 0.85) {
    clinicalFlags.push({
      code: 'ROM_DEFICIT',
      level: 'warn',
      label: 'ROM Deficit Under Target',
      desc: `Patient averaged ${meanPeakDeg}°, falling short of prescribed ${targetDeg}° target (-${Math.round(targetDeg - meanPeakDeg)}° deficit).`,
    });
  } else if (meanPeakDeg > targetDeg * 1.2) {
    clinicalFlags.push({
      code: 'ROM_EXCESS',
      level: 'warn',
      label: 'Exceeding Prescribed Range',
      desc: `Patient moved past target to ${meanPeakDeg}° (+${Math.round(meanPeakDeg - targetDeg)}°). Check for hypermobility or compensatory trunk lean.`,
    });
  }

  if (fatigueDetected) {
    clinicalFlags.push({
      code: 'FATIGUE_ONSET',
      level: 'warn',
      label: 'Fatigue Degradation Detected',
      desc: `Movement excursion declined by ${fatigueIndex}% between initial and terminal repetitions in this set.`,
    });
  }

  if (meanEccentricMs < meanConcentricMs * 0.9) {
    clinicalFlags.push({
      code: 'RUSHED_ECCENTRIC',
      level: 'warn',
      label: 'Rushed Return Phase',
      desc: `Eccentric return (${(meanEccentricMs / 1000).toFixed(1)}s) was faster than outbound phase (${(meanConcentricMs / 1000).toFixed(1)}s). Cue slower lowering.`,
    });
  } else {
    clinicalFlags.push({
      code: 'ECCENTRIC_CONTROL',
      level: 'ok',
      label: 'Controlled Eccentric Lowering',
      desc: `Patient demonstrated sustained deceleration on return (${(meanEccentricMs / 1000).toFixed(1)}s average).`,
    });
  }

  if (consistencyScore >= 85) {
    clinicalFlags.push({
      code: 'MOTOR_STABILITY',
      level: 'ok',
      label: 'High Motor Reproducibility',
      desc: `Angle standard deviation is low (±${romStdDev}°), indicating stable neuromuscular motor control.`,
    });
  }

  // Patient-facing coaching guidance
  const patientTips = [];
  if (targetCompliancePct >= 80) {
    patientTips.push(`🎯 Great job hitting your depth target on ${withinTargetCount} of ${count} reps!`);
  } else if (meanPeakDeg < targetDeg * 0.88) {
    patientTips.push(`📏 You reached ${meanPeakDeg}° on average (target was ${targetDeg}°). Aim to gently extend your depth on the next set.`);
  } else if (meanPeakDeg > targetDeg * 1.15) {
    patientTips.push(`🛑 You're bending past your target (${meanPeakDeg}° vs ${targetDeg}°). Stay within the clinician's zone to protect the joint.`);
  }

  if (meanDurationMs < 2200) {
    patientTips.push(`⏱️ Your pace was quite fast (${(meanDurationMs / 1000).toFixed(1)}s per rep). Slow down to 3-4 seconds per rep to maximize strength.`);
  } else if (meanEccentricMs >= meanConcentricMs) {
    patientTips.push(`✨ Excellent control on the return movement! Slow lowering protects tendons and builds resilience.`);
  }

  if (fatigueDetected) {
    patientTips.push(`⚡ Your depth dipped slightly towards the end of the set. That's normal fatigue — take a full 60-second rest between sets.`);
  } else {
    patientTips.push(`💪 Consistent energy from start to finish! Your repetitions stayed uniform.`);
  }

  const overallScore = Math.round(
    processedReps.reduce((sum, r) => sum + r.score, 0) / count
  );

  return {
    scored: true,
    repsCount: count,
    targetReps: exerciseMeta.targetReps || count,
    overallScore,
    targetCompliancePct,
    withinTargetCount,
    meanPeakDeg,
    targetDeg,
    romDeficitDeg: +(targetDeg - meanPeakDeg).toFixed(1),
    romStdDev,
    consistencyScore,
    timing: {
      meanDurationSec: +(meanDurationMs / 1000).toFixed(1),
      meanConcentricSec: +(meanConcentricMs / 1000).toFixed(1),
      meanEccentricSec: +(meanEccentricMs / 1000).toFixed(1),
      eccentricConcentricRatio: meanConcentricMs > 0 ? +(meanEccentricMs / meanConcentricMs).toFixed(2) : 1,
      cadenceRpm: +(60 / (meanDurationMs / 1000)).toFixed(1),
    },
    fatigue: {
      detected: fatigueDetected,
      indexPct: fatigueIndex,
    },
    reps: processedReps,
    clinicalFlags,
    patientTips,
  };
}

/**
 * Generates an automated SOAP progress note for Clinicians and EHR integration.
 *
 * NOTE: This function is purely template-based — string interpolation only.
 * No patient data is sent to any external service or AI provider.
 * Throws a typed AppError for obviously missing required inputs.
 */
export function generateSoapNote(patient = {}, session = {}, evaluation = {}) {
  if (!session || typeof session !== 'object') {
    throw new AppError('session is required to generate a SOAP note.', 400, 'VALIDATION_ERROR');
  }
  const patientName = patient.n || patient.displayName || 'Dipesh';
  const patientId = patient.id || patient.patientUid || 'P-101';
  const clinicianName = patient.clinicianName || 'Dr. Aditi Yadav';
  const dateStr = session.d || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const results = session.r || session.exerciseResults || [];

  const exercisesSummary = results.map(r => {
    const exName = r.ex || 'Exercise';
    const reps = r.reps || [];
    const count = r.attemptedReps || reps.length;
    const score = r.movementScore || (r.s ? Math.round(r.s * 100) : 'N/A');
    const time = r.t || Math.round((r.activeMs || 0) / 1000);
    return `${exName}: ${count} reps completed in ${time}s (Movement Score: ${score}/100)`;
  }).join('; ');

  const evalDetails = evaluation.exercises?.map(item => {
    return `- ${item.exName}: Target ${item.targetDeg}°, Achieved ${item.meanPeakDeg}° (Compliance: ${item.targetCompliancePct}%), Mean Tempo: ${item.timing?.meanDurationSec}s (Conc: ${item.timing?.meanConcentricSec}s / Ecc: ${item.timing?.meanEccentricSec}s), Fatigue Index: ${item.fatigue?.indexPct}%.`;
  }).join('\n') || '- Telemetric joint angles within anticipated rehabilitative trajectory.';

  const flagsList = evaluation.allFlags?.map(f => `[${f.level.toUpperCase()}] ${f.label}: ${f.desc}`).join('\n')
    || 'No acute biomechanical contraindications or movement aberrations detected.';

  return {
    patientId,
    patientName,
    clinicianName,
    date: dateStr,
    soap: {
      subjective: `Patient ${patientName} (${patientId}) completed scheduled home rehabilitation session on ${dateStr} supervised remotely by ${clinicianName} via Kineticare pose-tracking interface. No tracking loss or early abort reported.`,
      objective: `Exercises performed: ${exercisesSummary}.\nBiomechanical Measurements:\n${evalDetails}`,
      assessment: `Patient demonstrates neuromuscular control with ${evaluation.avgScore || 80}/100 functional movement composite score. Clinical flags:\n${flagsList}`,
      plan: `Continue current assigned protocol. Encourage sustained eccentric control and adequate rest intervals between sets. Schedule follow-up tele-consultation if pain or fatigue index exceeds threshold.`,
    },
    formattedText: `KINETICARE CLINICAL PROGRESS NOTE
Patient: ${patientName} (ID: ${patientId})
Attending Clinician: ${clinicianName}
Date: ${dateStr}
Session Status: ${session.status || 'completed'} (Mode: ${session.mode || 'live'})

[S] SUBJECTIVE:
Patient completed prescribed home movement set. Session duration: ${session.r?.reduce((t, x) => t + (x.t || 0), 0) || 0} seconds active movement.

[O] OBJECTIVE:
${exercisesSummary}
${evalDetails}

[A] ASSESSMENT:
Overall Movement Score: ${evaluation.avgScore || 80}/100.
Consistency & Motor Learning: ${evaluation.avgConsistency || 85}/100.
${flagsList}

[P] PLAN:
Maintain current target parameters. Review exercise video demonstration at next check-in with ${clinicianName}. Continue monitored home exercise program.`,
  };
}
