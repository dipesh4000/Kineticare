import { useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { DemoBanner } from '../utils';
import { useRecords } from '../records/recordsContext';
import { clearSessionDraft } from '../session/drafts';

function Bars({ items, valFn, labelFn }) {
  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', height: 120, paddingTop: 8 }}>
      {items.map((x, i) => (
        <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 12 }}>
          <div style={{ background: 'var(--pri)', borderRadius: '8px 8px 0 0', marginBottom: 4, height: valFn(x) }} />
          {labelFn(x)}
        </div>
      ))}
    </div>
  );
}

export default function PatientSummary() {
  const nav = useNavigate();
  const { state } = useLocation();
  const { patientId, assignment, saveSession } = useRecords();
  const sessionId = useRef(state?.sessionId ?? crypto.randomUUID());
  const [saveState, setSaveState] = useState('idle');
  const done = state?.done || [];

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
      <h1>Session summary</h1>
      {done.some(x => x.c === 'Replay demo') && <DemoBanner />}
      <div className="card">
        <h3>Time per exercise (s)</h3>
        <Bars items={done} valFn={x => Math.min(100, x.t * 10)} labelFn={x => `${x.ex.split(' ')[0]} ${x.t}`} />
      </div>
      <div className="card">
        <h3>Prototype movement score (0 to 100)</h3>
        <Bars items={done} valFn={x => x.movementScore ?? (x.s ?? 0) * 100} labelFn={x => `${x.ex.split(' ')[0]} ${x.movementScore ?? (x.s == null ? 'Unavailable' : Math.round(x.s * 100))}`} />
        {done.map(x => x.assessedReps == null ? null : (
          <p className="mut" key={x.ex}>
            {x.ex}: {x.withinTargetReps}/{x.assessedReps} assessed reps reached the target
            {x.scoreComponents ? ` · reach ${Math.round(x.scoreComponents.reach * 100)}% · tempo ${Math.round(x.scoreComponents.tempo * 100)}%` : ''}.
          </p>
        ))}
        <p className="mut">The prototype score combines visible target reach and repetition tempo. It is not a clinical grade. Replay scores are simulated.</p>
      </div>
      {saveState === 'error' && <div className="demo" role="alert">Save failed. Your summary is still available; retry when connected.</div>}
      <button className="btn" style={{ width: '100%' }} disabled={saveState === 'saving' || saveState === 'saved'} onClick={save}>
        {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : saveState === 'error' ? 'Retry save' : 'Save and finish'}
      </button>
    </>
  );
}
