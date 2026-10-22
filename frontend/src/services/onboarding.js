import { doc, runTransaction, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { patientEmail } from '../patientFlow';

export async function invitePatient(user, name, address) {
  const email = patientEmail(address);
  const displayName = name.trim();
  if (!displayName || displayName.length > 100) throw new Error('Enter a patient name (up to 100 characters).');
  await setDoc(doc(db, 'patientInvites', email), {
    email, displayName, clinicianUid: user.uid, clinicianName: user.displayName,
    status: 'pending', createdAt: serverTimestamp(),
  });
}

export async function acceptPatientInvite(account) {
  if (!account.emailVerified) throw new Error('Verify your email using the link in your inbox, then sign in again.');
  const email = patientEmail(account.email);
  return runTransaction(db, async transaction => {
    const reference = doc(db, 'patientInvites', email);
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists() || snapshot.data().status !== 'pending') {
      throw new Error('No pending invitation for this email. Ask your clinician to add you first.');
    }
    const invite = snapshot.data();
    const profile = {
      email, displayName: invite.displayName, role: 'patient',
      clinicianUid: invite.clinicianUid, clinicianName: invite.clinicianName,
    };
    transaction.set(doc(db, 'users', account.uid), profile);
    transaction.set(doc(db, 'relationships', account.uid), { clinicianUid: invite.clinicianUid, active: true });
    transaction.update(reference, { status: 'accepted', patientUid: account.uid });
    return profile;
  });
}
