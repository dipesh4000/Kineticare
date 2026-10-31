import { useSyncExternalStore } from 'react';
import { getInstallSnapshot, installApp, subscribeToInstall } from './pwaInstall';

export function usePWAInstall() {
  const { prompt, installed } = useSyncExternalStore(subscribeToInstall, getInstallSnapshot, getInstallSnapshot);
  const userAgent = typeof window === 'undefined' ? '' : window.navigator.userAgent;

  return {
    isInstallable: Boolean(prompt),
    isInstalled: installed,
    isIOS: /iphone|ipad|ipod/i.test(userAgent),
    isAndroid: /android/i.test(userAgent),
    install: installApp,
  };
}
