import express from 'express';
import { exercisesRouter } from './exercises.js';
import { analyticsRouter } from './analytics.js';
import { reportsRouter } from './reports.js';
import { config } from '../config/index.js';
import { recordsRouter } from './records.js';
import { aiRouter } from './ai.js';
import { knowledgeChatRouter } from './knowledgeChat.js';
import { authRouter } from './auth.js';
import { requireIdentity, canAccessPatient } from '../services/identity.js';

export const apiApp = express();
apiApp.disable('x-powered-by');
apiApp.disable('etag');
apiApp.use((req, res, next) => { res.set('Cache-Control', 'no-store'); res.set('X-Content-Type-Options', 'nosniff'); next(); });
apiApp.use(express.json({ limit: '512kb' }));
apiApp.use('/auth', authRouter);
apiApp.use('/records', recordsRouter);
apiApp.use('/ai/knowledge-chat', knowledgeChatRouter);
apiApp.use('/ai', aiRouter);

// Health & System status
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
  });
});

// Mount sub-routers
apiApp.use(requireIdentity);
apiApp.use('/exercises', exercisesRouter);
apiApp.use('/analytics', analyticsRouter);
apiApp.use('/clinical', analyticsRouter); // Aliased for /api/clinical/soap-note compatibility
apiApp.use('/reports', reportsRouter);

// Patient trends endpoint
apiApp.get('/patient/:id/trends', async (req, res) => {
  if (!await canAccessPatient(req.identity, req.params.id)) return res.status(403).json({ error: 'Patient access denied.' });
  res.json({
    patientId: req.params.id,
    analyzedAt: new Date().toISOString(),
    status: 'active',
  });
});

apiApp.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  const status = error.status || 503;
  res.status(status).json({ error: status < 500 ? error.message : 'Connected service unavailable. Check backend configuration and connectivity.' });
});
