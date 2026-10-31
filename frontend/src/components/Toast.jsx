import { useEffect, useRef, useState } from 'react';
import { subscribeToToast } from './toastBus';

export default function Toast() {
  const [msg, setMsg] = useState('');
  const timer = useRef();

  useEffect(() => subscribeToToast(message => {
    clearTimeout(timer.current);
    setMsg(message);
    timer.current = setTimeout(() => setMsg(''), 2200);
  }), []);

  useEffect(() => () => clearTimeout(timer.current), []);

  if (!msg) return null;
  return (
    <div role="status" style={{
      position: 'fixed', left: '50%', bottom: 90, transform: 'translateX(-50%)',
      background: '#222', color: '#fff', padding: '10px 18px',
      borderRadius: 999, fontSize: 14, zIndex: 9, whiteSpace: 'nowrap'
    }}>{msg}</div>
  );
}
