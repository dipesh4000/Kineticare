/**
 * frontend/src/components/AiChat.jsx
 *
 * Kineticare AI Chat Assistant (Groq powered).
 * Accessible, floating dialog with role-specific suggestions, privacy consent,
 * and dark/light mode support.
 */

import { useState, useEffect, useRef } from 'react';
import { getChatStatus, sendChat } from '../services/chatApi';
import './AiChat.css';

const PATIENT_SUGGESTIONS = [
  'What is my current assignment?',
  'How is my exercise score calculated?',
  'Tips for my squat form',
  'How do I message my clinician?',
];

const CLINICIAN_SUGGESTIONS = [
  "Summarise my patients' activity",
  'Which patients need session reviews?',
  'Draft feedback for recent sessions',
  'Any patients with declining scores?',
];

export default function AiChat({ role = 'patient', patientId = null, hidden = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasConsent, setHasConsent] = useState(() => {
    try {
      return localStorage.getItem('kineticare_ai_chat_consent') === 'true';
    } catch {
      return false;
    }
  });

  const [configured, setConfigured] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Check backend Groq status once on mount
  useEffect(() => {
    let active = true;
    getChatStatus().then(st => {
      if (active) setConfigured(st.configured);
    });
    return () => {
      active = false;
    };
  }, []);

  // Keyboard Escape listener
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  // Scroll to bottom when messages update
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading, isOpen]);

  // Focus textarea when panel opens and user has consent
  useEffect(() => {
    if (isOpen && hasConsent && configured) {
      textareaRef.current?.focus();
    }
  }, [isOpen, hasConsent, configured]);

  if (hidden) return null;

  const giveConsent = () => {
    try {
      localStorage.setItem('kineticare_ai_chat_consent', 'true');
    } catch {
      // localStorage may fail in restricted sandboxes
    }
    setHasConsent(true);
  };

  const handleSend = async (textToSend) => {
    const text = (typeof textToSend === 'string' ? textToSend : input).trim();
    if (!text || loading) return;

    const userMsg = { role: 'user', content: text };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      // Truncate assistant messages in history to stay within the 8000-char backend limit.
      // User messages are already capped at 1500 via the textarea maxLength.
      const payloadMessages = nextMessages.slice(-10).map(m =>
        m.role === 'assistant' && m.content.length > 7900
          ? { ...m, content: m.content.slice(0, 7900) + '…' }
          : m
      );
      const res = await sendChat(payloadMessages, { patientId });
      setMessages([...nextMessages, { role: 'assistant', content: res.reply }]);
    } catch (err) {
      setError(err.message || 'Unable to connect to AI assistant.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    setMessages([]);
    setError(null);
  };

  const suggestions = role === 'clinician' ? CLINICIAN_SUGGESTIONS : PATIENT_SUGGESTIONS;

  return (
    <div className={`ai-chat-root ${role === 'clinician' ? 'clinician-mode' : 'patient-mode'}`}>
      {/* Floating launcher button */}
      {!isOpen && (
        <button
          type="button"
          className="ai-chat-launcher"
          onClick={() => setIsOpen(true)}
          aria-label="Open AI Assistant"
        >
          <svg className="ai-chat-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 2l2.4 5 5 2.4-5 2.4-2.4 5-2.4-5-5-2.4 5-2.4z" />
            <path d="M19 16l1.2 2.5 2.5 1.2-2.5 1.2-1.2 2.5-1.2-2.5-2.5-1.2 2.5-1.2z" />
          </svg>
          <span>Ask AI</span>
        </button>
      )}

      {/* Floating chat dialog panel */}
      {isOpen && (
        <div
          className="ai-chat-panel"
          role="dialog"
          aria-label="AI Assistant"
          aria-modal="false"
        >
          {/* Header */}
          <div className="ai-chat-header">
            <div className="ai-chat-title">
              <svg className="ai-chat-header-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 2l2.4 5 5 2.4-5 2.4-2.4 5-2.4-5-5-2.4 5-2.4z" />
              </svg>
              <span>{role === 'clinician' ? 'Clinician Copilot' : 'Recovery Assistant'}</span>
            </div>
            <div className="ai-chat-actions">
              {messages.length > 0 && (
                <button
                  type="button"
                  className="ai-chat-btn-clear"
                  onClick={handleClear}
                  title="Clear conversation"
                  aria-label="Clear conversation"
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                className="ai-chat-btn-close"
                onClick={() => setIsOpen(false)}
                title="Close chat (Esc)"
                aria-label="Close chat"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="ai-chat-body">
            {/* Unconfigured alert */}
            {configured === false && (
              <div className="ai-chat-banner warn" role="alert">
                AI assistant is not configured on this server yet. Add <code>GROQ_API_KEY</code> to <code>.env.groq</code>.
              </div>
            )}

            {/* Privacy consent screen */}
            {configured !== false && !hasConsent && (
              <div className="ai-chat-consent">
                <div className="ai-chat-consent-badge">Privacy & Care Consent</div>
                <p>
                  Kineticare connects to Groq’s fast inference model to answer questions about exercise technique, rehabilitation plans, and movement recovery.
                </p>
                <ul>
                  <li>Your questions and an anonymized summary of your plan/sessions are shared with Groq to generate responses.</li>
                  <li>No emails, raw database IDs, or video camera streams are ever transmitted.</li>
                  <li>Conversations are temporary and not permanently stored.</li>
                </ul>
                <button
                  type="button"
                  className="btn ai-chat-consent-btn"
                  onClick={giveConsent}
                >
                  I Understand & Agree
                </button>
              </div>
            )}

            {/* Chat conversation */}
            {configured !== false && hasConsent && (
              <>
                <div className="ai-chat-log" aria-live="polite">
                  {messages.length === 0 && (
                    <div className="ai-chat-empty">
                      <p className="ai-chat-empty-intro">
                        {role === 'clinician'
                          ? 'Ask about patient compliance trends, unreviewed sessions, or draft encouraging feedback.'
                          : 'Ask questions about your assigned exercises, technique tips, or how your scores are calculated.'}
                      </p>
                      <div className="ai-chat-suggestions">
                        <span className="ai-chat-suggestions-label">Suggestions:</span>
                        {suggestions.map((s, idx) => (
                          <button
                            key={idx}
                            type="button"
                            className="ai-chat-suggestion-chip"
                            onClick={() => handleSend(s)}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {messages.map((m, idx) => (
                    <div key={idx} className={`ai-chat-msg ${m.role}`}>
                      <div className="ai-chat-bubble">{m.content}</div>
                    </div>
                  ))}

                  {loading && (
                    <div className="ai-chat-msg assistant">
                      <div className="ai-chat-bubble typing">
                        <span className="dot" />
                        <span className="dot" />
                        <span className="dot" />
                      </div>
                    </div>
                  )}

                  {error && (
                    <div className="ai-chat-error" role="alert">
                      {error}
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Input area */}
                <form
                  className="ai-chat-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSend();
                  }}
                >
                  <textarea
                    ref={textareaRef}
                    rows="2"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message… (Enter to send)"
                    aria-label="Chat message"
                    disabled={loading}
                    maxLength={1500}
                  />
                  <button
                    type="submit"
                    className="ai-chat-send-btn"
                    disabled={loading || !input.trim()}
                    aria-label="Send message"
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                  </button>
                </form>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="ai-chat-footer">
            AI-generated, not medical advice
          </div>
        </div>
      )}
    </div>
  );
}
