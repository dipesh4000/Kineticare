import { useNavigate } from 'react-router-dom';
import { useRecords } from '../records/recordsContext';
import { startDraft } from '../session/drafts';
import ScoreTimeCharts from '../components/ExerciseCharts';

export default function PatientWorkout() {
  const nav = useNavigate();
  const { patientId, assignment, sessions } = useRecords();
  const plan = assignment(patientId);
  const last = sessions(patientId).at(-1);
  if (!plan) return <div className="card">No active assignment. Contact your clinician if you expected one.</div>;
  const start = (exIdx, all) => nav('/patient/pre', { state: startDraft(plan, patientId, exIdx, all) });
  const totalReps = plan.items.reduce((total, item) => total + item.targetReps, 0);

  return (
    <>
      <h1>Workout</h1>
      <div className="card hero">
        <h3 style={{ fontSize: 19 }}>{plan.name}</h3>
        <div className="mut">{plan.items.length} exercises · {totalReps} target reps · set by {plan.by}</div>
        <button className="btn w" style={{ marginTop: 14, width: '100%' }} onClick={() => start(0, true)}>Start full workout</button>
      </div>
      <h2>Or pick one exercise</h2>
      {plan.items.map((item, index) => (
        <div className="card row sp" key={item.ex}>
          <div>
            <b>{item.ex}</b>
            <div className="mut">{item.targetReps} reps · target {item.targetExcursionDeg}°</div>
          </div>
          <button className="btn s sm" onClick={() => start(index, false)}>Start</button>
        </div>
      ))}
      <h2>Last session{last ? `: ${last.d}` : ''}</h2>
      {last ? <ScoreTimeCharts results={last.r} /> : <div className="card">Your results will appear here after your first workout.</div>}
    </>
  );
}
