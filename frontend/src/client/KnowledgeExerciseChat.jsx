import { lazy, Suspense, useEffect, useState } from 'react';
import { useAuth } from '../auth/authContext';
import { connectedApi } from '../services/atlasRecords';

const ExerciseAnimationPreview = lazy(() => import('../components/ExerciseAnimationPreview'));

export default function KnowledgeExerciseChat() {
  const { connectedEnabled } = useAuth();
  const [catalog, setCatalog] = useState([]);
  const [exerciseId, setExerciseId] = useState('EX-KU-000001');
  const [message, setMessage] = useState('Explain this exercise, its movement phases and the source-supported precautions.');
  const [consent, setConsent] = useState(false);
  const [turns, setTurns] = useState([]);
  const [previewId, setPreviewId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!connectedEnabled) return undefined;
    let active = true;
    Promise.all([connectedApi('ai/knowledge-chat/catalog'), connectedApi('ai/knowledge-chat')])
      .then(([data, history]) => { if (active) { setCatalog(data.exercises); setTurns(history); } })
      .catch(cause => { if (active) setError(cause.message); });
    return () => { active = false; };
  }, [connectedEnabled]);

  async function ask(event) {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      const turn = await connectedApi('ai/knowledge-chat', { message, exerciseId: exerciseId || null, consent }, 75000);
      setTurns(current => [...current, turn].slice(-20));
      if (turn.preview) setPreviewId(turn._id);
    } catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  }

  return <section className="card" aria-labelledby="knowledge-chat-heading">
    <div className="row sp"><h2 id="knowledge-chat-heading">Exercise knowledge chat</h2><span className="tag warn">Clinician review</span></div>
    <p className="mut">Ask Gemini using the source-linked textbook pilot: 8 exercise variations. Responses include evidence and unresolved details. Mini-squat responses can include an illustrative 3D preview and downloadable video.</p>
    {!connectedEnabled ? <p>Sign in with a clinician account to use the knowledge chat.</p> : <>
      <form onSubmit={ask}>
        <label htmlFor="knowledge-exercise">Exercise variation</label><select id="knowledge-exercise" value={exerciseId} onChange={event => setExerciseId(event.target.value)}><option value="">Resolve from my question</option>{catalog.map(exercise => <option key={exercise.exercise_id} value={exercise.exercise_id}>{exercise.exercise_name}</option>)}</select>
        <label htmlFor="knowledge-message">Question or demonstration request</label><textarea id="knowledge-message" value={message} required maxLength={3000} rows={3} onChange={event => setMessage(event.target.value)} />
        <label className="check-label"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} />Send my question, recent chat context and retrieved source summaries to Google Gemini. I have excluded patient-identifying information.</label>
        <button className="btn" disabled={busy || !consent || catalog.length === 0}>{busy ? 'Retrieving evidence and asking Gemini…' : 'Ask Gemini'}</button>
      </form>
      <div aria-live="polite">{turns.map(turn => <article className="card" key={turn._id} style={{ marginTop: 16 }}>
        <p><b>You:</b> {turn.message}</p><h3>{turn.exercise?.exercise_name ?? 'Exercise clarification'}</h3>
        {turn.plan.claims.map((claim, index) => <p key={index}>{claim.text}</p>)}
        {turn.plan.questions.map((question, index) => <p key={index}><b>Clarification:</b> {question}</p>)}
        {turn.plan.missing_requirements.length > 0 && <details><summary>Details requiring review</summary><ul>{turn.plan.missing_requirements.map((item, index) => <li key={index}>{item}</li>)}</ul></details>}
        {turn.citations.length > 0 && <details><summary>Source evidence ({turn.citations.length})</summary><ul>{turn.citations.map(source => <li key={source.id}>{source.title} — chapter {source.chapter_number}, printed pp. {source.printed_page_numbers.join(', ')}, PDF pp. {source.pdf_page_numbers.join(', ')} ({source.id})</li>)}</ul></details>}
        {turn.preview && <><button type="button" className="btn s" style={{ marginTop: 12 }} onClick={() => setPreviewId(previewId === turn._id ? null : turn._id)}>{previewId === turn._id ? 'Close animation' : 'Open illustrative animation'}</button>{previewId === turn._id && <Suspense fallback={<p>Loading 3D preview…</p>}><ExerciseAnimationPreview descriptor={turn.preview} /></Suspense>}</>}
        <p className="mut">Source-grounded draft · Clinical review pending · Model: {turn.model}</p>
      </article>)}</div>
    </>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
