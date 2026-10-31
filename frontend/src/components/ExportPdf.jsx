import { useEffect, useRef, useState, useId } from 'react';
import { createPortal } from 'react-dom';
import Brand from './Brand';
import Icon from './Icon';
import MovementReport from './MovementReport';

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
    <dialog ref={dialog} className="report-dialog" aria-label={title} onCancel={onClose}>
      <div className="report-toolbar row sp">
        <p className="mut">Choose “Save as PDF” in the print destination.</p>
        <div className="row">
          <button className="btn s sm" onClick={onClose}>Close</button>
          <button className="btn sm" onClick={() => window.print()}>Print / Save as PDF</button>
        </div>
      </div>
      <article className="report-page">
        {session ? <MovementReport patient={patient} session={session} plan={plan} /> : <>
        <Brand subtitle="Rehabilitation & movement care" />
        <p className="eyebrow">{session ? 'Movement insights' : 'Your care plan'}</p>
        <h1 id={titleId}>{title}</h1>
        <dl className="report-meta">
          <div><dt>Patient</dt><dd>{patient?.n ?? patient?.displayName ?? 'Patient'}</dd></div>
          <div><dt>Patient ID</dt><dd>{patient?.id ?? patient?.uid ?? '—'}</dd></div>
          <div><dt>Clinician</dt><dd>{plan?.by ?? '—'}</dd></div>
          <div><dt>{session ? 'Session date' : 'Generated'}</dt><dd>{session?.d ?? new Date().toLocaleDateString()}</dd></div>
        </dl>
          <h2>{plan.name} <span className="tag">Version {plan.v}</span></h2>
          <p>{plan.assessmentId ? `Assessment: ${plan.assessmentId}, version ${plan.assessmentVersion}.` : 'No assessment baseline recorded for this plan.'}</p>
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
