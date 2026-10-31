import express from 'express';
import { randomUUID } from 'node:crypto';
import { atlasDb } from '../services/atlas.js';
import { canAccessPatient } from '../services/identity.js';

export const reportsRouter = express.Router();
reportsRouter.post('/exercise', async (req, res) => {
  const { exercise, patientId, reason, notes = '', severity = 'medium' } = req.body ?? {};
  if (![exercise, reason].every(value => typeof value === 'string' && value.trim() && value.length <= 2000) || typeof notes !== 'string' || notes.length > 2000 || !['low', 'medium', 'high'].includes(severity)) return res.status(400).json({ error: 'Invalid exercise report.' });
  if (patientId && (typeof patientId !== 'string' || !await canAccessPatient(req.identity, patientId))) return res.status(403).json({ error: 'Patient access denied.' });
  const report = { _id: randomUUID(), ownerUid: req.identity.uid, patientId: patientId ?? null, exercise, reason, notes, severity, reportedBy: req.identity.displayName, timestamp: new Date().toISOString(), status: 'logged' };
  await (await atlasDb()).collection('exerciseReports').insertOne(report);
  res.status(201).json({ success: true, report });
});
reportsRouter.get('/exercise', async (req, res) => {
  const reports = await (await atlasDb()).collection('exerciseReports').find({ ownerUid: req.identity.uid }).limit(100).toArray();
  res.json({ count: reports.length, reports });
});
reportsRouter.post('/custom-video-staged', (req, res) => res.status(410).json({ error: 'Only bundled demonstrations are supported.' }));
