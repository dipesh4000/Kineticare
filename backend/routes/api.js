/**
 * Kineticare API Router — hardened edition
 *
 * Security surface:
 *  - helmet sets safe HTTP headers
 *  - CORS is restricted to the configured frontend origin
 *  - express-rate-limit caps request volume per IP
 *  - requestId stamps every request for log correlation
 *  - requestLogger emits structured JSON logs
 *  - All routes are wrapped with asyncRoute so promise rejections reach the central error handler
 *  - Central error handler emits the standard {code, message, requestId} envelope
 *  - 404 handler is mounted last so unknown routes also return the standard shape
 */
import express from 'express';
import helmet from 'helmet';
import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import { exercisesRouter } from './exercises.js';
import { analyticsRouter } from './analytics.js';
import { reportsRouter } from './reports.js';
import { config } from '../config/index.js';
import { recordsRouter } from './records.js';
import { aiRouter } from './ai.js';
import { knowledgeChatRouter } from './knowledgeChat.js';
import { authRouter } from './auth.js';
import { chatRouter } from './chat.js';
import { requireIdentity, canAccessPatient } from '../services/identity.js';
import { requestId } from '../middleware/requestId.js';
import { requestLogger } from '../middleware/requestLogger.js';
import { asyncRoute, errorHandler, notFoundHandler } from '../middleware/errorHandler.js';
import { AppError } from '../middleware/errorHandler.js';

export const apiApp = express();

// ── Security headers ──────────────────────────────────────────────────────────
apiApp.use(helmet());
apiApp.disable('x-powered-by');
apiApp.disable('etag');

// ── CORS — only the real frontend origin ─────────────────────────────────────
const ALLOWED_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';

apiApp.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin === ALLOWED_ORIGIN) res.set('Access-Control-Allow-Origin', origin);
  res.set('Vary', 'Origin');
  res.set('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Request-Id');
  res.set('Access-Control-Max-Age', '3600');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ── Cache & content-type defaults ────────────────────────────────────────────
apiApp.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  res.set('X-Content-Type-Options', 'nosniff');
  next();
});

// ── Request correlation and structured logging ────────────────────────────────
apiApp.use(requestId);
apiApp.use(requestLogger);

// ── Body parsing ─────────────────────────────────────────────────────────────
apiApp.use(express.json({ limit: '512kb' }));

// ── Rate limiting ─────────────────────────────────────────────────────────────
// General API limiter: 200 req / 15 min per IP
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later.' },
  keyGenerator: (req) => ipKeyGenerator(req),
});

// Tighter limiter for mutating AI routes (Gemini calls cost money)
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 'RATE_LIMITED', message: 'AI generation rate limit reached. Wait a moment before retrying.' },
  keyGenerator: (req) => req.identity?.uid ?? ipKeyGenerator(req),
});

apiApp.use(apiLimiter);

// ── /health — unauthenticated, no rate-limit count ───────────────────────────
apiApp.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: config.appName,
    version: config.version,
    env: config.env,
    capabilities: [
      'pose_telemetry_analysis',
      'clinical_metrics_computation',
      'fatigue_detection',
      'eccentric_phase_timing',
      'soap_note_generation',
      'exercise_catalog_management',
      'clinical_issue_reporting',
    ],
    timestamp: new Date().toISOString(),
    requestId: req.requestId,
  });
});

// ── Public sub-routers (require only Privy auth) ──────────────────────────────
apiApp.use('/auth', authRouter);
apiApp.use('/chat', chatRouter);

// ── Semi-public: knowledge-chat and AI drafts need identity + clinician role ──
apiApp.use('/ai/knowledge-chat', knowledgeChatRouter);
apiApp.use('/ai', [aiLimiter], aiRouter);

// ── All routes below require full identity (Privy token + DB profile) ─────────
apiApp.use(requireIdentity);

apiApp.use('/records', recordsRouter);
apiApp.use('/exercises', exercisesRouter);
apiApp.use('/analytics', analyticsRouter);
apiApp.use('/clinical', analyticsRouter); // Alias for /api/clinical/soap-note
apiApp.use('/reports', reportsRouter);

// ── /patient/:id/trends — authenticated, clinician access check ───────────────
apiApp.get(
  '/patient/:id/trends',
  asyncRoute(async (req, res) => {
    if (!await canAccessPatient(req.identity, req.params.id)) {
      throw new AppError('Patient access denied.', 403, 'PATIENT_ACCESS_DENIED');
    }
    res.json({
      patientId: req.params.id,
      analyzedAt: new Date().toISOString(),
      status: 'active',
    });
  }),
);

// ── 404 and central error handler (must be last) ──────────────────────────────
apiApp.use(notFoundHandler);
apiApp.use(errorHandler);
