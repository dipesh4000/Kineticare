import { useState } from 'react';
import { useRecords } from '../../records/recordsContext';
import { postureOptions, romFields, strengthFields, restrictions, painSites, functionalOptions, somatotypes, assessmentLabel as label } from '../../../../shared/assessmentFields.js';

const today = () => new Date().toLocaleDateString('en-CA');
const blank = () => ({ assessedAt: today(), anthropometrics: {}, posture: {}, rom: {}, strength: {}, painAreas: [], restrictions: [], functionalTests: {}, notes: '' });

export default function AssessmentPanel({ patientId, readOnly = false }) {
  const { workspace, publishAssessment } = useRecords();
  const history = workspace.assessments?.[patientId] ?? [];
  const latest = history[0];
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(blank);
  const [identity, setIdentity] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (section, field, value) => setForm(current => ({ ...current, [section]: { ...current[section], [field]: value } }));
  const number = (section, field, title, min, max, step = 'any') => <label key={field}>{title}<input type="number" min={min} max={max} step={step} value={form[section][field] ?? ''} onChange={event => set(section, field, event.target.value === '' ? undefined : Number(event.target.value))} /></label>;
  const select = (section, field, options) => <label key={field}>{label(field)}<select value={form[section][field] ?? ''} onChange={event => set(section, field, event.target.value || undefined)}><option value="">Not assessed</option>{options.map(value => <option key={value} value={value}>{label(value)}</option>)}</select></label>;
  const begin = () => {
    const source = latest ?? blank();
    const values = Object.fromEntries(Object.keys(blank()).map(key => [key, structuredClone(source[key])]));
    delete values.anthropometrics.bmi;
    values.assessedAt = today();
    setForm(values);
    setIdentity({ assessmentId: latest?.assessmentId ?? crypto.randomUUID(), version: (latest?.version ?? 0) + 1 });
    setError(''); setEditing(true);
  };
  const publish = async event => {
    event.preventDefault(); setBusy(true); setError('');
    try { await publishAssessment(patientId, { ...form, ...identity }); setEditing(false); }
    catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  };
  return <section className="card">
    <h2>Clinical assessment</h2>
    <p className="mut">Published versions are permanent. A reassessment creates a new version; earlier plans and sessions keep their original baseline.</p>
    {!readOnly && !editing && <button className="btn s" onClick={begin}>{latest ? 'Create reassessment' : 'Add assessment'}</button>}
    {editing && <form onSubmit={publish}><fieldset disabled={busy}>
      <legend>Assessment version {identity.version}</legend>
      <label>Assessment date<input type="date" required max={today()} value={form.assessedAt} onChange={event => setForm({ ...form, assessedAt: event.target.value })} /></label>
      <h3>Anthropometrics</h3><div className="grid">
        {number('anthropometrics', 'heightCm', 'Height (cm)', 30, 250)}{number('anthropometrics', 'weightKg', 'Weight (kg)', 1, 500)}
        {number('anthropometrics', 'legLengthDiscrepancyCm', 'Leg length discrepancy (cm)', 0, 30)}{select('anthropometrics', 'somatotype', somatotypes)}
      </div><p className="mut">BMI is calculated when height and weight are provided. Somatotype is descriptive and does not set exercise targets.</p>
      <h3>Posture</h3><div className="grid">{Object.entries(postureOptions).map(([key, options]) => select('posture', key, options))}</div>
      {[['rom', romFields, 'Measured ROM (degrees)', 180, 'any'], ['strength', strengthFields, 'Strength (grade 0–5)', 5, '1']].map(([section, fields, title, max, step]) => <div key={section}><h3>{title}</h3>{fields.map(field => <div className="grid" key={field}>{['left', 'right'].map(side => <label key={side}>{label(field)} · {side}<input type="number" min="0" max={max} step={step} value={form[section][field]?.[side] ?? ''} onChange={event => set(section, field, { ...form[section][field], [side]: event.target.value === '' ? undefined : Number(event.target.value) })} /></label>)}</div>)}</div>)}
      <h3>Pain by site</h3><p className="mut">Leave blank if not assessed; zero means assessed with no pain.</p><div className="grid">{painSites.map(site => <label key={site}>{label(site)} (0–10)<input type="number" min="0" max="10" step="1" value={form.painAreas.find(item => item.site === site)?.nrs ?? ''} onChange={event => setForm(current => ({ ...current, painAreas: [...current.painAreas.filter(item => item.site !== site), ...(event.target.value === '' ? [] : [{ site, nrs: Number(event.target.value) }])] }))} /></label>)}</div>
      <h3>Restrictions</h3>{restrictions.map(value => <label className="check-label" key={value}><input type="checkbox" checked={form.restrictions.includes(value)} onChange={event => setForm(current => ({ ...current, restrictions: event.target.checked ? [...current.restrictions, value] : current.restrictions.filter(item => item !== value) }))} />{label(value)}</label>)}
      <h3>Functional tests</h3><div className="grid">{['singleLegSquat', 'overheadSquat'].map(field => select('functionalTests', field, functionalOptions))}</div>
      <label>Clinical notes<textarea maxLength={2000} rows="3" value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} /></label>
      <p className="mut">Partial assessments are allowed. Blank fields mean not assessed. This step records the baseline; exercise targets remain clinician-set.</p>
      {error && <p role="alert">{error}</p>}
      <div className="row"><button className="btn" disabled={busy}>{busy ? 'Publishing…' : 'Publish immutable assessment'}</button><button type="button" className="btn s" disabled={busy} onClick={() => setEditing(false)}>Cancel</button></div>
    </fieldset></form>}
    {!history.length && <p className="mut">No published assessments yet.</p>}
    {history.map(assessment => <details key={`${assessment.assessmentId}-${assessment.version}`}><summary>Version {assessment.version} · {assessment.assessedAt} · {assessment.clinicianName}</summary>
      {['anthropometrics', 'posture', 'rom', 'strength', 'functionalTests'].map(section => <div key={section}><h3>{label(section)}</h3>{Object.entries(assessment[section]).length ? Object.entries(assessment[section]).map(([key, value]) => <p key={key}>{label(key)}: {typeof value === 'object' ? Object.entries(value).map(([side, amount]) => `${side}: ${amount}`).join(' · ') : label(String(value))}</p>) : <p className="mut">Not assessed</p>}</div>)}
      <p>Pain: {assessment.painAreas.map(item => `${label(item.site)} ${item.nrs}/10`).join(', ') || 'Not assessed'}</p><p>Restrictions: {assessment.restrictions.map(label).join(', ') || 'None recorded'}</p><p>{assessment.notes}</p>
    </details>)}
  </section>;
}
