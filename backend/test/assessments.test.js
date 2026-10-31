import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { validateAssessment } from '../services/assessments.js';
import { createRecordsRouter } from '../routes/records.js';
import { bundledReferences } from '../services/bundledReferences.js';
import { analyticsRouter } from '../routes/analytics.js';
import { assessmentIsStale } from '../../shared/assessmentFields.js';

const assessment = { assessmentId: 'asm-1', version: 1, assessedAt: '2026-01-01', anthropometrics: { heightCm: 172, weightKg: 78 }, rom: { shoulderAbduction: { right: 142 } } };
test('assessment validates enums, partial data, numeric limits and server-derived BMI', () => {
  assert.equal(validateAssessment(assessment).anthropometrics.bmi, 26.4);
  assert.equal(validateAssessment(assessment).rom.shoulderAbduction.left, undefined);
  assert.equal(assessmentIsStale(assessment, new Date('2026-03-01').getTime()), true);
  assert.equal(assessmentIsStale(assessment, new Date('2026-01-02').getTime()), false);
  for (const change of [
    { posture: { forwardHead: 'anything' } }, { rom: { kneeFlexion: { left: 181 } } },
    { strength: { quadriceps: { right: 4.5 } } }, { painAreas: [{ site: 'lower_back', nrs: 11 }] },
    { restrictions: ['invented_restriction'] }, { version: 0 }, { assessedAt: '2999-01-01' },
    { anthropometrics: { bmi: 22 } }, { clinicianUid: 'spoofed' },
  ]) assert.throws(() => validateAssessment({ ...assessment, ...change }), { status: 400 });
});

test('assessment versions are immutable, authorized and preserved through assignments and sessions', async () => {
  const rows = new Map();
  const matches = (row, filter) => Object.entries(filter).every(([key, value]) => value && typeof value === 'object' ? value.$in.includes(row[key]) : row[key] === value);
  const collection = {
    findOne: async filter => [...rows.values()].find(row => matches(row, filter)),
    find: filter => ({ toArray: async () => [...rows.values()].filter(row => matches(row, filter)).map(row => structuredClone(row)) }),
    insertOne: async row => {
      if (rows.has(row._id)) throw Object.assign(new Error('Duplicate'), { code: 11000 });
      rows.set(row._id, structuredClone(row));
    },
    updateOne: async (filter, update) => { if (!rows.has(filter._id)) rows.set(filter._id, { ...filter, ...structuredClone(update.$setOnInsert ?? update.$set) }); },
  };
  const app = express();
  app.use(express.json());
  app.use('/analytics', analyticsRouter);
  app.use(createRecordsRouter({ database: async () => ({ collection: () => collection }),
    authenticate(req, res, next) { req.identity = { uid: req.headers['x-user'] || 'doctor', role: req.headers['x-role'] || 'clinician', displayName: 'Doctor' }; next(); },
    authorize: async (identity, patientId) => patientId === 'patient' && (identity.uid === 'doctor' || identity.uid === 'patient'),
  }));
  app.use((error, req, res, next) => res.status(error.status || 500).json({ message: error.message }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (operation, body, headers = {}, patientId = 'patient') => fetch(`${base}/${patientId}/${operation}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  try {
    assert.equal((await post('publishAssessment', assessment, { 'x-role': 'patient', 'x-user': 'patient' })).status, 403);
    assert.equal((await post('publishAssessment', assessment, {}, 'other-patient')).status, 403);
    assert.equal((await post('publishAssessment', { ...assessment, version: 2 })).status, 403);
    assert.equal((await post('publishAssessment', assessment)).status, 200);
    assert.equal((await post('publishAssessment', { ...assessment, notes: 'overwrite' })).status, 409);
    const reference = bundledReferences.find(item => item.exerciseName === 'Squat');
    const plan = { assignmentId: 'plan', v: 1, assessmentId: 'asm-1', assessmentVersion: 1, items: [{ ex: 'Squat', targetReps: 5, targetExcursionDeg: 45, referenceId: reference.referenceId, referenceVersionId: reference.versionId, referencePath: `references/${reference.referenceId}/versions/${reference.versionId}` }] };
    assert.equal((await post('publishAssignment', { ...plan, assessmentId: 'missing' })).status, 403);
    assert.equal((await post('publishAssignment', { ...plan, assessmentId: null, assessmentVersion: null })).status, 400);
    assert.equal((await post('publishAssignment', plan)).status, 200);
    assert.equal((await post('publishAssessment', { ...assessment, version: 2, rom: { shoulderAbduction: { right: 150 } } })).status, 200);
    assert.equal(rows.get('patient:assessments:asm-1-v2').data.supersedes, 'asm-1-v1');
    const session = { sessionId: 'session', schemaVersion: 1, mode: 'live', status: 'completed', exerciseResults: [], assignmentId: 'plan', assignmentVersion: 1, assessmentId: 'asm-1', assessmentVersion: 1 };
    const patientHeaders = { 'x-role': 'patient', 'x-user': 'patient' };
    assert.equal((await post('saveSession', { ...session, assessmentVersion: 2 }, patientHeaders)).status, 400);
    assert.equal((await post('saveSession', session, patientHeaders)).status, 200);
    assert.equal(rows.get('patient:sessions:session').data.assessmentVersion, 1);
    assert.equal(rows.get('patient:assignments:plan-v1').data.assessmentVersion, 1);
    assert.equal(rows.get('patient:assessments:asm-1-v1').data.rom.shoulderAbduction.right, 142);
    assert.equal((await post('publishAssessment', { ...assessment, version: 3 }, { 'x-user': 'other-doctor' })).status, 403);
    rows.set('patient', { _id: 'patient', clinicianUid: 'doctor', active: true, displayName: 'Patient', email: 'patient@example.test' });
    const workspace = await (await fetch(base + '/workspace', { headers: patientHeaders })).json();
    assert.equal(workspace.assessments.patient.length, 2);
    assert.equal(workspace.sessions.patient[0].assessmentVersion, 1);
    const evaluated = await (await fetch(base + '/analytics/evaluate-session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session: { assessmentId: 'asm-1', assessmentVersion: 1, r: [{ ex: 'Squat', targetExcursionDeg: 45, reps: [{ peak: 1, durationMs: 3000 }] }] }, plan: { items: [{ ex: 'Squat', targetExcursionDeg: 80 }] } }) })).json();
    assert.equal(evaluated.assessmentVersion, 1);
    assert.equal(evaluated.exercises[0].reps[0].targetDeg, 45);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
