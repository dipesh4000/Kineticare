import express from 'express';

export const reportsRouter = express.Router();

// In-memory clinical reports log
const EXERCISE_REPORTS = [];

// POST /api/reports/exercise: Report an exercise issue or clinical concern
reportsRouter.post('/exercise', (req, res) => {
  try {
    const { exercise, patientId, reason, notes, severity, reportedBy } = req.body || {};
    if (!exercise || !reason) {
      return res.status(400).json({ error: 'Exercise name and report reason are required' });
    }

    const report = {
      reportId: crypto.randomUUID(),
      exercise,
      patientId: patientId || 'P-101',
      reportedBy: reportedBy || 'Dr. Aditi Singh',
      reason, // e.g., 'Knee discomfort / pain', 'Tracking distortion / occlusion', 'Target angle too deep'
      notes: notes || '',
      severity: severity || 'medium', // low, medium, high
      status: 'logged',
      timestamp: new Date().toISOString(),
    };

    EXERCISE_REPORTS.unshift(report);

    res.status(201).json({
      success: true,
      message: 'Exercise report logged successfully for clinical review',
      report,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to log report', details: err.message });
  }
});

// GET /api/reports/exercise: Retrieve clinical exercise reports
reportsRouter.get('/exercise', (req, res) => {
  res.json({
    count: EXERCISE_REPORTS.length,
    reports: EXERCISE_REPORTS,
  });
});

// POST /api/reports/custom-video-staged: Staging metadata for clinician custom video upload
reportsRouter.post('/custom-video-staged', (req, res) => {
  const { exercise, fileName, durationSec, notes } = req.body || {};
  res.json({
    success: true,
    status: 'staged',
    notice: 'Clinician custom video upload is in beta staging. Full persistent cloud video streaming is scheduled for Phase 2.',
    item: {
      exercise: exercise || 'Squat',
      fileName: fileName || 'doctor-custom-reference.mp4',
      durationSec: durationSec || 15,
      stagedAt: new Date().toISOString(),
      notes: notes || '',
    },
  });
});
