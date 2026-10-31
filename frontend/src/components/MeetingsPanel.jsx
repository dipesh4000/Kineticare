import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/authContext';
import { useRecords } from '../records/recordsContext';
import { localDayKey, meetingsOnDay } from '../calendar';
import CurrentWeek from './CurrentWeek';
import { toast } from './toastBus';
import Icon from './Icon';

export default function MeetingsPanel() {
  const { user } = useAuth();
  const { workspace, scheduleMeeting, cancelMeeting } = useRecords();
  const clinician = user?.role === 'clinician';
  const dialog = useRef(null);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(timer); }, []);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState({ title: '', patientId: '', startsAt: '', durationMinutes: 30, url: '' });
  const meetings = workspace.meetings ?? [];
  const upcoming = meetings.filter(meeting => meeting.status === 'scheduled' && Date.parse(meeting.endsAt) > now).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const visible = selected ? meetingsOnDay(meetings, selected).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt)) : upcoming;
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const change = event => setDraft(current => ({ ...current, [event.target.name]: event.target.value }));

  async function save(event) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const date = new Date(fields.get('startsAt'));
    if (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now()) { setError('Choose a future meeting date and time.'); return; }
    setBusy(true); setError('');
    try {
      await scheduleMeeting({ ...draft, startsAt: date.toISOString(), durationMinutes: Number(draft.durationMinutes), patientId: draft.patientId || null });
      setDraft({ title: '', patientId: '', startsAt: '', durationMinutes: 30, url: '' });
      setSelected(null); dialog.current.close(); toast('Meeting scheduled. It will appear in the calendar.');
    } catch (cause) { setError(cause.message || 'The meeting could not be saved. Your details are still here.'); }
    finally { setBusy(false); }
  }

  async function cancel(meeting) {
    if (!confirm(`Cancel “${meeting.title}”?`)) return;
    setBusy(true);
    try { await cancelMeeting(meeting._id); toast('Meeting cancelled. The calendar will update.'); }
    catch (cause) { toast(cause.message || 'Could not cancel this meeting. Try again.'); }
    finally { setBusy(false); }
  }

  return <section className="meetings-panel" aria-label="Meeting calendar">
    <CurrentWeek meetings={meetings} selectedDate={selected ? localDayKey(selected) : null} onSelect={setSelected} />
    <div className="section-heading"><h2>{selected ? `Meetings · ${selected.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : 'Upcoming meetings'}</h2>{clinician && <button type="button" className="btn s sm" onClick={() => { setError(''); dialog.current.showModal(); }}><Icon name="cal" size={17} />Schedule</button>}</div>
    {selected && <button type="button" className="text-action" onClick={() => setSelected(null)}>Show all upcoming</button>}
    {visible.length ? <div className="meeting-list">{visible.map(meeting => <article className="meeting-card" key={meeting._id}><span className="meeting-date"><b>{new Date(meeting.startsAt).getDate()}</b>{new Date(meeting.startsAt).toLocaleDateString(undefined, { month: 'short' })}</span><div className="meeting-details"><h3>{meeting.title}</h3><p>{new Date(meeting.startsAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} · {meeting.durationMinutes} min</p><small>{clinician ? workspace.patients.find(patient => patient.id === meeting.patientId)?.n ?? (meeting.patientId ? 'Previously linked patient' : 'Personal meeting') : `With ${meeting.clinicianName}`}</small><div className="meeting-actions">{meeting.url && <a className="btn s sm" href={meeting.url} target="_blank" rel="noreferrer">Open meeting link ↗</a>}{clinician && <button type="button" className="text-action" disabled={busy} onClick={() => cancel(meeting)}>Cancel meeting</button>}</div></div></article>)}</div> : <p className="meeting-empty">{selected ? 'No meetings on this date.' : clinician ? 'No upcoming meetings. Schedule your next appointment here.' : 'No upcoming meetings. Appointments from your linked clinician will appear here.'}</p>}
    {visible.length > 0 && <p className="meeting-timezone">Times shown in {zone}.</p>}
    {clinician && <dialog ref={dialog} className="meeting-dialog" onCancel={event => { if (busy) event.preventDefault(); }}><form onSubmit={save}><div className="row sp"><h2>Schedule a meeting</h2><button type="button" className="btn s sm" aria-label="Close meeting form" disabled={busy} onClick={() => dialog.current.close()}>×</button></div><p className="mut">Choose the time in {zone}. Patient appointments appear in their calendar once saved.</p><fieldset disabled={busy}><label>Meeting title<input name="title" value={draft.title} onChange={change} maxLength={120} required placeholder="e.g. Recovery check-in" /></label><label>Patient<select name="patientId" value={draft.patientId} onChange={change}><option value="">Personal meeting (only you)</option>{workspace.patients.map(patient => <option key={patient.id} value={patient.id}>{patient.n}</option>)}</select></label><div className="meeting-form-grid"><label>Date and time<input type="datetime-local" name="startsAt" value={draft.startsAt} onChange={change} onInput={change} required /></label><label>Duration<select name="durationMinutes" value={draft.durationMinutes} onChange={change}>{[15, 30, 45, 60, 90, 120].map(value => <option key={value} value={value}>{value} minutes</option>)}</select></label></div><label>Meeting link <span className="mut">Optional</span><input type="url" name="url" value={draft.url} onChange={change} maxLength={2000} placeholder="https://…" pattern="https://.*" /></label></fieldset>{error && <p className="session-status" role="alert">{error}</p>}<p className="mut">Saved in Kineticare. This does not create a video call or send an email invitation.</p><button className="btn meeting-save" disabled={busy}>{busy ? 'Scheduling…' : 'Save meeting'}</button></form></dialog>}
  </section>;
}
