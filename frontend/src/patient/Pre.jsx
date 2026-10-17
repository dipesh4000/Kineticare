import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useRecords } from '../records/recordsContext';
import { toast } from '../components/toastBus';
import ReferenceVideo from '../components/ReferenceVideo';
import { exerciseMeta } from '../exercise/measure';

export default function PatientPre() {
  const nav = useNavigate();
  const { state } = useLocation();
  const { patientId, assignment, createRequest, workspace } = useRecords();
  const [checks, setChecks] = useState([false, false, false]);
  const exIdx = state?.exIdx ?? 0;
  const x = assignment(patientId)?.items[exIdx];
  if (!x) return <div className="card">This exercise is no longer available in the current assignment.</div>;
  const reference = workspace.references.find(item => item.versionId === x.referenceVersionId);

  if (x.videoOnly) {
    return (
      <>
        <button className="btn s sm" onClick={() => nav('/patient/plan')}>Back</button>
        <h1 style={{ marginTop: 12 }}>{x.ex}</h1>
        <div className="card">
          <p>This is a video guide. The camera does not measure it, and nothing is saved to your session history.</p>
          <p className="mut">{x.note || 'Move slowly and stop if you feel pain or dizziness.'}</p>
        </div>
        <div className="card">
          <h3>Clinician demonstration</h3>
          {reference ? <div className="vid"><ReferenceVideo mediaPath={reference.mediaPath} /></div> : <p className="demo">No demonstration video is attached to this exercise.</p>}
        </div>
        <button className="btn" style={{ width: '100%' }} onClick={() => nav('/patient/plan')}>Back to plan</button>
      </>
    );
  }

  const requestHelp = () => {
    createRequest(patientId, {
      requestId: crypto.randomUUID(), kind: 'help', message: `Help requested before ${x.ex}`,
      creatorId: patientId, createdAt: new Date().toISOString(), status: 'open',
    });
    toast('Help request sent to your clinician');
  };

  return (
    <>
      <button className="btn s sm" onClick={() => nav('/patient/plan')}>Back</button>
      <h1 style={{ marginTop: 12 }}>{x.ex}</h1>
      <div className="card">
        <p>Follow the clinician's instructions. Move slowly and stop at any time if you feel pain or dizziness.</p>
        <p className="mut">{x.note || 'No extra precautions set.'}</p>
      </div>
      <div className="card">
        <h3>Clinician demonstration</h3>
        {reference ? <div className="vid"><ReferenceVideo mediaPath={reference.mediaPath} /></div> : <p className="demo">This legacy demo assignment has no approved reference recording. A new published assignment must include one.</p>}
      </div>
      <div className="card">
        <h3>Camera setup</h3>
        {['Phone is stable about 2 metres away', 'Whole body is visible', 'Room is evenly lit'].map((label, index) => (
          <label className="check-label" key={label}><input type="checkbox" checked={checks[index]} onChange={event => setChecks(current => current.map((value, itemIndex) => itemIndex === index ? event.target.checked : value))} /> {label}</label>
        ))}
        <p className="mut">{exerciseMeta(x.ex).setup}</p>
        <p className="mut">The camera activates only after you choose Start camera. Workout video stays on this device.</p>
      </div>
      <button className="btn" disabled={!checks.every(Boolean)} style={{ width: '100%', marginBottom: 8 }}
        onClick={() => nav('/patient/live', { state: { ...state, exIdx, all: !!state?.all } })}>
        Begin exercise
      </button>
      <button className="btn s" style={{ width: '100%' }} onClick={requestHelp}>
        I need help
      </button>
    </>
  );
}
