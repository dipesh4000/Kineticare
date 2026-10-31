import { useCallback, useEffect, useMemo, useState } from 'react';
import { PrivyProvider, usePrivy } from '@privy-io/react-auth';
import { AuthContext } from './authContext';
import { connectedApi } from '../services/atlasRecords';

function ConnectedAuth({ children }) {
  const { ready, authenticated, login, logout, user: privyUser } = usePrivy();
  const [profile, setProfile] = useState(null);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState('');
  const [loadedFor, setLoadedFor] = useState(null);
  useEffect(() => {
    if (!ready || !authenticated || !privyUser?.id) return;
    let active = true;
    connectedApi('auth/me').then(data => {
      if (active) { setProfile(data.user); setLoadedFor(privyUser.id); setError(''); }
    }).catch(cause => { if (active) { setProfile(null); setError(cause.message); setLoadedFor(privyUser.id); } });
    return () => { active = false; };
  }, [ready, authenticated, privyUser?.id]);
  const register = useCallback(async (displayName, role) => {
    setFetching(true);
    try { const data = await connectedApi('auth/register', { displayName, role }); setProfile(data.user); setError(''); }
    finally { setFetching(false); }
  }, []);
  const value = useMemo(() => ({
    user: authenticated && loadedFor === privyUser?.id ? profile : null,
    loading: !ready || authenticated && loadedFor !== privyUser?.id,
    needsProfile: authenticated && loadedFor === privyUser?.id && !profile && !error,
    authenticated, connectedEnabled: true, error, fetching, register,
    signIn: login,
    async signOut() { await logout(); setProfile(null); setLoadedFor(null); setError(''); },
    retryProfile: async () => { const data = await connectedApi('auth/me'); setProfile(data.user); setError(''); },
  }), [authenticated, loadedFor, privyUser?.id, profile, ready, error, fetching, register, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function AuthProvider({ children }) {
  const appId = import.meta.env.VITE_PRIVY_APP_ID;
  if (!appId) return <AuthContext.Provider value={{ user: null, loading: false, connectedEnabled: false, error: 'Set VITE_PRIVY_APP_ID in frontend/.env.local, configure the backend, then restart the launcher.' }}>{children}</AuthContext.Provider>;
  return <PrivyProvider appId={appId} config={{ loginMethods: ['email'], embeddedWallets: { ethereum: { createOnLogin: 'off' }, solana: { createOnLogin: 'off' } }, appearance: { theme: 'light', accentColor: '#007acc' } }}><ConnectedAuth>{children}</ConnectedAuth></PrivyProvider>;
}

