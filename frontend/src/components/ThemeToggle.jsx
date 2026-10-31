import { useState } from 'react';
import { applyTheme } from '../theme';

export default function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme === 'dark');
  const label = dark ? 'Switch to light mode' : 'Switch to dark mode';
  return <button type="button" className="theme-toggle" aria-label={label} title={label} aria-pressed={dark} onClick={() => {
    applyTheme(dark ? 'light' : 'dark');
    setDark(!dark);
  }}>
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {dark ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></> : <path d="M20.5 13a8.5 8.5 0 0 1-9.5-9.5A8.5 8.5 0 1 0 20.5 13Z" />}
    </svg>
    <span>{dark ? 'Light mode' : 'Dark mode'}</span>
  </button>;
}
