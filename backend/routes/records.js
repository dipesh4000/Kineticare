import express from 'express';
import { atlasDb } from '../services/atlas.js';
import { canAccessPatient, requireIdentity } from '../services/identity.js';
import { bundledReferences } from '../services/bundledReferences.js';

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const validId = value => typeof value === 'string' && /^[\w:-]{1,128}$/.test(value);
const key = (patientId, kind, id) => `${patientId}:${kind}:${id}`;
const text = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 2000;

export function createRecordsRouter({ database = atlasDb, authorize = canAccessPatient, authenticate = requireIdentity } = {}) {
const recordsRouter = express.Router();
recordsRouter.use(authenticate);
recordsRouter.get('/workspace', async (req, res) => {
  const identity = req.identity;
  const db = await database();
  const ids = identity.role === 'patient' ? [identity.uid] : (await db.collection('relationships').find({ clinicianUid: identity.uid, active: true }).toArray()).map(link => link._id);
  const workspace = { schemaVersion: 1, patients: [], invites: [], assignments: {}, assignmentDrafts: {}, sessions: {}, feedback: {}, requests: {}, references: [] };
  const records = await db.collection('patientRecords').find({ patientId: { $in: ids } }).toArray();
  const profiles = await db.collection('users').find({ _id: { $in: ids } }).toArray();
  workspace.patients = profiles.map(profile => ({ id: profile._id, n: profile.displayName, email: profile.email, a: 'Patient' }));
  const link = identity.role === 'patient' ? await db.collection('relationships').findOne({ _id: identity.uid, active: true }) : null;
  if (link) {
    const clinician = await db.collection('users').findOne({ _id: link.clinicianUid });
    workspace.relationship = { clinicianUid: link.clinicianUid, clinicianName: clinician?.displayName, consentAt: link.consentAt };
  }
  for (const { patientId, kind, data } of records) {
    if (kind === 'assignments' && (identity.role === 'clinician' ? data.clinicianUid === identity.uid : data.clinicianUid === link?.clinicianUid)) {
      if (data.status === 'draft') workspace.assignmentDrafts[patientId] = data;
      else if (data.v > (workspace.assignments[patientId]?.v ?? 0)) workspace.assignments[patientId] = data;
    } else if (['sessions', 'feedback', 'requests'].includes(kind)) (workspace[kind][patientId] ??= []).push(data);
  }
  for (const id of ids) {
    workspace.sessions[id]?.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
    workspace.feedback[id]?.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    for (const session of workspace.sessions[id] ?? []) {
      const review = records.find(record => record.patientId === id && record.kind === 'reviews' && record.data.sessionId === session.sessionId);
      if (review) session.reviewStatus = review.data.status;
    }
    if ((workspace.assignmentDrafts[id]?.v ?? 0) <= (workspace.assignments[id]?.v ?? 0)) workspace.assignmentDrafts[id] = null;
  }
  workspace.references = bundledReferences;
  res.json(workspace);
});

recordsRouter.post('/:patientId/:operation', async (req, res) => {
  const { patientId, operation } = req.params;
  if (!validId(patientId)) fail('Invalid patient ID.');
  if (!await authorize(req.identity, patientId)) fail('Patient access denied.', 403);
  const clinicianOps = ['saveAssignmentDraft', 'publishAssignment', 'sendFeedback', 'markSessionReviewed', 'resolveRequest', 'replyToRequest'];
  const patientOps = ['saveSession', 'markFeedbackRead', 'createRequest'];
  if (!(req.identity.role === 'clinician' ? clinicianOps : patientOps).includes(operation)) fail('Operation denied.', 403);
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail('Expected a record object.');
  const collection = (await database()).collection('patientRecords');
  const now = new Date().toISOString();
  const put = (kind, id, data) => collection.updateOne({ _id: key(patientId, kind, id) }, { $setOnInsert: { patientId, kind, data } }, { upsert: true });
  if (operation === 'saveSession') {
    if (!validId(body.sessionId) || !Array.isArray(body.exerciseResults) || body.exerciseResults.length > 10 || body.schemaVersion !== 1 || !['live', 'replay'].includes(body.mode) || !['completed', 'partial'].includes(body.status)) fail('Invalid finalized session.');
    await put('sessions', body.sessionId, { ...body, patientUid: patientId, submittedAt: now });
  } else if (operation === 'saveAssignmentDraft' || operation === 'publishAssignment') {
    if (!validId(body.assignmentId) || !Number.isInteger(body.v) || body.v < 1 || !Array.isArray(body.items) || !body.items.length || body.items.length > 10) fail('Invalid assignment.');
    for (const item of body.items) {
      if (!['Squat', 'Side Arm Raise', 'Toe Touch'].includes(item.ex) || !Number.isInteger(item.targetReps) || item.targetReps < 1 || item.targetReps > 100 || !Number.isFinite(item.targetExcursionDeg) || item.targetExcursionDeg <= 0 || item.targetExcursionDeg > 180) fail('Unsupported exercise or invalid targets.');
      if (operation === 'publishAssignment') {
        if (!validId(item.referenceId) || !validId(item.referenceVersionId)) fail('Approved reference required.');
        const path = `references/${item.referenceId}/versions/${item.referenceVersionId}`;
        if (item.referencePath !== path) fail('Invalid reference path.');
        const reference = bundledReferences.find(entry => entry.versionId === item.referenceVersionId && entry.referenceId === item.referenceId);
        if (!reference || reference.exerciseName !== item.ex) fail('Bundled reference is unavailable for this exercise.', 403);
      }
    }
    const data = { ...body, by: req.identity.displayName, patientUid: patientId, clinicianUid: req.identity.uid, status: operation === 'publishAssignment' ? 'published' : 'draft', createdAt: now };
    if (operation === 'publishAssignment') {
      await put('assignments', `${body.assignmentId}-v${body.v}`, data);
    } else await collection.updateOne({ _id: key(patientId, 'assignments', 'draft-current') }, { $set: { patientId, kind: 'assignments', data } }, { upsert: true });
  } else if (operation === 'createRequest') {
    if (!validId(body.requestId) || !['help', 'question', 'contact'].includes(body.kind) || !text(body.message)) fail('Invalid request.');
    await put('requests', body.requestId, { ...body, patientUid: patientId, creatorId: req.identity.uid, createdAt: now, status: 'open', replies: [] });
  } else if (operation === 'sendFeedback') {
    if (!validId(body.id) || !text(body.m ?? body.message) || !validId(body.sessionId)) fail('Invalid session feedback.');
    if (!await collection.findOne({ _id: key(patientId, 'sessions', body.sessionId) })) fail('Session not found.', 404);
    await put('feedback', body.id, { ...body, from: req.identity.displayName, patientUid: patientId, clinicianUid: req.identity.uid, createdAt: now, read: false });
  } else if (operation === 'markFeedbackRead') {
    await collection.updateMany({ patientId, kind: 'feedback' }, { $set: { 'data.read': true, 'data.readAt': now } });
  } else if (operation === 'markSessionReviewed') {
    if (!validId(body.sessionId)) fail('Invalid session ID.');
    if (!await collection.findOne({ _id: key(patientId, 'sessions', body.sessionId) })) fail('Session not found.', 404);
    await collection.updateOne({ _id: key(patientId, 'reviews', body.sessionId) }, { $set: { patientId, kind: 'reviews', data: { sessionId: body.sessionId, status: 'reviewed', clinicianUid: req.identity.uid, reviewedAt: now } } }, { upsert: true });
  } else {
    if (!validId(body.requestId) || operation === 'replyToRequest' && !text(body.reply?.message ?? body.reply?.m)) fail('Invalid request update.');
    const update = { $set: { 'data.status': 'closed', 'data.updatedAt': now } };
    if (operation === 'replyToRequest') update.$push = { 'data.replies': { ...body.reply, senderId: req.identity.uid, senderName: req.identity.displayName, creatorId: req.identity.uid, createdAt: now } };
    const result = await collection.updateOne({ _id: key(patientId, 'requests', body.requestId) }, update);
    if (!result.matchedCount) fail('Request not found.', 404);
  }
  res.json({ success: true });
});
return recordsRouter;
}

export const recordsRouter = createRecordsRouter();
