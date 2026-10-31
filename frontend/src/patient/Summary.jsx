import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { DemoBanner } from '../utils';
import { useRecords } from '../records/recordsContext';
import { clearSessionDraft } from '../session/drafts';
import ScoreTimeCharts from '../components/ExerciseCharts';
import { calcExerciseBiometrics } from '../metrics';
import { evaluateSessionServer } from '../services/api';
import { sessionMode } from '../patientFlow';
import MovementReport from '../components/MovementReport';
import ExportPdf from '../components/ExportPdf';
import { useAuth } from '../auth/authContext';

const mean = values => (values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0);
const scoreOf = result => (result.movementScore != null ? result.movementScore / 100 : result.s);

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
  const { user } = useAuth();
  const nav = useNavigate();
  const { state } = useLocation();
  const { patientId, patientPlan, sessions, saveSession } = useRecords();
  const sessionId = useRef(state?.sessionId ?? crypto.randomUUID());
  const [saveState, setSaveState] = useState('idle');
  const [serverAnalysis, setServerAnalysis] = useState(null);
  const done = useMemo(() => state?.done || [], [state?.done]);
  const previous = sessions(patientId).at(-1);
  const results = done.map(result => ({ ...result, s: scoreOf(result) }));
  const scored = results.filter(result => Number.isFinite(result.s));
  const attempted = done.reduce((total, result) => total + (result.attemptedReps ?? 0), 0);
  const onTarget = done.reduce((total, result) => total + (result.withinTargetReps ?? 0), 0);
  const plan = patientPlan(patientId);

  useEffect(() => {
    if (done.length) {
      evaluateSessionServer({ r: done }, plan).then(res => {
        if (res?.success) setServerAnalysis(res);
      }).catch(err => console.error(err));
    }
  }, [done, plan]);

  const save = async () => {
    setSaveState('saving');
    try {
      await saveSession(patientId, {
        schemaVersion: 1,
        sessionId: sessionId.current,
        assignmentId: state?.assignmentId ?? plan?.assignmentId ?? 'demo-assignment',
        assignmentVersion: state?.assignmentVersion ?? plan?.v ?? 1,
        status: done.length && done.every(item => item.completion !== 'partial') ? 'completed' : 'partial',
        mode: sessionMode(done),
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
      {done.length > 0 && <><ExportPdf patient={user} plan={plan} session={{ r: done, mode: sessionMode(done), d: new Date().toLocaleDateString() }} label="Print movement report" /><MovementReport patient={user} plan={plan} session={{ r: done, mode: sessionMode(done), d: new Date().toLocaleDateString() }} /></>}
      {sessionMode(done) === 'replay' && <DemoBanner />}
      {done.length === 0 && <div className="card">Nothing to summarise yet. Finish an exercise first.</div>}

      {done.length > 0 && (
        <>
          <div className="card st4">
            <div><b>{scored.length ? Math.round(100 * mean(scored.map(result => result.s))) : '—'}</b>Overall score</div>
            <div><b>{done.reduce((total, result) => total + (result.t ?? 0), 0)}s</b>Active time</div>
            <div><b>{attempted}</b>Reps counted</div>
            <div><b>{attempted ? `${Math.round(100 * onTarget / attempted)}%` : '—'}</b>On target</div>
          </div>

          {/* Clinical Biomechanics Quick Summary Banner */}
          {serverAnalysis && (
            <div className="card" style={{ borderLeft: '4px solid var(--pri)' }}>
              <div className="row sp">
                <h3 style={{ margin: 0 }}>Clinical Biomechanics</h3>
                <span className="tag ok">Engine Analyzed</span>
              </div>
              <div className="st4" style={{ margin: '10px 0 6px' }}>
                <div><b>{serverAnalysis.avgScore}/100</b>Functional Quality</div>
                <div><b>{serverAnalysis.avgConsistency}/100</b>Motor Stability</div>
              </div>
              {serverAnalysis.allTips?.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  {serverAnalysis.allTips.slice(0, 3).map((item, idx) => (
                    <p key={idx} style={{ margin: '4px 0', fontSize: 13 }}>{item.tip}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      <ScoreTimeCharts results={results} scoreTitle="Score on each exercise" timeTitle="Each exercise time in seconds" />

      {previous && scored.length > 0 && (
        <div className="card">
          <h3>Compared with your last session ({previous.d})</h3>
          {scored.map(result => {
            const before = previous.r.find(item => item.ex === result.ex && Number.isFinite(item.s));
            if (!before) return <p key={result.ex} className="mut">{result.ex}: no earlier score to compare.</p>;
            const change = Math.round(100 * (result.s - before.s));
            return (
              <p key={result.ex}>
                {result.ex}: <b>{Math.round(100 * result.s)}</b> now, {Math.round(100 * before.s)} before{' '}
                <span className={`tag ${change >= 0 ? 'ok' : 'warn'}`}>{change >= 0 ? '+' : ''}{change}</span>
              </p>
            );
          })}
        </div>
      )}

      {done.filter(x => x.reps?.length).map(x => {
        const planItem = plan?.items?.find(it => it.ex === x.ex) || {};
        const bio = calcExerciseBiometrics(x, planItem);
        return (
          <div className="card" key={`analysis-${x.ex}`}>
            <div className="row sp">
              <h3 style={{ margin: 0 }}>{x.ex}: Biomechanical Analysis</h3>
              {bio && <span className={`tag ${bio.fatigueDetected ? 'warn' : 'ok'}`}>{bio.fatigueDetected ? 'Fatigue Detected' : 'Stable Stamina'}</span>}
            </div>

            <div className="st4" style={{ margin: '12px 0' }}>
              <div><b>{x.attemptedReps}</b>Reps counted</div>
              <div><b>{bio ? `${bio.meanPeakDeg}°` : '—'}</b>Mean Excursion <span className="mut">(Target {bio?.targetDeg || 45}°)</span></div>
              <div><b>{bio ? `${bio.romCompliancePct}%` : '—'}</b>Target Compliance</div>
              <div><b>{bio ? `${bio.meanDurationSec}s` : '—'}</b>Avg Rep Time <span className="mut">({bio?.meanConcentricSec}s / {bio?.meanEccentricSec}s)</span></div>
            </div>

            <RepChart reps={x.reps} />
            <p className="mut" style={{ fontSize: 12, margin: '6px 0 12px' }}>
              Dark bars reached the {Math.round((bio?.targetDeg || 45) * 0.9)}°–{Math.round((bio?.targetDeg || 45) * 1.1)}° target range; light bars fell outside.
            </p>

            {/* Repetition Breakdown Table */}
            <div className="wrap" style={{ margin: '10px 0' }}>
              <table>
                <thead>
                  <tr>
                    <th>Rep</th>
                    <th>Angle</th>
                    <th>Concentric</th>
                    <th>Eccentric</th>
                    <th>Ratio</th>
                    <th>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {x.reps.map((r, idx) => (
                    <tr key={idx}>
                      <td>#{idx + 1}</td>
                      <td><b>{r.peakDeg != null ? `${r.peakDeg}°` : `${Math.round(r.peak * (bio?.targetDeg || 45))}°`}</b></td>
                      <td>{r.outboundMs ? `${(r.outboundMs / 1000).toFixed(1)}s` : '—'}</td>
                      <td>{r.returnMs ? `${(r.returnMs / 1000).toFixed(1)}s` : '—'}</td>
                      <td>{r.eccentricRatio ? `${r.eccentricRatio}x` : '1.0x'}</td>
                      <td><span className={`tag ${r.withinTarget ? 'ok' : 'warn'}`}>{r.score}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {bio?.fatigueIndex !== 0 && (
              <p className="mut" style={{ fontSize: 13 }}>
                Fatigue Degradation Index: <b>{bio.fatigueIndex}%</b> {bio.fatigueDetected ? '(Late reps showed depth or pace drop)' : '(Consistent energy through set)'}
              </p>
            )}
          </div>
        );
      })}

      <p className="mut">
        Kineticare calculates joint kinematics, eccentric deceleration, and motor consistency in real time. Replay scores use synthetic telemetry for demonstration.
      </p>

      {saveState === 'error' && <div className="demo" role="alert">Save failed. Your summary is still available; retry when connected.</div>}
      <button
        className="btn"
        style={{ width: '100%' }}
        disabled={saveState === 'saving' || saveState === 'saved' || done.length === 0}
        onClick={save}
      >
        {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : saveState === 'error' ? 'Retry save' : 'Save and finish'}
      </button>
    </>
  );
}
