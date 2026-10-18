import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/authContext';

const TABS = [
  ['overview', 'Overview'],
  ['patients', 'Patients'],
  ['library', 'Exercise library'],
  ['settings', 'Settings'],
];

export default function ClientLayout() {
  const nav = useNavigate();
  const { signOut, user } = useAuth();
  const { pathname } = useLocation();
  const active = TABS.find(([k]) => pathname.includes(`/client/${k}`))?.[0] ?? 'overview';

  return (
    <div className="app">
      <nav className="side" aria-label="Main navigation">
        <div className="brand" style={{ fontWeight: 800, color: 'var(--pri)', fontSize: 20, padding: '6px 14px 12px', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: 'var(--ok)' }} />
          Kineticare
        </div>
        <div style={{ padding: '0 14px 18px', fontSize: 12, color: 'var(--mut)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
          Clinician Portal
        </div>
        {TABS.map(([key, label]) => (
          <button key={key} className={active === key ? 'on' : ''} onClick={() => nav(`/client/${key}`)}>
            {label}
          </button>
        ))}
        <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid var(--card-border)' }}>
          <div style={{ padding: '0 14px 8px', fontSize: 13, color: 'var(--ink)' }}>
            <b>{user?.displayName ?? 'Clinician'}</b>
          </div>
          <button onClick={async () => { await signOut(); nav('/'); }}>Sign out</button>
        </div>
      </nav>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
