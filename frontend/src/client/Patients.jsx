import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DATA } from '../data';

export default function ClientPatients() {
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const filtered = DATA.pts.filter(x => (x.n + x.id).toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <h1>Patients</h1>
      <label htmlFor="q">Search</label>
      <input id="q" type="text" placeholder="Name or ID" value={q} onChange={e => setQ(e.target.value)} />
      <div className="card" style={{ marginTop: 12 }}>
        <div className="wrap">
          <table>
            <thead><tr><th>Patient</th><th>ID</th><th>Last session</th><th>Adherence</th><th></th></tr></thead>
            <tbody>
              {filtered.map(x => (
                <tr key={x.id}>
                  <td>{x.n}</td><td>{x.id}</td><td>{x.last}</td><td>{x.adh}%</td>
                  <td><button className="btn sm" onClick={() => nav('/client/patients/' + x.id)}>Open patient</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
