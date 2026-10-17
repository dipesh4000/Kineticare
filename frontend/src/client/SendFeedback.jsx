import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DATA } from '../data';
import { toast } from '../components/Toast';

export default function ClientSendFeedback() {
  const nav = useNavigate();
  const { id } = useParams();
  const p = DATA.pts.find(x => x.id === id);
  const [msg, setMsg] = useState('');

  const send = () => {
    if (!msg.trim()) return toast('Write a message first');
    DATA.fb.unshift({ id: 'F-' + (DATA.fb.length + 1), from: 'Dr. Sarah Khan', d: 'Today', m: msg.trim(), read: false });
    toast('Feedback sent');
    nav(`/client/patients/${id}`);
  };

  return (
    <>
      <h1>Feedback for {p?.n}</h1>
      <div className="card">
        <label htmlFor="fs">Linked session</label>
        <select id="fs">
          {DATA.sess.map(s => <option key={s.d}>{s.d}</option>)}
        </select>
        <label htmlFor="fm">Message</label>
        <textarea id="fm" rows="4" value={msg} onChange={e => setMsg(e.target.value)} />
        <h3 style={{ marginTop: 12 }}>Preview as patient</h3>
        <p className="mut">{msg || 'Your message appears here.'}</p>
        <button className="btn" onClick={send}>Send feedback</button>
      </div>
    </>
  );
}
