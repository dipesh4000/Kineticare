import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/authContext';
import { toast } from './toastBus';
import Icon from './Icon';
import { WORKSPACE_KEY } from '../patientFlow';

export default function Login() {
  const nav = useNavigate();
  const { user, error, firebaseEnabled, signIn, signInDemo, resetPassword, registerPatient } = useAuth();
  const [registering, setRegistering] = useState(false);
  const [notice, setNotice] = useState('');
  const [localPatients] = useState(() => {
    if (firebaseEnabled) return [];
    try { return (JSON.parse(localStorage.getItem(WORKSPACE_KEY))?.patients ?? []).filter(patient => patient.email); }
    catch { return []; }
  });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) nav(user.role === 'patient' ? '/patient/home' : '/client/overview', { replace: true });
  }, [user, nav]);

  const submit = async event => {
    event.preventDefault();
    setNotice('');
    setSubmitting(true);
    try {
      if (registering) {
        await registerPatient(email, password);
        setNotice('Verification email sent. Verify your email, then sign in to accept your clinician’s invitation.');
        setRegistering(false);
      } else await signIn(email, password);
    } catch (cause) {
      setNotice(cause.code === 'auth/email-already-in-use' ? 'An account already exists. Sign in, or use Forgot password.' : cause.message);
    } finally { setSubmitting(false); }
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
    nav(account === 'clinician' ? '/client/overview' : '/patient/home');
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
          <h3 style={{ margin: '0 0 6px' }}>Select Clinical Portal</h3>
          <p className="mut" style={{ fontSize: 13, marginBottom: 16 }}>
            Quick sign-in to explore the patient therapy app or attending clinician dashboard.
          </p>
          <button
            type="button"
            className="btn"
            style={{ width: '100%', marginBottom: 10 }}
            onClick={() => enterDemo('patient')}
          >
            Enter Patient Portal (Dipesh)
          </button>
          {localPatients.map(patient => <button key={patient.id} type="button" className="btn s" style={{ width: '100%', marginTop: 10 }} onClick={() => enterDemo(patient.id)}>
            Patient: {patient.n} ({patient.email})
          </button>)}
          <p className="mut">Demo accounts share data only in this browser.</p>
          <button
            type="button"
            className="btn s"
            style={{ width: '100%' }}
            onClick={() => enterDemo('clinician')}
          >
            Enter Clinician Portal (Dr. Aditi Yadav)
          </button>
        </div>
      )}

      <form className="card" onSubmit={submit}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 12, color: 'var(--pri)' }}>
          {firebaseEnabled ? registering ? 'Create invited patient account' : 'Sign in with credentials' : 'Connected account sign-in'}
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
          autoComplete={registering ? 'new-password' : 'current-password'}
          required={firebaseEnabled}
          minLength={registering ? 6 : undefined}
        />
        <label className="check-label">
          <input type="checkbox" checked={showPassword} onChange={event => setShowPassword(event.target.checked)} />
          Show password
        </label>
        {error && <p className="demo" role="alert" style={{ background: 'var(--badb)', color: 'var(--bad)' }}>{error}</p>}
        {notice && <p role="status">{notice}</p>}
        {firebaseEnabled ? (
          <>
            <p className="mut" style={{ margin: '8px 0 14px' }}>
              <a href="#" onClick={reset} style={{ color: 'var(--pri)', fontWeight: 600 }}>Forgot password?</a>
            </p>
            <button className="btn" style={{ width: '100%' }} disabled={submitting}>
              {submitting ? 'Please wait…' : registering ? 'Create account and verify email' : 'Sign in to Account'}
            </button>
            <button type="button" className="btn s" style={{ width: '100%', marginTop: 10 }} disabled={submitting} onClick={() => { setRegistering(value => !value); setNotice(''); }}>
              {registering ? 'Already have an account? Sign in' : 'Invited by your doctor? Create patient account'}
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
