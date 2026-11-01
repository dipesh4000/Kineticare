/**
 * backend/routes/chat.js
 *
 * Kineticare AI Chat Assistant Route (powered by Groq).
 *
 * Endpoints:
 * - GET  /status -> { configured: boolean, role: string }
 * - POST /       -> { reply: string, provider: 'groq', model: string, focusedPatient: string|null }
 *
 * Security:
 * - Mounted before /ai so both patients and clinicians can access it.
 * - Authenticated with requireIdentity.
 * - Context built strictly server-side from verified identity.
 * - Rate limited per user per minute via chatRateLimits collection.
 * - Never logs or persists conversations.
 */

import express from 'express';
import { requireIdentity, canAccessPatient } from '../services/identity.js';
import { atlasDb } from '../services/atlas.js';
import { AppError } from '../middleware/errorHandler.js';
import {
  buildPatientContext,
  buildClinicianContext,
  getSystemPrompt,
} from '../services/chatContext.js';

export function validateChatMessages(messages, consent) {
  if (consent !== true) {
    throw new AppError('Consent is required to consult the AI assistant.', 400, 'VALIDATION_ERROR');
  }
  if (!Array.isArray(messages) || messages.length < 1 || messages.length > 12) {
    throw new AppError('Messages must be an array of 1 to 12 items.', 400, 'VALIDATION_ERROR');
  }
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (!m || typeof m !== 'object') {
      throw new AppError(`Message at index ${i} must be an object.`, 400, 'VALIDATION_ERROR');
    }
    if (m.role !== 'user' && m.role !== 'assistant') {
      throw new AppError(`Message role must be 'user' or 'assistant', got '${m.role}'.`, 400, 'VALIDATION_ERROR');
    }
    if (typeof m.content !== 'string' || !m.content.trim()) {
      const label = m.role === 'user' ? 'up to 1500 characters' : 'up to 8000 characters';
      throw new AppError(`Message content at index ${i} must be a non-empty string ${label}.`, 400, 'VALIDATION_ERROR');
    }
    // User messages are capped at 1500 chars (matches frontend textarea maxLength).
    if (m.role === 'user' && m.content.length > 1500) {
      throw new AppError(`Message content at index ${i} must be a non-empty string up to 1500 characters.`, 400, 'VALIDATION_ERROR');
    }
  }
  if (messages.at(-1)?.role !== 'user') {
    throw new AppError('The last message must be from the user.', 400, 'VALIDATION_ERROR');
  }
  // Assistant messages can be up to 8000 chars. If a prior reply in history is longer, safely clamp so history never breaks.
  return messages.map(m => ({
    role: m.role,
    content: (m.role === 'assistant' && m.content.length > 8000 ? m.content.slice(0, 8000) : m.content).trim(),
  }));
}

export async function callGroqChat({ messages, systemPrompt, env = process.env, fetchImpl = fetch } = {}) {
  if (!env.GROQ_API_KEY) {
    throw new AppError('Set GROQ_API_KEY on the backend.', 503, 'SERVICE_UNAVAILABLE');
  }

  const model = env.GROQ_MODEL || 'qwen/qwen3.8-27b';
  const maxTokens = Number(env.GROQ_MAX_TOKENS) || 1024;

  const payload = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages.map(m => ({ role: m.role, content: m.content })),
    ],
    temperature: 0.3,
    max_tokens: maxTokens,
  };

  let response;
  try {
    response = await fetchImpl('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    });
  } catch {
    throw new AppError('AI service is unavailable or timed out. Please try again.', 502, 'BAD_GATEWAY');
  }

  if (!response.ok) {
    if (response.status === 429) {
      throw new AppError('The AI chat assistant is currently busy. Please wait a moment and try again.', 503, 'SERVICE_UNAVAILABLE');
    }
    if (response.status === 401 || response.status === 403) {
      throw new AppError('Groq rejected the configured credentials or API key.', 502, 'BAD_GATEWAY');
    }
    if (response.status === 404) {
      throw new AppError('The configured Groq model is unavailable.', 502, 'BAD_GATEWAY');
    }
    throw new AppError(`AI service error: ${response.statusText || response.status}`, 502, 'BAD_GATEWAY');
  }

  try {
    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content;
    if (!reply || typeof reply !== 'string') {
      throw new Error('Missing reply content');
    }
    return reply;
  } catch {
    throw new AppError('AI service returned an invalid response structure.', 502, 'BAD_GATEWAY');
  }
}

export async function enforceRateLimit(userId, db, limit = 12) {
  const collection = db.collection('chatRateLimits');
  if (collection.createIndex) {
    collection.createIndex({ createdAt: 1 }, { expireAfterSeconds: 120 }).catch(() => {});
  }
  const oneMinuteAgo = new Date(Date.now() - 60000);
  const query = { uid: userId, createdAt: { $gte: oneMinuteAgo } };

  const count = collection.countDocuments
    ? await collection.countDocuments(query)
    : (await collection.find(query).toArray()).length;

  if (count >= limit) {
    throw new AppError('Rate limit reached. Please wait a minute before sending more messages.', 429, 'RATE_LIMITED');
  }

  await collection.insertOne({ uid: userId, createdAt: new Date() });
}

export function createChatRouter({
  authenticate = requireIdentity,
  database = atlasDb,
  generate = callGroqChat,
  env = process.env,
  authorize = canAccessPatient,
  fetchImpl = fetch,
} = {}) {
  const router = express.Router();
  router.use(authenticate);

  // GET /api/chat/status
  router.get('/status', (req, res) => {
    res.json({
      configured: Boolean(env.GROQ_API_KEY),
      role: req.identity?.role || null,
    });
  });

  // POST /api/chat
  router.post('/', async (req, res, next) => {
    try {
      const { messages, patientId, consent } = req.body ?? {};

      // 1. Validate request body
      const validMessages = validateChatMessages(messages, consent);

      // 2. Check Groq configuration
      if (!env.GROQ_API_KEY) {
        throw new AppError('Set GROQ_API_KEY on the backend.', 503, 'SERVICE_UNAVAILABLE');
      }

      // 3. Enforce rate limiting
      const db = await database();
      const rateLimit = Number(env.AI_CHAT_RATE_LIMIT) || 12;
      await enforceRateLimit(req.identity.uid, db, rateLimit);

      // 4. Build context server-side based on role
      const role = req.identity?.role;
      let context;
      let focusedPatient = null;

      if (role === 'clinician') {
        context = await buildClinicianContext(req.identity, patientId || null, database, authorize);
        focusedPatient = context.focusPatient?.name || null;
      } else {
        // Patient role: ALWAYS ignore client-supplied patientId and use only own identity
        context = await buildPatientContext(req.identity, database);
      }

      // 5. Generate prompt and call Groq
      const systemPrompt = getSystemPrompt(role, context);
      const reply = await generate({
        messages: validMessages,
        systemPrompt,
        env,
        fetchImpl,
      });

      res.json({
        reply,
        provider: 'groq',
        model: env.GROQ_MODEL || 'qwen/qwen3.8-27b',
        focusedPatient,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

export const chatRouter = createChatRouter();
