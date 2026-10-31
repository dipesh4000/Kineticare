import { getAccessToken } from '@privy-io/react-auth';

const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
export async function connectedApi(path, body, timeoutMs = 45000) {
  const token = await getAccessToken();
  if (!token) throw new Error('Sign in to use connected services.');
  const response = await fetch(`${base}/api/${path}`, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(timeoutMs) });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) throw new Error(data?.error || 'The backend could not complete this request.');
  return data;
}

export function subscribeAtlasWorkspace(user, onChange, onError) {
  if (!user?.uid) return () => {};
  let active = true;
  let timer;
  const refresh = async () => {
    try { const data = await connectedApi('records/workspace'); if (active) onChange(data); }
    catch (error) { if (active) onError(error); }
    finally { if (active) timer = setTimeout(refresh, 5000); }
  };
  refresh();
  const listener = () => { clearTimeout(timer); refresh(); };
  window.addEventListener('kineticare-records-updated', listener);
  return () => { active = false; clearTimeout(timer); window.removeEventListener('kineticare-records-updated', listener); };
}
async function mutate(patientId, operation, body) {
  const result = await connectedApi(`records/${encodeURIComponent(patientId)}/${operation}`, body);
  window.dispatchEvent(new Event('kineticare-records-updated'));
  return result;
}
export const atlasMutations = {
  saveAssignmentDraft: (id, data) => mutate(id, 'saveAssignmentDraft', data),
  publishAssignment: (id, data) => mutate(id, 'publishAssignment', data),
  saveSession: (id, data) => mutate(id, 'saveSession', data),
  sendFeedback: (id, data) => mutate(id, 'sendFeedback', data),
  markSessionReviewed: (id, sessionId) => mutate(id, 'markSessionReviewed', { sessionId }),
  markFeedbackRead: id => mutate(id, 'markFeedbackRead', {}),
  createRequest: (id, data) => mutate(id, 'createRequest', data),
  resolveRequest: (id, requestId) => mutate(id, 'resolveRequest', { requestId }),
  replyToRequest: (id, requestId, reply) => mutate(id, 'replyToRequest', { requestId, reply }),
};
