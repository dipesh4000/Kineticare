import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/authContext';
import { connectedApi } from '../services/atlasRecords';
import { toast } from '../components/toastBus';
import Icon from '../components/Icon';

const ExerciseAnimationPreview = lazy(() => import('../components/ExerciseAnimationPreview'));
const TASKS = [
  { id: 'guide', title: 'Patient-friendly guide', icon: 'plan', detail: 'Clear setup and movement instructions', prompt: 'Write a concise patient-friendly movement guide for the selected exercise, including setup, movement phases and source-supported precautions. Do not invent dosage or patient-specific advice.' },
  { id: 'motion', title: 'Movement breakdown', icon: 'workout', detail: 'Phases, joint actions and demonstration', prompt: 'Break down the selected exercise into movement phases and supported joint actions. Explain what a demonstration should show and identify any motion details missing from the evidence.' },
  { id: 'review', title: 'Precautions & evidence', icon: 'info', detail: 'What to verify before using it', prompt: 'Summarize the source-supported precautions, limitations and missing requirements for the selected exercise, with evidence for each supported statement.' },
];

export default function KnowledgeExerciseChat({ api = connectedApi }) {
  const { connectedEnabled } = useAuth();
  const [catalog, setCatalog] = useState([]);
  const [exerciseId, setExerciseId] = useState('EX-KU-000001');
  const [task, setTask] = useState('guide');
  const [message, setMessage] = useState('');
  const [consent, setConsent] = useState(false);
  const [turns, setTurns] = useState([]);
  const [turnId, setTurnId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const resultRef = useRef(null);
  const selected = catalog.find(item => item.exercise_id === exerciseId);
  const result = turns.find(turn => turn._id === turnId) ?? turns.at(-1);

  useEffect(() => {
    if (!turnId) return;
    resultRef.current?.focus({ preventScroll: true });
    if (window.matchMedia('(max-width: 1100px)').matches) resultRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
  }, [turnId]);

  useEffect(() => {
    if (!connectedEnabled) return undefined;
    let active = true;
    Promise.allSettled([api('ai/knowledge-chat/catalog'), api('ai/knowledge-chat')]).then(([catalogResult, historyResult]) => {
      if (!active) return;
      if (catalogResult.status === 'fulfilled') setCatalog(catalogResult.value.exercises);
      else setError(catalogResult.reason.message);
      if (historyResult.status === 'fulfilled') setTurns(historyResult.value);
      else setError(current => current || historyResult.reason.message);
      setLoading(false);
    });
    return () => { active = false; };
  }, [connectedEnabled, api, retry]);

  async function ask(event) {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      const brief = TASKS.find(item => item.id === task).prompt + (message.trim() ? `\nAdditional request: ${message.trim()}` : '');
      const turn = await api('ai/knowledge-chat', { message: brief, exerciseId, consent }, 75000);
      setTurns(current => [...current, turn].slice(-20)); setTurnId(turn._id);
      toast('Your exercise guide is ready for review.');
    } catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  }

  async function copyGuide() {
    try {
      await navigator.clipboard.writeText([result.exercise?.exercise_name, 'Draft for clinician review', ...result.plan.claims.map(claim => claim.text), ...result.plan.questions, ...result.plan.missing_requirements.map(item => `Review needed: ${item}`)].filter(Boolean).join('\n\n'));
      toast('Draft copied with its review notes.');
    } catch { toast('Clipboard unavailable. Select the guide text to copy it.'); }
  }

  return <section aria-labelledby="knowledge-chat-heading" className="education-studio">
    <div className="studio-section-heading"><div><span className="eyebrow">SOURCE-GROUNDED CREATION</span><h2 id="knowledge-chat-heading">From exercise to clear guidance</h2><p className="mut">Choose a movement and the kind of guidance you need. Review the evidence before sharing.</p></div><span className="tag warn">Clinician review required</span></div>
    {!connectedEnabled ? <div className="session-status">Sign in with a connected clinician account to generate and save guides.</div> : <div className="generation-workspace">
      <form className="card generation-form" onSubmit={ask} aria-busy={busy}>
        <div className="studio-step"><span>01</span><div><h3>Choose a movement</h3><p>8 source-linked variations</p></div></div>
        <label htmlFor="knowledge-exercise">Exercise variation</label><select id="knowledge-exercise" value={exerciseId} disabled={loading || busy} onChange={event => setExerciseId(event.target.value)}>{loading && <option>Loading exercise catalog…</option>}{catalog.map(exercise => <option key={exercise.exercise_id} value={exercise.exercise_id}>{exercise.exercise_name}</option>)}</select>
        <div className="studio-step"><span>02</span><div><h3>What are you creating?</h3><p>Start with a focused brief</p></div></div>
        <div className="generation-presets" role="group" aria-label="Guide type">{TASKS.map(item => <button type="button" key={item.id} disabled={busy} className={task === item.id ? 'selected' : ''} aria-pressed={task === item.id} onClick={() => setTask(item.id)}><Icon name={item.icon} size={23} /><span><b>{item.title}</b><small>{item.detail}</small></span><span aria-hidden="true">{task === item.id ? '●' : '○'}</span></button>)}</div>
        <label htmlFor="knowledge-message">Anything to focus on? <span className="mut">Optional</span></label><textarea id="knowledge-message" value={message} maxLength={2400} rows={3} disabled={busy} placeholder="e.g. Explain the return phase in simple language. Keep it concise." onChange={event => setMessage(event.target.value)} />
        <label className="check-label"><input type="checkbox" checked={consent} disabled={busy} onChange={event => setConsent(event.target.checked)} />I agree to send this brief, recent chat context and source summaries to Google Gemini. No patient-identifying data is included.</label>
        <button className="btn generation-submit" disabled={busy || !consent || !catalog.length}>{busy ? 'Preparing your guide…' : `Generate ${task === 'guide' ? 'patient guide' : task === 'motion' ? 'movement breakdown' : 'evidence review'}`}<Icon name="plan" size={18} /></button>
        {!consent && <p className="mut">Check the consent box to enable generation.</p>}
        {busy && <div className="generation-loading" role="status"><span className="studio-spinner" />Checking evidence and writing your guide. Allow up to a minute.</div>}
        {error && <div className="session-status" role="alert">{error}{!catalog.length && <button type="button" className="btn s sm" onClick={() => { setLoading(true); setError(''); setRetry(value => value + 1); }}>Reload catalog</button>}</div>}
      </form>
      <div ref={resultRef} tabIndex={-1} className="generation-result" aria-label="Generated guide">
        {result ? <article className="card generated-guide"><div className="row sp"><span className="eyebrow">03 / REVIEW YOUR GUIDE</span><span className="tag warn">Draft · not assigned</span></div><h2>{result.exercise?.exercise_name ?? 'Exercise clarification'}</h2><p className="mut">{result.citations.length} source references · {result.exercise?.movement_phases?.length ?? 0} movement phases</p>
          {result.exercise?.movement_phases?.length > 0 && <ol className="movement-timeline">{result.exercise.movement_phases.map(phase => <li key={phase.phase_id}><b>{phase.phase_name}</b><p>{phase.description}</p></li>)}</ol>}
          <h3>Movement guide</h3>{result.plan.claims.map((claim, index) => <p className="guide-claim" key={index}>{claim.text}</p>)}
          {result.plan.questions.length > 0 && <div className="session-status"><b>Clarify before using</b>{result.plan.questions.map((question, index) => <p key={index}>{question}</p>)}</div>}
          {result.plan.missing_requirements.length > 0 && <details className="source-review"><summary>Review gaps ({result.plan.missing_requirements.length})</summary><ul>{result.plan.missing_requirements.map((item, index) => <li key={index}>{item}</li>)}</ul></details>}
          <details className="source-review"><summary>Inspect source evidence ({result.citations.length})</summary>{result.citations.length ? result.citations.map(source => <div className="source-card" key={source.id}><b>{source.title}</b><p className="mut">Chapter {source.chapter_number} · printed pp. {source.printed_page_numbers.join(', ')} · PDF pp. {source.pdf_page_numbers.join(', ')}</p></div>) : <p className="mut">No source citations were returned. Resolve this before using the guide.</p>}</details>
          {result.preview && <Suspense fallback={<p role="status">Loading movement preview…</p>}><ExerciseAnimationPreview key={result._id} descriptor={result.preview} /></Suspense>}
          <div className="guide-footer"><button type="button" className="btn s" onClick={copyGuide}>Copy draft & review notes</button><p className="mut">Saved to your exercise history · {result.model}. Creating a guide does not publish a patient plan.</p></div>
        </article> : <div className="card generation-empty"><span className="empty-icon"><Icon name="plan" size={38} /></span><span className="eyebrow">YOUR NEXT EXERCISE GUIDE</span><h2>{selected?.exercise_name ?? 'A clear guide starts here'}</h2><p className="mut">Your generated instructions, movement phases, source citations and review gaps will appear here.</p><div className="guide-skeleton"><i /><i /><i /></div><span className="tag">Choose → generate → review</span></div>}
        {turns.length > 1 && <details className="card"><summary>Previous guides ({turns.length})</summary>{[...turns].reverse().map(turn => <button type="button" key={turn._id} className="guide-history" aria-pressed={result?._id === turn._id} onClick={() => setTurnId(turn._id)}><b>{turn.exercise?.exercise_name ?? 'Exercise clarification'}</b><span>{turn.createdAt ? new Date(turn.createdAt).toLocaleString() : 'Saved guide'}</span></button>)}</details>}
      </div>
    </div>}
  </section>;
}
