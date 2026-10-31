const key = patientId => `kineticare-session-draft-${patientId}`;

export function loadSessionDraft(patientId) {
  try { return JSON.parse(localStorage.getItem(key(patientId))); } catch { return null; }
}

export function saveSessionDraft(patientId, draft) {
  localStorage.setItem(key(patientId), JSON.stringify(draft));
}

export function clearSessionDraft(patientId) {
  localStorage.removeItem(key(patientId));
}

export function startDraft(plan, patientId, exIdx, all) {
  const draft = { sessionId: crypto.randomUUID(), assignmentId: plan.assignmentId, assignmentVersion: plan.v, exIdx, all, done: [], startedAtClient: new Date().toISOString() };
  saveSessionDraft(patientId, draft);
  return draft;
}
