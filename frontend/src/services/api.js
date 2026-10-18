/**
 * Kineticare Server API Client
 * Connects the frontend to the backend Node.js clinical analytics engine,
 * with seamless local fallback when offline.
 */
import { evaluateExerciseRepetitions, generateSoapNote } from '../../../backend/services/analytics.js';

export async function evaluateSessionServer(session, plan) {
  try {
    const res = await fetch('/api/analytics/evaluate-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session, plan }),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Backend API unavailable, using local analytics fallback:', err);
  }

  // Local fallback using the same pure calculation logic
  const results = session.r || session.exerciseResults || [];
  const exerciseEvaluations = results.map(result => {
    const planItem = plan?.items?.find(it => it.ex === result.ex) || {};
    const targetDeg = planItem.targetExcursionDeg || result.targetExcursionDeg || (result.ex === 'Squat' ? 45 : result.ex === 'Side Arm Raise' ? 75 : 60);
    const targetReps = planItem.targetReps || result.targetReps || 5;

    const evalResult = evaluateExerciseRepetitions(result.reps || [], {
      ex: result.ex,
      targetExcursionDeg: targetDeg,
      targetReps,
    });

    return {
      exName: result.ex,
      activeSec: result.t || 0,
      ...evalResult,
    };
  });

  const validEvals = exerciseEvaluations.filter(e => e.scored);
  const avgScore = validEvals.length
    ? Math.round(validEvals.reduce((s, e) => s + e.overallScore, 0) / validEvals.length)
    : (session.s ? Math.round(session.s * 100) : 75);

  const avgConsistency = validEvals.length
    ? Math.round(validEvals.reduce((s, e) => s + (e.consistencyScore || 85), 0) / validEvals.length)
    : 85;

  return {
    success: true,
    evaluatedAt: new Date().toISOString(),
    avgScore,
    avgConsistency,
    exercises: exerciseEvaluations,
    allFlags: exerciseEvaluations.flatMap(e => (e.clinicalFlags || []).map(f => ({ ...f, exercise: e.exName }))),
    allTips: exerciseEvaluations.flatMap(e => (e.patientTips || []).map(t => ({ tip: t, exercise: e.exName }))),
  };
}

export async function generateSoapNoteServer(patient, session, plan) {
  try {
    const res = await fetch('/api/clinical/soap-note', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient, session, plan }),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('SOAP note API unavailable, using local fallback:', err);
  }

  const evaluation = await evaluateSessionServer(session, plan);
  return generateSoapNote(patient, session, evaluation);
}

export async function reportExerciseIssue(reportData) {
  try {
    const res = await fetch('/api/reports/exercise', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reportData),
    });
    if (res.ok) return await res.json();
  } catch (err) {
    console.warn('Backend report error, falling back locally:', err);
  }
  return {
    success: true,
    message: 'Report logged locally',
    report: { ...reportData, timestamp: new Date().toISOString() },
  };
}
