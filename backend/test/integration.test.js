import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { apiApp } from '../routes/api.js';
import { createRecordsRouter } from '../routes/records.js';
import { validateExerciseDraft } from '../routes/ai.js';
import { canAccessPatient } from '../services/identity.js';
import { createAuthRouter } from '../routes/auth.js';

async function serve(app, run) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

test('connected routes reject unauthenticated access before database or provider calls', async () => {
  await serve(apiApp, async base => {
    for (const path of ['/auth/me', '/records/workspace', '/ai/drafts']) assert.equal((await fetch(base + path)).status, 401);
  });
});

test('signup roles stay immutable; consent links records and revocation removes clinician access', async () => {
  const tables = new Map();
  const matches = (row, filter) => Object.entries(filter).every(([key, value]) => value && typeof value === 'object' && !(value instanceof Date) ? ('$gt' in value ? row[key] > value.$gt : '$ne' in value ? row[key] !== value.$ne : value.$in.includes(row[key])) : row[key] === value);
  const db = { collection(name) {
    if (!tables.has(name)) tables.set(name, new Map());
    const rows = tables.get(name);
    return {
      async findOne(filter) { return [...rows.values()].find(row => matches(row, filter)) ?? null; },
      find(filter) { return { toArray: async () => [...rows.values()].filter(row => matches(row, filter)).map(row => structuredClone(row)) }; },
      async insertOne(data) { if (rows.has(data._id)) throw Object.assign(new Error('Duplicate'), { code: 11000 }); rows.set(data._id, structuredClone(data)); },
      async updateOne(filter, update, options = {}) {
        const row = [...rows.values()].find(row => matches(row, filter));
        if (row) { Object.assign(row, update.$set ?? {}); return { matchedCount: 1 }; }
        if (options.upsert) {
          if (rows.has(filter._id)) throw Object.assign(new Error('Duplicate'), { code: 11000 });
          rows.set(filter._id, { _id: filter._id, ...structuredClone(update.$setOnInsert ?? update.$set) });
        }
        return { matchedCount: 0 };
      },
    };
  } };
  const database = async () => db;
  const authenticate = (req, res, next) => { req.privyId = req.headers['x-test-user']; next(); };
  const profile = async (req, res, next) => { const user = await db.collection('users').findOne({ _id: req.privyId }); req.identity = { ...user, uid: user._id }; next(); };
  const app = express();
  app.use(express.json());
  app.use('/auth', createAuthRouter({ database, authenticate, authenticatedProfile: profile, getUser: async id => ({ linked_accounts: [{ type: 'email', address: id + '@example.test' }] }) }));
  app.use('/records', createRecordsRouter({ database, authenticate: [authenticate, profile], authorize: (identity, id) => canAccessPatient(identity, id, database) }));
  app.use((error, req, res, next) => res.status(error.status || 500).json({ error: error.message }));
  await serve(app, async base => {
    const call = (user, path, body) => fetch(base + path, { method: body ? 'POST' : 'GET', headers: { 'x-test-user': user, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    assert.equal((await call('did:privy:p1', '/auth/register', { displayName: 'Patient', role: 'admin' })).status, 400);
    await call('did:privy:p1', '/auth/register', { displayName: 'Patient', role: 'patient', email: 'spoof@example.test' });
    assert.equal((await db.collection('users').findOne({ _id: 'did:privy:p1' })).email, 'did:privy:p1@example.test');
    await call('did:privy:c1', '/auth/register', { displayName: 'Clinician', role: 'clinician' });
    await call('did:privy:p1', '/auth/register', { displayName: 'Changed', role: 'clinician' });
    assert.equal((await db.collection('users').findOne({ _id: 'did:privy:p1' })).role, 'patient');
    assert.equal((await call('did:privy:p1', '/auth/invite-code', {})).status, 403);
    const { code } = await (await call('did:privy:c1', '/auth/invite-code', {})).json();
    assert.equal((await call('did:privy:p1', '/auth/link', { code: 'bad' })).status, 400);
    assert.equal((await call('did:privy:p1', '/auth/link', { code: 'x'.repeat(32) })).status, 404);
    const preview = await (await call('did:privy:p1', '/auth/link', { code })).json();
    assert.equal(preview.clinician.professionalVerified, false);
    assert.equal(await canAccessPatient({ uid: 'did:privy:c1', role: 'clinician' }, 'did:privy:p1', database), false);
    assert.equal((await call('did:privy:p1', '/auth/link', { code, consent: true, clinicianUid: 'wrong' })).status, 409);
    assert.equal((await call('did:privy:p1', '/auth/link', { code, consent: true, clinicianUid: preview.clinician.uid })).status, 200);
    assert.equal(await canAccessPatient({ uid: 'did:privy:c1', role: 'clinician' }, 'did:privy:p1', database), true);
    assert.equal((await (await call('did:privy:c1', '/records/workspace')).json()).patients.length, 1);
    assert.equal((await call('did:privy:c1', '/auth/revoke', {})).status, 403);
    await call('did:privy:p1', '/auth/revoke', {});
    assert.equal(await canAccessPatient({ uid: 'did:privy:c1', role: 'clinician' }, 'did:privy:p1', database), false);
    assert.equal((await (await call('did:privy:c1', '/records/workspace')).json()).patients.length, 0);
    assert.equal((await call('did:privy:c1', '/records/did%3Aprivy%3Ap1/markSessionReviewed', { sessionId: 'S-1' })).status, 403);
    assert.equal((await call('did:privy:p1', '/records/workspace')).status, 200);
    for (const invite of tables.get('careInvites').values()) invite.expiresAt = new Date(0);
    assert.equal((await call('did:privy:p1', '/auth/link', { code })).status, 404);
  });
});

test('Gemini response validation rejects incomplete content and strips unexpected fields', () => {
  for (const draft of [null, {}, { name: 'Example', description: 'Example', steps: [], precautions: [] }]) assert.throws(() => validateExerciseDraft(draft));
  const result = validateExerciseDraft({ name: 'Example', description: 'Education draft', steps: ['A step'], precautions: ['Needs clinical review'], status: 'approved', capability: 'camera-measured' });
  assert.equal(result.status, undefined);
  assert.equal(result.capability, undefined);
});

test('patient identity never grants access to another patient', async () => {
  assert.equal(await canAccessPatient({ uid: 'P-A', role: 'patient' }, 'P-A'), true);
  assert.equal(await canAccessPatient({ uid: 'P-A', role: 'patient' }, 'P-B'), false);
});

test('Atlas record route enforces ownership, operation roles, validation and immutable sessions', async () => {
  const rows = new Map();
  const collection = {
    async updateOne(filter, update) {
      if (!rows.has(filter._id)) rows.set(filter._id, structuredClone(update.$setOnInsert));
      return { upsertedCount: 1 };
    },
  };
  const app = express();
  app.use(express.json());
  app.use(createRecordsRouter({
    database: async () => ({ collection: () => collection }),
    authenticate(req, res, next) { req.identity = { uid: 'P-A', role: 'patient' }; next(); },
  }));
  app.use((error, req, res, next) => res.status(error.status || 500).json({ error: error.message }));
  await serve(app, async base => {
    const post = (path, body) => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const session = { sessionId: 'S-1', schemaVersion: 1, mode: 'live', status: 'completed', exerciseResults: [{ assessedReps: 5 }] };
    assert.equal((await post('/P-B/saveSession', session)).status, 403);
    assert.equal((await post('/P-A/publishAssignment', {})).status, 403);
    assert.equal((await post('/P-A/saveSession', {})).status, 400);
    assert.equal((await post('/P-A/saveSession', session)).status, 200);
    assert.equal((await post('/P-A/saveSession', { ...session, exerciseResults: [{ assessedReps: 999 }] })).status, 200);
    assert.equal(rows.get('P-A:sessions:S-1').data.exerciseResults[0].assessedReps, 5);
    assert.equal(rows.get('P-A:sessions:S-1').data.patientUid, 'P-A');
  });
});
