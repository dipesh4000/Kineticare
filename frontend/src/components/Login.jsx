import { useNavigate } from 'react-router-dom';
import { toast } from './Toast';

export default function Login() {
  const nav = useNavigate();
  return (
    <div className="center">
      <h1 style={{ color: 'var(--pri)' }}>Kineticare</h1>
      <p className="mut">Tele-rehabilitation that connects patients and clinicians.</p>
      <div className="demo">Demo mode: sample data only. Prototype, not clinically validated.</div>
      <div className="card">
        <label htmlFor="em">Email</label>
        <input id="em" type="email" defaultValue="demo@kineticare.app" autoComplete="off" />
        <label htmlFor="pw">Password</label>
        <input id="pw" type="password" defaultValue="password" />
        <label style={{ fontWeight: 400, display: 'flex', gap: 8, alignItems: 'center', margin: '8px 0' }}>
          <input type="checkbox" onChange={e => {
            document.getElementById('pw').type = e.target.checked ? 'text' : 'password';
          }} /> Show password
        </label>
        <p className="mut">
          <a href="#" onClick={e => { e.preventDefault(); toast('Password reset email is not sent in demo mode'); }}>
            Forgot password?
          </a>
        </p>
        <button className="btn" style={{ width: '100%', marginBottom: 8 }} onClick={() => nav('/patient/home')}>
          Sign in as patient
        </button>
        <button className="btn s" style={{ width: '100%' }} onClick={() => nav('/client/overview')}>
          Sign in as clinician
        </button>
        <p className="mut">Roles here are for the demo. In production, access is enforced by the server.</p>
      </div>
      <p className="mut">Privacy: pose estimation is intended to run on-device, sending skeleton keypoints rather than video.</p>
    </div>
  );
}
