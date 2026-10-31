import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import Icon from '../components/Icon';
import Brand from '../components/Brand';
import PageMotion from '../components/PageMotion';
import ThemeToggle from '../components/ThemeToggle';
import { useRecords } from '../records/recordsContext';

const TABS = [
  ['home', 'Home', 'home'],
  ['workout', 'Workout', 'workout'],
  ['plan', 'Plan', 'plan'],
  ['ai-physio', 'AI Physio', 'physio'],
  ['prog', 'Progress', 'prog'],
  ['me', 'Info', 'info'],
];

const NO_NAV = ['/patient/live', '/patient/pre', '/patient/sum'];

export default function PatientLayout() {
  const { error } = useRecords();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const hideNav = NO_NAV.some(p => pathname.startsWith(p));
  const active = TABS.find(([k]) => pathname.includes(`/patient/${k}`))?.[0] ?? 'home';

  return (
    <div className={`phone patient-shell${hideNav ? ' session-shell' : ''}`}>
      {!hideNav && (
        <header className="patient-brand">
          <Brand subtitle="Your recovery companion" />
          <div className="portal-tools">
            <span className="brand-caption">PATIENT PORTAL</span>
            <ThemeToggle />
          </div>
        </header>
      )}
      {error && <p role="alert" className="demo">{error}</p>}
      <main className={`patient-content ${pathname === '/patient/home' ? 'patient-dashboard' : 'patient-detail-page'}`}>
        <PageMotion><Outlet /></PageMotion>
      </main>
      {!hideNav && (
        <nav
          className="nav"
          aria-label="Main navigation"
          style={{
            '--active-tab': Math.max(0, TABS.findIndex(([key]) => key === active)),
            '--tab-count': TABS.length,
          }}
        >
          {TABS.map(([key, label, icon]) => {
            const isOn = active === key;
            return (
              <button
                key={key}
                className={isOn ? 'on' : ''}
                aria-label={label}
                aria-current={isOn ? 'page' : undefined}
                onClick={() => nav(`/patient/${key}`)}
              >
                <Icon name={icon} size={22} color={isOn ? 'var(--pri)' : 'var(--mut)'} />
                <span className="label">{label}</span>
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
}
