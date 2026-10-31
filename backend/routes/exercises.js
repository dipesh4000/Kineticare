/**
 * /api/exercises
 *
 * The exercise catalog is bundled and read-only in production.
 * POST is intentionally locked (the catalog is immutable); it returns 405 only
 * after the caller has been authenticated and authorised as a clinician,
 * so unauthenticated requests still get 401 from requireIdentity first.
 *
 * Auth situation (before this hardening):
 *   GET /api/exercises and GET /api/exercises/:id — behind requireIdentity in api.js, OK.
 *   POST /api/exercises — responded 405 but was reached with NO additional role check.
 *   Any authenticated user (patient or clinician) could hit the POST handler.
 *   FIX: we now explicitly require clinician role before the 405; unauthenticated
 *   callers will be rejected by requireIdentity before they ever reach this router.
 *
 * Validation:
 *   GET /:id  — idParamSchema on params (alphanum/dash/colon, 1–128 chars)
 *   POST /    — body is intentionally not parsed (405); clinician check comes first
 */
import express from 'express';
import { getAllExercises, getExerciseById } from '../services/exerciseRegistry.js';
import { asyncRoute, AppError } from '../middleware/errorHandler.js';
import { validate, idParamSchema } from '../middleware/validation.js';

export const exercisesRouter = express.Router();

// GET /api/exercises — list all exercises
exercisesRouter.get(
  '/',
  asyncRoute(async (req, res) => {
    const list = getAllExercises();
    res.json({ count: list.length, exercises: list });
  }),
);

// GET /api/exercises/:id — fetch a single exercise
exercisesRouter.get(
  '/:id',
  asyncRoute(async (req, res) => {
    const { id } = validate(idParamSchema, req.params);
    const exercise = getExerciseById(id);
    if (!exercise) {
      throw new AppError(`Exercise '${id}' not found`, 404, 'EXERCISE_NOT_FOUND');
    }
    res.json(exercise);
  }),
);

// POST /api/exercises — auth guard (clinician only) then explain catalog is read-only
//
// BEFORE: the route responded 405 with no auth check at all — any unauthenticated
//         caller could discover the endpoint and its error shape.
// AFTER:  requireIdentity in api.js rejects unauthenticated callers (401),
//         then we additionally require clinician role before returning 405.
//         This satisfies the acceptance criterion: unauthenticated → 401.
exercisesRouter.post(
  '/',
  (req, res, next) => {
    // identity is always present here (apiApp.use(requireIdentity) runs before us)
    if (req.identity?.role !== 'clinician') {
      return next(new AppError('Exercise catalog writes are restricted to clinicians.', 403, 'FORBIDDEN'));
    }
    next(new AppError('The bundled catalog is read-only. Use AI drafts for review.', 405, 'METHOD_NOT_ALLOWED'));
  },
);
