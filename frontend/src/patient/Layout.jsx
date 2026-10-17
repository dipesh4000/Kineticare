import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import Icon from '../components/Icon';

const TABS = [
  ['home', 'Home'],
  ['plan', 'Plan'],
  ['prog', 'Progress'],
  ['fb', 'Feedback'],
  ['me', 'Profile'],
];

const NO_NAV = ['/patient/live', '/patient/pre', '/patient/sum'];

export default function PatientLayout() {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const hideNav = NO_NAV.some(p => pathname.startsWith(p));
  const active = TABS.find(([k]) => pathname.includes(`/patient/${k}`))?.[0];

  return (
    <div className="phone">
      <Outlet />
      {!hideNav && (
        <nav className="nav" aria-label="Main">
          {TABS.map(([key, label]) => (
            <button key={key} className={active === key ? 'on' : ''} aria-label={label}
              onClick={() => nav(`/patient/${key}`)}>
              <Icon name={key} size={24} />
              <span className="label">{label}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}
