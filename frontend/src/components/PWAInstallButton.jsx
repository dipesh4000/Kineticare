import { useState } from 'react';
import { usePWAInstall } from './usePWAInstall';

export default function PWAInstallButton({ label = 'Install App' }) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as an installed PWA / APK, hide the prompt
  if (isInstalled) {
    return (
      <span className="tag ok" style={{ fontSize: 11 }}>
        ✓ Mobile App Installed
      </span>
    );
  }

  // Chromium / Android flow
  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="btn sm"
        style={{ background: 'var(--ok)', color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}
      >
        <span>📱</span> {label}
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="btn s sm"
          style={{ fontSize: 12 }}
        >
          📱 Install on iPhone
        </button>

        {showIOSGuide && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
          }}>
            <div className="card" style={{ maxWidth: 360, width: '100%', padding: 20 }}>
              <h3 style={{ margin: '0 0 10px' }}>Install Kineticare on iPhone</h3>
              <p className="mut" style={{ fontSize: 14, margin: '0 0 14px' }}>
                1. Tap the <b>Share</b> button (square with arrow up) at the bottom of Safari.<br /><br />
                2. Scroll down and select <b>Add to Home Screen</b>.<br /><br />
                3. Tap <b>Add</b> in the top right to install Kineticare as an app.
              </p>
              <button className="btn" style={{ width: '100%' }} onClick={() => setShowIOSGuide(false)}>
                Done
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
}
