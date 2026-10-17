import { useNavigate, useLocation } from 'react-router-dom';
import { DATA } from '../data';
import { toast } from '../components/Toast';

export default function PatientPre() {
  const nav = useNavigate();
  const { state } = useLocation();
  const exIdx = state?.exIdx ?? 0;
  const x = DATA.plan.items[exIdx];

  return (
    <>
      <button className="btn s sm" onClick={() => nav('/patient/plan')}>Back</button>
      <h1 style={{ marginTop: 12 }}>{x.ex}</h1>
      <div className="card">
        <p>Follow the clinician's instructions. Move slowly and stop at any time if you feel pain or dizziness.</p>
        <p className="mut">{x.note || 'No extra precautions set.'}</p>
      </div>
      <div className="card">
        <h3>Camera setup</h3>
        <label style={{ fontWeight: 400, display: 'flex', gap: 8, alignItems: 'center', margin: '8px 0' }}>
          <input type="checkbox" /> Phone is propped about 2 metres away
        </label>
        <label style={{ fontWeight: 400, display: 'flex', gap: 8, alignItems: 'center', margin: '8px 0' }}>
          <input type="checkbox" /> Whole body is visible
        </label>
        <label style={{ fontWeight: 400, display: 'flex', gap: 8, alignItems: 'center', margin: '8px 0' }}>
          <input type="checkbox" /> Room is well lit
        </label>
        <p className="mut">The camera is only active during the workout. In this demo no camera is used.</p>
      </div>
      <button className="btn" style={{ width: '100%', marginBottom: 8 }}
        onClick={() => nav('/patient/live', { state: { exIdx } })}>
        Begin exercise
      </button>
      <button className="btn s" style={{ width: '100%' }} onClick={() => toast('Help request sent to your clinician (demo)')}>
        I need help
      </button>
    </>
  );
}
