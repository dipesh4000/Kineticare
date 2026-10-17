import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/authContext';
import { toast } from './toastBus';

export default function Login() {
  const nav = useNavigate();
  const { user, error, firebaseEnabled, signIn, signInDemo, resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) nav(user.role === 'patient' ? '/patient/home' : '/client/overview', { replace: true });
  }, [user, nav]);

  const submit = async event => {
    event.preventDefault();
    setSubmitting(true);
    await signIn(email, password);
    setSubmitting(false);
  };

  const reset = async event => {
    event.preventDefault();
    if (!email) return toast('Enter your email address first');
    try {
      await resetPassword(email);
      toast('Password reset email sent');
    } catch (cause) {
      toast(cause.message || 'Password reset could not be sent');
    }
  };

  const enterDemo = account => {
    signInDemo(account);
    nav(account.startsWith('patient') ? '/patient/home' : '/client/overview');
  };

  return (
    <div className="center">
      <h1 style={{ color: 'var(--pri)' }}>Kineticare</h1>
      <p className="mut">Tele-rehabilitation that connects patients and clinicians.</p>
      {!firebaseEnabled && <div className="demo">Local demo workspace. Records persist in this browser only.</div>}
      <form className="card" onSubmit={submit}>
        <label htmlFor="em">Email</label>
        <input id="em" type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" required={firebaseEnabled} />
        <label htmlFor="pw">Password</label>
        <input id="pw" type={showPassword ? 'text' : 'password'} value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" required={firebaseEnabled} />
        <label className="check-label">
          <input type="checkbox" checked={showPassword} onChange={event => setShowPassword(event.target.checked)} /> Show password
        </label>
        {error && <p className="demo" role="alert">{error}</p>}
        {firebaseEnabled ? (
          <>
            <p className="mut"><a href="#" onClick={reset}>Forgot password?</a></p>
            <button className="btn" style={{ width: '100%' }} disabled={submitting}>{submitting ? 'Signing in…' : 'Sign in'}</button>
          </>
        ) : (
          <>
            <button type="button" className="btn" style={{ width: '100%', marginBottom: 8 }} onClick={() => enterDemo('patient')}>Open patient demo</button>
            <button type="button" className="btn s" style={{ width: '100%' }} onClick={() => enterDemo('clinician')}>Open clinician demo</button>
          </>
        )}
      </form>
      <p className="mut">Patient workout video is processed on this device and is not uploaded.</p>
    </div>
  );
}
