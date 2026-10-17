import { Fragment, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/authContext';
import { useRecords } from '../records/recordsContext';
import { avg } from '../metrics';
import { LineChart, KPIs } from '../utils';
import ScoreTimeCharts from '../components/ExerciseCharts';
import { toast } from '../components/toastBus';

export default function ClientPatientDetail() {
  const nav = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const { workspace, assignment, sessions, requests, markSessionReviewed, resolveRequest, replyToRequest, sendFeedback } = useRecords();
  const [selected, setSelected] = useState('');
  const [fbMessage, setFbMessage] = useState('');
  const [fbReminder, setFbReminder] = useState('');
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

  const chosen = history.find(session => (session.sessionId ?? session.d) === selected) ?? history.at(-1);

  const submitFeedback = async () => {
    if (!fbMessage.trim() && !fbReminder.trim()) return toast('Write feedback or a reminder first');
    try {
      await sendFeedback(id, {
        id: crypto.randomUUID(), sessionId: chosen?.sessionId ?? null, clinicianUid: user.uid, from: user.displayName,
        message: fbMessage.trim() || 'Reminder from your clinician.', m: fbMessage.trim() || 'Reminder from your clinician.',
        reminder: fbReminder.trim() || null,
        d: new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date()), createdAt: new Date().toISOString(), read: false,
      });
      setFbMessage('');
      setFbReminder('');
      toast('Sent to the patient');
    } catch {
      toast('Could not send. Try again.');
    }
  };

  if (!patient) return <div className="card">Patient not found or not linked to this clinician.</div>;

  return (
    <>
      <button className="btn s sm" onClick={() => nav('/client/patients')}>Back to patients</button>
      <h1 style={{ marginTop: 12 }}>Patient: {patient.n} <span className="mut">{patient.id} · {patient.a}</span></h1>
      <div className="row" style={{ margin: '10px 0', flexWrap: 'wrap' }}>
        <button className="btn" onClick={() => nav(`/client/patients/${id}/assign`)}>Edit assignment</button>
      </div>

      {chosen ? (
        <>
          <div className="row sp" style={{ margin: '14px 0 8px' }}>
            <h2 style={{ margin: 0 }}>Results for {chosen.d}</h2>
            <select aria-label="Choose session" style={{ width: 'auto' }} value={chosen.sessionId ?? chosen.d} onChange={event => setSelected(event.target.value)}>
              {history.slice().reverse().map(session => <option key={session.sessionId ?? session.d} value={session.sessionId ?? session.d}>{session.d}{session.mode === 'replay' ? ' (replay)' : ''}</option>)}
            </select>
          </div>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))' }}>
            <ScoreTimeCharts results={chosen.r} />
          </div>
        </>
      ) : <div className="card">No sessions yet, so there are no charts to show.</div>}

      <div className="card">
        <h3>Feedback and assignment</h3>
        <label htmlFor="fb-message">Feedback for the patient</label>
        <textarea id="fb-message" rows="3" value={fbMessage} onChange={event => setFbMessage(event.target.value)} placeholder="What went well, what to change, next steps" />
        <label htmlFor="fb-reminder">Reminder</label>
        <input id="fb-reminder" type="text" value={fbReminder} onChange={event => setFbReminder(event.target.value)} placeholder="For example: check-in next Tuesday" />
        <button className="btn" style={{ marginTop: 12 }} onClick={submitFeedback}>Submit</button>
        <p className="mut">Linked to the session shown above. Change the assigned exercises with Edit assignment.</p>
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
                <Fragment key={`${result.ex}-${index}`}>
                <tr>
                  <td>{result.ex}</td><td>{result.c ?? 'Recorded'}</td><td>{result.t}s</td>
                  <td>{result.s == null ? 'Unavailable' : Math.round(result.s * 100)}</td>
                  <td>{result.assessedReps == null ? 'Legacy fixture' : `${result.withinTargetReps}/${result.assessedReps} in target`}</td>
                </tr>
                {result.reps?.length > 0 && (
                  <tr key={`${result.ex}-${index}-reps`}>
                    <td colSpan={5} className="mut">
                      Rep by rep: {result.reps.map((rep, repIndex) => `#${repIndex + 1} ${Math.round(rep.peak * 100)}% of target, ${(rep.durationMs / 1000).toFixed(1)}s, score ${rep.score}`).join(' · ')}
                    </td>
                  </tr>
                )}
                </Fragment>
              ))}</tbody>
            </table>
          </div>
          {session.sessionId && session.reviewStatus !== 'reviewed' && <button className="btn s sm" onClick={() => markSessionReviewed(id, session.sessionId)}>Mark reviewed</button>}
        </div>
      )) : <div className="card">No sessions yet.</div>}
    </>
  );
}
