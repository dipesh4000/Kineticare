import { useEffect, useRef, useState, useId } from 'react';
import { createPortal } from 'react-dom';
import Brand from './Brand';
import Icon from './Icon';
import { calcExerciseBiometrics } from '../metrics';

function ReportPreview({ patient, plan, session, onClose }) {
  const dialog = useRef(null);
  const titleId = useId();
  const title = session ? 'Session analysis report' : 'Exercise schedule';
  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);

  return createPortal(
    <dialog ref={dialog} className="report-dialog" aria-labelledby={titleId} onCancel={onClose}>
      <div className="report-toolbar row sp">
        <p className="mut">Choose “Save as PDF” in the print destination.</p>
        <div className="row">
          <button className="btn s sm" onClick={onClose}>Close</button>
          <button className="btn sm" onClick={() => window.print()}>Print / Save as PDF</button>
        </div>
      </div>
      <article className="report-page">
        <Brand subtitle="Rehabilitation & movement care" />
        <p className="eyebrow">{session ? 'Movement insights' : 'Your care plan'}</p>
        <h1 id={titleId}>{title}</h1>
        <dl className="report-meta">
          <div><dt>Patient</dt><dd>{patient?.n ?? patient?.displayName ?? 'Patient'}</dd></div>
          <div><dt>Patient ID</dt><dd>{patient?.id ?? patient?.uid ?? '—'}</dd></div>
          <div><dt>Clinician</dt><dd>{plan?.by ?? '—'}</dd></div>
          <div><dt>{session ? 'Session date' : 'Generated'}</dt><dd>{session?.d ?? new Date().toLocaleDateString()}</dd></div>
        </dl>
        {session ? <>
          <p><b>Status:</b> {session.status ?? 'Recorded'} · {session.reviewStatus === 'reviewed' ? 'Reviewed' : 'Needs review'} · {session.mode === 'replay' ? 'Replay demonstration — synthetic data' : session.mode === 'live' ? 'Live camera session' : 'Session mode not recorded'}</p>
          <p className="mut">Assignment version: {session.assignmentVersion ?? 'Not recorded'} · Session ID: {session.sessionId ?? 'Not recorded'}</p>
          <table>
            <thead><tr><th>Exercise</th><th>Active time</th><th>Reps assessed</th><th>Score / 100</th><th>Mean ROM</th><th>In target</th></tr></thead>
            <tbody>{(session.r ?? []).map((result, index) => {
              // Use the recorded session target; today's assignment may have changed.
              const bio = calcExerciseBiometrics(result);
              return <tr key={index}><td>{result.ex}</td><td>{result.t ?? '—'}s</td><td>{result.assessedReps ?? result.reps?.length ?? '—'}</td><td>{Number.isFinite(result.movementScore) ? result.movementScore : Number.isFinite(result.s) ? Math.round(result.s * 100) : '—'}</td><td>{bio ? `${bio.meanPeakDeg}°` : '—'}</td><td>{bio ? `${bio.romCompliancePct}%` : '—'}</td></tr>;
            })}</tbody>
          </table>
          <p className="mut">Scores are prototype movement estimates, not a clinical grade. Missing measurements are shown as —. Target compliance uses the recorded target where available, otherwise the exercise default.</p>
        </> : <>
          <h2>{plan.name} <span className="tag">Version {plan.v}</span></h2>
          <p><b>Frequency:</b> {plan.schedule?.weeklyFrequency ? `${plan.schedule.weeklyFrequency} times per week` : 'As directed by your clinician'}. Follow your clinician’s prescribed rest days.</p>
          <table>
            <thead><tr><th>Exercise</th><th>Target reps</th><th>Duration</th><th>Target angle</th></tr></thead>
            <tbody>{plan.items.map((item, index) => <tr key={index}><td>{item.ex}{item.videoOnly && <small> · Video guided</small>}</td><td>{item.targetReps ?? '—'}</td><td>{item.t == null ? '—' : `${item.t}s`}</td><td>{item.videoOnly || item.targetExcursionDeg == null ? '—' : `${item.targetExcursionDeg}°`}</td></tr>)}</tbody>
          </table>
          {plan.items.filter(item => item.note).map((item, index) => <section key={index}><h3>{item.ex}</h3><p className="report-note">{item.note}</p></section>)}
          <p className="mut">Use the Kineticare exercise instructions and clinician demonstrations alongside this schedule.</p>
        </>}
        <footer className="report-footer">Kineticare · Generated {new Date().toLocaleString()} · Confidential patient record</footer>
      </article>
    </dialog>, document.body,
  );
}

export default function ExportPdf({ patient, plan, session, label = 'Export PDF' }) {
  const [open, setOpen] = useState(false);
  return <>
    <button className="btn s sm" onClick={() => setOpen(true)} disabled={!session && !plan}><Icon name="download" size={16} />{label}</button>
    {open && <ReportPreview patient={patient} plan={plan} session={session} onClose={() => setOpen(false)} />}
  </>;
}
