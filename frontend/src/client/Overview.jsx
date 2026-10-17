import { useNavigate } from 'react-router-dom';
import { DATA } from '../data';
import { HBar, DEMO_BANNER } from '../utils';

export default function ClientOverview() {
  const nav = useNavigate();
  const rev = DATA.pts.filter(x => x.review).length;
  return (
    <>
      <h1>Overview</h1>
      {DEMO_BANNER}
      <div className="grid">
        <div className="card"><div className="stat">{DATA.pts.length}</div>Assigned patients</div>
        <div className="card"><div className="stat">{rev}</div>Need review</div>
        <div className="card"><div className="stat">1</div>Overdue plan</div>
        <div className="card"><div className="stat">1</div>Low-confidence session</div>
      </div>
      <h2>Adherence by patient</h2>
      <div className="card">
        <HBar rows={DATA.pts.map(x => [x.n, x.adh, x.adh + '%'])} />
      </div>
      <h2>Recent sessions</h2>
      <div className="card">
        <div className="wrap">
          <table>
            <thead><tr><th>Patient</th><th>Date</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {DATA.pts.slice(0, 2).map(x => (
                <tr key={x.id}>
                  <td>{x.n}</td><td>{x.last}</td>
                  <td><span className={`tag ${x.review ? 'warn' : 'ok'}`}>{x.review ? 'Needs review' : 'Reviewed'}</span></td>
                  <td><button className="btn sm" onClick={() => nav('/client/patients/' + x.id)}>Open</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
