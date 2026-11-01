import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useRecords } from '../records/recordsContext';
import { startDraft } from '../session/drafts';
import { INSTRUCTIONS } from '../data';
import ScoreTimeCharts from '../components/ExerciseCharts';
import ReferenceVideo from '../components/ReferenceVideo';
import ExportPdf from '../components/ExportPdf';
import Icon from '../components/Icon';

export default function PatientWorkout({ initialTab }) {
  const nav = useNavigate();
  const location = useLocation();
  const { patientId, patientPlan, sessions, workspace } = useRecords();
  const plan = patientPlan(patientId);
  const patient = workspace?.patients?.find(p => p.id === patientId);
  const last = sessions(patientId).at(-1);

  const defaultTab = initialTab || (location.pathname.includes('/plan') ? 'plan' : 'workout');
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [expandedExercise, setExpandedExercise] = useState(null);

  if (!plan) return <div className="card">No active assignment. Contact your clinician if you expected one.</div>;

  const start = (exIdx, all) => nav('/patient/pre', { state: startDraft(plan, patientId, exIdx, all) });
  const totalReps = plan.items.reduce((total, item) => total + item.targetReps, 0);

  return (
    <>
      <div className="row sp" style={{ marginBottom: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>Workout & Plan</h1>
          <p className="mut" style={{ margin: '4px 0 0', fontSize: 13 }}>
            {plan.name} · {plan.source === 'self-guided' ? 'Starter guidance' : `Prescribed by ${plan.by}`}
            {plan.schedule?.weeklyFrequency ? ` · ${plan.schedule.weeklyFrequency}x/week` : ''}
          </p>
        </div>
        {patient && plan && <ExportPdf patient={patient} plan={plan} />}
      </div>

      {/* Segmented Tab Toggle for Workout vs Plan Details */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 6,
          background: 'var(--soft)',
          padding: 4,
          borderRadius: 14,
          marginBottom: 16,
          border: '1px solid var(--card-border)',
        }}
      >
        <button
          type="button"
          className="btn s"
          style={{
            minHeight: 38,
            padding: '6px 12px',
            borderRadius: 10,
            background: activeTab === 'workout' ? 'var(--card)' : 'transparent',
            color: activeTab === 'workout' ? 'var(--ink)' : 'var(--mut)',
            border: activeTab === 'workout' ? '1px solid var(--card-border)' : '1px solid transparent',
            fontWeight: activeTab === 'workout' ? 700 : 500,
            boxShadow: activeTab === 'workout' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
          }}
          onClick={() => setActiveTab('workout')}
        >
          <Icon name="workout" size={17} color={activeTab === 'workout' ? 'var(--pri)' : 'currentColor'} />
          Today's Workout
        </button>

        <button
          type="button"
          className="btn s"
          style={{
            minHeight: 38,
            padding: '6px 12px',
            borderRadius: 10,
            background: activeTab === 'plan' ? 'var(--card)' : 'transparent',
            color: activeTab === 'plan' ? 'var(--ink)' : 'var(--mut)',
            border: activeTab === 'plan' ? '1px solid var(--card-border)' : '1px solid transparent',
            fontWeight: activeTab === 'plan' ? 700 : 500,
            boxShadow: activeTab === 'plan' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
          }}
          onClick={() => setActiveTab('plan')}
        >
          <Icon name="plan" size={17} color={activeTab === 'plan' ? 'var(--pri)' : 'currentColor'} />
          Plan & Guides
        </button>
      </div>

      {/* Main Prescription Card */}
      <div className="card" style={{ padding: '22px 20px', textAlign: 'center', marginBottom: 20 }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: 'var(--pri2)',
            display: 'grid',
            placeItems: 'center',
            margin: '0 auto 12px',
          }}
        >
          <Icon name="workout" size={24} color="var(--pri)" />
        </div>
        <h2 style={{ margin: '0 0 6px', fontSize: 20 }}>{plan.name}</h2>
        <p className="mut" style={{ margin: '0 0 16px', fontSize: 14 }}>
          {plan.items.length} guided exercises · {totalReps} target reps · Version {plan.v}
        </p>
        <button className="btn" style={{ width: '100%', maxWidth: 320 }} onClick={() => start(0, true)}>
          Start Full Workout
        </button>
      </div>

      {plan.source === 'self-guided' && (
        <div className="card" style={{ borderLeft: '4px solid var(--warn)', marginBottom: 16 }}>
          <b>General guidance only</b>
          <p className="mut" style={{ margin: '4px 0 0', fontSize: 13 }}>
            This starter plan does not account for an undiagnosed condition. A clinician should review it before progression.
          </p>
        </div>
      )}

      {/* TAB 1: Workout Routine */}
      {activeTab === 'workout' && (
        <>
          <div className="row sp" style={{ margin: '20px 0 10px' }}>
            <h2 style={{ margin: 0 }}>Exercises</h2>
            <span className="mut" style={{ fontSize: 13 }}>Practice individually or start all</span>
          </div>

          {plan.items.map((item, index) => {
            const isExpanded = expandedExercise === item.ex;
            const ref = workspace?.references?.find(entry => entry.versionId === item.referenceVersionId);
            return (
              <div className="card" key={item.ex} style={{ padding: '16px 18px', marginBottom: 12 }}>
                <div className="row sp" style={{ alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
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
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button
                      className="btn s sm"
                      style={{ fontSize: 11, padding: '5px 8px' }}
                      onClick={() => setExpandedExercise(isExpanded ? null : item.ex)}
                      title="Show video & instructions"
                    >
                      {isExpanded ? 'Hide guide ▴' : 'Guide ▾'}
                    </button>
                    <button className="btn sm" onClick={() => start(index, false)}>
                      Practice
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--card-border)' }}>
                    {ref ? (
                      <div className="vid" style={{ maxWidth: 260, margin: '0 auto 12px' }}>
                        <ReferenceVideo mediaPath={ref.mediaPath} />
                      </div>
                    ) : (
                      <p className="demo" style={{ fontSize: 12, marginBottom: 8 }}>
                        No demonstration video attached yet.
                      </p>
                    )}
                    {(INSTRUCTIONS[item.ex] ?? []).map(([title, text]) => (
                      <p key={title} style={{ margin: '6px 0', fontSize: 13 }}>
                        <b>{title}:</b> {text}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          <h2 style={{ marginTop: 24 }}>Previous Workout Results{last ? `: ${last.d}` : ''}</h2>
          {last ? (
            <ScoreTimeCharts results={last.r} />
          ) : (
            <div className="card">Your results and joint angles will appear here after your first workout session.</div>
          )}
        </>
      )}

      {/* TAB 2: Plan Details, Schedule & Guides */}
      {activeTab === 'plan' && (
        <>
          <div className="row sp" style={{ margin: '20px 0 10px' }}>
            <h2 style={{ margin: 0 }}>Prescription & Exercise Details</h2>
            <span className="mut" style={{ fontSize: 13 }}>{plan.items.length} prescribed movements</span>
          </div>

          {plan.items.map((item, index) => {
            const ref = workspace?.references?.find(entry => entry.versionId === item.referenceVersionId);
            return (
              <details className="card" key={item.ex} style={{ marginBottom: 12 }} open>
                <summary style={{ cursor: 'pointer', listStyle: 'none' }}>
                  <div className="row sp">
                    <h3 style={{ margin: 0 }}>{item.ex}</h3>
                    <span className="tag">{item.targetReps} reps · {item.targetExcursionDeg}°</span>
                  </div>
                  {item.note && <p className="mut" style={{ margin: '6px 0 0', fontSize: 13 }}>{item.note}</p>}
                </summary>
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--card-border)' }}>
                  {ref ? (
                    <div className="vid" style={{ maxWidth: 260, margin: '0 auto 12px' }}>
                      <ReferenceVideo mediaPath={ref.mediaPath} />
                    </div>
                  ) : (
                    <p className="demo">No demonstration video is attached to this exercise yet.</p>
                  )}
                  {(INSTRUCTIONS[item.ex] ?? []).map(([title, text]) => (
                    <p key={title} style={{ margin: '8px 0', fontSize: 13 }}>
                      <b>{title}:</b> {text}
                    </p>
                  ))}
                  <button className="btn sm" style={{ marginTop: 10 }} onClick={() => start(index, false)}>
                    Practice this exercise
                  </button>
                </div>
              </details>
            );
          })}
        </>
      )}
    </>
  );
}
