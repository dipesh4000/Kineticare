import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRecords } from '../records/recordsContext';

export default function ClientPatients() {
  const nav = useNavigate();
  const { workspace, sessions, addPatient, backend, error: recordsError } = useRecords();
  const [q, setQ] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const filtered = workspace.patients.filter(x => (x.n + x.id + (x.email ?? '')).toLowerCase().includes(q.toLowerCase()));
  const onboard = async event => {
    event.preventDefault();
    setSaving(true);
    setNotice('');
    try {
      const id = await addPatient(name, email);
      setName(''); setEmail('');
      if (id) nav(`/client/patients/${id}/assign`);
      else setNotice('Invitation saved. Share this app’s address with the patient. They must create an account with this email and verify it before you can assign exercises. No invitation email has been sent.');
    } catch (cause) { setNotice(cause.message || 'Patient could not be added.'); }
    finally { setSaving(false); }
  };
  return (
    <>
      <h1>Patients</h1>
      <form className="card" onSubmit={onboard}>
        <h2>Add patient by email</h2>
        <label htmlFor="patient-name">Patient name</label>
        <input id="patient-name" value={name} onChange={event => setName(event.target.value)} maxLength={100} required />
        <label htmlFor="patient-email">Patient email</label>
        <input id="patient-email" type="email" value={email} onChange={event => setEmail(event.target.value)} maxLength={254} required />
        <button className="btn" style={{ marginTop: 12 }} disabled={saving}>{saving ? 'Saving…' : backend === 'local-demo' ? 'Add demo patient' : 'Create patient invitation'}</button>
        <p className="mut">{backend === 'local-demo' ? 'The new patient will appear on the demo login screen in this browser.' : 'The patient joins with this verified email. After they join, open their record to assign exercises.'}</p>
        {notice && <p role="status">{notice}</p>}
      </form>
      {recordsError && <p role="alert">{recordsError}</p>}
      {workspace.invites?.length > 0 && <div className="card">
        <h2>Awaiting patient signup</h2>
        {workspace.invites.map(invite => <p key={invite.email}>{invite.displayName} · {invite.email} · Pending</p>)}
      </div>}
      <label htmlFor="q">Search</label>
      <input id="q" type="text" placeholder="Name, email or ID" value={q} onChange={e => setQ(e.target.value)} />
      <div className="card" style={{ marginTop: 12 }}>
        <div className="wrap">
          <table>
            <thead><tr><th>Patient</th><th>ID</th><th>Last session</th><th>History</th><th></th></tr></thead>
            <tbody>
              {filtered.map(x => {
                const recent = sessions(x.id).at(-1);
                return (
                <tr key={x.id}>
                  <td>{x.n}<div className="mut">{x.email}</div></td><td>{x.id}</td><td>{recent?.d ?? 'No sessions yet'}</td><td>{sessions(x.id).length} saved</td>
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
