import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/authContext';
import { useRecords } from '../records/recordsContext';
import { avg } from '../metrics';
import { LineChart, DemoBanner } from '../utils';
import { toast } from '../components/toastBus';
import Icon from '../components/Icon';
import { clearSessionDraft, loadSessionDraft } from '../session/drafts';

export default function PatientHome() {
  const nav = useNavigate();
  const { user } = useAuth();
  const { patientId, assignment, sessions, feedback, createRequest, backend } = useRecords();
  const [contactOpen, setContactOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [draft, setDraft] = useState(() => loadSessionDraft(patientId));
  const plan = assignment(patientId);
  const history = sessions(patientId);
  const messages = feedback(patientId);
  const unread = messages.filter(item => !item.read).length;
  const reminder = messages.find(item => item.reminder)?.reminder;
  const scored = history.filter(session => Number.isFinite(avg(session.r)));

  const contactClinician = () => {
    if (!message.trim()) return toast('Write a message first');
    createRequest(patientId, {
      requestId: crypto.randomUUID(), kind: 'contact', message: message.trim(),
      creatorId: patientId, createdAt: new Date().toISOString(), status: 'open',
    });
    setMessage('');
    setContactOpen(false);
    toast('Message saved for your clinician');
  };

  return (
    <>
      <div className="row sp">
        <p className="hello">Hello,<b>{user.displayName}!</b></p>
        <div className="hd">
          <button className="call-btn" style={{ background: 'none' }} aria-label="Notifications" onClick={() => unread ? nav('/patient/fb') : toast('No new notifications')}>
            <Icon name="bell" color="var(--ink)" />
          </button>
          <div className="av">{user.displayName.split(' ').map(part => part[0]).slice(0, 2).join('')}</div>
        </div>
      </div>

      <div className="card" style={{ background: 'var(--pri2)', marginTop: 16 }}>
        <span className="mut">Current doctor</span>
        <h3 style={{ marginTop: 2 }}>{plan?.by ?? 'Not linked yet'}</h3>
      </div>
      <div className="card" style={{ background: 'var(--pri2)' }}>
        <span className="mut">Welcome back, {user.displayName.split(' ')[0]}. Today's date</span>
        <h3 style={{ marginTop: 2 }}>{new Intl.DateTimeFormat('en-GB').format(new Date())}</h3>
      </div>
      <div className="card" style={{ background: 'var(--pri2)' }}>
        <span className="mut">Reminders</span>
        <p style={{ margin: '2px 0 0' }}>{reminder ?? 'No reminders from your clinician.'}</p>
      </div>
      {backend === 'local-demo' && <DemoBanner />}

      <h2>Current assignment</h2>
      {draft && <div className="card">
        <div className="row sp"><div><h3>Unfinished session</h3><p className="mut">Camera calibration will run again before measurements resume.</p></div><span className="tag warn">Draft</span></div>
        <div className="row"><button className="btn sm" onClick={() => nav('/patient/pre', { state: draft })}>Resume</button><button className="btn s sm" onClick={() => { clearSessionDraft(patientId); setDraft(null); }}>Discard</button></div>
      </div>}
      {plan ? (
        <div className="card hero">
          <div className="row">
            <div className="thumb"><Icon name="plan" color="var(--pri)" /></div>
            <div><h3 style={{ fontSize: 19 }}>{plan.name}</h3><div className="mut">v{plan.v} · set by {plan.by}</div></div>
          </div>
          <div className="pill"><span><Icon name="clock" size={18} color="#fff" /> {plan.items.filter(item => !item.videoOnly).length} measured exercises · {plan.items.filter(item => !item.videoOnly).reduce((total, item) => total + item.targetReps, 0)} target reps{plan.items.some(item => item.videoOnly) ? ' · 1 video guide' : ''}</span></div>
          <button className="btn w" onClick={() => nav('/patient/workout')}>Start workout</button>
        </div>
      ) : <div className="card">No active assignment.</div>}

      <div className="card">
        <div className="row sp"><h3>Doctor feedback and assignments</h3>{unread ? <span className="tag warn">{unread} new</span> : null}</div>
        <p>{messages[0]?.m ?? 'No feedback yet.'}</p>
        {plan && <p className="mut">Assigned: {plan.items.map(item => `${item.ex} (${item.targetReps} reps)`).join(', ')}</p>}
        {messages.length > 0 && <button className="btn s sm" onClick={() => nav('/patient/fb')}>Open feedback</button>}
      </div>

      <div className="row sp"><h2>Recent sessions</h2><button className="btn s sm" onClick={() => nav('/patient/prog')}>See all</button></div>
      <div className="hs">
        {history.length ? history.slice(-3).reverse().map(session => (
          <div key={session.sessionId ?? session.d} className="card">
            <b>{session.d}</b>
            <p className="mut">{session.r.length} exercises · score {avg(session.r) == null ? 'unavailable' : Math.round(avg(session.r) * 100)}</p>
            <span className={`tag ${session.status === 'partial' ? 'warn' : 'ok'}`}>{session.status ?? 'completed'}</span>
            <div className="row sp" style={{ marginTop: 10 }}>
              <button className="btn s sm" onClick={() => nav('/patient/workout')}>Repeat current plan</button>
              <button className="call-btn" aria-label="Message clinician" onClick={() => setContactOpen(true)}><Icon name="fb" color="#fff" size={20} /></button>
            </div>
          </div>
        )) : <div className="card">No saved sessions yet.</div>}
      </div>

      {contactOpen && <div className="card">
        <h3>Message your clinician</h3>
        <textarea rows="3" value={message} onChange={event => setMessage(event.target.value)} placeholder="Describe what you need help with" />
        <div className="row" style={{ marginTop: 10 }}><button className="btn" onClick={contactClinician}>Send message</button><button className="btn s" onClick={() => setContactOpen(false)}>Cancel</button></div>
        <p className="mut">This is an asynchronous, nonurgent message.</p>
      </div>}

      <div className="card">
        <h3>Saved activity</h3>
        <p><b>{history.length}</b> saved sessions</p>
        <p className="mut">A completion percentage appears only after the clinician adds a schedule.</p>
      </div>

      <div className="card">
        <h3>Prototype score trend</h3>
        <LineChart vals={scored.map(session => avg(session.r))} labs={scored.map(session => session.d.slice(0, 6))} />
        <p className="mut">0–100 display derived from compatible saved prototype scores; not a recovery percentage.</p>
      </div>
    </>
  );
}
