import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { readFileSync } from 'node:fs';
import { buildKnowledgeContext, exerciseCatalog, generationSchema, illustrativePreview, knowledgeSystemParts, providerSchema, validateKnowledgePlan } from '../services/exerciseKnowledge.js';
import { callKnowledgeGemini, createKnowledgeChatRouter } from '../routes/knowledgeChat.js';

const env = { GEMINI_API_KEY: 'test-only-not-a-real-key', GEMINI_MODEL: 'test-model' };
const reviewPlan = context => ({ status: 'needs_review', exercise_id: context.selection.exercise_id, motion_template_id: null, rig_profile_id: null,
  phase_ids: context.exercise?.movement_phases.map(phase => phase.phase_id) ?? [], parameters: [],
  claims: context.knowledge_units.length ? [{ text: context.knowledge_units[0].summary, evidence_unit_ids: [context.knowledge_units[0].id] }] : [],
  missing_requirements: ['Clinical review and motion assets are pending.'], questions: [] });

test('runtime preserves the supplied prompt exactly and retrieves selected exercise evidence', () => {
  assert.equal(knowledgeSystemParts[0], readFileSync(new URL('../../knowledge-base/generation/user-system-prompt.md', import.meta.url), 'utf8'));
  const context = buildKnowledgeContext('Explain this exercise', 'EX-KU-000001');
  assert.equal(exerciseCatalog().length, 8);
  assert.equal(context.exercise.slug, 'bilateral-mini-squat');
  assert.ok(context.exercise.related_knowledge_units.every(id => context.knowledge_units.some(unit => unit.id === id)));
  assert.equal(context.animation_capabilities.render_ready, false);
  assert.equal(illustrativePreview(context.exercise).id, 'mini-squat-illustration-v1');
});

test('unsupported and conflicting variations cannot borrow a selected motion', () => {
  for (const request of ['single leg bridge', 'deep squat', 'seated heel raise', 'mini squat or wall squat']) {
    const context = buildKnowledgeContext(request, 'EX-KU-000001');
    assert.equal(context.exercise, null);
    assert.equal(illustrativePreview(context.exercise), null);
  }
  assert.equal(buildKnowledgeContext('standing toe touch').exercise, null);
  assert.throws(() => buildKnowledgeContext(''), /exercise question/);
  assert.throws(() => buildKnowledgeContext('hello', 'invented'), /Unknown exercise/);
});

test('citations, phase IDs, executable fields and model-invented approvals are rejected', () => {
  const context = buildKnowledgeContext('mini squat');
  const plan = reviewPlan(context);
  assert.equal(validateKnowledgePlan(plan, context), plan);
  for (const change of [
    { claims: [{ text: 'invented', evidence_unit_ids: ['KU-CH21-9999'] }] },
    { phase_ids: ['invented'] }, { exercise_id: 'EX-KU-000002' }, { javascript: 'arbitrary code' },
    { motion_template_id: 'invented' },
    { parameters: [{ name: 'angle', value: 999, provenance: 'reviewed_template', reference_id: 'invented' }] },
    { status: 'ready_to_render', motion_template_id: 'invented', rig_profile_id: 'invented', missing_requirements: [] },
  ]) assert.throws(() => validateKnowledgePlan({ ...plan, ...change }, context));
  assert.equal(providerSchema().allOf, undefined);
  assert.ok(generationSchema.allOf.length > 0);
});

test('Gemini request uses system instructions, source context and server-side response validation', async () => {
  const context = buildKnowledgeContext('mini squat');
  let request;
  const fetchImpl = async (url, options) => {
    assert.ok(url.endsWith('/test-model:generateContent'));
    request = JSON.parse(options.body);
    assert.equal(options.headers['x-goog-api-key'], env.GEMINI_API_KEY);
    return { ok: true, json: async () => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(reviewPlan(context)) }] } }] }) };
  };
  assert.equal((await callKnowledgeGemini(context, [], { fetchImpl, env })).exercise_id, 'EX-KU-000001');
  assert.equal(request.systemInstruction.parts[0].text, knowledgeSystemParts[0]);
  assert.ok(JSON.parse(request.contents[0].parts[0].text).context.knowledge_units.length);
  assert.equal(request.generationConfig.responseMimeType, 'application/json');
  await assert.rejects(callKnowledgeGemini(context, [], { fetchImpl: async () => ({ ok: false, status: 404 }), env }), /unavailable for this account/);
  await assert.rejects(callKnowledgeGemini(context, [], { fetchImpl: async () => ({ ok: false, status: 429 }), env }), /quota or rate limit/);
  await assert.rejects(callKnowledgeGemini(context, [], { fetchImpl: async () => ({ ok: true, json: async () => ({ candidates: [{ finishReason: 'MAX_TOKENS' }] }) }), env }), /incomplete/);
});

async function serve(router, run) {
  const app = express(); app.use(express.json()); app.use(router);
  app.use((error, req, res, next) => res.status(error.status || 500).json({ error: error.message }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

test('chat enforces clinician identity, consent, per-user history and generation lease', async () => {
  const rows = [{ _id: 'other-user', ownerUid: 'other', createdAt: '2026-01-01', message: 'private', plan: { claims: [] } }];
  const leases = new Set();
  let called = 0;
  const database = async () => ({ collection(name) {
    return {
      find(filter) { let limit = 20; return { sort() { return this; }, limit(value) { limit = value; return this; }, async toArray() { return rows.filter(row => row.ownerUid === filter.ownerUid).slice(-limit).reverse(); } }; },
      async insertOne(value) {
        if (name === 'aiGenerationLeases') { if (leases.has(value._id)) throw Object.assign(new Error('Duplicate'), { code: 11000 }); leases.add(value._id); }
        else rows.push(value);
      },
    };
  } });
  const authenticate = (req, res, next) => {
    if (!req.headers['x-test-user']) return res.status(401).json({ error: 'Sign in' });
    req.identity = { uid: req.headers['x-test-user'], role: req.headers['x-test-role'] ?? 'clinician' }; next();
  };
  const generate = async (context, history) => { called++; assert.equal(history.length, 0); return reviewPlan(context); };
  await serve(createKnowledgeChatRouter({ authenticate, database, generate, env }), async base => {
    const post = (body, role = 'clinician') => fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-test-user': 'owner', 'x-test-role': role }, body: JSON.stringify(body) });
    assert.equal((await fetch(base + '/catalog')).status, 401);
    assert.equal((await post({ message: 'mini squat', consent: true }, 'patient')).status, 403);
    assert.equal((await post({ message: 'mini squat' })).status, 400);
    const response = await post({ message: 'mini squat', exerciseId: 'EX-KU-000001', consent: true });
    assert.equal(response.status, 201);
    const turn = await response.json();
    assert.equal(turn.preview.id, 'mini-squat-illustration-v1');
    assert.equal(turn.capability, 'unmeasured');
    assert.ok(turn.citations.length);
    assert.equal((await post({ message: 'mini squat', consent: true })).status, 429);
    assert.equal(called, 1);
    const history = await (await fetch(base, { headers: { 'x-test-user': 'owner' } })).json();
    assert.equal(history.length, 1); assert.equal(history[0].ownerUid, 'owner');
  });
});

test('missing provider configuration never calls Gemini or a database', async () => {
  const router = createKnowledgeChatRouter({ env: {}, authenticate(req, res, next) { req.identity = { uid: 'owner', role: 'clinician' }; next(); },
    database: async () => { throw new Error('Must not connect'); }, generate: async () => { throw new Error('Must not generate'); } });
  await serve(router, async base => {
    const result = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'mini squat', consent: true }) });
    assert.equal(result.status, 503);
  });
});
