import { useEffect, useMemo, useRef, useState } from 'react';
import { createUserWithEmailAndPassword, onAuthStateChanged, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, firebaseEnabled } from '../services/firebase';
import { AuthContext } from './authContext';
import { acceptPatientInvite } from '../services/onboarding';
import { patientEmail, WORKSPACE_KEY } from '../patientFlow';

const DEMO_USERS = {
  patient: { uid: 'P-101', email: 'shyam@kineticare.com', role: 'patient', displayName: 'Dipesh' },
  clinician: { uid: 'C-001', email: 'aditi@kineticare.com', role: 'clinician', displayName: 'Dr. Aditi Yadav' },
};

function demoUser(id) {
  if (DEMO_USERS[id]) return DEMO_USERS[id];
  try {
    const patient = JSON.parse(localStorage.getItem(WORKSPACE_KEY))?.patients.find(item => item.id === id);
    return patient ? { uid: patient.id, email: patient.email, displayName: patient.n, role: 'patient', clinicianName: patient.clinicianName } : null;
  } catch { return null; }
}

export function AuthProvider({ children }) {
  const registering = useRef(false);
  const [user, setUser] = useState(() => {
    if (firebaseEnabled) return null;
    const role = sessionStorage.getItem('kineticare-demo-role');
    return demoUser(role);
  });
  const [loading, setLoading] = useState(firebaseEnabled);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!firebaseEnabled) return undefined;
    return onAuthStateChanged(auth, async account => {
      if (account && registering.current) return;
      if (!account) {
        setUser(null);
        setLoading(false);
        return;
      }
      try {
        const profile = await getDoc(doc(db, 'users', account.uid));
        const data = profile.exists() ? profile.data() : await acceptPatientInvite(account);
        if (!['patient', 'clinician'].includes(data.role)) throw new Error('This account has not been provisioned for Kineticare.');
        setError('');
        setUser({ ...data, uid: account.uid, email: account.email });
      } catch (cause) {
        setError(cause.message || 'Could not load the account profile.');
        setUser(null);
        await firebaseSignOut(auth);
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
        await signInWithEmailAndPassword(auth, patientEmail(email), password);
      } catch {
        setError('Email or password is incorrect.');
      }
    },
    async registerPatient(email, password) {
      setError('');
      registering.current = true;
      try {
        const credential = await createUserWithEmailAndPassword(auth, patientEmail(email), password);
        await sendEmailVerification(credential.user);
      } finally {
        await firebaseSignOut(auth);
        registering.current = false;
      }
    },
    signInDemo(account) {
      if (firebaseEnabled) throw new Error('Demo login is unavailable in a connected workspace.');
      const selected = demoUser(account);
      if (!selected) throw new Error('Patient account not found.');
      sessionStorage.setItem('kineticare-demo-role', account);
      setUser(selected);
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
