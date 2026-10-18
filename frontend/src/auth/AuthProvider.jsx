import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, firebaseEnabled } from '../services/firebase';
import { AuthContext } from './authContext';

const DEMO_USERS = {
  patient: { uid: 'P-101', email: 'shyam@kineticare.com', role: 'patient', displayName: 'Shyam Yadav' },
  clinician: { uid: 'C-001', email: 'aditi@kineticare.com', role: 'clinician', displayName: 'Dr. Aditi Singh' },
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    if (firebaseEnabled) return null;
    const role = sessionStorage.getItem('kineticare-demo-role');
    return DEMO_USERS[role] ?? null;
  });
  const [loading, setLoading] = useState(firebaseEnabled);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!firebaseEnabled) return undefined;
    return onAuthStateChanged(auth, async account => {
      if (!account) {
        setUser(null);
        setLoading(false);
        return;
      }
      try {
        const profile = await getDoc(doc(db, 'users', account.uid));
        if (!profile.exists() || !['patient', 'clinician'].includes(profile.data().role)) {
          await firebaseSignOut(auth);
          setError('This account has not been provisioned for Kineticare.');
          setUser(null);
        } else {
          setUser({ uid: account.uid, email: account.email, ...profile.data() });
        }
      } catch {
        setError('Could not load the account profile.');
        setUser(null);
      } finally {
        setLoading(false);
      }
    });
  }, []);

  const value = useMemo(() => ({
    user,
    loading,
    error,
    firebaseEnabled,
    async signIn(email, password) {
      setError('');
      try {
        await signInWithEmailAndPassword(auth, email, password);
      } catch {
        setError('Email or password is incorrect.');
      }
    },
    signInDemo(account) {
      sessionStorage.setItem('kineticare-demo-role', account);
      setUser(DEMO_USERS[account]);
    },
    async resetPassword(email) {
      if (!firebaseEnabled) throw new Error('Password reset is unavailable in local demo mode.');
      await sendPasswordResetEmail(auth, email);
    },
    async signOut() {
      if (firebaseEnabled) await firebaseSignOut(auth);
      sessionStorage.removeItem('kineticare-demo-role');
      setUser(null);
    },
  }), [user, loading, error]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
