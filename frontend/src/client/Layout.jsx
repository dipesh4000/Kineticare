import { Outlet, useNavigate, useLocation } from 'react-router-dom';

const TABS = [
  ['overview', 'Overview'],
  ['patients', 'Patients'],
  ['library', 'Exercise library'],
  ['settings', 'Settings'],
];

export default function ClientLayout() {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const active = TABS.find(([k]) => pathname.includes(`/client/${k}`))?.[0] ?? 'overview';

  return (
    <div className="app">
      <nav className="side" aria-label="Main">
        <div className="brand" style={{ fontWeight: 800, color: 'var(--pri)', fontSize: 20, padding: '6px 14px 16px' }}>
          Kineticare
        </div>
        {TABS.map(([key, label]) => (
          <button key={key} className={active === key ? 'on' : ''} onClick={() => nav(`/client/${key}`)}>
            {label}
          </button>
        ))}
        <button style={{ marginTop: 'auto' }} onClick={() => nav('/')}>Sign out</button>
      </nav>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
