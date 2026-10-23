import { useNavigate } from 'react-router-dom';
import { useRecords } from '../records/recordsContext';
import { DemoBanner } from '../utils';
import { useAuth } from '../auth/authContext';
import Icon from '../components/Icon';
import WeeklyActivity from '../components/WeeklyActivity';
import MovementArt from '../components/MovementArt';

export default function ClientOverview() {
  const nav = useNavigate();
  const { user } = useAuth();
  const { workspace, sessions, requests, backend } = useRecords();
  const recent = workspace.patients
    .flatMap(patient => sessions(patient.id).map(session => ({ patient, session })))
    .sort((a, b) => String(b.session.createdAt ?? b.session.d).localeCompare(String(a.session.createdAt ?? a.session.d)));
  const needsReview = recent.filter(item => item.session.reviewStatus !== 'reviewed').length;
  const openRequests = workspace.patients.reduce((total, patient) => total + requests(patient.id).filter(item => item.status === 'open').length, 0);

  return (
    <>
      <div className="page-heading"><div><p className="eyebrow">CARE THAT KEEPS MOVING</p><h1>Welcome back, {user.displayName}</h1><p className="mut">A clearer picture of your patients. A little more progress, together.</p></div><button className="btn" onClick={() => nav('/client/patients')}><Icon name="me" size={18} />Manage patients</button></div>
      <div className="overview-lead">
        <section className="care-priority"><div className="section-label"><span>YOUR PRACTICE, AT A GLANCE</span><Icon name="prog" /></div><h2>Good care starts<br />with a clear picture.</h2><p>{needsReview ? `${needsReview} sessions are ready for your review.` : 'You’re up to date on submitted sessions.'} {openRequests ? `${openRequests} patient requests are waiting.` : 'Keep your patients moving forward.'}</p><button className="btn w" onClick={() => nav('/client/patients')}>Review your patients <span aria-hidden="true">↗</span></button><MovementArt /></section>
        <WeeklyActivity sessions={recent.map(item => item.session)} compact />
      </div>
      {backend === 'local-demo' && <DemoBanner />}
      <div className="grid overview-stats">
        <div className="card"><span className="stat-icon"><Icon name="me" /></span><div className="stat">{workspace.patients.length}</div>Linked patients</div>
        <div className="card"><span className="stat-icon"><Icon name="prog" /></span><div className="stat">{needsReview}</div>Sessions needing review</div>
        <div className="card"><span className="stat-icon"><Icon name="fb" /></span><div className="stat">{openRequests}</div>Open patient requests</div>
        <div className="card"><div className="stat" style={{ fontSize: 22, color: 'var(--ok)' }}>Active</div>Workspace status</div>
      </div>

      <div className="dashboard-columns"><section>
      <div className="section-heading"><h2>Your patients <span className="count-badge">{workspace.patients.length}</span></h2><button className="text-action" onClick={() => nav('/client/patients')}>View all ↗</button></div>
      <div className="card patient-roster">
        {workspace.patients.map(patient => {
          const latest = sessions(patient.id).at(-1);
          const pending = sessions(patient.id).filter(session => session.reviewStatus !== 'reviewed').length;
          return (
            <div className="row sp roster-row" key={patient.id}>
              <div className="row"><div className="av">{patient.n.split(' ').map(part => part[0]).slice(0, 2).join('')}</div><div><b>{patient.n}</b><div className="mut">{patient.a} · last session {latest?.d ?? 'none yet'}</div></div></div>
              <span>{pending > 0 && <span className="tag warn">{pending} to review</span>}{' '}<button className="btn sm" onClick={() => nav(`/client/patients/${patient.id}`)}>Open</button></span>
            </div>
          );
        })}
      </div>

      </section><section className="review-column">
      <div className="section-heading"><h2>Next to review</h2><span className="tag">{needsReview} pending</span></div>
      <div className="card review-queue">
        {recent.filter(item => item.session.reviewStatus !== 'reviewed').slice(0, 3).map(({ patient, session }) => <button className="review-item" key={`${patient.id}-${session.sessionId ?? session.d}`} onClick={() => nav(`/client/patients/${patient.id}`)}><span className="review-dot" /><span><b>{patient.n}</b><small>{session.d} · {session.status ?? 'Submitted session'}</small></span><span aria-hidden="true">↗</span></button>)}
        {!needsReview && <div className="queue-empty"><Icon name="prog" size={28} /><h3>All caught up</h3><p className="mut">Submitted sessions will appear here when they need your attention.</p></div>}
      </div>
      {openRequests > 0 && <>
        <h2>Patient requests</h2>
        <div className="card">
          {workspace.patients.flatMap(patient => requests(patient.id).filter(item => item.status === 'open').map(item => (
            <div className="row sp" key={item.requestId} style={{ marginBottom: 10 }}>
              <div className="row"><div className="av">{patient.n.split(' ').map(part => part[0]).slice(0, 2).join('')}</div><div><b>{patient.n}</b><div className="mut">{item.kind}: {item.message}</div></div></div>
              <button className="btn sm" onClick={() => nav(`/client/patients/${patient.id}`)}>Open</button>
            </div>
          )))}
        </div>
      </>}
      <button className="library-shortcut" onClick={() => nav('/client/library')}><span className="shortcut-icon"><Icon name="workout" size={24} /></span><span><b>Your exercise studio</b><small>References, movements & care plans</small></span><span aria-hidden="true">↗</span></button>
      </section></div>

      <h2>Recent sessions</h2>
      <div className="card">
        <div className="wrap">
          <table>
            <thead><tr><th>Patient</th><th>Date</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {recent.slice(0, 8).map(({ patient, session }) => (
                <tr key={`${patient.id}-${session.sessionId ?? session.d}`}>
                  <td>{patient.n}</td><td>{session.d}</td>
                  <td><span className={`tag ${session.reviewStatus === 'reviewed' ? 'ok' : 'warn'}`}>{session.reviewStatus === 'reviewed' ? 'Reviewed' : 'Needs review'}</span></td>
                  <td><button className="btn sm" onClick={() => nav(`/client/patients/${patient.id}`)}>Open</button></td>
                </tr>
              ))}
              {!recent.length && <tr><td colSpan="4">No submitted sessions yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
