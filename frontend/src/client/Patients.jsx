import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRecords } from '../records/recordsContext';
import CareConnection from '../components/CareConnection';

export default function ClientPatients() {
  const { workspace } = useRecords();
  const [query, setQuery] = useState('');
  const nav = useNavigate();
  return <><h1>Your patients</h1><CareConnection /><label htmlFor="patient-search">Search linked patients</label><input id="patient-search" value={query} onChange={event => setQuery(event.target.value)} />{workspace.patients.filter(patient => (patient.n + patient.email).toLowerCase().includes(query.toLowerCase())).map(patient => <div className="card row sp" key={patient.id}><div><h3>{patient.n}</h3><p className="mut">{patient.email}</p></div><button className="btn s" onClick={() => nav('/client/patients/' + encodeURIComponent(patient.id))}>Open patient</button></div>)}{!workspace.patients.length && <p className="card">Patients appear here after they use your invite code and consent to sharing.</p>}</>;
}

