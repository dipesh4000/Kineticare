import { useEffect, useRef, useState } from 'react';
import { subscribeToToast } from './toastBus';

export default function Toast() {
  const [msg, setMsg] = useState('');
  const timer = useRef();

  useEffect(() => subscribeToToast(message => {
    clearTimeout(timer.current);
    setMsg(message);
    timer.current = setTimeout(() => setMsg(''), 6000);
  }), []);

  useEffect(() => () => clearTimeout(timer.current), []);

  if (!msg) return null;
  return (
    <div role="status" aria-live="polite" className="toast-message">
      <span>{msg}</span><button type="button" aria-label="Dismiss notification" onClick={() => setMsg('')}>×</button>
    </div>
  );
}
