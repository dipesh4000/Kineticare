import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/authContext';
import Brand from './Brand';
import ThemeToggle from './ThemeToggle';
import EmailLogin from './EmailLogin';

export default function Login() {
  const { user, loading, connectedEnabled, authenticated, needsProfile, signOut, register, retryProfile, error } = useAuth();
  const [name, setName] = useState('');
  const [role, setRole] = useState('patient');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const nav = useNavigate();
  const [params] = useSearchParams();
  const invitation = params.get('invite');
  useEffect(() => { if (user) nav(user.role === 'patient' ? invitation ? `/patient/me?invite=${encodeURIComponent(invitation)}` : '/patient/home' : '/client/overview', { replace: true }); }, [user, nav, invitation]);
  const run = async action => { setBusy(true); setNotice(''); try { await action(); } catch (cause) { setNotice(cause.message); } finally { setBusy(false); } };
  return <div className="center login-page">
    <div className="login-theme"><ThemeToggle /></div>
    <div className="login-intro"><Brand subtitle="Your movement companion" /><h1>Space to move.<br /><em>Room to recover.</em></h1><p className="mut">Start independently. Connect with a clinician when you choose.</p></div>
    <section className="card">
      <h2>{needsProfile ? 'Complete your account' : 'Welcome to Kineticare'}</h2>
      {invitation && <p className="mut">You’ve been invited to connect with a clinician. Sign in with the invited email and choose Patient when creating an account. You’ll review the connection before sharing records.</p>}
      {loading ? <p role="status">Loading your account…</p> : needsProfile ? <form onSubmit={event => { event.preventDefault(); run(() => register(name, role)); }}>
        <label htmlFor="signup-name">Your name</label><input id="signup-name" required maxLength={100} autoComplete="name" value={name} onChange={event => setName(event.target.value)} />
        <label htmlFor="signup-role">I am joining as</label><select id="signup-role" value={role} onChange={event => setRole(event.target.value)}><option value="patient">Patient</option><option value="clinician">Clinician</option></select>
        <p className="mut">{role === 'patient' ? 'No clinician invitation is required. You control who can access your records.' : 'Patients must consent before you can view their records. Registration does not verify professional credentials.'}</p>
        <button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Create account'}</button>
      </form> : !authenticated && connectedEnabled ? <EmailLogin /> : null}
      {(error || notice) && <p role="alert" className="demo">{notice || error}</p>}
      {authenticated && error && <button className="btn s" disabled={busy} onClick={() => run(retryProfile)}>Retry account loading</button>}
      {authenticated && !user && <button className="btn s" disabled={busy} onClick={() => run(signOut)}>Sign out</button>}
    </section>
    <p className="mut">Camera video stays on your device. You control clinician sharing.</p>
  </div>;
}

