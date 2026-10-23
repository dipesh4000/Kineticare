import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/authContext';
import { useRecords } from '../records/recordsContext';
import { avg } from '../metrics';
import { LineChart, DemoBanner } from '../utils';
import { toast } from '../components/toastBus';
import Icon from '../components/Icon';
import WeeklyActivity from '../components/WeeklyActivity';
import MovementArt from '../components/MovementArt';
import { clearSessionDraft, loadSessionDraft } from '../session/drafts';
import { workoutStreak } from '../patientFlow';

export default function PatientHome() {
  const nav = useNavigate();
  const { user } = useAuth();
  const { patientId, assignment, sessions, feedback, createRequest, backend } = useRecords();
  const [contactOpen, setContactOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [draft, setDraft] = useState(() => loadSessionDraft(patientId));
  const plan = assignment(patientId);
  const history = sessions(patientId);
  const streak = workoutStreak(history);
  const messages = feedback(patientId);
  const unread = messages.filter(item => !item.read).length;
  const reminder = messages.find(item => item.reminder)?.reminder;
  const scored = history.filter(session => session.mode !== 'replay' && Number.isFinite(avg(session.r)));

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

  const totalTargetReps = plan ? plan.items.filter(item => !item.videoOnly).reduce((total, item) => total + item.targetReps, 0) : 0;

  return (
    <>
      {/* Top Clinical Header */}
      <div className="row sp" style={{ marginBottom: 14 }}>
        <div>
          <p className="hello">Good to see you, <b>{user.displayName.split(' ')[0]}</b></p>
          <p className="mut" style={{ fontSize: 13, marginTop: 2 }}>
            {new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric' }).format(new Date())}
          </p>
        </div>
        <div className="hd" style={{ gap: 8 }}>
          <button
            className="call-btn"
            style={{ background: 'none' }}
            aria-label="Notifications"
            onClick={() => unread ? nav('/patient/fb') : toast('No new notifications')}
          >
            <Icon name="bell" color="var(--pri)" size={20} />
          </button>
          <div className="av">
            {user.displayName.split(' ').map(part => part[0]).slice(0, 2).join('')}
          </div>
        </div>
      </div>

      {backend === 'local-demo' && <DemoBanner />}
      <section className="daily-focus">
        <div className="focus-copy"><span className="tag">YOUR DAILY MOVEMENT</span><h2>A little stronger.<br />Every day.</h2><p>{plan ? `${plan.items.length} exercises, at your own pace.` : 'Your next step starts with a care plan.'}</p><button className="btn w" onClick={() => nav(plan ? '/patient/workout' : '/patient/plan')}>{plan ? 'Let’s move' : 'My care plan'} <span aria-hidden="true">↗</span></button></div>
        <MovementArt exercise={plan?.items[0]?.ex} />
      </section>
      <div className="quick-actions" aria-label="Your care shortcuts">
        {[['plan', 'My plan', '/patient/plan'], ['prog', 'Progress', '/patient/prog'], ['fb', 'Feedback', '/patient/fb']].map(([icon, label, path]) =>
          <button key={path} onClick={() => nav(path)}><span><Icon name={icon} size={22} /></span>{label}</button>)}
        <button aria-expanded={contactOpen} aria-controls="contact-message" onClick={() => setContactOpen(open => !open)}><span><Icon name="call" size={22} /></span>Contact</button>
      </div>
      {/* Message Drawer */}
      {contactOpen && (
        <div id="contact-message" className="card" style={{ borderLeft: '4px solid var(--pri)' }}>
          <h3 id="contact-message-label">Message your clinician</h3>
          <textarea
            aria-labelledby="contact-message-label"
            rows="3"
            value={message}
            onChange={event => setMessage(event.target.value)}
            placeholder="Describe any symptoms, pain, or questions"
          />
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn" onClick={contactClinician}>Send message</button>
            <button className="btn s" onClick={() => setContactOpen(false)}>Cancel</button>
          </div>
          <p className="mut" style={{ fontSize: 12, marginTop: 6 }}>
            Non-urgent clinical communication. For emergencies, please call emergency services immediately.
          </p>
        </div>
      )}

      <WeeklyActivity sessions={history} />
      <div className="recovery-stats">
        <div className="card"><span className="eyebrow">STAYING CONSISTENT</span><b>{streak.current}<small> day streak</small></b><p className="mut">Best: {streak.best} days · {streak.practicedToday ? 'Done for today' : 'One step at a time'}</p></div>
        <button className="card" onClick={() => nav('/patient/prog')}><span className="eyebrow">YOUR JOURNEY</span><b>{history.filter(session => session.status === 'completed' && session.mode === 'live').length}<small> workouts</small></b><p className="mut">View your progress <span aria-hidden="true">↗</span></p></button>
      </div>
      <p className="mut rest-note">Completed live workouts count toward your streak. Follow your clinician’s rest schedule.</p>

      {/* Linked Clinician Connection Card (Styled like Screen 3 in Reference Image) */}
      <div className="card row sp" style={{ padding: '14px 18px', marginBottom: 16 }}>
        <div className="row" style={{ gap: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: 'var(--pri2)',
              display: 'grid',
              placeItems: 'center',
              color: 'var(--pri)',
            }}
          >
            <Icon name="me" size={22} color="var(--pri)" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--pri)' }}>
              {plan?.by ?? user.clinicianName ?? 'No clinician linked'}
            </div>
            <div className="mut" style={{ fontSize: 13 }}>
              Your rehabilitation clinician
            </div>
          </div>
        </div>
        <span className={`tag ${plan || user.clinicianName ? 'ok' : 'warn'}`}>{plan || user.clinicianName ? 'Linked' : 'Awaiting assignment'}</span>
      </div>

      {/* Clinician Reminder if present */}
      {reminder && (
        <div
          className="card row"
          style={{
            background: 'var(--warnb)',
            borderColor: 'rgba(180, 83, 9, 0.2)',
            padding: '12px 16px',
            marginBottom: 16,
          }}
        >
          <Icon name="clock" size={20} color="var(--warn)" />
          <div style={{ fontSize: 13, color: 'var(--warn)' }}>
            <b>Reminder:</b> {reminder}
          </div>
        </div>
      )}

      {/* Unfinished Session Alert */}
      {draft && (
        <div className="card" style={{ borderLeft: '4px solid var(--warn)' }}>
          <div className="row sp">
            <div>
              <h3 style={{ margin: 0 }}>Unfinished session</h3>
              <p className="mut" style={{ fontSize: 13, marginTop: 4 }}>
                Pick up where you left off. Calibration will run before continuing.
              </p>
            </div>
            <span className="tag warn">Draft</span>
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn sm" onClick={() => nav('/patient/pre', { state: draft })}>Resume</button>
            <button className="btn s sm" onClick={() => { clearSessionDraft(patientId); setDraft(null); }}>Discard</button>
          </div>
        </div>
      )}

      <div className="section-heading"><div><span className="eyebrow">PRESCRIBED FOR YOU</span><h2>Your movement plan</h2></div><button className="text-action" onClick={() => nav('/patient/plan')}>View plan ↗</button></div>
      {plan ? <>
        <div className="exercise-preview-grid">
          {plan.items.map((item, index) => <button className="exercise-preview" key={`${item.ex}-${index}`} onClick={() => nav('/patient/workout')}>
            <div className="exercise-visual"><span className="exercise-number">{String(index + 1).padStart(2, '0')}</span><MovementArt exercise={item.ex} /><span className="exercise-arrow" aria-hidden="true">↗</span></div>
            <div className="exercise-caption"><b>{item.ex}</b><span>{item.targetReps} reps · {item.videoOnly ? 'Guided video' : 'Camera guided'}</span></div>
          </button>)}
        </div>
        <p className="mut plan-footnote">{totalTargetReps} target repetitions · {plan.name}</p>
      </> : <div className="card">No active assignment. Contact your clinician.</div>}

      {/* Doctor Feedback Card */}
      <div className="card">
        <div className="row sp" style={{ marginBottom: 6 }}>
          <h3 style={{ margin: 0 }}>Clinician Notes & Feedback</h3>
          {unread > 0 && <span className="tag warn">{unread} new</span>}
        </div>
        <p style={{ margin: '6px 0', fontSize: 14 }}>
          {messages[0]?.m ?? 'No messages from your clinician yet.'}
        </p>
        {messages.length > 0 && (
          <button className="btn s sm" style={{ marginTop: 8 }} onClick={() => nav('/patient/fb')}>
            View feedback history
          </button>
        )}
      </div>

      {/* Recent Sessions */}
      <div className="row sp" style={{ margin: '18px 0 10px' }}>
        <h2 style={{ margin: 0 }}>Recent workouts</h2>
        <button className="btn s sm" onClick={() => nav('/patient/prog')}>See all</button>
      </div>

      <div className="hs">
        {history.length ? (
          history.slice(-3).reverse().map(session => (
            <div key={session.sessionId ?? session.d} className="card" style={{ minWidth: 230 }}>
              <div className="row sp" style={{ marginBottom: 6 }}>
                <b>{session.d}</b>
                <span className={`tag ${session.status === 'partial' || session.mode === 'replay' ? 'warn' : 'ok'}`}>
                  {session.mode === 'replay' ? 'Replay · ' : ''}{session.status ?? 'completed'}
                </span>
              </div>
              <p className="mut" style={{ fontSize: 13, margin: '4px 0 10px' }}>
                {session.r.length} exercises · Score {avg(session.r) == null ? '—' : Math.round(avg(session.r) * 100)}/100
              </p>
              <div className="row sp" style={{ marginTop: 8 }}>
                <button className="btn s sm" onClick={() => nav('/patient/workout')}>Repeat plan</button>
                <button className="call-btn" aria-label="Message clinician" onClick={() => setContactOpen(true)}>
                  <Icon name="fb" color="#fff" size={18} />
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="card">No saved sessions yet. Complete your first workout to see results here.</div>
        )}
      </div>

      {/* Score Trend */}
      {scored.length > 0 && (
        <div className="card">
          <h3>Movement Quality Trend</h3>
          <LineChart vals={scored.map(session => avg(session.r))} labs={scored.map(session => session.d.slice(0, 6))} />
          <p className="mut" style={{ fontSize: 12, marginTop: 4 }}>
            0–100 movement quality index based on joint range compliance and tempo smoothness.
          </p>
        </div>
      )}
    </>
  );
}
