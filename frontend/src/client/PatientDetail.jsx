import { Fragment, useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/authContext';
import { useRecords } from '../records/recordsContext';
import { avg, calcExerciseBiometrics, calcLongitudinalTrends } from '../metrics';
import { LineChart, KPIs } from '../utils';
import ScoreTimeCharts from '../components/ExerciseCharts';
import { toast } from '../components/toastBus';
import { evaluateSessionServer, generateSoapNoteServer, reportExerciseIssue } from '../services/api';
import { workoutStreak } from '../patientFlow';
import ExportPdf from '../components/ExportPdf';
import AssessmentPanel from './assessment/AssessmentPanel';

export default function ClientPatientDetail() {
  const nav = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const { workspace, assignment, sessions, requests, markSessionReviewed, resolveRequest, replyToRequest, sendFeedback } = useRecords();
  const [selected, setSelected] = useState('');
  const [fbMessage, setFbMessage] = useState('');
  const [fbReminder, setFbReminder] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [reply, setReply] = useState('');
  const [soapData, setSoapData] = useState(null);
  const [loadingSoap, setLoadingSoap] = useState(false);
  const [sessionAnalysis, setSessionAnalysis] = useState(null);
  const [reportingExercise, setReportingExercise] = useState(null);
  const [reportReason, setReportReason] = useState('Patient reported pain or joint discomfort');
  const [reportNotes, setReportNotes] = useState('');

  const patient = workspace.patients.find(item => item.id === id);
  const plan = assignment(id);
  const history = sessions(id);
  const patientRequests = requests(id);
  const scored = history.filter(session => session.mode !== 'replay' && Number.isFinite(avg(session.r)));
  const chosen = history.find(session => (session.sessionId ?? session.d) === selected) ?? history.at(-1);

  // Evaluate chosen session with clinical analytics engine
  useEffect(() => {
    let cancelled = false;
    if (chosen && chosen.r?.length) {
      evaluateSessionServer(chosen, plan).then(res => {
        if (!cancelled && res?.success) setSessionAnalysis(res);
      }).catch(err => console.error(err));
    }
    return () => {
      cancelled = true;
    };
  }, [chosen, plan]);

  const generateSoap = async () => {
    if (!chosen) return toast('Select a session first');
    setLoadingSoap(true);
    try {
      const res = await generateSoapNoteServer(patient, chosen, plan);
      setSoapData(res);
      toast('SOAP Progress Note generated');
    } catch {
      toast('Could not generate note');
    } finally {
      setLoadingSoap(false);
    }
  };

  const copySoap = () => {
    if (!soapData?.formattedText) return;
    navigator.clipboard.writeText(soapData.formattedText);
    toast('Copied SOAP note to clipboard');
  };

  const pasteSoapToFeedback = () => {
    if (!soapData?.soap?.plan) return;
    setFbMessage(`Progress Note Summary (${chosen.d}): ${soapData.soap.assessment}\n\nPlan: ${soapData.soap.plan}`);
    toast('Inserted note into feedback draft');
  };

  const sendReply = async requestId => {
    if (!reply.trim()) return;
    await replyToRequest(id, requestId, {
      replyId: crypto.randomUUID(),
      senderId: user.uid,
      senderName: user.displayName,
      message: reply.trim(),
      createdAt: new Date().toISOString(),
    });
    setReply('');
    setReplyTo(null);
  };

  const submitFeedback = async () => {
    if (!fbMessage.trim() && !fbReminder.trim()) return toast('Write feedback or a reminder first');
    try {
      await sendFeedback(id, {
        id: crypto.randomUUID(),
        sessionId: chosen?.sessionId ?? null,
        clinicianUid: user.uid,
        from: user.displayName,
        message: fbMessage.trim() || 'Reminder from your clinician.',
        m: fbMessage.trim() || 'Reminder from your clinician.',
        reminder: fbReminder.trim() || null,
        d: new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date()),
        createdAt: new Date().toISOString(),
        read: false,
      });
      setFbMessage('');
      setFbReminder('');
      toast('Sent to the patient');
    } catch {
      toast('Could not send. Try again.');
    }
  };

  if (!patient) return <div className="card">Patient not found or not linked to this clinician.</div>;

  const trends = calcLongitudinalTrends(history);

  return (
    <>
      <button className="btn s sm" onClick={() => nav('/client/patients')}>Back to patients</button>
      <h1 style={{ marginTop: 12 }}>
        Patient: {patient.n} <span className="mut">{patient.id} · {patient.a}</span>
      </h1>
      <p className="mut">{patient.email} · Current streak: {workoutStreak(history).current} days · Best: {workoutStreak(history).best} days</p>
      <div className="row" style={{ margin: '10px 0', flexWrap: 'wrap' }}>
        <button className="btn" onClick={() => nav(`/client/patients/${id}/assign`)}>Edit assignment</button>
        {plan && <ExportPdf patient={patient} plan={plan} label="Schedule PDF" />}
        {chosen && <ExportPdf patient={patient} plan={plan} session={chosen} label="Analysis PDF" />}
      </div>

      <AssessmentPanel patientId={id} />
      {chosen ? (
        <>
          <div className="row sp" style={{ margin: '14px 0 8px' }}>
            <h2 style={{ margin: 0 }}>Results for {chosen.d}</h2>
            <select
              aria-label="Choose session"
              style={{ width: 'auto' }}
              value={chosen.sessionId ?? chosen.d}
              onChange={event => setSelected(event.target.value)}
            >
              {history.slice().reverse().map(session => (
                <option key={session.sessionId ?? session.d} value={session.sessionId ?? session.d}>
                  {session.d}{session.mode === 'replay' ? ' (replay)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))' }}>
            <ScoreTimeCharts results={chosen.r} />
          </div>

          {/* Clinician Biomechanical Telemetry & Risk Flags */}
          <div className="card" style={{ borderLeft: '4px solid var(--pri)' }}>
            <div className="row sp" style={{ marginBottom: 8 }}>
              <h3 style={{ margin: 0 }}>Clinical Biomechanics & Quality Assessment</h3>
              <button className="btn sm" disabled={loadingSoap} onClick={generateSoap}>
                {loadingSoap ? 'Generating Note…' : 'Generate SOAP Progress Note'}
              </button>
            </div>

            {sessionAnalysis?.allFlags?.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '8px 0 12px' }}>
                {sessionAnalysis.allFlags.map((flag, idx) => (
                  <span key={idx} className={`tag ${flag.level === 'ok' ? 'ok' : 'warn'}`}>
                    {flag.label}
                  </span>
                ))}
              </div>
            )}

            <div className="wrap">
              <table>
                <thead>
                  <tr>
                    <th>Exercise</th>
                    <th>Target Excursion</th>
                    <th>Achieved ROM</th>
                    <th>Compliance</th>
                    <th>Concentric / Eccentric</th>
                    <th>Ratio</th>
                    <th>Fatigue</th>
                    <th>Report</th>
                  </tr>
                </thead>
                <tbody>
                  {chosen.r.map((result, idx) => {
                    const planItem = plan?.items?.find(it => it.ex === result.ex) || {};
                    const bio = calcExerciseBiometrics(result, planItem);
                    return (
                      <tr key={idx}>
                        <td><b>{result.ex}</b></td>
                        <td>{bio ? `${bio.targetDeg}°` : '—'}</td>
                        <td><b>{bio ? `${bio.meanPeakDeg}°` : '—'}</b> {bio?.romDeficitDeg > 0 ? <span className="mut">(-{bio.romDeficitDeg}°)</span> : ''}</td>
                        <td>{bio ? `${bio.romCompliancePct}%` : '—'}</td>
                        <td>{bio ? `${bio.meanConcentricSec}s / ${bio.meanEccentricSec}s` : '—'}</td>
                        <td>{bio ? `${bio.eccentricRatio}x` : '—'}</td>
                        <td>
                          {bio ? (
                            <span className={`tag ${bio.fatigueDetected ? 'warn' : 'ok'}`}>
                              {bio.fatigueIndex}%
                            </span>
                          ) : '—'}
                        </td>
                        <td>
                          <button
                            className="btn s sm"
                            style={{ padding: '4px 8px', fontSize: 12 }}
                            onClick={() => setReportingExercise(result.ex)}
                          >
                            Flag / Report
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Exercise Issue Report Drawer */}
            {reportingExercise && (
              <div style={{ marginTop: 14, padding: 14, background: 'var(--warnb)', borderRadius: 12, border: '1px solid rgba(180, 83, 9, 0.2)' }}>
                <div className="row sp" style={{ marginBottom: 6 }}>
                  <b>Report Exercise Protocol: {reportingExercise} (Patient: {patient.n})</b>
                  <button className="btn s sm" onClick={() => setReportingExercise(null)}>Cancel</button>
                </div>
                <label htmlFor="p-rep-reason" style={{ marginTop: 6 }}>Clinical Reason</label>
                <select id="p-rep-reason" value={reportReason} onChange={e => setReportReason(e.target.value)}>
                  <option value="Patient reported pain or joint discomfort">Patient reported pain or joint discomfort</option>
                  <option value="Target angle too aggressive for rehabilitation stage">Target angle too aggressive for rehabilitation stage</option>
                  <option value="Keypoint tracking occlusion or jump">Keypoint tracking occlusion or jump</option>
                  <option value="Asymmetrical motor compensation / trunk sway">Asymmetrical motor compensation / trunk sway</option>
                </select>
                <label htmlFor="p-rep-notes">Clinician Observations</label>
                <textarea
                  id="p-rep-notes"
                  rows="2"
                  value={reportNotes}
                  onChange={e => setReportNotes(e.target.value)}
                  placeholder="e.g. Advise patient to reduce squat depth by 10° due to medial knee strain"
                />
                <button
                  className="btn sm"
                  style={{ marginTop: 8 }}
                  onClick={async () => {
                    await reportExerciseIssue({
                      exercise: reportingExercise,
                      patientId: id,
                      reason: reportReason,
                      notes: reportNotes,
                      reportedBy: user.displayName,
                    });
                    toast(`Exercise report logged for ${reportingExercise}`);
                    setReportingExercise(null);
                    setReportNotes('');
                  }}
                >
                  Submit Clinical Report
                </button>
              </div>
            )}

            {/* SOAP Note Drawer */}
            {soapData && (
              <div style={{ marginTop: 16, padding: 14, background: 'var(--soft)', borderRadius: 12 }}>
                <div className="row sp" style={{ marginBottom: 8 }}>
                  <b>SOAP Progress Note ({soapData.date})</b>
                  <div className="row" style={{ gap: 6 }}>
                    <button className="btn s sm" onClick={copySoap}>Copy Note</button>
                    <button className="btn s sm" onClick={pasteSoapToFeedback}>Insert into Feedback</button>
                  </div>
                </div>
                <pre style={{ margin: 0, fontSize: 13, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
                  {soapData.formattedText}
                </pre>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="card">No sessions yet, so there are no charts to show.</div>
      )}

      {/* Feedback & Assignment Card */}
      <div className="card">
        <h3>Feedback and assignment</h3>
        <label htmlFor="fb-message">Feedback for the patient</label>
        <textarea
          id="fb-message"
          rows={3}
          value={fbMessage}
          onChange={event => setFbMessage(event.target.value)}
          placeholder="What went well, what to change, next steps"
        />
        <label htmlFor="fb-reminder">Reminder</label>
        <input
          id="fb-reminder"
          type="text"
          value={fbReminder}
          onChange={event => setFbReminder(event.target.value)}
          placeholder="For example: check-in next Tuesday"
        />
        <button className="btn" style={{ marginTop: 12 }} onClick={submitFeedback}>Submit</button>
        <p className="mut">Linked to the session shown above. Change the assigned exercises with Edit assignment.</p>
      </div>

      <div className="card">
        <h3>Active plan</h3>
        {plan ? (
          <p>{plan.name} · v{plan.v} · {plan.items.map(item => `${item.ex} ${item.targetReps} reps (${item.targetExcursionDeg || 45}° target)`).join(', ')}</p>
        ) : (
          <p className="mut">No plan assigned yet.</p>
        )}
      </div>

      <div className="card">
        <h3>Patient requests</h3>
        {patientRequests.length ? patientRequests.map(request => (
          <div key={request.requestId} style={{ marginTop: 12 }}>
            <div className="row sp">
              <span>
                <span className={`tag ${request.status === 'open' ? 'warn' : 'ok'}`}>{request.kind}</span>{' '}
                {request.message}
              </span>
              {request.status === 'open' && (
                <span>
                  <button className="btn s sm" onClick={() => setReplyTo(request.requestId)}>Reply</button>{' '}
                  <button className="btn s sm" onClick={() => Promise.resolve(resolveRequest(id, request.requestId)).catch(() => toast('Could not close this request.'))}>Close</button>
                </span>
              )}
            </div>
            {request.replies?.map(item => <p className="mut" key={item.replyId}>{item.senderName}: {item.message}</p>)}
            {replyTo === request.requestId && (
              <div>
                <textarea rows={2} value={reply} onChange={event => setReply(event.target.value)} placeholder="Reply to patient" />
                <button className="btn sm" onClick={() => sendReply(request.requestId)}>Send reply</button>
              </div>
            )}
          </div>
        )) : <p className="mut">No requests.</p>}
      </div>

      <KPIs ss={history.filter(session => session.mode !== 'replay')} />

      {/* Longitudinal Recovery Trajectory */}
      {trends && Object.keys(trends.exerciseTrends).length > 0 && (
        <div className="card">
          <h3>Longitudinal ROM Trajectory (Degrees by Session)</h3>
          {Object.entries(trends.exerciseTrends).map(([exercise, points]) => (
            <div key={exercise} style={{ margin: '10px 0' }}>
              <div className="row sp">
                <b>{exercise}</b>
                <span className="mut">Prescribed Target: {points[0]?.targetDeg}°</span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 80, margin: '8px 0 4px' }}>
                {points.map((pt, idx) => {
                  const target = pt.targetDeg || 45;
                  const maxH = 65;
                  const barH = Math.min(maxH, Math.round((pt.meanPeakDeg / (target * 1.3)) * maxH));
                  return (
                    <div key={idx} style={{ flex: 1, textAlign: 'center', fontSize: 11 }}>
                      <div
                        style={{
                          height: Math.max(6, barH),
                          background: pt.meanPeakDeg >= target * 0.9 ? 'var(--ok)' : 'var(--warn)',
                          borderRadius: '4px 4px 0 0',
                          marginBottom: 4,
                        }}
                      />
                      <b>{pt.meanPeakDeg}°</b>
                      <br />
                      <span className="mut">{pt.date.slice(0, 6)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {scored.length > 0 && (
        <div className="card">
          <h3>Prototype score trend</h3>
          <LineChart vals={scored.map(session => avg(session.r))} labs={scored.map(session => session.d.slice(0, 6))} />
          <p className="mut">0–100 display; not a clinical grade.</p>
        </div>
      )}

      <h2>Session results</h2>
      {history.length ? history.slice().reverse().map(session => (
        <div key={session.sessionId ?? session.d} className="card">
          <div className="row sp">
            <b>{session.d}</b>
            <span className={`tag ${session.reviewStatus === 'reviewed' ? 'ok' : 'warn'}`}>
              {session.reviewStatus === 'reviewed' ? 'Reviewed' : 'Needs review'}
            </span>
          </div>
          <div className="wrap">
            <table>
              <thead>
                <tr>
                  <th>Assigned exercise</th>
                  <th>Measured status</th>
                  <th>Active time</th>
                  <th>Score</th>
                  <th>Reps</th>
                </tr>
              </thead>
              <tbody>
                {session.r.map((result, index) => (
                  <Fragment key={`${result.ex}-${index}`}>
                    <tr>
                      <td>{result.ex}</td>
                      <td>{result.c ?? 'Recorded'}</td>
                      <td>{result.t}s</td>
                      <td>{result.s == null ? 'Unavailable' : Math.round(result.s * 100)}</td>
                      <td>{result.assessedReps == null ? 'Legacy fixture' : `${result.withinTargetReps}/${result.assessedReps} in target`}</td>
                    </tr>
                    {result.reps?.length > 0 && (
                      <tr key={`${result.ex}-${index}-reps`}>
                        <td colSpan={5} className="mut">
                          Rep by rep: {result.reps.map((rep, repIndex) => `#${repIndex + 1} ${rep.peakDeg != null ? `${rep.peakDeg}°` : `${Math.round(rep.peak * 100)}%`}, ${(rep.durationMs / 1000).toFixed(1)}s (ecc: ${rep.eccentricRatio ? `${rep.eccentricRatio}x` : '1x'}), score ${rep.score}`).join(' · ')}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          {session.sessionId && session.reviewStatus !== 'reviewed' && (
            <button className="btn s sm" style={{ marginTop: 8 }} onClick={() => Promise.resolve(markSessionReviewed(id, session.sessionId)).catch(() => toast('Could not save the review.'))}>
              Mark reviewed
            </button>
          )}
        </div>
      )) : <div className="card">No sessions yet.</div>}
    </>
  );
}
