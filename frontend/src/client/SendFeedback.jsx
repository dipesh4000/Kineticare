import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/authContext';
import { useRecords } from '../records/recordsContext';
import { toast } from '../components/toastBus';

export default function ClientSendFeedback() {
  const nav = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const { workspace, sessions, sendFeedback } = useRecords();
  const patient = workspace.patients.find(item => item.id === id);
  const history = sessions(id);
  const [sessionId, setSessionId] = useState(history.at(-1)?.sessionId ?? '');
  const [message, setMessage] = useState('');

  if (!patient) return <div className="card">Patient not found.</div>;

  const send = async () => {
    if (!sessionId) return toast('Choose a saved session');
    if (!message.trim()) return toast('Write a message first');
    try {
      await sendFeedback(id, {
        id: crypto.randomUUID(), sessionId, clinicianUid: user.uid, from: user.displayName,
        message: message.trim(), d: new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date()),
        m: message.trim(), createdAt: new Date().toISOString(), read: false,
      });
      toast('Feedback sent');
      nav(`/client/patients/${id}`);
    } catch {
      toast('Feedback could not be sent');
    }
  };

  return (
    <>
      <h1>Feedback for {patient.n}</h1>
      <div className="card">
        <label htmlFor="fs">Linked session</label>
        <select id="fs" value={sessionId} onChange={event => setSessionId(event.target.value)}>
          <option value="">Choose a session</option>
          {history.filter(session => session.sessionId).map(session => <option key={session.sessionId} value={session.sessionId}>{session.d} · {session.status}</option>)}
        </select>
        {!history.some(session => session.sessionId) && <p className="mut">Only newly saved sessions have stable IDs. Complete a new session before sending linked feedback.</p>}
        <label htmlFor="fm">Message</label>
        <textarea id="fm" rows="4" value={message} onChange={event => setMessage(event.target.value)} />
        <h3 style={{ marginTop: 12 }}>Preview as patient</h3>
        <p className="mut">{message || 'Your message appears here.'}</p>
        <button className="btn" disabled={!history.some(session => session.sessionId)} onClick={send}>Send feedback</button>
      </div>
    </>
  );
}
