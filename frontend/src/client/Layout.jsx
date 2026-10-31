import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
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
  ['ai-copilot', 'AI Copilot', 'physio'],
  ['settings', 'Settings', 'settings'],
];

export default function ClientLayout() {
  const { error } = useRecords();
  const nav = useNavigate();
  const { signOut, user } = useAuth();
  const { pathname } = useLocation();
  const active = TABS.find(([k]) => pathname.includes(`/client/${k}`))?.[0] ?? 'overview';

  return (
    <div className="app clinician-app">
      <header className="mobile-portal-header">
        <Brand subtitle="Clinician workspace" />
        <div className="mobile-header-tools">
          <ThemeToggle />
          <details className="mobile-account" key={pathname}>
            <summary aria-label="Open account menu">{(user?.displayName ?? 'Clinician').split(' ').filter(Boolean).map(part => part[0]).slice(0, 2).join('')}</summary>
            <div className="mobile-account-menu">
              <b>{user?.displayName ?? 'Clinician'}</b>
              <small>Clinician account</small>
              <Link to="/client/settings">Account settings</Link>
              <button type="button" onClick={async () => { await signOut(); nav('/'); }}>Sign out</button>
            </div>
          </details>
        </div>
      </header>
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
        <div className="workspace-bar">
          <span>YOUR CARE WORKSPACE</span>
          <span>{new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(new Date())}</span>
        </div>
        <PageMotion><Outlet /></PageMotion>
      </main>
      <nav
        className="nav clinician-mobile-nav"
        aria-label="Mobile workspace navigation"
        style={{
          '--active-tab': Math.max(0, TABS.findIndex(([key]) => key === active)),
          '--tab-count': TABS.length,
          gridTemplateColumns: `repeat(${TABS.length}, minmax(0, 1fr))`,
        }}
      >
        {TABS.map(([key, label, icon]) => (
          <button key={key} className={active === key ? 'on' : ''} aria-current={active === key ? 'page' : undefined} onClick={() => nav(`/client/${key}`)}>
            <Icon name={icon} size={22} />
            <span className="label">{key === 'library' ? 'Exercises' : key === 'ai-copilot' ? 'AI Physio' : label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
