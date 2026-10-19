import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/authContext';
import { useRecords } from '../records/recordsContext';
import { useState } from 'react';
import { clearSessionDraft } from '../session/drafts';
import { clearPerfLog, readPerfLog } from '../session/profiler';

import PWAInstallButton from '../components/PWAInstallButton';

export default function PatientProfile() {
  const nav = useNavigate();
  const { user, signOut } = useAuth();
  const { patientId, assignment, backend } = useRecords();
  const plan = assignment(patientId);
  const [runs, setRuns] = useState(readPerfLog);
  const download = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(runs, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url; link.download = 'kineticare-performance-log.json'; link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <>
      <h1>Info & Settings</h1>
      <div className="card">
        <b>{user.displayName}</b>
        <p className="mut">Patient account · Clinician: {plan?.by ?? 'Not linked'}</p>
      </div>
      <div className="card">
        <div className="row sp">
          <div>
            <h3>Install Mobile App</h3>
            <p className="mut" style={{ fontSize: 13, margin: '2px 0 0' }}>
              Add to home screen for fast camera launch and standalone app performance.
            </p>
          </div>
          <PWAInstallButton />
        </div>
      </div>
      <div className="card">
        <h3>How your workout is measured</h3>
        <p className="mut">The camera finds the joints in your body on this device. For each exercise the app tracks one joint angle: knee for squats, hip for toe touches, and shoulders for arm raises.</p>
        <p className="mut">It first learns your resting position, then counts a repetition each time you move out towards your target and return. Each repetition gets a score from how close you came to the target and how steady your pace was (2 to 5 seconds is ideal).</p>
      </div>
      <div className="card">
        <h3>Performance log</h3>
        <p className="mut">Memory (JS heap), TensorFlow tensor memory and frame rate are sampled every 2 s during camera sessions, for profiling.</p>
        {runs.length === 0 ? <p className="mut">No camera sessions logged yet.</p> : runs.slice(0, 5).map(run => (
          <p key={run.id} className="mut" style={{ margin: '4px 0' }}>
            {new Date(run.startedAt).toLocaleString('en-GB')} · {run.label} · {run.summary?.seconds}s · heap {run.summary?.heapStartMb ?? 'n/a'} to {run.summary?.heapEndMb ?? 'n/a'} MB (peak {run.summary?.heapPeakMb ?? 'n/a'}) · {run.summary?.avgFps} fps
          </p>
        ))}
        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn s sm" disabled={!runs.length} onClick={download}>Download log (JSON)</button>
          <button className="btn s sm" disabled={!runs.length} onClick={() => { clearPerfLog(); setRuns([]); }}>Clear</button>
        </div>
      </div>
      <div className="card">
        <h3>Camera permission</h3>
        <p className="mut">If the camera is blocked, allow it in your browser or phone settings, then reload.</p>
      </div>
      <div className="card">
        <h3>Privacy</h3>
        <p className="mut">Workout video stays on this device. Compact measurements are saved. Approved clinician reference recordings may be streamed when configured.</p>
        <p className="mut">Storage mode: {backend === 'local-demo' ? 'local clinical workspace' : 'protected Firebase project'}.</p>
        <p className="mut">Clinical notice: Tele-rehabilitation system for remote exercise guidance and movement telemetry.</p>
      </div>
      <button className="btn s" onClick={async () => { clearSessionDraft(patientId); await signOut(); nav('/'); }}>Sign out</button>
    </>
  );
}
