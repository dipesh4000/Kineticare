import { useState } from 'react';
import { Captcha, useLoginWithEmail } from '@privy-io/react-auth';
import { withAuthTimeout } from '../auth/withAuthTimeout';

export default function EmailLogin() {
  const { sendCode, loginWithCode, state } = useLoginWithEmail();
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function run(operation) {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try { await withAuthTimeout(operation); return true; }
    catch (cause) { setError(cause.message || 'Sign-in failed. Please try again.'); return false; }
    finally { setBusy(false); }
  }

  async function send() {
    const address = (sentTo || email).trim();
    const sent = await run(() => sendCode({ email: address }));
    if (sent) {
      setSentTo(address);
      setCode('');
      setNotice('A fresh code has been sent. Use the latest email.');
    }
  }

  return <>
    <Captcha />
    {state.status === 'done' ? <p role="status">Email verified. Loading your account…</p> : sentTo ? <>
      <p>Enter the 6-digit code sent to <b>{sentTo}</b>.</p>
      <form onSubmit={event => { event.preventDefault(); run(() => loginWithCode({ code })); }}>
        <label htmlFor="login-code">Verification code</label>
        <input id="login-code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} disabled={busy} autoFocus aria-describedby="login-code-help" />
        <p id="login-code-help" className="mut">Paste the code, then tap Verify and continue.</p>
        <button type="submit" className="btn" disabled={busy || code.length !== 6}>{busy ? 'Verifying…' : 'Verify and continue'}</button>
      </form>
      <div className="row" style={{ marginTop: 12, flexWrap: 'wrap' }}>
        <button type="button" className="btn s sm" disabled={busy} onClick={send}>Resend code</button>
        <button type="button" className="btn s sm" disabled={busy} onClick={() => { setSentTo(''); setCode(''); setError(''); setNotice(''); }}>Use another email</button>
      </div>
    </> : <form onSubmit={event => { event.preventDefault(); send(); }}>
      <p>Sign up or sign in with a verification code sent to your email.</p>
      <label htmlFor="login-email">Email address</label>
      <input id="login-email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required value={email} onChange={event => setEmail(event.target.value)} disabled={busy} />
      <button type="submit" className="btn" disabled={busy}>{busy ? 'Sending code…' : 'Continue with email'}</button>
    </form>}
    {notice && <p role="status" className="mut">{notice}</p>}
    {error && <p role="alert" className="demo">{error}</p>}
  </>;
}
