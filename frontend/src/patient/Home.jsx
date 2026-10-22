import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/authContext';
import { useRecords } from '../records/recordsContext';
import { avg } from '../metrics';
import { LineChart, DemoBanner } from '../utils';
import { toast } from '../components/toastBus';
import Icon from '../components/Icon';
import { clearSessionDraft, loadSessionDraft } from '../session/drafts';
import PWAInstallButton from '../components/PWAInstallButton';
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
          <p className="hello">Hello, <b>{user.displayName.split(' ')[0]}</b></p>
          <p className="mut" style={{ fontSize: 13, marginTop: 2 }}>
            {new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric' }).format(new Date())}
          </p>
        </div>
        <div className="hd" style={{ gap: 8 }}>
          <PWAInstallButton />
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
      <div className="card">
        <h3>{streak.current} day workout streak</h3>
        <p className="mut">Best: {streak.best} days · {streak.practicedToday ? 'Workout completed today.' : 'Complete a live workout to count today.'}</p>
        <p className="mut">Completed camera sessions count once per day. Partial workouts and replays do not count. Follow your clinician’s rest schedule.</p>
      </div>

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

      {/* Main Prescribed Rehabilitation Plan Card (Styled like Screen 1 in Reference Image) */}
      {plan ? (
        <div className="card" style={{ textAlign: 'center', padding: '24px 20px', marginBottom: 18 }}>
          <div
            style={{
              width: 58,
              height: 58,
              borderRadius: '50%',
              background: 'var(--pri2)',
              display: 'grid',
              placeItems: 'center',
              margin: '0 auto 14px',
            }}
          >
            <Icon name="plan" size={28} color="var(--pri)" />
          </div>
          <h2 style={{ margin: '0 0 6px', fontSize: 20 }}>{plan.name}</h2>
          <p className="mut" style={{ margin: '0 0 16px', fontSize: 14 }}>
            {plan.items.length} prescribed exercises · {totalTargetReps} target repetitions with live camera guidance.
          </p>
          <button className="btn" style={{ width: '100%', maxWidth: 320 }} onClick={() => nav('/patient/workout')}>
            Begin Workout
          </button>
          <div style={{ marginTop: 12 }}>
            <button
              onClick={() => nav('/patient/plan')}
              style={{ background: 'none', border: 0, color: 'var(--pri)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              View exercise instructions →
            </button>
          </div>
        </div>
      ) : (
        <div className="card">No active assignment. Contact your clinician.</div>
      )}

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

      {/* Message Drawer */}
      {contactOpen && (
        <div className="card" style={{ borderLeft: '4px solid var(--pri)' }}>
          <h3>Message your clinician</h3>
          <textarea
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
