import { useNavigate } from 'react-router-dom';
import { DATA } from '../data';
import { avg, Ring, LineChart, DEMO_BANNER } from '../utils';
import { toast } from '../components/Toast';
import Icon from '../components/Icon';

export default function PatientHome() {
  const nav = useNavigate();
  const P = DATA.plan;
  const unread = DATA.fb.filter(f => !f.read).length;
  const l = DATA.sess.at(-1);

  return (
    <>
      <div className="row sp">
        <p className="hello">Hello,<b>Siyam Ahamed!</b></p>
        <div className="hd">
          <button className="call-btn" style={{ background: 'none' }} aria-label="Notifications"
            onClick={() => toast(unread ? '1 new feedback message' : 'No new notifications')}>
            <Icon name="bell" color="var(--ink)" />
          </button>
          <div className="av">SA<span className="pro">PRO</span></div>
        </div>
      </div>

      <button className="srch" onClick={() => nav('/patient/plan')}>
        <Icon name="search" color="var(--mut)" size={20} /> Search exercises
      </button>

      {DEMO_BANNER}

      <div className="hs">
        {[['plan','Exercises'],['prog','Progress'],['fb','Feedback'],['me','Profile']].map(([k, label]) => (
          <button key={k} className="tile" onClick={() => nav(`/patient/${k}`)}>
            <Icon name={k} color="var(--pri)" />{label}
          </button>
        ))}
      </div>

      <h2>Upcoming Session</h2>
      <div className="card hero">
        <div className="row">
          <div className="thumb"><Icon name="plan" color="var(--pri)" /></div>
          <div>
            <h3 style={{ fontSize: 19 }}>{P.name}</h3>
            <div className="mut">v{P.v} · set by {P.by}</div>
          </div>
        </div>
        <div className="pill">
          <span><Icon name="cal" size={18} color="#fff" /> Today</span>
          <span><Icon name="clock" size={18} color="#fff" /> {P.items.length} exercises · about {Math.round(P.items.reduce((a, x) => a + x.t, 0) / 60)} min</span>
        </div>
        <button className="btn w" onClick={() => nav('/patient/plan')}>Start session</button>
      </div>

      <div className="card">
        <div className="row sp">
          <h3>Latest clinician feedback</h3>
          {unread ? <span className="tag warn">New</span> : null}
        </div>
        <p>{DATA.fb[0].m}</p>
        <button className="btn s sm" onClick={() => nav('/patient/fb')}>Open feedback</button>
      </div>

      <div className="row sp"><h2>My Recent Sessions</h2><a href="#" className="mut" onClick={e => { e.preventDefault(); nav('/patient/prog'); }}>See All</a></div>
      <div className="hs">
        {DATA.sess.slice(-3).reverse().map(s => (
          <div key={s.d} className="card">
            <b>{s.d}</b>
            <p className="mut">{s.r.length} exercises · score {avg(s.r)}</p>
            <span className="tag ok">Completed</span>
            <div className="row sp" style={{ marginTop: 10 }}>
              <button className="btn s sm" onClick={() => nav('/patient/plan')}>Do Again</button>
              <button className="call-btn" aria-label="Contact clinician" onClick={() => toast('Message sent to your clinician (demo)')}>
                <Icon name="call" color="#fff" size={20} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h3>This week</h3>
        <div className="row">
          <Ring pct={67} label="Weekly adherence" />
          <div>
            <div className="mut">2 of 3 sessions completed</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--pri)' }}>{avg(l.r)}</div>
            <div className="mut">last session score (0 to 1)</div>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Score trend</h3>
        <LineChart vals={DATA.sess.map(s => avg(s.r))} labs={DATA.sess.map(s => s.d.slice(0, 6))} />
        <p className="mut">Sample data, 0 to 1 scale.</p>
      </div>
    </>
  );
}
