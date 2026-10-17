import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRecords } from '../records/recordsContext';
import { saveSessionDraft } from '../session/drafts';

export default function PatientPlan() {
  const nav = useNavigate();
  const [query, setQuery] = useState('');
  const { patientId, assignment } = useRecords();
  const P = assignment(patientId);
  if (!P) return <div className="card">No active assignment. Contact your clinician if you expected one.</div>;
  const prepare = (exIdx, all) => {
    const sessionId = crypto.randomUUID();
    const draft = { sessionId, assignmentId: P.assignmentId, assignmentVersion: P.v, exIdx, all, done: [], startedAtClient: new Date().toISOString() };
    saveSessionDraft(patientId, draft);
    nav('/patient/pre', { state: draft });
  };
  const visibleItems = P.items.map((item, index) => ({ item, index })).filter(({ item }) => item.ex.toLowerCase().includes(query.toLowerCase()));
  return (
    <>
      <h1>{P.name}</h1>
      <p className="mut">By {P.by} · version {P.v}{P.schedule?.weeklyFrequency ? ` · ${P.schedule.weeklyFrequency} times per week` : ''}</p>
      <label htmlFor="exercise-search">Search assigned exercises</label>
      <input id="exercise-search" type="text" value={query} onChange={event => setQuery(event.target.value)} placeholder="Squat or arm raise" />
      <div style={{ marginTop: 12 }} />
      {visibleItems.map(({ item: x, index: i }) => (
        <div key={i} className="card">
          <div className="row sp">
            <h3>{x.ex}</h3>
            <span className="tag">Not started</span>
          </div>
          <p className="mut">Target: {x.t} seconds{x.note ? ' · ' + x.note : ''}</p>
          <button className="btn s sm" onClick={() => prepare(i, false)}>Instructions</button>
        </div>
      ))}
      {!visibleItems.length && <div className="card">No assigned exercise matches “{query}”.</div>}
      <button className="btn" style={{ width: '100%' }} onClick={() => prepare(0, true)}>
        Start plan
      </button>
    </>
  );
}
