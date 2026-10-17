import { DATA } from '../data';
import { toast } from '../components/Toast';

export default function PatientFeedback() {
  DATA.fb.forEach(f => (f.read = true));
  return (
    <>
      <h1>Feedback</h1>
      {DATA.fb.map(f => (
        <div key={f.id} className="card">
          <div className="row sp">
            <b>{f.from}</b>
            <span className="mut">{f.d}</span>
          </div>
          <p>{f.m}</p>
          <span className="tag ok">Read</span>{' '}
          <button className="btn s sm" onClick={() => toast('Reply sent (demo)')}>Ask a question</button>
        </div>
      ))}
    </>
  );
}
