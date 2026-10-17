import { useCallback, useEffect, useMemo, useState } from 'react';
import { createDemoWorkspace, DEMO_REFERENCES } from '../data';
import { useAuth } from '../auth/authContext';
import { RecordsContext } from './recordsContext';
import { firebaseMutations, subscribeFirebaseWorkspace } from '../services/firebaseRecords';

const STORAGE_KEY = 'kineticare-demo-workspace-v2';
const emptyWorkspace = () => ({ schemaVersion: 1, patients: [], assignments: {}, assignmentDrafts: {}, sessions: {}, feedback: {}, requests: {}, references: [] });

function loadWorkspace() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved) return createDemoWorkspace();
    const known = new Set((saved.references ?? []).map(item => item.versionId));
    return { ...saved, references: [...(saved.references ?? []), ...DEMO_REFERENCES.filter(item => !known.has(item.versionId))] };
  } catch {
    return createDemoWorkspace();
  }
}

export default function RecordsProvider({ children }) {
  const { user, firebaseEnabled } = useAuth();
  const [workspace, setWorkspace] = useState(() => firebaseEnabled ? emptyWorkspace() : loadWorkspace());
  const [error, setError] = useState('');

  useEffect(() => {
    if (firebaseEnabled || !user) return undefined;
    const sync = event => {
      if (event.key === STORAGE_KEY && event.newValue) setWorkspace(JSON.parse(event.newValue));
    };
    addEventListener('storage', sync);
    return () => removeEventListener('storage', sync);
  }, [firebaseEnabled, user]);

  useEffect(() => {
    if (!firebaseEnabled || !user) return undefined;
    return subscribeFirebaseWorkspace(user, setWorkspace, () => setError('Live records could not be loaded. Check permissions and connection.'));
  }, [firebaseEnabled, user]);

  const update = useCallback(change => setWorkspace(current => {
    const next = change(current);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next;
  }), []);

  const value = useMemo(() => ({
    workspace,
    error,
    backend: firebaseEnabled ? 'firebase' : 'local-demo',
    patientId: user?.role === 'patient' ? user.uid : null,
    assignment(patientId) {
      return workspace.assignments[patientId] ?? null;
    },
    assignmentDraft(patientId) {
      return workspace.assignmentDrafts[patientId] ?? null;
    },
    sessions(patientId) {
      return workspace.sessions[patientId] ?? [];
    },
    feedback(patientId) {
      return workspace.feedback[patientId] ?? [];
    },
    requests(patientId) {
      return workspace.requests[patientId] ?? [];
    },
    saveAssignmentDraft(patientId, draft) {
      if (firebaseEnabled) return firebaseMutations.saveAssignmentDraft(patientId, draft);
      update(current => ({ ...current, assignmentDrafts: { ...current.assignmentDrafts, [patientId]: draft } }));
    },
    publishAssignment(patientId, assignment) {
      if (firebaseEnabled) return firebaseMutations.publishAssignment(patientId, assignment);
      update(current => ({
        ...current,
        assignments: { ...current.assignments, [patientId]: assignment },
        assignmentDrafts: { ...current.assignmentDrafts, [patientId]: null },
      }));
    },
    saveSession(patientId, session) {
      if (firebaseEnabled) return firebaseMutations.saveSession(patientId, session);
      update(current => {
        const sessions = current.sessions[patientId] ?? [];
        if (sessions.some(item => item.sessionId === session.sessionId)) return current;
        return { ...current, sessions: { ...current.sessions, [patientId]: [...sessions, session] } };
      });
    },
    markSessionReviewed(patientId, sessionId) {
      if (firebaseEnabled) return firebaseMutations.markSessionReviewed(patientId, sessionId, user.uid);
      update(current => ({
        ...current,
        sessions: {
          ...current.sessions,
          [patientId]: (current.sessions[patientId] ?? []).map(session =>
            session.sessionId === sessionId ? { ...session, reviewStatus: 'reviewed', reviewedAt: new Date().toISOString() } : session),
        },
      }));
    },
    sendFeedback(patientId, message) {
      if (firebaseEnabled) return firebaseMutations.sendFeedback(patientId, message);
      update(current => ({
        ...current,
        feedback: { ...current.feedback, [patientId]: [message, ...(current.feedback[patientId] ?? [])] },
      }));
    },
    markFeedbackRead(patientId) {
      if (firebaseEnabled) return firebaseMutations.markFeedbackRead(patientId, workspace.feedback[patientId] ?? []);
      update(current => ({
        ...current,
        feedback: {
          ...current.feedback,
          [patientId]: (current.feedback[patientId] ?? []).map(item => item.read ? item : { ...item, read: true, readAt: new Date().toISOString() }),
        },
      }));
    },
    createRequest(patientId, request) {
      if (firebaseEnabled) return firebaseMutations.createRequest(patientId, request);
      update(current => ({
        ...current,
        requests: { ...current.requests, [patientId]: [request, ...(current.requests[patientId] ?? [])] },
      }));
    },
    resolveRequest(patientId, requestId) {
      if (firebaseEnabled) return firebaseMutations.resolveRequest(patientId, requestId);
      update(current => ({
        ...current,
        requests: {
          ...current.requests,
          [patientId]: (current.requests[patientId] ?? []).map(request => request.requestId === requestId ? { ...request, status: 'closed', updatedAt: new Date().toISOString() } : request),
        },
      }));
    },
    replyToRequest(patientId, requestId, reply) {
      if (firebaseEnabled) return firebaseMutations.replyToRequest(patientId, requestId, reply);
      update(current => ({
        ...current,
        requests: {
          ...current.requests,
          [patientId]: (current.requests[patientId] ?? []).map(request => request.requestId === requestId
            ? { ...request, replies: [...(request.replies ?? []), reply], status: 'closed', updatedAt: new Date().toISOString() }
            : request),
        },
      }));
    },
    saveReference(reference) {
      if (firebaseEnabled) return firebaseMutations.saveReference(reference);
      update(current => ({
        ...current,
        references: [reference, ...current.references.filter(item => item.referenceId !== reference.referenceId)],
      }));
    },
  }), [workspace, error, firebaseEnabled, user, update]);

  return <RecordsContext.Provider value={value}>{children}</RecordsContext.Provider>;
}
