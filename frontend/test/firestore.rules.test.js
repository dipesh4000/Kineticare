import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

let environment;

before(async () => {
  environment = await initializeTestEnvironment({
    projectId: 'demo-kineticare',
    firestore: { rules: await readFile(new URL('../../../firestore.rules', import.meta.url), 'utf8') },
  });
  await environment.withSecurityRulesDisabled(async context => {
    const database = context.firestore();
    await Promise.all([
      setDoc(doc(database, 'users/P-A'), { role: 'patient', displayName: 'Patient A' }),
      setDoc(doc(database, 'users/P-B'), { role: 'patient', displayName: 'Patient B' }),
      setDoc(doc(database, 'users/C-1'), { role: 'clinician', displayName: 'Clinician One' }),
      setDoc(doc(database, 'users/C-2'), { role: 'clinician', displayName: 'Clinician Two' }),
      setDoc(doc(database, 'relationships/P-A'), { clinicianUid: 'C-1', active: true }),
      setDoc(doc(database, 'relationships/P-B'), { clinicianUid: 'C-1', active: true }),
    ]);
  });
});

after(async () => environment?.cleanup());

const session = patientUid => ({
  schemaVersion: 1,
  sessionId: 'S-1',
  patientUid,
  assignmentId: 'A-1',
  assignmentVersion: 1,
  status: 'completed',
  exerciseResults: [{ exerciseId: 'squat', assessedReps: 5 }],
  submittedAt: 'initial',
});

test('Firestore rules isolate patient sessions and linked clinicians', async () => {
  const patientA = environment.authenticatedContext('P-A').firestore();
  const patientB = environment.authenticatedContext('P-B').firestore();
  const clinician = environment.authenticatedContext('C-1').firestore();
  const stranger = environment.authenticatedContext('C-2').firestore();
  const path = 'patients/P-A/sessions/S-1';

  await assertSucceeds(setDoc(doc(patientA, path), session('P-A')));
  await assertSucceeds(getDoc(doc(clinician, path)));
  await assertFails(getDoc(doc(patientB, path)));
  await assertFails(getDoc(doc(stranger, path)));
  await assertFails(setDoc(doc(patientA, 'patients/P-B/sessions/S-1'), session('P-B')));
});

test('Firestore rules keep finalized measurements immutable', async () => {
  const patient = environment.authenticatedContext('P-A').firestore();
  const path = doc(patient, 'patients/P-A/sessions/S-1');
  await assertFails(updateDoc(path, { exerciseResults: [{ exerciseId: 'squat', assessedReps: 99 }] }));
  await assertSucceeds(updateDoc(path, { submittedAt: 'retry-confirmation' }));
});

test('Firestore rules scope feedback creation and read receipts', async () => {
  const clinician = environment.authenticatedContext('C-1').firestore();
  const stranger = environment.authenticatedContext('C-2').firestore();
  const patient = environment.authenticatedContext('P-A').firestore();
  const feedbackPath = 'patients/P-A/feedback/F-1';
  const feedback = { patientUid: 'P-A', clinicianUid: 'C-1', sessionId: 'S-1', message: 'Good work', read: false };

  await assertSucceeds(setDoc(doc(clinician, feedbackPath), feedback));
  await assertFails(setDoc(doc(stranger, 'patients/P-A/feedback/F-2'), { ...feedback, clinicianUid: 'C-2' }));
  await assertSucceeds(updateDoc(doc(patient, feedbackPath), { read: true, readAt: 'now' }));
  await assertFails(updateDoc(doc(patient, feedbackPath), { message: 'changed' }));
});

test('Firestore rules require explicit reference access and protect roles', async () => {
  await environment.withSecurityRulesDisabled(async context => {
    const database = context.firestore();
    await setDoc(doc(database, 'references/squat/versions/V-1'), {
      referenceId: 'squat', versionId: 'V-1', ownerUid: 'C-1', exerciseName: 'Squat', status: 'approved',
    });
    await setDoc(doc(database, 'patients/P-A/referenceAccess/V-1'), {
      patientUid: 'P-A', clinicianUid: 'C-1', referenceId: 'squat', versionId: 'V-1',
    });
  });
  const patientA = environment.authenticatedContext('P-A').firestore();
  const patientB = environment.authenticatedContext('P-B').firestore();
  await assertSucceeds(getDoc(doc(patientA, 'references/squat/versions/V-1')));
  await assertFails(getDoc(doc(patientB, 'references/squat/versions/V-1')));
  await assertFails(updateDoc(doc(patientA, 'users/P-A'), { role: 'clinician' }));
  assert.ok(true);
});
