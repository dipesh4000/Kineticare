import { useState, useCallback } from 'react';

let _show;
export function useToast() {
  const [msg, setMsg] = useState('');
  _show = useCallback(m => {
    setMsg(m);
    setTimeout(() => setMsg(''), 2200);
  }, []);
  return msg;
}

export const toast = m => _show?.(m);

export function Toast({ msg }) {
  if (!msg) return null;
  return (
    <div role="status" style={{
      position: 'fixed', left: '50%', bottom: 90, transform: 'translateX(-50%)',
      background: '#222', color: '#fff', padding: '10px 18px',
      borderRadius: 999, fontSize: 14, zIndex: 9, whiteSpace: 'nowrap'
    }}>{msg}</div>
  );
}
