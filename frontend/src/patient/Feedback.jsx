import { useEffect, useState } from 'react';
import { useRecords } from '../records/recordsContext';
import { toast } from '../components/toastBus';

export default function PatientFeedback() {
  const { patientId, feedback, requests, markFeedbackRead, createRequest } = useRecords();
  const messages = feedback(patientId);
  const patientRequests = requests(patientId);
  const [replyTo, setReplyTo] = useState(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (messages.some(item => !item.read)) Promise.resolve(markFeedbackRead(patientId)).catch(() => toast('Could not save the read receipt.'));
  }, [patientId, messages, markFeedbackRead]);

  const ask = async feedbackId => {
    if (!message.trim()) return toast('Write your question first');
    const linked = messages.find(item => item.id === feedbackId);
    try {
    await createRequest(patientId, {
      requestId: crypto.randomUUID(), kind: 'question', feedbackId,
      sessionId: linked?.sessionId ?? null, message: message.trim(), creatorId: patientId,
      createdAt: new Date().toISOString(), status: 'open',
    });
    setMessage('');
    setReplyTo(null);
    toast('Question sent to your clinician');
    } catch { toast('Question was not saved. Check your connection and retry.'); }
  };

  return (
    <>
      <h1>Feedback</h1>
      {messages.length ? messages.map(item => (
        <div key={item.id} className="card">
          <div className="row sp"><b>{item.from}</b><span className="mut">{item.d}</span></div>
          <p>{item.m}</p>
          {item.sessionId && <p className="mut">Linked session: {item.sessionId}</p>}
          <span className={`tag ${item.read ? 'ok' : 'warn'}`}>{item.read ? 'Read' : 'Unread'}</span>{' '}
          <button className="btn s sm" onClick={() => setReplyTo(item.id)}>Ask a question</button>
          {replyTo === item.id && <div style={{ marginTop: 10 }}>
            <textarea rows="3" value={message} onChange={event => setMessage(event.target.value)} placeholder="Your question" />
            <div className="row" style={{ marginTop: 8 }}><button className="btn sm" onClick={() => ask(item.id)}>Send</button><button className="btn s sm" onClick={() => setReplyTo(null)}>Cancel</button></div>
          </div>}
        </div>
      )) : <div className="card">No clinician feedback yet.</div>}
      <h2>My questions and requests</h2>
      {patientRequests.length ? patientRequests.map(request => <div className="card" key={request.requestId}>
        <div className="row sp"><b>{request.kind}</b><span className={`tag ${request.status === 'open' ? 'warn' : 'ok'}`}>{request.status}</span></div>
        <p>{request.message}</p>
        {request.replies?.map(reply => <p key={reply.replyId} className="mut"><b>{reply.senderName}:</b> {reply.message}</p>)}
      </div>) : <div className="card">No questions or help requests yet.</div>}
    </>
  );
}
