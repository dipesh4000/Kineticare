import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRecords } from '../records/recordsContext';

export default function ClientPatients() {
  const nav = useNavigate();
  const { workspace, sessions } = useRecords();
  const [q, setQ] = useState('');
  const filtered = workspace.patients.filter(x => (x.n + x.id).toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <h1>Patients</h1>
      <label htmlFor="q">Search</label>
      <input id="q" type="text" placeholder="Name or ID" value={q} onChange={e => setQ(e.target.value)} />
      <div className="card" style={{ marginTop: 12 }}>
        <div className="wrap">
          <table>
            <thead><tr><th>Patient</th><th>ID</th><th>Last session</th><th>History</th><th></th></tr></thead>
            <tbody>
              {filtered.map(x => {
                const recent = sessions(x.id).at(-1);
                return (
                <tr key={x.id}>
                  <td>{x.n}</td><td>{x.id}</td><td>{recent?.d ?? 'No sessions yet'}</td><td>{sessions(x.id).length} saved</td>
                  <td><button className="btn sm" onClick={() => nav('/client/patients/' + x.id)}>Open patient</button></td>
                </tr>
              );})}
              {!filtered.length && <tr><td colSpan="5">No linked patient matches this search.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
