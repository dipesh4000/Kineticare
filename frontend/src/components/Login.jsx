import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/authContext';
import { toast } from './toastBus';
import Icon from './Icon';

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
      {/* Centered Medical Emblem */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'var(--pri2)',
            display: 'grid',
            placeItems: 'center',
            margin: '0 auto 12px',
          }}
        >
          <Icon name="plan" size={32} color="var(--pri)" />
        </div>
        <h1 style={{ color: 'var(--pri)', fontSize: 26, marginBottom: 6 }}>Kineticare</h1>
        <p className="mut" style={{ fontSize: 14, margin: 0 }}>
          Camera-guided physical therapy connecting patients and clinicians.
        </p>
      </div>

      {!firebaseEnabled && (
        <div className="card" style={{ padding: '20px', textAlign: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 6px' }}>Choose your workspace</h3>
          <p className="mut" style={{ fontSize: 13, marginBottom: 16 }}>
            Select an account to explore the patient workout or doctor dashboard.
          </p>
          <button
            type="button"
            className="btn"
            style={{ width: '100%', marginBottom: 10 }}
            onClick={() => enterDemo('patient')}
          >
            Enter Patient Portal (Shyam)
          </button>
          <button
            type="button"
            className="btn s"
            style={{ width: '100%' }}
            onClick={() => enterDemo('clinician')}
          >
            Enter Clinician Portal (Dr. Aditi)
          </button>
        </div>
      )}

      <form className="card" onSubmit={submit}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 12, color: 'var(--pri)' }}>
          {firebaseEnabled ? 'Sign in with credentials' : 'Or sign in with email'}
        </div>
        <label htmlFor="em">Email address</label>
        <input
          id="em"
          type="email"
          placeholder="name@example.com"
          value={email}
          onChange={event => setEmail(event.target.value)}
          autoComplete="email"
          required={firebaseEnabled}
        />
        <label htmlFor="pw">Password</label>
        <input
          id="pw"
          type={showPassword ? 'text' : 'password'}
          placeholder="••••••••"
          value={password}
          onChange={event => setPassword(event.target.value)}
          autoComplete="current-password"
          required={firebaseEnabled}
        />
        <label className="check-label">
          <input type="checkbox" checked={showPassword} onChange={event => setShowPassword(event.target.checked)} />
          Show password
        </label>
        {error && <p className="demo" role="alert" style={{ background: 'var(--badb)', color: 'var(--bad)' }}>{error}</p>}
        {firebaseEnabled ? (
          <>
            <p className="mut" style={{ margin: '8px 0 14px' }}>
              <a href="#" onClick={reset} style={{ color: 'var(--pri)', fontWeight: 600 }}>Forgot password?</a>
            </p>
            <button className="btn" style={{ width: '100%' }} disabled={submitting}>
              {submitting ? 'Signing in…' : 'Sign in to Account'}
            </button>
          </>
        ) : (
          <p className="mut" style={{ fontSize: 12, margin: '8px 0 0' }}>
            Production authentication connects automatically when Firebase credentials are configured in .env.local.
          </p>
        )}
      </form>

      <div style={{ textAlign: 'center', marginTop: 16 }}>
        <p className="mut" style={{ fontSize: 12 }}>
          🔒 HIPAA/GDPR Privacy: Patient camera frames are computed on-device via WebGL and never uploaded or stored.
        </p>
      </div>
    </div>
  );
}
