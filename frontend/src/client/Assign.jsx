import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ALL_EXERCISES, VIDEO_ONLY_EXERCISES } from '../data';
import { useRecords } from '../records/recordsContext';
import { toast } from '../components/toastBus';
import { useAuth } from '../auth/authContext';
import { assessmentIsStale } from '../../../shared/assessmentFields.js';

const defaults = exercise => ({
  ex: exercise,
  checked: false,
  t: 45,
  targetReps: 5,
  targetExcursionDeg: exercise === 'Squat' ? 45 : exercise === 'Toe Touch' ? 60 : 75,
  videoOnly: VIDEO_ONLY_EXERCISES.includes(exercise),
  note: '',
  referenceVersionId: '',
});

export default function ClientAssign() {
  const nav = useNavigate();
  const { user } = useAuth();
  const { id } = useParams();
  const { workspace, assignment, assignmentDraft, saveAssignmentDraft, publishAssignment } = useRecords();
  const patient = workspace.patients.find(item => item.id === id);
  const current = assignment(id);
  const savedDraft = assignmentDraft(id);
  const initial = savedDraft ?? current;
  const assessments = workspace.assessments?.[id] ?? [];
  const [assessmentKey, setAssessmentKey] = useState(initial?.assessmentId ? `${initial.assessmentId}:v${initial.assessmentVersion}` : '');
  const assessment = assessments.find(item => `${item.assessmentId}:v${item.version}` === assessmentKey);
  const [planName, setPlanName] = useState(initial?.name ?? 'Mobility plan');
  const [frequency, setFrequency] = useState(initial?.schedule?.weeklyFrequency ?? 3);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [items, setItems] = useState(ALL_EXERCISES.map(exercise => {
    const item = initial?.items?.find(candidate => candidate.ex === exercise);
    return item ? { ...defaults(exercise), ...item, checked: true } : defaults(exercise);
  }));

  if (!patient) return <div className="card">Patient not found.</div>;

  const setItem = (index, change) => setItems(currentItems => currentItems.map((item, itemIndex) => itemIndex === index ? { ...item, ...change } : item));
  const approvedReferences = exercise => workspace.references.filter(reference => reference.exerciseName === exercise && reference.status === 'approved');
  const build = status => ({
    assignmentId: current?.assignmentId ?? crypto.randomUUID(),
    name: planName.trim() || 'Plan',
    v: (current?.v ?? 0) + 1,
    by: user.displayName,
    clinicianUid: user.uid,
    patientUid: id,
    assessmentId: assessment?.assessmentId ?? null,
    assessmentVersion: assessment?.version ?? null,
    status,
    schedule: { weeklyFrequency: frequency },
    createdAt: new Date().toISOString(),
    items: items.filter(item => item.checked).map(item => {
      const reference = workspace.references.find(candidate => candidate.versionId === item.referenceVersionId);
      return Object.fromEntries(Object.entries({
        ...item,
        referenceId: reference?.referenceId ?? null,
        referencePath: reference ? `references/${reference.referenceId}/versions/${reference.versionId}` : null,
      }).filter(([key]) => key !== 'checked'));
    }),
  });

  const validate = assignmentValue => {
    if (!assessment) return 'Select a published assessment first.';
    if (!assignmentValue.items.length) return 'Select at least one exercise.';
    if (!Number.isInteger(frequency) || frequency < 1 || frequency > 7) return 'Weekly frequency must be between 1 and 7.';
    for (const item of assignmentValue.items) {
      if (![item.t, item.targetReps, item.targetExcursionDeg].every(Number.isFinite)) return `Enter valid targets for ${item.ex}.`;
      if (item.t < 10 || item.t > 1800 || item.targetReps < 1 || item.targetReps > 100) return `Targets for ${item.ex} are outside the supported range.`;
      if (!item.videoOnly && (item.targetExcursionDeg <= 0 || item.targetExcursionDeg > 180)) return `Targets for ${item.ex} are outside the supported range.`;
      if (!item.referenceVersionId) return `Choose an approved reference for ${item.ex}.`;
    }
    return '';
  };

  const saveDraft = async () => {
    if (!items.some(item => item.checked)) { setError('Select at least one exercise.'); return; }
    setBusy(true); setError('');
    try {
      await saveAssignmentDraft(id, build('draft'));
      toast('Assignment draft saved');
    } catch {
      setError('Draft could not be saved. Your changes are still here; try again.');
    } finally { setBusy(false); }
  };

  const publish = async () => {
    const value = build('published');
    const error = validate(value);
    if (error) { setError(error); return; }
    setBusy(true); setError('');
    try {
      await publishAssignment(id, value);
      toast(`Assignment version ${value.v} published`);
      nav(`/client/patients/${id}`);
    } catch (cause) {
      setError(cause.message || 'Assignment could not be published. Your changes are still here; try again.');
    } finally { setBusy(false); }
  };

  return (
    <>
      <h1>Assignment for {patient.n}</h1>
      <p className="mut">1. Choose exercises → 2. Set targets → 3. Review and publish. Save a draft to finish later.</p>
      <div className="card">
        <label htmlFor="assignment-assessment">Select assessment</label>
        <select id="assignment-assessment" value={assessmentKey} onChange={event => setAssessmentKey(event.target.value)}>
          <option value="">Choose a published assessment</option>
          {assessments.map(item => <option key={`${item.assessmentId}:v${item.version}`} value={`${item.assessmentId}:v${item.version}`}>Version {item.version} · {item.assessedAt}</option>)}
        </select>
        {!assessments.length && <p className="mut">Publish an assessment on the patient’s detail page before publishing a plan. You can save a draft now.</p>}
        {assessment && assessmentIsStale(assessment) && <p role="status">This assessment is over 8 weeks old. Consider reassessing before publishing.</p>}
        {assessment && <p className="mut">Assessment v{assessment.version} selected. Targets remain clinician-set; restrictions are recorded for your review: {assessment.restrictions.join(', ') || 'none recorded'}.</p>}
        <label htmlFor="pn">Plan name</label>
        <input id="pn" type="text" value={planName} onChange={event => setPlanName(event.target.value)} />
        <label htmlFor="frequency">Sessions per week</label>
        <input id="frequency" type="number" min="1" max="7" value={frequency} onChange={event => setFrequency(Number(event.target.value))} />

        <h3 style={{ marginTop: 16 }}>Exercises and patient targets</h3>
        {items.map((item, index) => (
          <div key={item.ex} className="card" style={{ background: 'var(--soft)' }}>
            <label className="check-label"><input type="checkbox" checked={item.checked} onChange={() => setItem(index, { checked: !item.checked, referenceVersionId: item.referenceVersionId || approvedReferences(item.ex)[0]?.versionId || '' })} /> {item.ex}</label>
            {item.checked && <>
              <label>Approved reference</label>
              <select value={item.referenceVersionId} onChange={event => setItem(index, { referenceVersionId: event.target.value })}>
                <option value="">Choose a reference</option>
                {approvedReferences(item.ex).map(reference => <option key={reference.versionId} value={reference.versionId}>Version {reference.version} · {reference.cameraView}</option>)}
              </select>
              {!approvedReferences(item.ex).length && <p className="session-status">No approved reference is available. You can save this as a draft, but it cannot be published yet. <a href="/client/library" target="_blank" rel="noreferrer">View exercise library</a></p>}
              <div className="grid">
                <label>{item.videoOnly ? 'Suggested reps (not counted)' : 'Target reps'}<input type="number" min="1" max="100" value={item.targetReps} onChange={event => setItem(index, { targetReps: Number(event.target.value) })} /></label>
                {!item.videoOnly && <label>Target movement (degrees)<input type="number" min="1" max="180" value={item.targetExcursionDeg} onChange={event => setItem(index, { targetExcursionDeg: Number(event.target.value) })} /></label>}
                <label>Time limit (seconds)<input type="number" min="10" max="1800" value={item.t} onChange={event => setItem(index, { t: Number(event.target.value) })} /></label>
              </div>
              <label>Instructions<textarea rows="2" value={item.note} onChange={event => setItem(index, { note: event.target.value })} /></label>
            </>}
          </div>
        ))}
        <p className="mut">Targets are clinician-set. Publishing creates a new immutable assignment version for future sessions.</p>
      </div>
      <div className="card">
        <h3>Patient preview</h3>
        <p className="mut">{assessment ? `Linked to assessment v${assessment.version}, assessed ${assessment.assessedAt}.` : 'No assessment selected.'} No automatic target changes are applied.</p>
        <b>{planName || 'Plan'}</b>
        {items.filter(item => item.checked).map(item => <p key={item.ex}>{item.ex}: {item.videoOnly ? `video guide, about ${item.targetReps} reps, not camera-measured` : `${item.targetReps} reps, ${item.targetExcursionDeg}° target`} · {item.note || 'No additional note'}</p>)}
        {!items.some(item => item.checked) && <p className="mut">Select an exercise above to preview the patient's plan.</p>}
        <p className="mut">{frequency} sessions per week · {items.filter(item => item.checked).length} exercises selected</p>
        {error && <p className="session-status" role="alert">{error}</p>}
        <div className="row" style={{ flexWrap: 'wrap' }}><button className="btn" disabled={busy || !items.some(item => item.checked)} onClick={publish}>{busy ? 'Saving…' : 'Publish patient plan'}</button><button className="btn s" disabled={busy} onClick={saveDraft}>Save draft</button></div>
      </div>
    </>
  );
}
