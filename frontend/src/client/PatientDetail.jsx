import { useNavigate, useParams } from 'react-router-dom';
import { DATA } from '../data';
import { avg, exs, LineChart, HBar, KPIs } from '../utils';

export default function ClientPatientDetail() {
  const nav = useNavigate();
  const { id } = useParams();
  const p = DATA.pts.find(x => x.id === id);
  const live = p?.id === 'P-101';
  const ss = live ? DATA.sess : [];

  if (!p) return <div className="card">Patient not found.</div>;

  return (
    <>
      <button className="btn s sm" onClick={() => nav('/client/patients')}>Back to patients</button>
      <h1 style={{ marginTop: 12 }}>{p.n} <span className="mut">{p.id} · {p.a}</span></h1>
      <div className="row" style={{ margin: '10px 0', flexWrap: 'wrap' }}>
        <button className="btn" onClick={() => nav(`/client/patients/${id}/assign`)}>Edit assignment</button>
        <button className="btn s" onClick={() => nav(`/client/patients/${id}/feedback`)}>Send feedback</button>
      </div>
      <div className="card">
        <h3>Active plan</h3>
        {live
          ? <p>{DATA.plan.name} · v{DATA.plan.v} · {DATA.plan.items.map(x => `${x.ex} ${x.t}s`).join(', ')}</p>
          : <p className="mut">No plan assigned yet.</p>}
      </div>
      {ss.length > 1 && (
        <>
          <KPIs ss={ss} />
          <div className="card">
            <h3>Score trend</h3>
            <LineChart vals={ss.map(s => avg(s.r))} labs={ss.map(s => s.d.slice(0, 6))} />
            <p className="mut">Session score, 0 to 1. Sample data, not validated form grading.</p>
            <HBar rows={exs(ss).map(r => [r[0], Math.round(r[1] * 100), r[1].toFixed(2) + ' avg'])} />
          </div>
        </>
      )}
      <h2>Session results</h2>
      {ss.length ? ss.slice().reverse().map(s => (
        <div key={s.d} className="card">
          <b>{s.d}</b>
          <div className="wrap">
            <table>
              <thead><tr><th>Assigned</th><th>Detected</th><th>Time</th><th>Score (0–1)</th><th>Confidence</th></tr></thead>
              <tbody>
                {s.r.map((x, i) => (
                  <tr key={i}>
                    <td>{x.ex}</td><td>{x.ex}</td><td>{x.t}s</td><td>{x.s}</td>
                    <td><span className={`tag ${x.c === 'High' ? 'ok' : 'warn'}`}>{x.c}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mut">Score is exercise recognition, not validated form grading. Sample data.</p>
        </div>
      )) : <div className="card">No sessions yet. Results will appear after the patient's first session.</div>}
    </>
  );
}
