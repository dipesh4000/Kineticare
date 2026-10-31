import { useState } from 'react';
import { usePWAInstall } from './usePWAInstall';
import './PWAInstallPrompt.css';

export default function PWAInstallPrompt() {
  const { isAndroid, isInstalled, isInstallable, install } = usePWAInstall();
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem('kineticare-install-dismissed') === '1'; }
    catch { return false; }
  });
  const [showGuide, setShowGuide] = useState(false);

  function dismiss() {
    setDismissed(true);
    try { sessionStorage.setItem('kineticare-install-dismissed', '1'); }
    catch { /* The close button still works when browser storage is unavailable. */ }
  }

  async function handleInstall() {
    if (!isInstallable) { setShowGuide(true); return; }
    if (await install()) dismiss();
    else setShowGuide(true);
  }

  if (!isAndroid || isInstalled || dismissed) return null;

  return (
    <aside className="pwa-install" aria-labelledby="pwa-install-title">
      <button type="button" className="pwa-install-close" onClick={dismiss} aria-label="Dismiss app installation">×</button>
      <div className="pwa-install-heading">
        <img src="/app-icon-192.png" width="48" height="48" alt="" />
        <div>
          <h2 id="pwa-install-title">Install Kineticare</h2>
          <p>Open your exercises straight from your home screen.</p>
        </div>
      </div>
      {showGuide && (
        <p className="pwa-install-guide" role="status">
          Open this website in Chrome, tap the <b>⋮ menu</b>, then <b>Add to home screen</b> or <b>Install app</b> and confirm.
          If you opened the link inside another app, use its menu to open it in Chrome first.
        </p>
      )}
      <div className="pwa-install-actions">
        <button type="button" className="btn s" onClick={dismiss}>Not now</button>
        <button type="button" className="btn" onClick={handleInstall}>Install App</button>
      </div>
    </aside>
  );
}
