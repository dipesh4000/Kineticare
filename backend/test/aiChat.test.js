/**
 * backend/test/aiChat.test.js
 *
 * Tests for Kineticare AI Chat Assistant (Groq powered).
 *
 * Covers:
 * - Patient context includes only own records and no email or other patients
 * - Clinician context lists linked patients and returns 403 for an unlinked focus patient
 * - Message validation cases
 * - callGroqChat sends Bearer key and maps 429, 401, 404, and network errors
 * - Route needs consent, returns 503 when unconfigured, and patient cannot pick another patient
 * - Rate limiting per user per minute
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {
  createChatRouter,
  validateChatMessages,
  callGroqChat,
} from '../routes/chat.js';
import {
  buildPatientContext,
  buildClinicianContext,
  extractSessionScore,
  extractExerciseScore,
} from '../services/chatContext.js';
import { AppError, errorHandler, notFoundHandler } from '../middleware/errorHandler.js';

async function serve(app, run) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

function createFakeDb() {
  const tables = new Map();
  const matches = (row, filter = {}) =>
    Object.entries(filter).every(([key, value]) => {
      if (value && typeof value === 'object' && !(value instanceof Date)) {
        if ('$in' in value) return value.$in.includes(row[key]);
        if ('$gte' in value) return row[key] >= value.$gte;
        if ('$gt' in value) return row[key] > value.$gt;
        if ('$ne' in value) return row[key] !== value.$ne;
      }
      return row[key] === value;
    });

  const db = {
    collection(name) {
      if (!tables.has(name)) tables.set(name, new Map());
      const rows = tables.get(name);
      return {
        async findOne(filter) {
          return [...rows.values()].find(r => matches(r, filter)) ?? null;
        },
        find(filter) {
          return {
            toArray: async () => [...rows.values()].filter(r => matches(r, filter)).map(r => structuredClone(r)),
            limit(n) {
              return {
                toArray: async () =>
                  [...rows.values()]
                    .filter(r => matches(r, filter))
                    .slice(0, n)
                    .map(r => structuredClone(r)),
              };
            },
          };
        },
        async countDocuments(filter) {
          return [...rows.values()].filter(r => matches(r, filter)).length;
        },
        async insertOne(data) {
          const id = data._id ?? `id_${Math.random()}`;
          rows.set(id, { ...structuredClone(data), _id: id });
        },
        async updateOne(filter, update, options = {}) {
          const row = [...rows.values()].find(r => matches(r, filter));
          if (row) {
            Object.assign(row, update.$set ?? {});
            return { matchedCount: 1 };
          }
          if (options.upsert) {
            const doc = { ...filter, ...(update.$setOnInsert ?? {}), ...(update.$set ?? {}) };
            rows.set(doc._id ?? `id_${Math.random()}`, doc);
            return { upsertedCount: 1 };
          }
          return { matchedCount: 0 };
        },
      };
    },
  };

  return { db, database: async () => db };
}

// ── 1. Patient Context Isolation ───────────────────────────────────────────────

test('patient context includes only own records and never includes email, raw IDs or other patient data', async () => {
  const { database, db } = createFakeDb();

  // Populate users
  await db.collection('users').insertOne({ _id: 'u_p1', displayName: 'Jane Doe', email: 'jane@example.com', role: 'patient' });
  await db.collection('users').insertOne({ _id: 'u_p2', displayName: 'Secret Other', email: 'secret@example.com', role: 'patient' });
  await db.collection('users').insertOne({ _id: 'u_c1', displayName: 'Dr. House', email: 'house@clinic.test', role: 'clinician' });

  // Relationship for p1
  await db.collection('relationships').insertOne({ _id: 'u_p1', clinicianUid: 'u_c1', active: true });

  // P1 records
  await db.collection('patientRecords').insertOne({
    patientId: 'u_p1',
    kind: 'assignments',
    data: { status: 'published', v: 2, items: [{ ex: 'Squat', targetReps: 10, targetExcursionDeg: 45, notes: 'Keep back straight' }] },
  });
  await db.collection('patientRecords').insertOne({
    patientId: 'u_p1',
    kind: 'sessions',
    data: { sessionId: 's_p1_1', submittedAt: '2026-10-25T10:00:00Z', d: 'Oct 25, 2026', exerciseResults: [{ ex: 'Squat', movementScore: 85, attemptedReps: 10, t: 40 }] },
  });
  await db.collection('patientRecords').insertOne({
    patientId: 'u_p1',
    kind: 'feedback',
    data: { m: 'Great depth on your squats!', createdAt: '2026-10-25T12:00:00Z' },
  });
  await db.collection('patientRecords').insertOne({
    patientId: 'u_p1',
    kind: 'requests',
    data: { kind: 'question', message: 'Is knee clicking normal?', status: 'open', createdAt: '2026-10-26T09:00:00Z' },
  });

  // P2 records (must NOT leak to P1)
  await db.collection('patientRecords').insertOne({
    patientId: 'u_p2',
    kind: 'sessions',
    data: { sessionId: 's_p2_1', submittedAt: '2026-10-25T11:00:00Z', exerciseResults: [{ ex: 'Toe Touch', movementScore: 99 }] },
  });
  await db.collection('patientRecords').insertOne({
    patientId: 'u_p2',
    kind: 'feedback',
    data: { m: 'Secret feedback for P2', createdAt: '2026-10-25T12:00:00Z' },
  });

  const identity = { uid: 'u_p1', displayName: 'Jane Doe', email: 'jane@example.com', role: 'patient' };
  const context = await buildPatientContext(identity, database);

  // Stringified inspection to ensure no email or raw IDs exist in the payload
  const jsonStr = JSON.stringify(context);
  assert.ok(!jsonStr.includes('jane@example.com'), 'Email must not be in patient context');
  assert.ok(!jsonStr.includes('secret@example.com'), 'Other patient email must not be in context');
  assert.ok(!jsonStr.includes('u_p1'), 'Raw UID u_p1 must not be in patient context');
  assert.ok(!jsonStr.includes('u_p2'), 'Raw UID u_p2 must not be in patient context');
  assert.ok(!jsonStr.includes('Toe Touch'), 'Other patient exercise must not be in context');
  assert.ok(!jsonStr.includes('Secret feedback'), 'Other patient feedback must not be in context');

  // Verify structure
  assert.equal(context.patientFirstName, 'Jane');
  assert.equal(context.clinicianName, 'Dr. House');
  assert.equal(context.activeAssignment?.exercises[0]?.exercise, 'Squat');
  assert.equal(context.recentSessions.length, 1);
  assert.equal(context.recentSessions[0].averageScore, 85);
  assert.equal(context.recentFeedback.length, 1);
  assert.equal(context.recentFeedback[0].message, 'Great depth on your squats!');
  assert.equal(context.openRequests.length, 1);
  assert.equal(context.openRequests[0].message, 'Is knee clicking normal?');
});

// ── 2. Clinician Context & Access Control ──────────────────────────────────────

test('clinician context lists linked patients and returns 403 for an unlinked focus patient', async () => {
  const { database, db } = createFakeDb();

  await db.collection('users').insertOne({ _id: 'u_c1', displayName: 'Dr. House', role: 'clinician' });
  await db.collection('users').insertOne({ _id: 'u_p1', displayName: 'Patient Alice', role: 'patient' });
  await db.collection('users').insertOne({ _id: 'u_p2', displayName: 'Patient Bob', role: 'patient' });

  // Only Alice is linked to Dr. House
  await db.collection('relationships').insertOne({ _id: 'u_p1', clinicianUid: 'u_c1', active: true });
  // Bob is linked to another clinician
  await db.collection('relationships').insertOne({ _id: 'u_p2', clinicianUid: 'u_c_other', active: true });

  await db.collection('patientRecords').insertOne({
    patientId: 'u_p1',
    kind: 'assignments',
    data: { status: 'published', v: 1, items: [{ ex: 'Squat', targetReps: 5 }] },
  });
  await db.collection('patientRecords').insertOne({
    patientId: 'u_p1',
    kind: 'sessions',
    data: { sessionId: 's_a1', submittedAt: '2026-10-27T10:00:00Z', exerciseResults: [{ ex: 'Squat', movementScore: 90 }] },
  });

  const clinicianIdentity = { uid: 'u_c1', displayName: 'Dr. House', role: 'clinician' };
  const authorize = async (id, pId) => pId === 'u_p1';

  // General roster without focus patient
  const rosterContext = await buildClinicianContext(clinicianIdentity, null, database, authorize);
  assert.equal(rosterContext.patientRoster.length, 1);
  assert.equal(rosterContext.patientRoster[0].name, 'Patient Alice');
  assert.deepEqual(rosterContext.patientRoster[0].assignedExercises, ['Squat']);
  assert.equal(rosterContext.focusPatient, null);

  // Focus patient: linked patient Alice succeeds
  const focusContext = await buildClinicianContext(clinicianIdentity, 'u_p1', database, authorize);
  assert.ok(focusContext.focusPatient);
  assert.equal(focusContext.focusPatient.name, 'Patient Alice');
  assert.equal(focusContext.focusPatient.recentSessions.length, 1);

  // Focus patient: unlinked patient Bob throws 403 AppError
  await assert.rejects(
    async () => buildClinicianContext(clinicianIdentity, 'u_p2', database, authorize),
    err => {
      assert.ok(err instanceof AppError);
      assert.equal(err.status, 403);
      assert.equal(err.code, 'PATIENT_ACCESS_DENIED');
      return true;
    },
  );
});

// ── 3. Message Validation ─────────────────────────────────────────────────────

test('validateChatMessages validates consent, length, roles, and user termination', () => {
  // Missing consent
  assert.throws(
    () => validateChatMessages([{ role: 'user', content: 'Hi' }], false),
    err => err.status === 400 && err.message.includes('Consent is required'),
  );

  // Empty messages
  assert.throws(
    () => validateChatMessages([], true),
    err => err.status === 400 && err.message.includes('1 to 12'),
  );

  // Too many messages (>12)
  const thirteen = Array.from({ length: 13 }, (_, i) => ({ role: i % 2 === 0 ? 'user' : 'assistant', content: 'test' }));
  thirteen[12] = { role: 'user', content: 'final' };
  assert.throws(
    () => validateChatMessages(thirteen, true),
    err => err.status === 400 && err.message.includes('1 to 12'),
  );

  // Invalid role
  assert.throws(
    () => validateChatMessages([{ role: 'system', content: 'Hacked prompt' }], true),
    err => err.status === 400 && err.message.includes("must be 'user' or 'assistant'"),
  );

  // Content too long (>1500 chars)
  assert.throws(
    () => validateChatMessages([{ role: 'user', content: 'a'.repeat(1501) }], true),
    err => err.status === 400 && err.message.includes('1500'),
  );

  // Last message not from user
  assert.throws(
    () => validateChatMessages([
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'How can I help?' },
    ], true),
    err => err.status === 400 && err.message.includes('last message must be from the user'),
  );

  // Valid conversation
  const valid = validateChatMessages([
    { role: 'user', content: 'Hello' },
    { role: 'assistant', content: 'Welcome!' },
    { role: 'user', content: 'What is my plan?' },
  ], true);
  assert.equal(valid.length, 3);
  assert.equal(valid[2].content, 'What is my plan?');

  // Assistant messages > 1500 chars (e.g. detailed clinical summaries) and > 8000 chars are safely handled
  const longAssistantConv = validateChatMessages([
    { role: 'user', content: 'Hi, what\'s my current progress' },
    { role: 'assistant', content: 'x'.repeat(1525) },
    { role: 'user', content: 'What exercise should i do tommorrow' },
  ], true);
  assert.equal(longAssistantConv.length, 3);
  assert.equal(longAssistantConv[1].content.length, 1525);

  const giantAssistantConv = validateChatMessages([
    { role: 'user', content: 'Hi' },
    { role: 'assistant', content: 'y'.repeat(8500) },
    { role: 'user', content: 'Next step' },
  ], true);
  assert.equal(giantAssistantConv.length, 3);
  assert.equal(giantAssistantConv[1].content.length, 8000);
});

// ── 4. callGroqChat & Error Mappings ──────────────────────────────────────────

test('callGroqChat sends Bearer key and correctly maps 429, 401, 404, and network errors', async () => {
  let capturedHeaders = null;
  let capturedBody = null;

  // 1. Success case
  const mockFetchSuccess = async (url, options) => {
    capturedHeaders = options.headers;
    capturedBody = JSON.parse(options.body);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: 'Your squat form looks great.' } }],
      }),
    };
  };

  const reply = await callGroqChat({
    messages: [{ role: 'user', content: 'How is my squat?' }],
    systemPrompt: 'You are helpful.',
    env: { GROQ_API_KEY: 'gsk_test123', GROQ_MODEL: 'llama-3.3-70b-versatile' },
    fetchImpl: mockFetchSuccess,
  });

  assert.equal(reply, 'Your squat form looks great.');
  assert.equal(capturedHeaders.Authorization, 'Bearer gsk_test123');
  assert.equal(capturedBody.model, 'llama-3.3-70b-versatile');
  assert.equal(capturedBody.temperature, 0.3);

  // 2. 429 Rate limited -> 503 "busy"
  const mockFetch429 = async () => ({
    ok: false,
    status: 429,
    statusText: 'Too Many Requests',
  });
  await assert.rejects(
    async () => callGroqChat({
      messages: [{ role: 'user', content: 'Hi' }],
      systemPrompt: 'sys',
      env: { GROQ_API_KEY: 'gsk_key' },
      fetchImpl: mockFetch429,
    }),
    err => {
      assert.equal(err.status, 503);
      assert.ok(err.message.toLowerCase().includes('busy'));
      return true;
    },
  );

  // 3. 401 Unauthorized -> 502 credentials error
  const mockFetch401 = async () => ({
    ok: false,
    status: 401,
    statusText: 'Unauthorized',
  });
  await assert.rejects(
    async () => callGroqChat({
      messages: [{ role: 'user', content: 'Hi' }],
      systemPrompt: 'sys',
      env: { GROQ_API_KEY: 'bad_key' },
      fetchImpl: mockFetch401,
    }),
    err => {
      assert.equal(err.status, 502);
      assert.ok(err.message.toLowerCase().includes('credentials'));
      return true;
    },
  );

  // 4. 404 Model not found -> 502 model unavailable
  const mockFetch404 = async () => ({
    ok: false,
    status: 404,
    statusText: 'Not Found',
  });
  await assert.rejects(
    async () => callGroqChat({
      messages: [{ role: 'user', content: 'Hi' }],
      systemPrompt: 'sys',
      env: { GROQ_API_KEY: 'gsk_key' },
      fetchImpl: mockFetch404,
    }),
    err => {
      assert.equal(err.status, 502);
      assert.ok(err.message.toLowerCase().includes('model is unavailable'));
      return true;
    },
  );

  // 5. Network / Abort error -> 502
  const mockFetchNetworkError = async () => {
    throw new Error('Connection refused');
  };
  await assert.rejects(
    async () => callGroqChat({
      messages: [{ role: 'user', content: 'Hi' }],
      systemPrompt: 'sys',
      env: { GROQ_API_KEY: 'gsk_key' },
      fetchImpl: mockFetchNetworkError,
    }),
    err => {
      assert.equal(err.status, 502);
      assert.ok(err.message.toLowerCase().includes('unavailable or timed out'));
      return true;
    },
  );
});

// ── 5. Endpoints: Status, Consent, 503 Unconfigured & Patient Isolation ───────

test('chat route requires consent, returns 503 when unconfigured, and patient cannot pick another patient', async () => {
  const { database, db } = createFakeDb();

  // Users
  await db.collection('users').insertOne({ _id: 'did:p1', displayName: 'Alice Cooper', role: 'patient' });
  await db.collection('users').insertOne({ _id: 'did:p2', displayName: 'Bob Marley', role: 'patient' });

  let capturedSystemPrompt = null;
  const mockGenerate = async ({ systemPrompt }) => {
    capturedSystemPrompt = systemPrompt;
    return 'Here is your advice.';
  };

  let currentUser = 'did:p1';
  const authenticate = (req, res, next) => {
    req.identity = { uid: currentUser, role: 'patient', displayName: currentUser === 'did:p1' ? 'Alice Cooper' : 'Bob Marley' };
    next();
  };

  const app = express();
  app.use(express.json());

  // Setup router with configurable env
  let testEnv = { GROQ_API_KEY: 'valid_key', GROQ_MODEL: 'llama-3.3-70b-versatile', AI_CHAT_RATE_LIMIT: '10' };
  app.use('/api/chat', (req, res, next) => {
    createChatRouter({
      authenticate,
      database,
      generate: mockGenerate,
      env: testEnv,
    })(req, res, next);
  });
  app.use(notFoundHandler);
  app.use(errorHandler);

  await serve(app, async base => {
    const post = (body) =>
      fetch(`${base}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

    // A. GET /status when configured
    const statusRes = await fetch(`${base}/api/chat/status`);
    assert.equal(statusRes.status, 200);
    const statusBody = await statusRes.json();
    assert.equal(statusBody.configured, true);
    assert.equal(statusBody.role, 'patient');

    // B. Missing consent returns 400
    const noConsentRes = await post({
      messages: [{ role: 'user', content: 'What should I do?' }],
      consent: false,
    });
    assert.equal(noConsentRes.status, 400);

    // C. When unconfigured (no GROQ_API_KEY), returns 503
    testEnv = { GROQ_API_KEY: '', GROQ_MODEL: 'llama-3.3-70b-versatile' };
    const unconfStatusRes = await fetch(`${base}/api/chat/status`);
    assert.equal((await unconfStatusRes.json()).configured, false);

    const unconfPostRes = await post({
      messages: [{ role: 'user', content: 'What should I do?' }],
      consent: true,
    });
    assert.equal(unconfPostRes.status, 503);

    // D. Patient cannot pick another patient: client sends patientId: 'did:p2'
    testEnv = { GROQ_API_KEY: 'valid_key', GROQ_MODEL: 'llama-3.3-70b-versatile', AI_CHAT_RATE_LIMIT: '10' };
    const patientPostRes = await post({
      messages: [{ role: 'user', content: 'Tell me about my exercises.' }],
      consent: true,
      patientId: 'did:p2', // Spoofed target
    });
    assert.equal(patientPostRes.status, 200);
    const postBody = await patientPostRes.json();
    assert.equal(postBody.reply, 'Here is your advice.');
    assert.equal(postBody.provider, 'groq');

    // Verify context sent to Groq only contained Alice, never Bob
    assert.ok(capturedSystemPrompt.includes('Alice'), 'Prompt must include Alice');
    assert.ok(!capturedSystemPrompt.includes('Bob'), 'Prompt must never include Bob');
  });
});

// ── 6. Per-User Rate Limiting ─────────────────────────────────────────────────

test('chat route enforces per-user rate limit (AI_CHAT_RATE_LIMIT)', async () => {
  const { database } = createFakeDb();
  const authenticate = (req, res, next) => {
    req.identity = { uid: 'u_rate_test', role: 'patient', displayName: 'Rate Tester' };
    next();
  };

  const app = express();
  app.use(express.json());
  app.use('/api/chat', createChatRouter({
    authenticate,
    database,
    generate: async () => 'ok',
    env: { GROQ_API_KEY: 'test_key', AI_CHAT_RATE_LIMIT: '2' },
  }));
  app.use(errorHandler);

  await serve(app, async base => {
    const post = () =>
      fetch(`${base}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Ping' }],
          consent: true,
        }),
      });

    // Request 1: ok
    assert.equal((await post()).status, 200);
    // Request 2: ok (hits limit 2)
    assert.equal((await post()).status, 200);
    // Request 3: exceeds limit -> 429
    const limited = await post();
    assert.equal(limited.status, 429);
    const body = await limited.json();
    assert.equal(body.code, 'RATE_LIMITED');
  });
});
