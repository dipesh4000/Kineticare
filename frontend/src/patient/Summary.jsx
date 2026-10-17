import { useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { DemoBanner } from '../utils';
import { useRecords } from '../records/recordsContext';
import { clearSessionDraft } from '../session/drafts';
import ScoreTimeCharts from '../components/ExerciseCharts';

const mean = values => values.reduce((total, value) => total + value, 0) / values.length;
const scoreOf = result => (result.movementScore != null ? result.movementScore / 100 : result.s);

function insights(result) {
  const reps = result.reps ?? [];
  if (!reps.length) return ['No complete repetitions were counted, so there is nothing to analyse for this exercise.'];
  const notes = [];
  const peak = mean(reps.map(rep => rep.peak));
  const seconds = mean(reps.map(rep => rep.durationMs)) / 1000;
  if (peak < 0.9) notes.push(`Reps averaged ${Math.round(peak * 100)}% of the target movement. Aim to go a little further.`);
  else if (peak > 1.1) notes.push(`Reps averaged ${Math.round(peak * 100)}% of the target, past the assigned range. Stop at the target.`);
  else notes.push(`Reps averaged ${Math.round(peak * 100)}% of the target, inside the 90–110% range.`);
  if (seconds < 2) notes.push(`Average rep time was ${seconds.toFixed(1)}s. Slow down to 2–5 seconds per rep.`);
  else if (seconds > 5) notes.push(`Average rep time was ${seconds.toFixed(1)}s, slower than the 2–5 second range.`);
  else notes.push(`Average rep time was ${seconds.toFixed(1)}s, inside the 2–5 second range.`);
  if (reps.length > 1) {
    const best = reps.reduce((a, b, i) => (b.score > reps[a].score ? i : a), 0);
    const worst = reps.reduce((a, b, i) => (b.score < reps[a].score ? i : a), 0);
    if (best !== worst) notes.push(`Best rep was #${best + 1} (${reps[best].score}); weakest was #${worst + 1} (${reps[worst].score}).`);
    const half = Math.floor(reps.length / 2);
    if (half > 0 && mean(reps.slice(-half).map(rep => rep.score)) + 5 < mean(reps.slice(0, half).map(rep => rep.score))) notes.push('Scores dropped toward the end of the set, which can be a sign of fatigue.');
  }
  return notes;
}

function RepChart({ reps }) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 110, paddingTop: 8 }} role="img" aria-label="Score for each repetition">
      {reps.map((rep, index) => (
        <div key={index} style={{ flex: 1, textAlign: 'center', fontSize: 11 }}>
          <div style={{ background: rep.withinTarget ? 'var(--pri)' : 'var(--pri2)', borderRadius: '6px 6px 0 0', height: Math.max(4, rep.score * 0.8) }} />
          {rep.score}<br /><span className="mut">#{index + 1}</span>
        </div>
      ))}
    </div>
  );
}

export default function PatientSummary() {
  const nav = useNavigate();
  const { state } = useLocation();
  const { patientId, assignment, sessions, saveSession } = useRecords();
  const sessionId = useRef(state?.sessionId ?? crypto.randomUUID());
  const [saveState, setSaveState] = useState('idle');
  const done = state?.done || [];
  const previous = sessions(patientId).at(-1);
  const results = done.map(result => ({ ...result, s: scoreOf(result) }));
  const scored = results.filter(result => Number.isFinite(result.s));
  const attempted = done.reduce((total, result) => total + (result.attemptedReps ?? 0), 0);
  const onTarget = done.reduce((total, result) => total + (result.withinTargetReps ?? 0), 0);

  const save = async () => {
    setSaveState('saving');
    try {
      const plan = assignment(patientId);
      await saveSession(patientId, {
        schemaVersion: 1,
        sessionId: sessionId.current,
        assignmentId: plan?.assignmentId ?? 'demo-assignment',
        assignmentVersion: plan?.v ?? 1,
        status: done.length && done.every(item => item.completion !== 'partial') ? 'completed' : 'partial',
        mode: done.some(item => item.c === 'Replay demo') ? 'replay' : 'live',
        createdAt: new Date().toISOString(),
        d: new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date()),
        r: done,
        exerciseResults: done,
      });
      setSaveState('saved');
      clearSessionDraft(patientId);
      nav('/patient/home');
    } catch {
      setSaveState('error');
    }
  };

  return (
    <>
      <h1>Workout summary</h1>
      {done.some(x => x.c === 'Replay demo') && <DemoBanner />}
      {done.length === 0 && <div className="card">Nothing to summarise yet. Finish an exercise first.</div>}
      {done.length > 0 && (
        <div className="card st4">
          <div><b>{scored.length ? Math.round(100 * mean(scored.map(result => result.s))) : '—'}</b>Overall score</div>
          <div><b>{done.reduce((total, result) => total + (result.t ?? 0), 0)}s</b>Active time</div>
          <div><b>{attempted}</b>Reps counted</div>
          <div><b>{attempted ? `${Math.round(100 * onTarget / attempted)}%` : '—'}</b>On target</div>
        </div>
      )}
      <ScoreTimeCharts results={results} scoreTitle="Score on each exercise" timeTitle="Each exercise time in seconds" />
      {previous && scored.length > 0 && (
        <div className="card">
          <h3>Compared with your last session ({previous.d})</h3>
          {scored.map(result => {
            const before = previous.r.find(item => item.ex === result.ex && Number.isFinite(item.s));
            if (!before) return <p key={result.ex} className="mut">{result.ex}: no earlier score to compare.</p>;
            const change = Math.round(100 * (result.s - before.s));
            return <p key={result.ex}>{result.ex}: <b>{Math.round(100 * result.s)}</b> now, {Math.round(100 * before.s)} before <span className={`tag ${change >= 0 ? 'ok' : 'warn'}`}>{change >= 0 ? '+' : ''}{change}</span></p>;
          })}
        </div>
      )}
      {done.filter(x => x.reps?.length).map(x => (
        <div className="card" key={`analysis-${x.ex}`}>
          <h3>{x.ex}: repetition analysis</h3>
          <div className="st4" style={{ margin: '10px 0' }}>
            <div><b>{x.attemptedReps}</b>Reps counted</div>
            <div><b>{x.withinTargetReps}</b>On target</div>
            <div><b>{x.movementScore ?? '—'}</b>Score</div>
            <div><b>{Math.round(mean(x.reps.map(rep => rep.durationMs)) / 100) / 10}s</b>Average rep time</div>
          </div>
          {x.scoreComponents && <p className="mut">Reach {Math.round(x.scoreComponents.reach * 100)}% · tempo {Math.round(x.scoreComponents.tempo * 100)}% · tracking coverage {x.trackingCoverage == null ? 'n/a' : `${Math.round(x.trackingCoverage * 100)}%`}</p>}
          <RepChart reps={x.reps} />
          <p className="mut">Dark bars reached the 90–110% target range; light bars did not.</p>
          {insights(x).map(note => <p key={note} style={{ margin: '6px 0' }}>{note}</p>)}
        </div>
      ))}
      <p className="mut">The prototype score combines how close each rep came to the target and how steady the pace was. It is not a clinical grade. Replay scores are simulated.</p>
      {saveState === 'error' && <div className="demo" role="alert">Save failed. Your summary is still available; retry when connected.</div>}
      <button className="btn" style={{ width: '100%' }} disabled={saveState === 'saving' || saveState === 'saved' || done.length === 0} onClick={save}>
        {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : saveState === 'error' ? 'Retry save' : 'Save and finish'}
      </button>
    </>
  );
}
