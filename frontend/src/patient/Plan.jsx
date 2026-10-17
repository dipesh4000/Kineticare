import { useNavigate } from 'react-router-dom';
import { DATA } from '../data';

export default function PatientPlan() {
  const nav = useNavigate();
  const P = DATA.plan;
  return (
    <>
      <h1>{P.name}</h1>
      <p className="mut">By {P.by} · version {P.v} · 3 times per week</p>
      {P.items.map((x, i) => (
        <div key={i} className="card">
          <div className="row sp">
            <h3>{x.ex}</h3>
            <span className="tag">Not started</span>
          </div>
          <p className="mut">Target: {x.t} seconds{x.note ? ' · ' + x.note : ''}</p>
          <button className="btn s sm" onClick={() => nav('/patient/pre', { state: { exIdx: i } })}>Instructions</button>
        </div>
      ))}
      <button className="btn" style={{ width: '100%' }} onClick={() => nav('/patient/pre', { state: { exIdx: 0, all: true } })}>
        Start plan
      </button>
    </>
  );
}
