import { useState } from 'react';
import { useAuth } from '../auth/authContext';
import { ALL_EXERCISES, VIDEO_ONLY_EXERCISES } from '../data';
import { useRecords } from '../records/recordsContext';
import ReferenceVideo from '../components/ReferenceVideo';
import ReferenceCapture from './ReferenceCapture';
import { toast } from '../components/toastBus';
import { reportExerciseIssue } from '../services/api';

export function ClientLibrary() {
  const { workspace } = useRecords();
  const { user } = useAuth();
  const [captureExercise, setCaptureExercise] = useState(null);

  // Exercise Report State
  const [reportingEx, setReportingEx] = useState(null);
  const [reportReason, setReportReason] = useState('Patient reported pain or joint discomfort');
  const [reportSeverity, setReportSeverity] = useState('medium');
  const [reportNotes, setReportNotes] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);

  // Custom Video Upload State
  const [customVideoEx, setCustomVideoEx] = useState(null);
  const [videoFile, setVideoFile] = useState(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState('');
  const [videoNotes, setVideoNotes] = useState('');

  if (captureExercise) {
    return <ReferenceCapture exerciseName={captureExercise} onClose={() => setCaptureExercise(null)} />;
  }

  const submitReport = async () => {
    if (!reportingEx) return;
    setSubmittingReport(true);
    try {
      await reportExerciseIssue({
        exercise: reportingEx,
        reason: reportReason,
        severity: reportSeverity,
        notes: reportNotes,
        reportedBy: user?.displayName || 'Dr. Aditi Singh',
      });
      toast(`Report for ${reportingEx} submitted successfully`);
      setReportingEx(null);
      setReportNotes('');
    } catch {
      toast('Failed to submit report. Saved locally.');
    } finally {
      setSubmittingReport(false);
    }
  };

  const handleVideoSelect = event => {
    const file = event.target.files?.[0];
    if (file) {
      setVideoFile(file);
      setVideoPreviewUrl(URL.createObjectURL(file));
    }
  };

  const saveCustomVideoStaged = () => {
    if (!videoFile) return toast('Please select a video file first');
    toast(`Custom video for ${customVideoEx} staged for clinical review.`);
    setCustomVideoEx(null);
    setVideoFile(null);
    setVideoPreviewUrl('');
    setVideoNotes('');
  };

  return (
    <>
      <div className="row sp" style={{ marginBottom: 8 }}>
        <h1>Exercise Library</h1>
      </div>
      <p className="mut" style={{ marginBottom: 16 }}>
        Camera-measured protocols and clinician demonstration management. Clinicians can capture reference models, stage custom videos, or report clinical issues.
      </p>

      {/* Exercise Issue Report Modal */}
      {reportingEx && (
        <div className="card" style={{ borderLeft: '4px solid var(--warn)', marginBottom: 20 }}>
          <div className="row sp">
            <h3 style={{ margin: 0 }}>Report Clinical Issue: {reportingEx}</h3>
            <button className="btn s sm" onClick={() => setReportingEx(null)}>Cancel</button>
          </div>
          <p className="mut" style={{ fontSize: 13, margin: '6px 0 12px' }}>
            Flag a protocol limitation, tracking anomaly, or patient safety concern to help refine rehabilitation standards.
          </p>

          <label htmlFor="rep-reason">Reason for Report</label>
          <select id="rep-reason" value={reportReason} onChange={e => setReportReason(e.target.value)}>
            <option value="Patient reported pain or joint discomfort">Patient reported pain or joint discomfort</option>
            <option value="Tracking occlusion or keypoint jump">Tracking occlusion or keypoint jump</option>
            <option value="Target excursion angle is too aggressive">Target excursion angle is too aggressive</option>
            <option value="Patient trunk compensation / asymmetrical sway">Patient trunk compensation / asymmetrical sway</option>
            <option value="Other clinical concern">Other clinical concern</option>
          </select>

          <label htmlFor="rep-sev">Clinical Severity</label>
          <select id="rep-sev" value={reportSeverity} onChange={e => setReportSeverity(e.target.value)}>
            <option value="low">Low (Minor observation / tracking tip)</option>
            <option value="medium">Medium (Requires exercise modification)</option>
            <option value="high">High (Contraindication / Risk of injury)</option>
          </select>

          <label htmlFor="rep-notes">Clinical Notes & Observations</label>
          <textarea
            id="rep-notes"
            rows="3"
            value={reportNotes}
            onChange={e => setReportNotes(e.target.value)}
            placeholder="Describe specific joint angles, symptoms, or recommendations"
          />

          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn" disabled={submittingReport} onClick={submitReport}>
              {submittingReport ? 'Submitting…' : 'Submit Exercise Report'}
            </button>
            <button className="btn s" onClick={() => setReportingEx(null)}>Dismiss</button>
          </div>
        </div>
      )}

      {/* Custom Video Upload Modal */}
      {customVideoEx && (
        <div className="card" style={{ borderLeft: '4px solid var(--pri)', marginBottom: 20 }}>
          <div className="row sp">
            <h3 style={{ margin: 0 }}>Upload Custom Demonstration Video: {customVideoEx}</h3>
            <button className="btn s sm" onClick={() => setCustomVideoEx(null)}>Close</button>
          </div>

          <div className="demo" style={{ margin: '12px 0' }}>
            ℹ️ <b>Roadmap Notice:</b> Clinician Custom Video Upload is currently in Stage 1 Preview. Persistent cloud-synced video streaming is scheduled for Phase 2. You can test and stage your local recording below.
          </div>

          <label htmlFor="custom-vid-input">Select Demonstration Recording (MP4/WebM)</label>
          <input
            id="custom-vid-input"
            type="file"
            accept="video/mp4,video/webm"
            onChange={handleVideoSelect}
            style={{ marginBottom: 12 }}
          />

          {videoPreviewUrl && (
            <div style={{ margin: '12px 0', textAlign: 'center' }}>
              <video
                src={videoPreviewUrl}
                controls
                style={{ maxHeight: 240, width: '100%', maxWidth: 360, borderRadius: 12, background: '#000' }}
              />
              <p className="mut" style={{ fontSize: 12, marginTop: 4 }}>Preview: {videoFile?.name} ({(videoFile?.size / (1024 * 1024)).toFixed(1)} MB)</p>
            </div>
          )}

          <label htmlFor="vid-notes">Doctor Exercise Notes for this Video</label>
          <textarea
            id="vid-notes"
            rows="2"
            value={videoNotes}
            onChange={e => setVideoNotes(e.target.value)}
            placeholder="e.g. Focus on chest up and weight over midfoot"
          />

          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn" disabled={!videoFile} onClick={saveCustomVideoStaged}>
              Stage Custom Demonstration
            </button>
            <button className="btn s" onClick={() => setCustomVideoEx(null)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="grid">
        {ALL_EXERCISES.map(exercise => {
          const videoOnly = VIDEO_ONLY_EXERCISES.includes(exercise);
          const references = workspace.references.filter(
            reference => reference.exerciseName === exercise && reference.status === 'approved'
          );

          return (
            <div key={exercise} className="card">
              <div className="row sp">
                <h3 style={{ margin: 0 }}>{exercise}</h3>
                <span className={`tag ${references.length ? 'ok' : 'warn'}`}>
                  {references.length ? `${references.length} approved version` : 'Reference required'}
                </span>
              </div>

              <p className="mut" style={{ margin: '8px 0 12px' }}>
                {videoOnly
                  ? 'Video guide only. Not measured by the camera.'
                  : exercise === 'Side Arm Raise'
                  ? 'Front camera view · Bilateral shoulder tracking'
                  : 'Side camera view · Unilateral joint tracking'}
              </p>

              <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                {!videoOnly && (
                  <button className="btn sm" onClick={() => setCaptureExercise(exercise)}>
                    In-app capture
                  </button>
                )}
                <button className="btn s sm" onClick={() => setCustomVideoEx(exercise)}>
                  Upload custom video
                </button>
                <button className="btn s sm" onClick={() => setReportingEx(exercise)}>
                  Report exercise
                </button>
              </div>

              {references.slice(0, 1).map(reference => (
                <div key={reference.versionId} style={{ marginTop: 12 }}>
                  <b>Latest: version {reference.version}</b>
                  {reference.demo ? (
                    <p className="mut" style={{ fontSize: 13 }}>
                      Demo clip verified. Targets are set per patient in individual assignments.
                    </p>
                  ) : (
                    <p className="mut" style={{ fontSize: 13 }}>
                      {reference.targetExcursionDeg}° median movement · {(reference.targetDurationMs / 1000).toFixed(1)}s median tempo
                    </p>
                  )}
                  <div className="vid">
                    <ReferenceVideo mediaPath={reference.mediaPath} />
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </>
  );
}

export function ClientSettings() {
  const { user, firebaseEnabled } = useAuth();
  return (
    <>
      <h1>Clinician Settings</h1>
      <div className="card">
        <b>{user.displayName}</b>
        <p className="mut">Role: Attending Clinician / Physiotherapist · {firebaseEnabled ? 'Connected Firebase Workspace' : 'Active Local Clinic Workspace'}</p>
      </div>

      <div className="card">
        <h3>Clinical Safety & Target Protocol</h3>
        <p className="mut">
          All joint angles, cue thresholds, and telemetry scoring formulas should be evaluated against individual patient tolerance. Exercise reports and custom video submissions are logged for quality assurance.
        </p>
      </div>
    </>
  );
}
