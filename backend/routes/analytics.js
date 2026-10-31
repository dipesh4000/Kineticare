/**
 * /api/analytics  (aliased as /api/clinical)
 *
 * SOAP notes (generateSoapNote) are 100% template-based — pure JavaScript string
 * interpolation, no external AI or network calls. Patient identifiers (name, id)
 * flow into the template from the caller-supplied `patient` object and are never
 * sent to any third-party service.
 *
 * Auth: both routes sit behind requireIdentity in api.js (Privy token + DB profile).
 *       No role restriction here — patients and clinicians can both query analytics.
 *
 * Validation: request bodies are parsed through Zod schemas; unknown fields rejected.
 *
 * Service errors: evaluateExerciseRepetitions and generateSoapNote now throw typed
 * AppErrors for bad input instead of raw exceptions, so the central handler
 * can emit the correct {code, message, requestId} envelope.
 */
import express from 'express';
import { evaluateExerciseRepetitions, generateSoapNote } from '../services/analytics.js';
import { asyncRoute, AppError } from '../middleware/errorHandler.js';
import { validate, evaluateSessionSchema, soapNoteSchema } from '../middleware/validation.js';

export const analyticsRouter = express.Router();

// POST /api/analytics/evaluate-session
analyticsRouter.post(
  '/evaluate-session',
  asyncRoute(async (req, res) => {
    const { session, plan } = validate(evaluateSessionSchema, req.body);

    const results = session.r || session.exerciseResults || [];
    const exerciseEvaluations = results.map(result => {
      const planItem = plan?.items?.find(it => it.ex === result.ex) || {};
      const targetDeg =
        result.targetExcursionDeg ||
        planItem.targetExcursionDeg ||
        (result.ex === 'Squat' ? 45 : result.ex === 'Side Arm Raise' ? 75 : 60);
      const targetReps = result.targetReps || planItem.targetReps || 5;

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
      assessmentId: session.assessmentId ?? null,
      assessmentVersion: session.assessmentVersion ?? null,
      evaluationBasis: session.assessmentId ? 'clinician-targets-with-assessment' : 'default-or-legacy-targets',
      avgScore,
      avgConsistency,
      exercises: exerciseEvaluations,
      allFlags: exerciseEvaluations.flatMap(e =>
        (e.clinicalFlags || []).map(f => ({ ...f, exercise: e.exName })),
      ),
      allTips: exerciseEvaluations.flatMap(e =>
        (e.patientTips || []).map(t => ({ tip: t, exercise: e.exName })),
      ),
    });
  }),
);

// POST /api/analytics/soap-note
// SOAP note is TEMPLATE-BASED. generateSoapNote() performs string interpolation only.
// No patient data is sent to any external service.
analyticsRouter.post(
  '/soap-note',
  asyncRoute(async (req, res) => {
    const { patient, session, plan } = validate(soapNoteSchema, req.body);

    const results = session.r || session.exerciseResults || [];
    const exerciseEvaluations = results.map(result => {
      const planItem = plan?.items?.find(it => it.ex === result.ex) || {};
      const targetDeg = result.targetExcursionDeg || planItem.targetExcursionDeg || 45;
      return {
        exName: result.ex,
        ...evaluateExerciseRepetitions(result.reps || [], {
          ex: result.ex,
          targetExcursionDeg: targetDeg,
        }),
      };
    });

    const validEvals = exerciseEvaluations.filter(e => e.scored);
    const avgScore = validEvals.length
      ? Math.round(validEvals.reduce((s, e) => s + e.overallScore, 0) / validEvals.length)
      : 80;

    const allFlags = exerciseEvaluations.flatMap(e =>
      (e.clinicalFlags || []).map(f => ({ ...f, exercise: e.exName })),
    );

    // generateSoapNote is pure template interpolation — no network, no AI, no PII egress.
    const soapResult = generateSoapNote(
      patient || {},
      session,
      { avgScore, exercises: exerciseEvaluations, allFlags },
    );

    res.json({ success: true, ...soapResult });
  }),
);
