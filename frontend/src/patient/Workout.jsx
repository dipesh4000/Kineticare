import { useNavigate } from 'react-router-dom';
import { useRecords } from '../records/recordsContext';
import { startDraft } from '../session/drafts';
import ScoreTimeCharts from '../components/ExerciseCharts';
import Icon from '../components/Icon';

export default function PatientWorkout() {
  const nav = useNavigate();
  const { patientId, patientPlan, sessions } = useRecords();
  const plan = patientPlan(patientId);
  const last = sessions(patientId).at(-1);

  if (!plan) return <div className="card">No active assignment. Contact your clinician if you expected one.</div>;

  const start = (exIdx, all) => nav('/patient/pre', { state: startDraft(plan, patientId, exIdx, all) });
  const totalReps = plan.items.reduce((total, item) => total + item.targetReps, 0);

  return (
    <>
      <div className="row sp" style={{ marginBottom: 12 }}>
        <h1>Rehabilitation Workout</h1>
        <button className="btn s sm" onClick={() => nav('/patient/home')}>Back</button>
      </div>

      {/* Main Prescription Card */}
      <div className="card" style={{ padding: '22px 20px', textAlign: 'center' }}>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: '50%',
            background: 'var(--pri2)',
            display: 'grid',
            placeItems: 'center',
            margin: '0 auto 12px',
          }}
        >
          <Icon name="workout" size={26} color="var(--pri)" />
        </div>
        <h2 style={{ margin: '0 0 6px', fontSize: 20 }}>{plan.name}</h2>
        <p className="mut" style={{ margin: '0 0 16px', fontSize: 14 }}>
          {plan.items.length} guided exercises · {totalReps} target reps · {plan.source === 'self-guided' ? 'Starter guidance' : `Prescribed by ${plan.by}`}
        </p>
        <button className="btn" style={{ width: '100%', maxWidth: 320 }} onClick={() => start(0, true)}>
          Start Full Workout
        </button>
      </div>

      <h2>{plan.source === 'self-guided' ? 'Starter Exercises' : 'Prescribed Exercises'}</h2>
      {plan.items.map((item, index) => (
        <div className="card row sp" key={item.ex} style={{ padding: '16px 18px' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--pri)' }}>{item.ex}</div>
            <div className="mut" style={{ fontSize: 13, marginTop: 2 }}>
              {item.targetReps} reps · Target {item.targetExcursionDeg}° excursion
            </div>
            {item.note && (
              <div style={{ fontSize: 12, color: 'var(--mut)', marginTop: 4 }}>
                Clinician note: {item.note}
              </div>
            )}
          </div>
          <button className="btn s sm" onClick={() => start(index, false)}>
            Practice
          </button>
        </div>
      ))}

      <h2>Previous Workout Results{last ? `: ${last.d}` : ''}</h2>
      {last ? (
        <ScoreTimeCharts results={last.r} />
      ) : (
        <div className="card">Your results and joint angles will appear here after your first workout session.</div>
      )}
    </>
  );
}
