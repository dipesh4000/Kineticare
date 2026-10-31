import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/authContext';
import Brand from '../components/Brand';
import Icon from '../components/Icon';
import PageMotion from '../components/PageMotion';
import ThemeToggle from '../components/ThemeToggle';
import { useRecords } from '../records/recordsContext';

const TABS = [
  ['overview', 'Overview', 'home'],
  ['patients', 'Patients', 'me'],
  ['library', 'Exercise library', 'workout'],
  ['settings', 'Settings', 'settings'],
];

export default function ClientLayout() {
  const { error } = useRecords();
  const nav = useNavigate();
  const { signOut, user } = useAuth();
  const { pathname } = useLocation();
  const active = TABS.find(([k]) => pathname.includes(`/client/${k}`))?.[0] ?? 'overview';

  return (
    <div className="app">
      <nav className="side" aria-label="Main navigation">
        <Brand subtitle="Clinician workspace" />
        <div className="side-caption">WORKSPACE</div>
        {TABS.map(([key, label, icon]) => (
          <button key={key} className={active === key ? 'on' : ''} aria-current={active === key ? 'page' : undefined} onClick={() => nav(`/client/${key}`)}>
            <Icon name={icon} size={19} />{label}
          </button>
        ))}
        <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid var(--card-border)' }}>
          <div style={{ padding: '0 14px 8px', fontSize: 13, color: 'var(--ink)' }}>
            <b>{user?.displayName ?? 'Clinician'}</b>
          </div>
          <ThemeToggle />
          <button onClick={async () => { await signOut(); nav('/'); }}>Sign out</button>
        </div>
      </nav>
      <main className="main">
        {error && <p role="alert" className="demo">{error}</p>}
        <div className="workspace-bar"><span>YOUR CARE WORKSPACE</span><span>{new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(new Date())}</span></div>
        <PageMotion><Outlet /></PageMotion>
      </main>
    </div>
  );
}
