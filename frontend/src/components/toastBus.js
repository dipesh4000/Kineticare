const listeners = new Set();

export const toast = message => listeners.forEach(listener => listener(message));

export function subscribeToToast(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
