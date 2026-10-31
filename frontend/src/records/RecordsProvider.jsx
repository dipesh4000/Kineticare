import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/authContext';
import { RecordsContext } from './recordsContext';
import { atlasMutations, subscribeAtlasWorkspace } from '../services/atlasRecords';
import { buildSelfGuidedPlan } from '../patient/selfGuided';

const starterPlan = buildSelfGuidedPlan();
const emptyWorkspace = { schemaVersion: 1, patients: [], assignments: {}, assignmentDrafts: {}, sessions: {}, feedback: {}, requests: {}, references: [] };
export default function RecordsProvider({ children }) {
  const { user } = useAuth();
  const [snapshot, setSnapshot] = useState({ uid: null, workspace: emptyWorkspace, error: '', ready: false });
  useEffect(() => {
    if (!user) return;
    return subscribeAtlasWorkspace(user, data => setSnapshot({ uid: user.uid, workspace: data, error: '', ready: true }), cause => setSnapshot(current => ({ ...current, uid: user.uid, error: cause.message, ready: false })));
  }, [user]);
  const workspace = snapshot.uid === user?.uid ? snapshot.workspace : emptyWorkspace;
  const value = useMemo(() => ({
    workspace, error: snapshot.uid === user?.uid ? snapshot.error : '',
    recordsReady: snapshot.uid === user?.uid && snapshot.ready,
    backend: 'mongodb-atlas', patientId: user?.role === 'patient' ? user.uid : null,
    assignment: id => workspace.assignments[id] ?? null,
    patientPlan: id => snapshot.uid === user?.uid && snapshot.ready && !snapshot.error ? workspace.assignments[id] ?? starterPlan : null,
    assignmentDraft: id => workspace.assignmentDrafts[id] ?? null,
    sessions: id => workspace.sessions[id] ?? [],
    feedback: id => workspace.feedback[id] ?? [],
    requests: id => workspace.requests[id] ?? [],
    ...atlasMutations,
  }), [workspace, snapshot, user]);
  return <RecordsContext.Provider value={value}>{children}</RecordsContext.Provider>;
}

