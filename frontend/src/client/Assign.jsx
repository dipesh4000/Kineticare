import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DATA, EXERCISES } from '../data';
import { toast } from '../components/Toast';

export default function ClientAssign() {
  const nav = useNavigate();
  const { id } = useParams();
  const p = DATA.pts.find(x => x.id === id);
  const P = DATA.plan;
  const [planName, setPlanName] = useState(P.name);
  const [note, setNote] = useState(P.items[0].note);
  const [checks, setChecks] = useState(
    EXERCISES.map(x => ({ checked: !!P.items.find(z => z.ex === x), t: P.items.find(z => z.ex === x)?.t || 45 }))
  );

  const toggle = i => setChecks(c => c.map((v, j) => j === i ? { ...v, checked: !v.checked } : v));
  const setT = (i, val) => setChecks(c => c.map((v, j) => j === i ? { ...v, t: val } : v));

  const publish = () => {
    const items = EXERCISES.map((x, i) => checks[i].checked ? { ex: x, t: checks[i].t || 45, note } : null).filter(Boolean);
    if (!items.length) return toast('Select at least one exercise');
    DATA.plan = { name: planName || 'Plan', v: P.v + 1, by: 'Dr. Sarah Khan', items };
    toast('Assigned. Patient sees version ' + DATA.plan.v);
    nav(`/client/patients/${id}`);
  };

  return (
    <>
      <h1>Assignment for {p?.n}</h1>
      <div className="card">
        <label htmlFor="pn">Plan name</label>
        <input id="pn" type="text" value={planName} onChange={e => setPlanName(e.target.value)} />
        <h3 style={{ marginTop: 14 }}>Exercises and targets (seconds)</h3>
        {EXERCISES.map((x, i) => (
          <div key={x} className="row" style={{ marginTop: 8 }}>
            <label style={{ margin: 0, fontWeight: 400, flex: 1, display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="checkbox" checked={checks[i].checked} onChange={() => toggle(i)} /> {x}
            </label>
            <input type="number" min="10" value={checks[i].t} onChange={e => setT(i, +e.target.value)}
              style={{ width: 90 }} aria-label={`${x} seconds`} />
          </div>
        ))}
        <label htmlFor="nt">Instructions and precautions</label>
        <textarea id="nt" rows="3" value={note} onChange={e => setNote(e.target.value)} />
        <p className="mut">Targets are set by you. The app never prescribes automatically. Saving creates version {P.v + 1}.</p>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <button className="btn" onClick={publish}>Assign to patient</button>
          <button className="btn s" onClick={() => toast('Draft saved')}>Save draft</button>
        </div>
      </div>
      <div className="card">
        <h3>Patient preview</h3>
        <p className="mut">The patient sees the selected exercises with your targets on their Plan screen.</p>
      </div>
    </>
  );
}
