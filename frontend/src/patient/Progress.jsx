import { DATA } from '../data';
import { avg, exs, Ring, LineChart, HBar, KPIs, DEMO_BANNER } from '../utils';

export default function PatientProgress() {
  const ss = DATA.sess;
  return (
    <>
      <h1>Progress</h1>
      {DEMO_BANNER}
      <KPIs ss={ss} />
      <div className="card">
        <h3>Score by session</h3>
        <LineChart vals={ss.map(s => avg(s.r))} labs={ss.map(s => s.d.slice(0, 6))} />
        <p className="mut">Session score, 0 to 1. This is not a recovery percentage.</p>
      </div>
      <div className="card">
        <h3>Average score by exercise</h3>
        <HBar rows={exs(ss).map(r => [r[0], Math.round(r[1] * 100), r[1].toFixed(2)])} />
      </div>
      <div className="card">
        <h3>Average time by exercise</h3>
        <HBar rows={exs(ss).map(r => [r[0], Math.min(100, Math.round(r[2] / 70 * 100)), Math.round(r[2]) + ' s'])} />
      </div>
      <div className="card">
        <h3>Completion</h3>
        <div className="row">
          <Ring pct={67} label="Completion" />
          <span className="mut">2 of 3 assigned sessions done this week.</span>
        </div>
      </div>
      {ss.map(s => (
        <div key={s.d} className="card">
          <b>{s.d}</b>
          <p className="mut">{s.r.map(x => `${x.ex} ${x.t}s`).join(' · ')}</p>
        </div>
      ))}
    </>
  );
}
