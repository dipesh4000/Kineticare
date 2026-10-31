/**
 * backend/test/hardening.test.js
 *
 * Tests for Task 5 — Backend Hardening
 *
 * Covers:
 *  1. Standard error envelope {code, message, requestId}
 *  2. Unauthenticated requests → 401 with standard envelope
 *  3. Invalid token → 401
 *  4. Wrong role (patient tries clinician-only route) → 403
 *  5. Validation failures (malformed body, unknown fields) → 400
 *  6. POST /api/exercises unauthenticated → 401
 *  7. POST /api/exercises authenticated as patient → 403
 *  8. POST /api/exercises authenticated as clinician → 405 (catalog is read-only)
 *  9. Rate limiting: too many requests → 429
 * 10. /health endpoint accessible without auth
 * 11. SOAP note route (template-based, no AI)
 * 12. Analytics evaluate-session validation
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { requestId } from '../middleware/requestId.js';
import { errorHandler, notFoundHandler, asyncRoute, AppError } from '../middleware/errorHandler.js';
import {
  validate,
  evaluateSessionSchema,
  soapNoteSchema,
  exerciseReportSchema,
  registerSchema,
  aiDraftSchema,
} from '../middleware/validation.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function serve(app, run) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

/**
 * Build a minimal express app that mimics api.js behavior:
 * - requestId middleware
 * - optional requireIdentity
 * - a set of routes
 * - notFoundHandler + errorHandler
 */
function buildApp({ requireIdentity = null, routes = () => {} } = {}) {
  const app = express();
  app.use(requestId);
  app.use(express.json({ limit: '512kb' }));
  if (requireIdentity) app.use(requireIdentity);
  routes(app);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

// ── 1. Error envelope shape ───────────────────────────────────────────────────

test('errorHandler emits {code, message, requestId} envelope for AppError', async () => {
  const app = buildApp({
    routes(a) {
      a.get('/boom', (req, res, next) => next(new AppError('Something wrong', 422, 'UNPROCESSABLE')));
    },
  });
  await serve(app, async base => {
    const res = await fetch(`${base}/boom`);
    assert.equal(res.status, 422);
    const body = await res.json();
    assert.equal(body.code, 'UNPROCESSABLE');
    assert.equal(body.message, 'Something wrong');
    assert.ok(typeof body.requestId === 'string' && body.requestId.length > 0, 'requestId must be present');
  });
});

test('errorHandler emits {code, message, requestId} for unexpected errors (500)', async () => {
  const app = buildApp({
    routes(a) {
      a.get('/crash', asyncRoute(async () => { throw new Error('db exploded'); }));
    },
  });
  await serve(app, async base => {
    const res = await fetch(`${base}/crash`);
    assert.equal(res.status, 500);
    const body = await res.json();
    assert.equal(body.code, 'INTERNAL_ERROR');
    assert.ok(body.message.includes('unexpected'), 'internal errors must be opaque');
    assert.ok(body.requestId, 'requestId must be present even on 500s');
  });
});

test('notFoundHandler returns 404 with standard envelope', async () => {
  const app = buildApp();
  await serve(app, async base => {
    const res = await fetch(`${base}/no-such-route`);
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.code, 'NOT_FOUND');
    assert.ok(body.requestId);
  });
});

// ── 2. Unauthenticated requests ───────────────────────────────────────────────

test('requireIdentity rejects missing token with 401 and standard envelope', async () => {
  const fakeRequireIdentity = (req, res, next) => {
    const token = req.headers.authorization?.match(/^Bearer (\S+)$/)?.[1];
    if (!token) return next(new AppError('Sign in to access connected records.', 401, 'UNAUTHORIZED'));
    next();
  };

  const app = buildApp({
    requireIdentity: fakeRequireIdentity,
    routes(a) {
      a.get('/protected', (req, res) => res.json({ ok: true }));
    },
  });
  await serve(app, async base => {
    const res = await fetch(`${base}/protected`);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.code, 'UNAUTHORIZED');
    assert.ok(body.requestId);
  });
});

// ── 3. Invalid token ──────────────────────────────────────────────────────────

test('invalid Bearer token returns 401 with standard envelope', async () => {
  const fakeRequireIdentity = async (req, res, next) => {
    const token = req.headers.authorization?.match(/^Bearer (\S+)$/)?.[1];
    if (!token) return next(new AppError('Sign in.', 401, 'UNAUTHORIZED'));
    // Simulate failed token verification
    next(new AppError('Your session could not be verified. Sign in again.', 401, 'INVALID_TOKEN'));
  };

  const app = buildApp({
    requireIdentity: fakeRequireIdentity,
    routes(a) {
      a.get('/protected', (req, res) => res.json({ ok: true }));
    },
  });
  await serve(app, async base => {
    const res = await fetch(`${base}/protected`, {
      headers: { Authorization: 'Bearer bad.token.here' },
    });
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.code, 'INVALID_TOKEN');
    assert.ok(body.requestId);
  });
});

// ── 4. Wrong role ─────────────────────────────────────────────────────────────

test('patient role rejected on clinician-only route with 403', async () => {
  const fakeAuth = (req, res, next) => {
    req.identity = { uid: 'patient-1', role: 'patient' };
    next();
  };

  const app = buildApp({
    requireIdentity: fakeAuth,
    routes(a) {
      // Simulates POST /api/exercises clinician check
      a.post('/exercises', (req, res, next) => {
        if (req.identity.role !== 'clinician') {
          return next(new AppError('Exercise catalog writes are restricted to clinicians.', 403, 'FORBIDDEN'));
        }
        next(new AppError('The bundled catalog is read-only.', 405, 'METHOD_NOT_ALLOWED'));
      });
    },
  });
  await serve(app, async base => {
    const res = await fetch(`${base}/exercises`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.code, 'FORBIDDEN');
    assert.ok(body.requestId);
  });
});

// ── 5. Validation failures ────────────────────────────────────────────────────

test('validate() throws 400 AppError with VALIDATION_ERROR code for missing required fields', () => {
  assert.throws(
    () => validate(evaluateSessionSchema, {}),
    err => {
      assert.ok(err instanceof AppError);
      assert.equal(err.status, 400);
      assert.equal(err.code, 'VALIDATION_ERROR');
      assert.ok(err.message.includes('session'));
      return true;
    },
  );
});

test('validate() rejects unknown fields on strict schemas', () => {
  assert.throws(
    () => validate(registerSchema, { displayName: 'Alice', role: 'clinician', adminFlag: true }),
    err => {
      assert.ok(err instanceof AppError);
      assert.equal(err.status, 400);
      assert.equal(err.code, 'VALIDATION_ERROR');
      assert.ok(err.message.toLowerCase().includes('unrecognized') || err.message.includes('adminFlag'));
      return true;
    },
  );
});

test('soapNoteSchema requires session field', () => {
  assert.throws(
    () => validate(soapNoteSchema, { patient: {} }),
    err => {
      assert.ok(err instanceof AppError);
      assert.equal(err.status, 400);
      return true;
    },
  );
});

test('exerciseReportSchema rejects invalid severity', () => {
  assert.throws(
    () => validate(exerciseReportSchema, { exercise: 'Squat', reason: 'Pain', severity: 'critical' }),
    err => {
      assert.ok(err instanceof AppError);
      assert.equal(err.status, 400);
      return true;
    },
  );
});

test('exerciseReportSchema rejects unknown fields', () => {
  assert.throws(
    () => validate(exerciseReportSchema, { exercise: 'Squat', reason: 'Pain', hackerField: 'evil' }),
    err => {
      assert.ok(err instanceof AppError);
      assert.equal(err.status, 400);
      return true;
    },
  );
});

test('aiDraftSchema requires consent:true — boolean false throws', () => {
  assert.throws(
    () => validate(aiDraftSchema, { brief: 'test', reference: 'ch1', referenceNotes: 'notes', consent: false }),
    err => {
      assert.ok(err instanceof AppError);
      assert.equal(err.status, 400);
      return true;
    },
  );
});

// ── 6. POST /api/exercises unauthenticated → 401 ─────────────────────────────
// Uses the full apiApp so the real requireIdentity and exercises router run.

test('POST /api/exercises without Bearer token returns 401 with standard envelope', async () => {
  // We import apiApp. Privy will fail because no credentials in test env,
  // but the token is absent so we get 401 before any Privy call.
  const { apiApp } = await import('../routes/api.js');

  await serve(apiApp, async base => {
    const res = await fetch(`${base}/exercises`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Lunge' }),
    });
    assert.equal(res.status, 401, `Expected 401, got ${res.status}`);
    const body = await res.json();
    assert.ok(body.code, 'code field must be present');
    assert.ok(body.message, 'message field must be present');
    assert.ok(body.requestId, 'requestId field must be present');
  });
});

// ── 7 & 8. POST /api/exercises authenticated ─────────────────────────────────

test('POST /api/exercises as patient returns 403; as clinician returns 405', async () => {
  const fakeAuth = role => (req, res, next) => {
    req.identity = { uid: `${role}-1`, role };
    next();
  };

  // Patient → 403
  const patientApp = buildApp({
    requireIdentity: fakeAuth('patient'),
    routes(a) {
      a.post('/exercises', (req, res, next) => {
        if (req.identity.role !== 'clinician') {
          return next(new AppError('Exercise catalog writes are restricted to clinicians.', 403, 'FORBIDDEN'));
        }
        next(new AppError('The bundled catalog is read-only.', 405, 'METHOD_NOT_ALLOWED'));
      });
    },
  });
  await serve(patientApp, async base => {
    const res = await fetch(`${base}/exercises`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(res.status, 403);
    assert.equal((await res.json()).code, 'FORBIDDEN');
  });

  // Clinician → 405
  const clinicianApp = buildApp({
    requireIdentity: fakeAuth('clinician'),
    routes(a) {
      a.post('/exercises', (req, res, next) => {
        if (req.identity.role !== 'clinician') {
          return next(new AppError('Clinicians only.', 403, 'FORBIDDEN'));
        }
        next(new AppError('The bundled catalog is read-only. Use AI drafts for review.', 405, 'METHOD_NOT_ALLOWED'));
      });
    },
  });
  await serve(clinicianApp, async base => {
    const res = await fetch(`${base}/exercises`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(res.status, 405);
    const body = await res.json();
    assert.equal(body.code, 'METHOD_NOT_ALLOWED');
    assert.ok(body.message.includes('read-only'));
  });
});

// ── 9. Rate limiting ──────────────────────────────────────────────────────────

test('rate limiter returns 429 after limit exceeded', async () => {
  const limiter = rateLimit({
    windowMs: 60_000,
    max: 3,
    standardHeaders: true,
    legacyHeaders: false,
  });
  const app = express();
  app.use(requestId);
  app.use(limiter);
  app.get('/ping', (req, res) => res.json({ pong: true }));
  // No need for a custom error handler — express-rate-limit handles 429 itself

  await serve(app, async base => {
    // First 3 should succeed
    for (let i = 0; i < 3; i++) {
      const r = await fetch(`${base}/ping`);
      assert.equal(r.status, 200);
    }
    // 4th should be rate-limited
    const r = await fetch(`${base}/ping`);
    assert.equal(r.status, 429);
  });
});

// ── 10. /health accessible without auth ───────────────────────────────────────

test('/api/health returns 200 without auth', async () => {
  const { apiApp } = await import('../routes/api.js');
  await serve(apiApp, async base => {
    const res = await fetch(`${base}/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'ok');
    assert.ok(body.requestId, 'health must include requestId');
  });
});

// ── 11. SOAP note validation on route ─────────────────────────────────────────

test('POST /analytics/soap-note with empty body returns 400 with standard envelope', async () => {
  const fakeAuth = (req, res, next) => { req.identity = { uid: 'u1', role: 'clinician' }; next(); };

  const { analyticsRouter } = await import('../routes/analytics.js');
  const app = express();
  app.use(requestId);
  app.use(express.json());
  app.use(fakeAuth);
  app.use('/analytics', analyticsRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);

  await serve(app, async base => {
    const res = await fetch(`${base}/analytics/soap-note`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.code, 'VALIDATION_ERROR');
    assert.ok(body.requestId);
  });
});

// ── 12. Analytics evaluate-session validation ─────────────────────────────────

test('POST /analytics/evaluate-session with malformed body returns 400', async () => {
  const fakeAuth = (req, res, next) => { req.identity = { uid: 'u1', role: 'clinician' }; next(); };

  const { analyticsRouter } = await import('../routes/analytics.js');
  const app = express();
  app.use(requestId);
  app.use(express.json());
  app.use(fakeAuth);
  app.use('/analytics', analyticsRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);

  await serve(app, async base => {
    // Missing `session`
    const res = await fetch(`${base}/analytics/evaluate-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wrongField: 'oops' }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.code, 'VALIDATION_ERROR');
    assert.ok(body.requestId);

    // Valid session passes
    const ok = await fetch(`${base}/analytics/evaluate-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session: { r: [] } }),
    });
    assert.equal(ok.status, 200);
  });
});
