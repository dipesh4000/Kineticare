import { useNavigate } from 'react-router-dom';
import { useRecords } from '../records/recordsContext';
import { DemoBanner } from '../utils';
import { useAuth } from '../auth/authContext';

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
      <h1>Welcome back, {user.displayName}</h1>
      {backend === 'local-demo' && <DemoBanner />}
      <div className="grid">
        <div className="card"><div className="stat">{workspace.patients.length}</div>Linked patients</div>
        <div className="card"><div className="stat">{needsReview}</div>Sessions needing review</div>
        <div className="card"><div className="stat">{openRequests}</div>Open patient requests</div>
      </div>

      <h2>Your patients</h2>
      <div className="card">
        {workspace.patients.map(patient => {
          const latest = sessions(patient.id).at(-1);
          const pending = sessions(patient.id).filter(session => session.reviewStatus !== 'reviewed').length;
          return (
            <div className="row sp" key={patient.id} style={{ padding: '10px 0', borderBottom: '1px solid #8883' }}>
              <div><b>{patient.n}</b><div className="mut">{patient.a} · last session {latest?.d ?? 'none yet'}</div></div>
              <span>{pending > 0 && <span className="tag warn">{pending} to review</span>}{' '}<button className="btn sm" onClick={() => nav(`/client/patients/${patient.id}`)}>Open</button></span>
            </div>
          );
        })}
      </div>

      {openRequests > 0 && <>
        <h2>Patient requests</h2>
        <div className="card">
          {workspace.patients.flatMap(patient => requests(patient.id).filter(item => item.status === 'open').map(item => (
            <div className="row sp" key={item.requestId} style={{ marginBottom: 10 }}>
              <div><b>{patient.n}</b><div className="mut">{item.kind}: {item.message}</div></div>
              <button className="btn sm" onClick={() => nav(`/client/patients/${patient.id}`)}>Open</button>
            </div>
          )))}
        </div>
      </>}

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
