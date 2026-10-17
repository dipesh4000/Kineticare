import { useNavigate, useLocation } from 'react-router-dom';
import { DATA } from '../data';
import { DEMO_BANNER } from '../utils';

function Bars({ items, valFn, labelFn }) {
  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', height: 120, paddingTop: 8 }}>
      {items.map((x, i) => (
        <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 12 }}>
          <div style={{ background: 'var(--pri)', borderRadius: '8px 8px 0 0', marginBottom: 4, height: valFn(x) }} />
          {labelFn(x)}
        </div>
      ))}
    </div>
  );
}

export default function PatientSummary() {
  const nav = useNavigate();
  const { state } = useLocation();
  const done = state?.done || [];

  return (
    <>
      <h1>Session summary</h1>
      {DEMO_BANNER}
      <div className="card">
        <h3>Time per exercise (s)</h3>
        <Bars items={done} valFn={x => Math.min(100, x.t * 10)} labelFn={x => `${x.ex.split(' ')[0]} ${x.t}`} />
      </div>
      <div className="card">
        <h3>Score per exercise (0 to 1)</h3>
        <Bars items={done} valFn={x => x.s * 100} labelFn={x => `${x.ex.split(' ')[0]} ${x.s}`} />
        <p className="mut">Score is a prototype measure of exercise recognition, not a clinical grade of your form.</p>
      </div>
      <button className="btn" style={{ width: '100%' }} onClick={() => {
        DATA.sess.push({ d: 'Today', r: done });
        nav('/patient/home');
      }}>Save and finish</button>
    </>
  );
}
