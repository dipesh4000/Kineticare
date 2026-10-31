/**
 * /api/reports
 *
 * Exercise issue reporting (clinicians and patients alike, per identity).
 * Auth: behind requireIdentity in api.js.
 * Validation: exerciseReportSchema via Zod — unknown fields rejected.
 */
import express from 'express';
import { randomUUID } from 'node:crypto';
import { atlasDb } from '../services/atlas.js';
import { canAccessPatient } from '../services/identity.js';
import { asyncRoute, AppError } from '../middleware/errorHandler.js';
import { validate, exerciseReportSchema } from '../middleware/validation.js';

export const reportsRouter = express.Router();

reportsRouter.post(
  '/exercise',
  asyncRoute(async (req, res) => {
    const { exercise, reason, patientId, notes, severity } = validate(exerciseReportSchema, req.body);

    if (patientId && !await canAccessPatient(req.identity, patientId)) {
      throw new AppError('Patient access denied.', 403, 'PATIENT_ACCESS_DENIED');
    }

    const report = {
      _id: randomUUID(),
      ownerUid: req.identity.uid,
      patientId: patientId ?? null,
      exercise,
      reason,
      notes,
      severity,
      reportedBy: req.identity.displayName,
      timestamp: new Date().toISOString(),
      status: 'logged',
    };

    await (await atlasDb()).collection('exerciseReports').insertOne(report);
    res.status(201).json({ success: true, report });
  }),
);

reportsRouter.get(
  '/exercise',
  asyncRoute(async (req, res) => {
    const reports = await (await atlasDb())
      .collection('exerciseReports')
      .find({ ownerUid: req.identity.uid })
      .limit(100)
      .toArray();
    res.json({ count: reports.length, reports });
  }),
);
