import express from 'express';
import { getAllExercises, getExerciseById } from '../services/exerciseRegistry.js';

export const exercisesRouter = express.Router();

// GET /api/exercises: List all exercises with normative rehab guidelines
exercisesRouter.get('/', (req, res) => {
  const list = getAllExercises();
  res.json({
    count: list.length,
    exercises: list,
  });
});

// GET /api/exercises/:id: Detailed protocol information
exercisesRouter.get('/:id', (req, res) => {
  const exercise = getExerciseById(req.params.id);
  if (!exercise) {
    return res.status(404).json({ error: `Exercise '${req.params.id}' not found` });
  }
  res.json(exercise);
});

// POST /api/exercises: Add new exercise or push protocol updates (Developer / Clinician feature)
exercisesRouter.post('/', (req, res) => {
  res.status(405).json({ error: 'The bundled catalog is read-only. Use AI drafts for review.' });
});
