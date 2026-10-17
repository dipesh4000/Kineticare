import { useNavigate } from 'react-router-dom';
import { DATA } from '../data';

export default function PatientProfile() {
  const nav = useNavigate();
  return (
    <>
      <h1>Profile</h1>
      <div className="card">
        <b>Siyam Ahamed</b>
        <p className="mut">Male, 27 · Clinician: {DATA.plan.by}</p>
      </div>
      <div className="card">
        <h3>Camera permission</h3>
        <p className="mut">If the camera is blocked, allow it in your browser or phone settings, then reload.</p>
      </div>
      <div className="card">
        <h3>Privacy</h3>
        <p className="mut">Prototype notice: this app is a demo and has not been validated in a clinical setting.</p>
      </div>
      <button className="btn s" onClick={() => nav('/')}>Sign out</button>
    </>
  );
}
