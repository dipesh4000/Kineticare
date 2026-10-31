/**
 * frontend/src/services/chatApi.js
 *
 * Client API for Kineticare AI Chat Assistant (Groq powered).
 */

import { getAccessToken } from '@privy-io/react-auth';

const API_BASE = (import.meta.env?.VITE_API_BASE_URL || '').replace(/\/$/, '');

const getHeaders = async () => {
  const token = await getAccessToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export async function getChatStatus() {
  try {
    const res = await fetch(`${API_BASE}/api/chat/status`, {
      headers: await getHeaders(),
    });
    if (res.ok) {
      return await res.json();
    }
    return { configured: false, role: null };
  } catch {
    return { configured: false, role: null };
  }
}

export async function sendChat(messages, { patientId = null } = {}) {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: await getHeaders(),
    body: JSON.stringify({
      messages,
      patientId: patientId || undefined,
      consent: true,
    }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const message = data.message || data.error || (res.status === 429 ? 'Rate limit exceeded. Please wait a moment.' : 'Unable to reach AI assistant.');
    const error = new Error(message);
    error.status = res.status;
    error.code = data.code;
    throw error;
  }

  return data;
}
