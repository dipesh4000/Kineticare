import express from 'express';
import { randomUUID } from 'node:crypto';
import { requireIdentity } from '../services/identity.js';
import { atlasDb } from '../services/atlas.js';
import { buildKnowledgeContext, citedSources, exerciseCatalog, illustrativePreview, knowledgeSystemParts, providerSchema, validateKnowledgePlan } from '../services/exerciseKnowledge.js';

export async function callKnowledgeGemini(context, history, { fetchImpl = fetch, env = process.env } = {}) {
  let response;
  try {
    response = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY }, signal: AbortSignal.timeout(60000),
      body: JSON.stringify({
        systemInstruction: { parts: knowledgeSystemParts.map(text => ({ text })) },
        contents: [{ role: 'user', parts: [{ text: JSON.stringify({ context, previous_turns: history }) }] }],
        generationConfig: { responseMimeType: 'application/json', responseJsonSchema: providerSchema(), maxOutputTokens: 4096,
          ...(env.GEMINI_MODEL === 'gemini-3.8-flash' ? { thinkingConfig: { thinkingLevel: 'LOW' } } : {}),
        },
      }),
    });
  } catch { throw Object.assign(new Error('Gemini is unavailable or timed out. No response was saved.'), { status: 502 }); }
  if (!response.ok) {
    const detail = response.status === 404 ? 'The configured Gemini model is unavailable for this account.' : response.status === 429 ? 'Gemini quota or rate limit was reached.' : response.status === 401 || response.status === 403 ? 'Gemini rejected the configured credentials or account access.' : 'Gemini rejected the request; check model compatibility and configuration.';
    throw Object.assign(new Error(detail), { status: response.status === 429 ? 503 : 502 });
  }
  try {
    const payload = await response.json();
    const candidate = payload.candidates?.[0];
    if (candidate?.finishReason !== 'STOP') throw new Error('Incomplete response');
    return validateKnowledgePlan(JSON.parse(candidate.content.parts.filter(part => !part.thought).map(part => part.text ?? '').join('')), context);
  } catch { throw Object.assign(new Error('Gemini returned incomplete, unsupported or ungrounded exercise metadata. No response was saved.'), { status: 502 }); }
}

export function createKnowledgeChatRouter({ authenticate = requireIdentity, database = atlasDb, generate = callKnowledgeGemini, env = process.env } = {}) {
  const router = express.Router();
  router.use(authenticate);
  router.use((req, res, next) => req.identity?.role === 'clinician' ? next() : res.status(403).json({ error: 'Knowledge-grounded exercise generation is restricted to clinicians.' }));
  router.get('/catalog', (req, res) => res.json({ exercises: exerciseCatalog(), coverage: 'Partial source-curated pilot; clinical review pending.' }));
  router.get('/', async (req, res) => {
    const db = await database();
    const rows = await db.collection('exerciseKnowledgeChats').find({ ownerUid: req.identity.uid }).sort({ createdAt: -1 }).limit(20).toArray();
    res.json(rows.reverse());
  });
  router.post('/', async (req, res) => {
    const { message, exerciseId = null, consent } = req.body ?? {};
    if (consent !== true || (exerciseId !== null && typeof exerciseId !== 'string')) return res.status(400).json({ error: 'Provide an exercise question and consent to send it and retrieved source summaries to Google Gemini.' });
    const context = buildKnowledgeContext(message, exerciseId);
    if (!env.GEMINI_API_KEY || !/^[\w.-]+$/.test(env.GEMINI_MODEL ?? '')) return res.status(503).json({ error: 'Set GEMINI_API_KEY and GEMINI_MODEL on the backend.' });
    const db = await database();
    try { await db.collection('aiGenerationLeases').insertOne({ _id: `${req.identity.uid}:${Math.floor(Date.now() / 60000)}`, expiresAt: new Date(Date.now() + 120000) }); }
    catch (error) { if (error.code === 11000) return res.status(429).json({ error: 'Please wait a minute before generating another AI response.' }); throw error; }
    const previous = await db.collection('exerciseKnowledgeChats').find({ ownerUid: req.identity.uid }).sort({ createdAt: -1 }).limit(3).toArray();
    const history = previous.reverse().map(turn => ({ request: turn.message, claims: turn.plan.claims }));
    const plan = validateKnowledgePlan(await generate(context, history, { env }), context);
    const preview = plan.exercise_id === context.selection.exercise_id && plan.status === 'needs_review' ? illustrativePreview(context.exercise) : null;
    const turn = { _id: randomUUID(), ownerUid: req.identity.uid, message: message.trim(), plan,
      citations: citedSources(plan, context), exercise: context.exercise ? { exercise_id: context.exercise.exercise_id, exercise_name: context.exercise.exercise_name, movement_phases: context.exercise.movement_phases } : null,
      preview, clinicalStatus: 'pending-review', capability: 'unmeasured', provider: 'gemini', model: env.GEMINI_MODEL, createdAt: new Date().toISOString() };
    await db.collection('exerciseKnowledgeChats').insertOne(turn);
    res.status(201).json(turn);
  });
  return router;
}

export const knowledgeChatRouter = createKnowledgeChatRouter();
