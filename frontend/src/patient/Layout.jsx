import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import Icon from '../components/Icon';

const TABS = [
  ['home', 'Home', 'home'],
  ['workout', 'Workout', 'workout'],
  ['plan', 'Plan', 'plan'],
  ['prog', 'Progress', 'prog'],
  ['me', 'Info', 'info'],
];

const NO_NAV = ['/patient/live', '/patient/pre', '/patient/sum'];

export default function PatientLayout() {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const hideNav = NO_NAV.some(p => pathname.startsWith(p));
  const active = TABS.find(([k]) => pathname.includes(`/patient/${k}`))?.[0] ?? 'home';

  return (
    <div className="phone">
      <Outlet />
      {!hideNav && (
        <nav className="nav" aria-label="Main navigation">
          {TABS.map(([key, label, icon]) => {
            const isOn = active === key;
            return (
              <button
                key={key}
                className={isOn ? 'on' : ''}
                aria-label={label}
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
