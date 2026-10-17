import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/authContext';
import { useRecords } from '../records/recordsContext';
import { avg, exs } from '../metrics';
import { LineChart, HBar, KPIs } from '../utils';

export default function ClientPatientDetail() {
  const nav = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const { workspace, assignment, sessions, requests, markSessionReviewed, resolveRequest, replyToRequest } = useRecords();
  const [replyTo, setReplyTo] = useState(null);
  const [reply, setReply] = useState('');
  const patient = workspace.patients.find(item => item.id === id);
  const plan = assignment(id);
  const history = sessions(id);
  const patientRequests = requests(id);
  const scored = history.filter(session => Number.isFinite(avg(session.r)));

  const sendReply = async requestId => {
    if (!reply.trim()) return;
    await replyToRequest(id, requestId, { replyId: crypto.randomUUID(), senderId: user.uid, senderName: user.displayName, message: reply.trim(), createdAt: new Date().toISOString() });
    setReply('');
    setReplyTo(null);
  };

  if (!patient) return <div className="card">Patient not found or not linked to this clinician.</div>;

  return (
    <>
      <button className="btn s sm" onClick={() => nav('/client/patients')}>Back to patients</button>
      <h1 style={{ marginTop: 12 }}>{patient.n} <span className="mut">{patient.id} · {patient.a}</span></h1>
      <div className="row" style={{ margin: '10px 0', flexWrap: 'wrap' }}>
        <button className="btn" onClick={() => nav(`/client/patients/${id}/assign`)}>Edit assignment</button>
        <button className="btn s" disabled={!history.length} onClick={() => nav(`/client/patients/${id}/feedback`)}>Send feedback</button>
      </div>
      <div className="card">
        <h3>Active plan</h3>
        {plan ? <p>{plan.name} · v{plan.v} · {plan.items.map(item => `${item.ex} ${item.targetReps} reps`).join(', ')}</p> : <p className="mut">No plan assigned yet.</p>}
      </div>

      <div className="card">
        <h3>Patient requests</h3>
        {patientRequests.length ? patientRequests.map(request => (
          <div key={request.requestId} style={{ marginTop: 12 }}>
            <div className="row sp"><span><span className={`tag ${request.status === 'open' ? 'warn' : 'ok'}`}>{request.kind}</span>{' '}{request.message}</span>
              {request.status === 'open' && <span><button className="btn s sm" onClick={() => setReplyTo(request.requestId)}>Reply</button>{' '}<button className="btn s sm" onClick={() => resolveRequest(id, request.requestId)}>Close</button></span>}
            </div>
            {request.replies?.map(item => <p className="mut" key={item.replyId}>{item.senderName}: {item.message}</p>)}
            {replyTo === request.requestId && <div><textarea rows="2" value={reply} onChange={event => setReply(event.target.value)} placeholder="Reply to patient" /><button className="btn sm" onClick={() => sendReply(request.requestId)}>Send reply</button></div>}
          </div>
        )) : <p className="mut">No requests.</p>}
      </div>

      <KPIs ss={history} />
      {scored.length > 0 && <div className="card">
        <h3>Prototype score trend</h3>
        <LineChart vals={scored.map(session => avg(session.r))} labs={scored.map(session => session.d.slice(0, 6))} />
        <p className="mut">0–100 display; not a clinical grade.</p>
        <HBar rows={exs(history).map(row => [row[0], Math.round((row[1] ?? 0) * 100), row[1] == null ? 'Unavailable' : `${Math.round(row[1] * 100)} avg`])} />
      </div>}

      <h2>Session results</h2>
      {history.length ? history.slice().reverse().map(session => (
        <div key={session.sessionId ?? session.d} className="card">
          <div className="row sp">
            <b>{session.d}</b>
            <span className={`tag ${session.reviewStatus === 'reviewed' ? 'ok' : 'warn'}`}>{session.reviewStatus === 'reviewed' ? 'Reviewed' : 'Needs review'}</span>
          </div>
          <div className="wrap">
            <table>
              <thead><tr><th>Assigned exercise</th><th>Measured status</th><th>Active time</th><th>Score</th><th>Reps</th></tr></thead>
              <tbody>{session.r.map((result, index) => (
                <tr key={`${result.ex}-${index}`}>
                  <td>{result.ex}</td><td>{result.c ?? 'Recorded'}</td><td>{result.t}s</td>
                  <td>{result.s == null ? 'Unavailable' : Math.round(result.s * 100)}</td>
                  <td>{result.assessedReps == null ? 'Legacy fixture' : `${result.withinTargetReps}/${result.assessedReps} in target`}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          {session.sessionId && session.reviewStatus !== 'reviewed' && <button className="btn s sm" onClick={() => markSessionReviewed(id, session.sessionId)}>Mark reviewed</button>}
        </div>
      )) : <div className="card">No sessions yet.</div>}
    </>
  );
}
