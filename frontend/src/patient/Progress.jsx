import { useRecords } from '../records/recordsContext';
import { avg } from '../metrics';
import { LineChart, KPIs, DemoBanner } from '../utils';
import ScoreTimeCharts from '../components/ExerciseCharts';

export default function PatientProgress() {
  const { patientId, sessions, assignment, backend } = useRecords();
  const history = sessions(patientId);
  const plan = assignment(patientId);
  const scored = history.filter(session => Number.isFinite(avg(session.r)));

  return (
    <>
      <h1>Progress</h1>
      {backend === 'local-demo' && <DemoBanner />}
      <KPIs ss={history} />
      <div className="card">
        <h3>Prototype score by session</h3>
        <LineChart vals={scored.map(session => avg(session.r))} labs={scored.map(session => session.d.slice(0, 6))} />
        <p className="mut">Displayed on a 0–100 scale. This is not a recovery percentage.</p>
      </div>
      <ScoreTimeCharts results={history.flatMap(session => session.r)} scoreTitle="Average score for each exercise" timeTitle="Average time in seconds for each exercise" />
      <div className="card">
        <h3>Completion</h3>
        <p>{history.length} saved session{history.length === 1 ? '' : 's'} for {plan?.name ?? 'the current account'}.</p>
        <p className="mut">A percentage is not shown because this assignment does not yet contain a dated schedule.</p>
      </div>
      {history.slice().reverse().map(session => (
        <div key={session.sessionId ?? session.d} className="card">
          <div className="row sp"><b>{session.d}</b><span className={`tag ${session.status === 'partial' ? 'warn' : 'ok'}`}>{session.status ?? 'completed'}</span></div>
          <p className="mut">{session.r.map(result => `${result.ex} ${result.t}s`).join(' · ')}</p>
        </div>
      ))}
    </>
  );
}
