import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/authContext';
import { useRecords } from '../records/recordsContext';
import { avg } from '../metrics';
import { LineChart, DemoBanner } from '../utils';
import { toast } from '../components/toastBus';
import Icon from '../components/Icon';
import WeeklyActivity from '../components/WeeklyActivity';
import MeetingsPanel from '../components/MeetingsPanel';
import { startDraft } from '../session/drafts';
import { clearSessionDraft, loadSessionDraft } from '../session/drafts';
import { workoutStreak } from '../patientFlow';

export default function PatientHome() {
  const nav = useNavigate();
  const { user } = useAuth();
  const { patientId, assignment, patientPlan, sessions, feedback, requests, createRequest, backend, workspace } = useRecords();
  const [contactOpen, setContactOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState(() => loadSessionDraft(patientId));
  const plan = patientPlan(patientId);
  const linkedPlan = assignment(patientId);
  const history = sessions(patientId);
  const streak = workoutStreak(history);
  const messages = feedback(patientId);
  const myRequests = requests(patientId);
  const unread = messages.filter(item => !item.read).length;
  const reminder = messages.find(item => item.reminder)?.reminder;
  const scored = history.filter(session => session.mode !== 'replay' && Number.isFinite(avg(session.r)));

  const clinicianName = workspace.relationship?.clinicianName ?? linkedPlan?.by ?? null;
  const clinicianEmail = workspace.relationship?.clinicianEmail ?? null;

  const contactClinician = async () => {
    if (!workspace.relationship) { nav('/patient/me'); return; }
    if (!message.trim()) return toast('Write a message first');
    setSending(true);
    try {
      await createRequest(patientId, {
        requestId: crypto.randomUUID(), kind: 'contact', message: message.trim(),
        creatorId: patientId, createdAt: new Date().toISOString(), status: 'open',
      });
      setMessage('');
      setContactOpen(false);
      toast('Message sent to your clinician');
    } catch {
      toast('Message was not saved. Check your connection and retry.');
    } finally {
      setSending(false);
    }
  };

  const totalTargetReps = plan ? plan.items.filter(item => !item.videoOnly).reduce((total, item) => total + item.targetReps, 0) : 0;

  return (
    <>
      {/* Top Clinical Header */}
      <div className="home-greeting row sp">
        <div>
          <p className="hello">Hello, {user.displayName.split(' ')[0]}<span className="greeting-dot">.</span></p>
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

      <MeetingsPanel />
      <section className="daily-focus">
        <div className="focus-copy">
          <span className="eyebrow"><span className="status-dot" /> YOUR SPACE TO MOVE</span>
          <h1>Progress, at<br /><em>your own pace.</em></h1>
          <p>Your plan. A little guidance. A step forward.<br />Make a moment for yourself today.</p>
          <button className="btn" onClick={() => nav(plan ? '/patient/workout' : '/patient/plan')}>
            {plan ? 'Start your session' : 'View your care plan'} <span aria-hidden="true">↗</span>
          </button>
        </div>
        <div className="focus-note">
          <span className="focus-orbit" aria-hidden="true"><Icon name="workout" size={26} /></span>
          <span>
            {plan?.items.length ?? 0} guided exercises
            <small>
              {linkedPlan
                ? `Prescribed by Dr. ${linkedPlan.by}`
                : plan?.source === 'self-guided'
                ? 'Starter template · pending clinical review'
                : 'Your movement plan'}
            </small>
          </span>
        </div>
      </section>

      {/* Direct AI Physiotherapist Banner Card */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, var(--pri2, #f3f0ff), #ffffff)',
          border: '1px solid #dcd5f8',
          borderRadius: '16px',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '14px',
          cursor: 'pointer',
          marginBottom: '20px',
        }}
        onClick={() => nav('/patient/ai-physio')}
        role="button"
        tabIndex={0}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--pri)', color: '#fff', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <Icon name="kira" size={22} color="#ffffff" />
          </div>
          <div>
            <b style={{ fontSize: 14, color: 'var(--ink)' }}>Kira · AI Physio</b>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--mut)' }}>
              Movement analysis, pain check, form cueing & recovery guidance
            </p>
          </div>
        </div>
        <button type="button" className="btn s" style={{ flexShrink: 0, padding: '8px 14px' }}>
          Consult AI ↗
        </button>
      </div>

      <div className="home-content">
        <section className="home-primary">
          {/* Movement Plan Section */}
          <div className="section-heading">
            <div>
              <span className="eyebrow">THE NEXT SMALL STEP</span>
              <h2>{linkedPlan ? `Prescribed plan (${linkedPlan.name})` : 'Your movement plan'}</h2>
            </div>
            <button className="text-action" onClick={() => nav('/patient/plan')}>View plan ↗</button>
          </div>

          {plan ? (
            <div className="exercise-list">
              {plan.items.map((item, index) => (
                <button
                  className="exercise-row"
                  key={`${item.ex}-${index}`}
                  onClick={() => nav('/patient/pre', { state: startDraft(plan, patientId, index, false) })}
                >
                  <span className="exercise-index">{String(index + 1).padStart(2, '0')}</span>
                  <span className="exercise-copy">
                    <b>{item.ex}</b>
                    <small>{item.note || 'Follow your prescribed movement target.'}</small>
                    <span className="exercise-meta">
                      {item.targetReps} repetitions <span>·</span> {item.videoOnly ? 'Guided video' : `${item.targetExcursionDeg || 45}° target`}
                    </span>
                  </span>
                  <span className="exercise-arrow" aria-hidden="true">↗</span>
                </button>
              ))}
              <div className="plan-footnote">
                <span>{plan.name}</span>
                <span>{totalTargetReps} target reps · {linkedPlan ? `Prescribed by ${linkedPlan.by}` : 'Starter plan'}</span>
              </div>
            </div>
          ) : (
            <div className="card">Loading your exercises…</div>
          )}

          {/* Clinical status notices */}
          {linkedPlan ? (
            <div className="card" style={{ borderLeft: '4px solid var(--ok, #10b981)', background: 'var(--soft)' }}>
              <b>Active Assigned Plan</b>
              <p className="mut" style={{ margin: '4px 0 0', fontSize: 13 }}>
                Prescribed by <b>Dr. {linkedPlan.by}</b> (Version {linkedPlan.v}). Targets are tailored to your biomechanical assessment.
              </p>
            </div>
          ) : workspace.relationship ? (
            <div className="card" style={{ borderLeft: '4px solid var(--warn)' }}>
              <b>Connected with {workspace.relationship.clinicianName}</b>
              <p className="mut" style={{ margin: '4px 0 0', fontSize: 13 }}>
                Your clinician is linked. You are currently following the starter mobility routine while your clinician finalizes your personalized prescription.
              </p>
            </div>
          ) : plan?.source === 'self-guided' ? (
            <div className="card" style={{ borderLeft: '4px solid var(--warn)' }}>
              <b>Self-guided starter template</b>
              <p className="mut" style={{ margin: '6px 0 0' }}>
                This fixed template has not been personalized to your health history. Connect with a clinician for custom targets or seek advice if you experience pain.
              </p>
            </div>
          ) : null}

          {/* Quick Actions / Stay Connected */}
          <div className="section-heading">
            <h2>Stay connected</h2>
            <span className="section-number">01 / CARE</span>
          </div>
          <div className="quick-actions" aria-label="Your care shortcuts">
            {[['plan', 'My plan', '/patient/plan'], ['prog', 'Progress', '/patient/prog'], ['fb', 'Feedback', '/patient/fb']].map(([icon, label, path]) => (
              <button key={path} onClick={() => nav(path)}>
                <span><Icon name={icon} size={22} /></span>{label}
              </button>
            ))}
            <button
              aria-expanded={contactOpen}
              aria-controls="contact-message"
              onClick={() => setContactOpen(open => !open)}
            >
              <span><Icon name="call" size={22} /></span>
              {workspace.relationship ? 'Contact Doctor' : 'Connect Doctor'}
            </button>
          </div>

          {/* Message / Contact Drawer */}
          {contactOpen && (
            <div id="contact-message" className="card" style={{ borderLeft: '4px solid var(--pri)' }}>
              {workspace.relationship ? (
                <>
                  <h3 id="contact-message-label">Message Dr. {workspace.relationship.clinicianName}</h3>
                  <p className="mut" style={{ fontSize: 13, margin: '2px 0 10px' }}>
                    Send a note directly to your clinician regarding pain, exercises, or recovery questions.
                  </p>
                  <textarea
                    aria-labelledby="contact-message-label"
                    rows="3"
                    value={message}
                    disabled={sending}
                    onChange={event => setMessage(event.target.value)}
                    placeholder="Describe any symptoms, pain, questions, or exercise feedback…"
                  />
                  <div className="row sp" style={{ marginTop: 10 }}>
                    <div className="row" style={{ gap: 8 }}>
                      <button className="btn" disabled={sending || !message.trim()} onClick={contactClinician}>
                        {sending ? 'Sending…' : 'Send message'}
                      </button>
                      <button className="btn s" onClick={() => setContactOpen(false)}>Cancel</button>
                    </div>
                    {clinicianEmail && (
                      <a href={`mailto:${clinicianEmail}?subject=Kineticare%20Rehabilitation%20Inquiry`} className="btn s sm">
                        Email Doctor ✉
                      </a>
                    )}
                  </div>
                  <p className="mut" style={{ fontSize: 12, marginTop: 8 }}>
                    Non-urgent clinical communication. For emergencies, please call emergency services immediately.
                  </p>
                </>
              ) : (
                <>
                  <h3>Connect with a Clinician</h3>
                  <p className="mut" style={{ fontSize: 13, margin: '6px 0 12px' }}>
                    You are currently using Kineticare in self-guided mode. You can link your account with your physician using their care invite code, or consult our AI Physiotherapist for immediate movement guidance.
                  </p>
                  <div className="row" style={{ gap: 8 }}>
                    <button className="btn" onClick={() => nav('/patient/me')}>Enter Invite Code ↗</button>
                    <button className="btn s" onClick={() => nav('/patient/ai-physio')}>Consult AI Physio ↗</button>
                    <button className="btn s" onClick={() => setContactOpen(false)}>Cancel</button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Linked Clinician Connection Card */}
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
                  {clinicianName ?? 'No clinician linked'}
                </div>
                <div className="mut" style={{ fontSize: 13 }}>
                  {clinicianEmail ? (
                    <span>Email: <a href={`mailto:${clinicianEmail}`} style={{ color: 'var(--pri)' }}>{clinicianEmail}</a></span>
                  ) : (
                    'Your rehabilitation clinician'
                  )}
                </div>
              </div>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <span className={`tag ${workspace.relationship ? 'ok' : 'warn'}`}>
                {workspace.relationship ? 'Linked' : 'Independent'}
              </span>
              <button
                className="btn s sm"
                onClick={() => {
                  if (workspace.relationship) {
                    setContactOpen(true);
                  } else {
                    nav('/patient/me');
                  }
                }}
              >
                {workspace.relationship ? 'Contact' : 'Connect'}
              </button>
            </div>
          </div>

          {/* Patient Sent Requests & Inquiries Card */}
          {myRequests.length > 0 && (
            <div className="card">
              <div className="row sp" style={{ marginBottom: 8 }}>
                <h3 style={{ margin: 0 }}>Recent Messages to Clinician</h3>
                <button className="btn s sm" onClick={() => setContactOpen(true)}>+ New message</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {myRequests.slice(-3).reverse().map(req => (
                  <div key={req.requestId} style={{ padding: '10px 12px', background: 'var(--soft)', borderRadius: 10 }}>
                    <div className="row sp" style={{ fontSize: 12, marginBottom: 4 }}>
                      <span className={`tag ${req.status === 'open' ? 'warn' : 'ok'}`}>
                        {req.status === 'open' ? 'Awaiting Doctor Reply' : 'Resolved'}
                      </span>
                      <span className="mut">{new Date(req.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--ink)' }}>{req.message}</p>
                    {req.replies?.map((rep, idx) => (
                      <div key={rep.replyId || idx} style={{ marginTop: 6, paddingLeft: 10, borderLeft: '2px solid var(--pri)' }}>
                        <b style={{ fontSize: 12, color: 'var(--pri)' }}>{rep.senderName || 'Doctor'}:</b>
                        <p style={{ margin: 0, fontSize: 12 }}>{rep.message}</p>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

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
        </section>

        <aside className="home-secondary">
          <div className="section-heading"><h2>A little perspective</h2><span className="section-number">02 / PROGRESS</span></div>
          <WeeklyActivity sessions={history} />
          <div className="recovery-stats">
            <div className="card"><span className="eyebrow">STAYING CONSISTENT</span><b>{streak.current}<small> day streak</small></b><p className="mut">Best: {streak.best} days · {streak.practicedToday ? 'Done for today' : 'One step at a time'}</p></div>
            <button className="card" onClick={() => nav('/patient/prog')}><span className="eyebrow">YOUR JOURNEY</span><b>{history.filter(session => session.status === 'completed' && session.mode === 'live').length}<small> workouts</small></b><p className="mut">View your progress <span aria-hidden="true">↗</span></p></button>
          </div>
          <p className="mut rest-note">Completed live workouts count toward your streak. Follow your clinician’s rest schedule.</p>

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
          {backend === 'local-demo' && <DemoBanner />}
        </aside>
      </div>
    </>
  );
}
