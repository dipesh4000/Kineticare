import express from 'express';
import { evaluateExerciseRepetitions, generateSoapNote } from '../services/analytics.js';

export const analyticsRouter = express.Router();

// POST /api/analytics/evaluate-session
analyticsRouter.post('/evaluate-session', (req, res) => {
  try {
    const { session, plan } = req.body || {};
    if (!session) {
      return res.status(400).json({ error: 'Missing session payload' });
    }

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

    res.json({
      success: true,
      evaluatedAt: new Date().toISOString(),
      avgScore,
      avgConsistency,
      exercises: exerciseEvaluations,
      allFlags: exerciseEvaluations.flatMap(e => (e.clinicalFlags || []).map(f => ({ ...f, exercise: e.exName }))),
      allTips: exerciseEvaluations.flatMap(e => (e.patientTips || []).map(t => ({ tip: t, exercise: e.exName }))),
    });
  } catch (err) {
    res.status(500).json({ error: 'Evaluation failed', details: err.message });
  }
});

// POST /api/analytics/soap-note
analyticsRouter.post('/soap-note', (req, res) => {
  try {
    const { patient, session, plan } = req.body || {};
    if (!session) {
      return res.status(400).json({ error: 'Session is required to generate SOAP note' });
    }

    const results = session.r || session.exerciseResults || [];
    const exerciseEvaluations = results.map(result => {
      const planItem = plan?.items?.find(it => it.ex === result.ex) || {};
      const targetDeg = planItem.targetExcursionDeg || result.targetExcursionDeg || 45;
      return {
        exName: result.ex,
        ...evaluateExerciseRepetitions(result.reps || [], { ex: result.ex, targetExcursionDeg: targetDeg }),
      };
    });

    const validEvals = exerciseEvaluations.filter(e => e.scored);
    const avgScore = validEvals.length
      ? Math.round(validEvals.reduce((s, e) => s + e.overallScore, 0) / validEvals.length)
      : 80;

    const allFlags = exerciseEvaluations.flatMap(e => (e.clinicalFlags || []).map(f => ({ ...f, exercise: e.exName })));

    const soapResult = generateSoapNote(
      patient || { n: 'Dipesh', id: 'P-101', clinicianName: 'Dr. Aditi Yadav' },
      session,
      { avgScore, exercises: exerciseEvaluations, allFlags }
    );

    res.json({
      success: true,
      ...soapResult,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate SOAP note', details: err.message });
  }
});
