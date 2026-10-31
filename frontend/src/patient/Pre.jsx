import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useRecords } from '../records/recordsContext';
import { toast } from '../components/toastBus';
import ReferenceVideo from '../components/ReferenceVideo';
import SideArmRaiseDemo from '../components/SideArmRaiseDemo';
import { exerciseMeta } from '../exercise/measure';

export default function PatientPre() {
  const nav = useNavigate();
  const { state } = useLocation();
  const { patientId, patientPlan, createRequest, workspace } = useRecords();
  const [checks, setChecks] = useState([false, false, false]);
  const exIdx = state?.exIdx ?? 0;
  const plan = patientPlan(patientId);
  const x = plan?.items[exIdx];
  if (!x) return <div className="card">This exercise is no longer available in the current assignment.</div>;
  if (state?.assignmentVersion != null && state.assignmentVersion !== plan.v) return <div className="card">Your clinician updated this plan. <button className="btn" onClick={() => nav('/patient/workout')}>Open current workout</button></div>;
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
          <h3>{reference ? 'Clinician demonstration' : 'Movement preview'}</h3>
          {reference ? <div className="vid"><ReferenceVideo mediaPath={reference.mediaPath} /></div> : <p className="demo">No demonstration video is attached to this exercise.</p>}
        </div>
        <button className="btn" style={{ width: '100%' }} onClick={() => nav('/patient/plan')}>Back to plan</button>
      </>
    );
  }

  const requestHelp = async () => {
    if (!workspace.relationship) { nav('/patient/me'); return; }
    try {
    await createRequest(patientId, {
      requestId: crypto.randomUUID(), kind: 'help', message: `Help requested before ${x.ex}`,
      creatorId: patientId, createdAt: new Date().toISOString(), status: 'open',
    });
    toast('Help request sent to your clinician');
    } catch { toast('Help request was not saved. Check your connection and retry.'); }
  };

  return (
    <>
      <button className="btn s sm" onClick={() => nav('/patient/plan')}>Back</button>
      <h1 style={{ marginTop: 12 }}>{x.ex}</h1>
      <div className="card">
        <p>{plan.source === 'self-guided' ? 'This is general self-guided movement. Move slowly and stop at any time if you feel pain or dizziness.' : "Follow the clinician's instructions. Move slowly and stop at any time if you feel pain or dizziness."}</p>
        <p className="mut">{x.note || 'No extra precautions set.'}</p>
      </div>
      <div className="card">
        <h3>{reference ? 'Clinician demonstration' : 'Movement preview'}</h3>
        {reference ? <div className="vid"><ReferenceVideo mediaPath={reference.mediaPath} /></div> : x.ex === 'Side Arm Raise' ? <SideArmRaiseDemo target={x.targetExcursionDeg} /> : <p className="demo">No demonstration is attached. Follow your plan instructions.</p>}
      </div>
      <div className="card">
        <h3>Camera setup</h3>
        {['Phone is stable about 2 metres away', 'Whole body is visible', 'Room is evenly lit'].map((label, index) => (
          <label className="check-label" key={label}><input type="checkbox" checked={checks[index]} onChange={event => setChecks(current => current.map((value, itemIndex) => itemIndex === index ? event.target.checked : value))} /> {label}</label>
        ))}
        <p className="mut">{exerciseMeta(x.ex).setup}</p>
        <p className="mut">The camera activates only after you choose Start exercise on the next screen. Workout video stays on this device.</p>
      </div>
      <p className="mut" role="status">{checks.every(Boolean) ? 'Ready. Next, start the camera and hold still for setup.' : `Camera checklist: ${checks.filter(Boolean).length} of 3 ready. Complete all three to continue.`}</p>
      <button className="btn" disabled={!checks.every(Boolean)} style={{ width: '100%', marginBottom: 8 }}
        onClick={() => nav('/patient/live', { state: { ...state, exIdx, all: !!state?.all } })}>
        Continue to camera
      </button>
      <button className="btn s" style={{ width: '100%' }} onClick={requestHelp}>
        I need help
      </button>
    </>
  );
}
