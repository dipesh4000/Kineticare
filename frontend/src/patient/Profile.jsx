import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/authContext';
import { useRecords } from '../records/recordsContext';
import { clearSessionDraft } from '../session/drafts';

export default function PatientProfile() {
  const nav = useNavigate();
  const { user, signOut } = useAuth();
  const { patientId, assignment, backend } = useRecords();
  const plan = assignment(patientId);
  return (
    <>
      <h1>Profile</h1>
      <div className="card">
        <b>{user.displayName}</b>
        <p className="mut">Patient account · Clinician: {plan?.by ?? 'Not linked'}</p>
      </div>
      <div className="card">
        <h3>Camera permission</h3>
        <p className="mut">If the camera is blocked, allow it in your browser or phone settings, then reload.</p>
      </div>
      <div className="card">
        <h3>Privacy</h3>
        <p className="mut">Workout video stays on this device. Compact measurements are saved. Approved clinician reference recordings may be streamed when configured.</p>
        <p className="mut">Storage mode: {backend === 'local-demo' ? 'this browser only' : 'protected Firebase project'}.</p>
        <p className="mut">Prototype notice: this app has not been validated for clinical use.</p>
      </div>
      <button className="btn s" onClick={async () => { clearSessionDraft(patientId); await signOut(); nav('/'); }}>Sign out</button>
    </>
  );
}
