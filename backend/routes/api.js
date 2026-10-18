import express from 'express';
import { exercisesRouter } from './exercises.js';
import { analyticsRouter } from './analytics.js';
import { reportsRouter } from './reports.js';
import { config } from '../config/index.js';

export const apiApp = express();
apiApp.use(express.json());

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
apiApp.use('/exercises', exercisesRouter);
apiApp.use('/analytics', analyticsRouter);
apiApp.use('/clinical', analyticsRouter); // Aliased for /api/clinical/soap-note compatibility
apiApp.use('/reports', reportsRouter);

// Patient trends endpoint
apiApp.get('/patient/:id/trends', (req, res) => {
  res.json({
    patientId: req.params.id,
    analyzedAt: new Date().toISOString(),
    status: 'active',
  });
});
