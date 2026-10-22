import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRecords } from '../records/recordsContext';
import { INSTRUCTIONS } from '../data';
import { startDraft } from '../session/drafts';
import ReferenceVideo from '../components/ReferenceVideo';
import ExportPdf from '../components/ExportPdf';

function ExerciseCard({ item, reference, onPractise }) {
  const [open, setOpen] = useState(false);
  return (
    <details className="card" onToggle={event => setOpen(event.currentTarget.open)}>
      <summary style={{ cursor: 'pointer', listStyle: 'none' }}>
        <div className="row sp">
          <h3>{open ? '▾' : '▸'} {item.ex}</h3>
          <span className="tag">{item.targetReps} reps · {item.targetExcursionDeg}°</span>
        </div>
        {item.note && <p className="mut" style={{ margin: '6px 0 0' }}>{item.note}</p>}
      </summary>
      {open && (
        <div style={{ marginTop: 12 }}>
          {reference
            ? <div className="vid" style={{ maxWidth: 260, margin: '0 auto' }}><ReferenceVideo mediaPath={reference.mediaPath} /></div>
            : <p className="demo">No demonstration video is attached to this exercise yet.</p>}
          {(INSTRUCTIONS[item.ex] ?? []).map(([title, text]) => (
            <p key={title} style={{ margin: '10px 0' }}><b>{title}:</b> {text}</p>
          ))}
          <button className="btn sm" onClick={onPractise}>Practise this exercise</button>
        </div>
      )}
    </details>
  );
}

export default function PatientPlan() {
  const nav = useNavigate();
  const { patientId, assignment, workspace } = useRecords();
  const plan = assignment(patientId);
  if (!plan) return <div className="card">No active assignment. Contact your clinician if you expected one.</div>;
  return (
    <>
      <div className="row sp"><h1>Your exercise plan</h1><ExportPdf patient={workspace.patients.find(patient => patient.id === patientId)} plan={plan} /></div>
      <p className="mut">{plan.name} · by {plan.by} · version {plan.v}{plan.schedule?.weeklyFrequency ? ` · ${plan.schedule.weeklyFrequency} times per week` : ''}</p>
      {plan.items.map((item, index) => (
        <ExerciseCard key={item.ex} item={item}
          reference={workspace.references.find(entry => entry.versionId === item.referenceVersionId)}
          onPractise={() => nav('/patient/pre', { state: startDraft(plan, patientId, index, false) })} />
      ))}
      <button className="btn" style={{ width: '100%' }} onClick={() => nav('/patient/workout')}>Go to workout</button>
    </>
  );
}
