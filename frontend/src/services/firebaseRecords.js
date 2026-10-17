import {
  arrayUnion, collection, collectionGroup, doc, onSnapshot, query, serverTimestamp,
  setDoc, updateDoc, where, writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';

const emptyWorkspace = () => ({
  schemaVersion: 1, patients: [], assignments: {}, assignmentDrafts: {}, sessions: {}, feedback: {}, requests: {}, references: [],
});

const value = snapshot => {
  const data = snapshot.data();
  for (const key of ['createdAt', 'submittedAt', 'approvedAt', 'reviewedAt', 'readAt']) {
    if (data[key]?.toDate) data[key] = data[key].toDate().toISOString();
  }
  return { ...data, _documentId: snapshot.id };
};

export function subscribeFirebaseWorkspace(user, onChange, onError) {
  const workspace = emptyWorkspace();
  const subscriptions = [];
  let patientSubscriptions = [];
  const emit = () => onChange(structuredClone(workspace));

  const subscribePatient = patientId => {
    const own = [];
    let referenceSubscriptions = [];
    let sessionValues = [];
    let reviews = {};
    const updateSessions = () => {
      workspace.sessions[patientId] = sessionValues.map(session => ({ ...session, reviewStatus: reviews[session.sessionId]?.status ?? session.reviewStatus }))
        .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
      emit();
    };
    own.push(onSnapshot(doc(db, 'users', patientId), snapshot => {
      if (!snapshot.exists()) return;
      const profile = value(snapshot);
      workspace.patients = [...workspace.patients.filter(item => item.id !== patientId), {
        id: patientId, n: profile.displayName, a: profile.summary ?? 'Patient',
      }];
      emit();
    }, onError));
    own.push(onSnapshot(collection(db, 'patients', patientId, 'assignments'), snapshot => {
      const assignments = snapshot.docs.map(value);
      workspace.assignmentDrafts[patientId] = assignments.find(item => item.status === 'draft') ?? null;
      workspace.assignments[patientId] = assignments.filter(item => item.status === 'published').sort((a, b) => b.v - a.v)[0] ?? null;
      if (user.role === 'patient') {
        referenceSubscriptions.forEach(unsubscribe => unsubscribe());
        referenceSubscriptions = [];
        workspace.references = [];
        workspace.assignments[patientId]?.items?.filter(item => item.referencePath).forEach(item => {
          referenceSubscriptions.push(onSnapshot(doc(db, item.referencePath), referenceSnapshot => {
            if (!referenceSnapshot.exists()) return;
            const reference = value(referenceSnapshot);
            workspace.references = [...workspace.references.filter(existing => existing.versionId !== reference.versionId), reference];
            emit();
          }, onError));
        });
      }
      emit();
    }, onError));
    own.push(onSnapshot(collection(db, 'patients', patientId, 'sessions'), snapshot => {
      sessionValues = snapshot.docs.map(value);
      updateSessions();
    }, onError));
    own.push(onSnapshot(collection(db, 'patients', patientId, 'reviews'), snapshot => {
      reviews = Object.fromEntries(snapshot.docs.map(item => [item.id, value(item)]));
      updateSessions();
    }, onError));
    own.push(onSnapshot(collection(db, 'patients', patientId, 'feedback'), snapshot => {
      workspace.feedback[patientId] = snapshot.docs.map(value).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      emit();
    }, onError));
    own.push(onSnapshot(collection(db, 'patients', patientId, 'requests'), snapshot => {
      workspace.requests[patientId] = snapshot.docs.map(value).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      emit();
    }, onError));
    own.push(() => referenceSubscriptions.forEach(unsubscribe => unsubscribe()));
    return own;
  };

  if (user.role === 'patient') {
    workspace.patients = [{ id: user.uid, n: user.displayName, a: user.summary ?? 'Patient' }];
    subscriptions.push(...subscribePatient(user.uid));
  } else {
    subscriptions.push(onSnapshot(query(collection(db, 'relationships'), where('clinicianUid', '==', user.uid)), snapshot => {
      patientSubscriptions.forEach(unsubscribe => unsubscribe());
      patientSubscriptions = [];
      workspace.patients = [];
      snapshot.docs.filter(relationship => relationship.data().active === true).forEach(relationship => patientSubscriptions.push(...subscribePatient(relationship.id)));
      emit();
    }, onError));
    subscriptions.push(onSnapshot(query(collectionGroup(db, 'versions'), where('ownerUid', '==', user.uid)), snapshot => {
      workspace.references = snapshot.docs.map(value);
      emit();
    }, onError));
  }

  return () => {
    subscriptions.forEach(unsubscribe => unsubscribe());
    patientSubscriptions.forEach(unsubscribe => unsubscribe());
  };
}

export const firebaseMutations = {
  saveAssignmentDraft(patientId, draft) {
    return setDoc(doc(db, 'patients', patientId, 'assignments', 'draft-current'), { ...draft, updatedAt: serverTimestamp() });
  },
  async publishAssignment(patientId, assignment) {
    const batch = writeBatch(db);
    batch.set(doc(db, 'patients', patientId, 'assignments', `${assignment.assignmentId}-v${assignment.v}`), { ...assignment, createdAt: serverTimestamp() });
    assignment.items.forEach(item => {
      batch.set(doc(db, 'patients', patientId, 'referenceAccess', item.referenceVersionId), {
        patientUid: patientId,
        clinicianUid: assignment.clinicianUid,
        referenceId: item.referenceId,
        versionId: item.referenceVersionId,
        assignmentId: assignment.assignmentId,
        assignmentVersion: assignment.v,
        createdAt: serverTimestamp(),
      });
    });
    await batch.commit();
  },
  saveSession(patientId, session) {
    return setDoc(doc(db, 'patients', patientId, 'sessions', session.sessionId), { ...session, patientUid: patientId, submittedAt: serverTimestamp() });
  },
  sendFeedback(patientId, message) {
    return setDoc(doc(db, 'patients', patientId, 'feedback', message.id), { ...message, patientUid: patientId, createdAt: serverTimestamp() });
  },
  async markFeedbackRead(patientId, messages) {
    const unread = messages.filter(item => !item.read);
    if (!unread.length) return;
    const batch = writeBatch(db);
    unread.forEach(item => batch.update(doc(db, 'patients', patientId, 'feedback', item._documentId ?? item.id), { read: true, readAt: serverTimestamp() }));
    await batch.commit();
  },
  createRequest(patientId, request) {
    return setDoc(doc(db, 'patients', patientId, 'requests', request.requestId), { ...request, patientUid: patientId, createdAt: serverTimestamp() });
  },
  resolveRequest(patientId, requestId) {
    return updateDoc(doc(db, 'patients', patientId, 'requests', requestId), { status: 'closed', updatedAt: serverTimestamp() });
  },
  replyToRequest(patientId, requestId, reply) {
    return updateDoc(doc(db, 'patients', patientId, 'requests', requestId), {
      replies: arrayUnion(reply), status: 'closed', updatedAt: serverTimestamp(),
    });
  },
  markSessionReviewed(patientId, sessionId, clinicianUid) {
    return setDoc(doc(db, 'patients', patientId, 'reviews', sessionId), { sessionId, patientUid: patientId, clinicianUid, status: 'reviewed', reviewedAt: serverTimestamp() });
  },
  saveReference(reference) {
    return setDoc(doc(db, 'references', reference.referenceId, 'versions', reference.versionId), { ...reference, createdAt: serverTimestamp(), approvedAt: serverTimestamp() });
  },
};
