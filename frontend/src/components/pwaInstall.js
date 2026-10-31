// Capture the browser event before React mounts and share it across install controls.
const browser = typeof window === 'undefined' ? null : window;
const standalone = browser?.matchMedia?.('(display-mode: standalone)');
let snapshot = { prompt: null, installed: Boolean(standalone?.matches || browser?.navigator.standalone) };
const listeners = new Set();

function update(changes) {
  snapshot = { ...snapshot, ...changes };
  listeners.forEach(listener => listener());
}

browser?.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  if (!snapshot.installed) update({ prompt: event });
});
browser?.addEventListener('appinstalled', () => update({ prompt: null, installed: true }));
standalone?.addEventListener('change', event => {
  if (event.matches) update({ prompt: null, installed: true });
});

export const getInstallSnapshot = () => snapshot;
export function subscribeToInstall(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function installApp() {
  const event = snapshot.prompt;
  if (!event || snapshot.installed) return false;
  // Each browser event can be used only once, including after dismissal.
  update({ prompt: null });
  try {
    await event.prompt();
    return (await event.userChoice).outcome === 'accepted';
  } catch {
    return false;
  }
}
