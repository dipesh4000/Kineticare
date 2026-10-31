import { useState } from 'react';
import { useAuth } from '../auth/authContext';
import { connectedApi } from '../services/atlasRecords';

export default function AiExerciseDrafts() {
  const { connectedEnabled } = useAuth();
  const [brief, setBrief] = useState('');
  const [reference, setReference] = useState('Kisner & Colby, Therapeutic Exercise, 6th edition (2012), chapter / page: ');
  const [referenceNotes, setReferenceNotes] = useState('');
  const [consent, setConsent] = useState(false);
  const [drafts, setDrafts] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reviewNote, setReviewNote] = useState('');
  const run = async action => {
    setBusy(true); setError('');
    try { await action(); } catch (cause) { setError(cause.message); } finally { setBusy(false); }
  };
  const load = async () => setDrafts(await connectedApi('ai/drafts'));
  return <section className="card" aria-labelledby="ai-drafts-heading">
    <div className="row sp"><h2 id="ai-drafts-heading">Gemini exercise drafts</h2><span className="tag warn">Clinician review required</span></div>
    <p className="mut">Draft exercise education from your reference notes. Drafts are saved in Atlas and are not available for patient assignment or camera scoring.</p>
    {!connectedEnabled ? <p>Sign in with a connected clinician account to use Gemini and Atlas.</p> : <>
      <form onSubmit={event => { event.preventDefault(); run(async () => { await connectedApi('ai/drafts', { brief, reference, referenceNotes, consent }); await load(); }); }}>
        <label htmlFor="ai-brief">Exercise brief (no patient information)</label><input id="ai-brief" value={brief} maxLength={3000} required onChange={event => setBrief(event.target.value)} />
        <label htmlFor="ai-source">Reference, edition, chapter and page</label><input id="ai-source" value={reference} maxLength={3000} required onChange={event => setReference(event.target.value)} />
        <label htmlFor="ai-notes">Your own summary of the relevant reference</label><textarea id="ai-notes" value={referenceNotes} maxLength={3000} required rows="4" onChange={event => setReferenceNotes(event.target.value)} />
        <p className="mut">Manual-note drafts use only the notes supplied here. For retrieved textbook evidence and illustrative animation previews, use Exercise knowledge chat above.</p>
        <label className="check-label"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} />Send this brief, reference and notes to Google Gemini. I have excluded identifiable patient data.</label>
        <div className="row"><button className="btn" disabled={busy || !consent}>{busy ? 'Working…' : 'Generate draft'}</button><button type="button" className="btn s" disabled={busy} onClick={() => run(load)}>Load saved drafts</button></div>
      </form>
      {drafts.length > 0 && <><label htmlFor="ai-review-note">Review note (required for a decision)</label><input id="ai-review-note" value={reviewNote} maxLength={2000} onChange={event => setReviewNote(event.target.value)} /></>}
      {drafts.map(draft => <article className="card" key={draft._id}><div className="row sp"><h3>{draft.exercise.name}</h3><span className="tag">{draft.status}</span></div><p>{draft.exercise.description}</p><ol>{draft.exercise.steps.map((step, index) => <li key={index}>{step}</li>)}</ol><h4>Precautions to verify</h4><ul>{draft.exercise.precautions.map((item, index) => <li key={index}>{item}</li>)}</ul><p className="mut">Source supplied by author: {draft.reference} · Model: {draft.model}</p>{draft.reviewNote && <p>Review: {draft.reviewNote}</p>}{draft.status === 'pending-review' && <div className="row">{[['reviewed', 'Mark reviewed'], ['rejected', 'Reject']].map(([status, label]) => <button key={status} className="btn s sm" disabled={busy || !reviewNote.trim()} onClick={() => run(async () => { await connectedApi(`ai/drafts/${draft._id}/review`, { status, note: reviewNote }); await load(); })}>{label}</button>)}</div>}</article>)}
    </>}
    {error && <p role="alert" className="demo">{error}</p>}
  </section>;
}
