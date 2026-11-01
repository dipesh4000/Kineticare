import { useState, useEffect, useRef } from 'react';
import { useRecords } from '../records/recordsContext';
import { useAuth } from '../auth/authContext';
import { getChatStatus, sendChat } from '../services/chatApi';
import Icon from '../components/Icon';
import FormattedAiMessage from '../components/FormattedAiMessage';
import '../patient/PatientAiPhysio.css';

const CLINICIAN_PROMPTS = [
  'Summarise recent session compliance and volume across my patient roster.',
  'Which patients have sessions waiting for clinical review and feedback?',
  'Draft thoughtful, encouraging clinical feedback for recently submitted sessions.',
  'Identify any patients showing irregular form scores or movement deficits.',
  'Suggest exercise regressions for patients struggling with squat depth.',
];

export default function ClientAiCopilot() {
  const { user } = useAuth();
  const { patients = [] } = useRecords();
  const [selectedPatientId, setSelectedPatientId] = useState(null);

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

  useEffect(() => {
    let active = true;
    getChatStatus().then(st => {
      if (active) setConfigured(st.configured);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const giveConsent = () => {
    try {
      localStorage.setItem('kineticare_ai_chat_consent', 'true');
    } catch {
      /* ignore storage failure */
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
      const payloadMessages = nextMessages.slice(-10);
      const res = await sendChat(payloadMessages, { patientId: selectedPatientId });
      setMessages([...nextMessages, { role: 'assistant', content: res.reply }]);
    } catch (err) {
      setError(err.message || 'Unable to connect to Clinician Copilot.');
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

  return (
    <div className="physio-page" style={{ maxWidth: 960 }}>
      {/* Header */}
      <div className="physio-header">
        <div className="physio-header-title">
          <div className="physio-avatar-mark" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
            <Icon name="physio" size={24} color="#ffffff" />
          </div>
          <div className="physio-header-text">
            <h1>Clinician Intelligence Copilot</h1>
            <p>
              <span className="physio-status-dot" />
              {configured !== false ? 'Groq AI Copilot Active (Kisner & Colby Grounded)' : 'Offline'}
            </p>
          </div>
        </div>
        <div className="physio-header-actions">
          {messages.length > 0 && (
            <button
              type="button"
              className="physio-btn-subtle"
              onClick={() => { setMessages([]); setError(null); }}
            >
              Clear Workspace
            </button>
          )}
        </div>
      </div>

      {/* Patient Focus Selector Bar */}
      <div className="physio-plan-bar" style={{ background: 'var(--soft)', borderColor: 'var(--card-border)', color: 'var(--ink)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <label htmlFor="patient-focus-select" style={{ fontSize: 12, fontWeight: 600, margin: 0 }}>
            Focus on Patient:
          </label>
          <select
            id="patient-focus-select"
            value={selectedPatientId || ''}
            onChange={(e) => setSelectedPatientId(e.target.value || null)}
            style={{ padding: '4px 8px', borderRadius: 8, border: '1px solid var(--card-border)', fontSize: 12 }}
          >
            <option value="">All Linked Patients (Cohort Overview)</option>
            {patients.map(p => (
              <option key={p.id || p.uid} value={p.id || p.uid}>
                {p.displayName || p.name || 'Patient'}
              </option>
            ))}
          </select>
        </div>
        <span>{patients.length} linked patients</span>
      </div>

      {!hasConsent && (
        <div className="physio-consent-screen">
          <div className="physio-avatar-mark" style={{ margin: '0 auto 14px', background: '#10b981' }}>
            <Icon name="physio" size={26} color="#ffffff" />
          </div>
          <h2>Clinician AI Copilot</h2>
          <p>
            Assists clinicians with cohort summaries, feedback generation, and biomechanical trend analysis.
          </p>
          <button type="button" className="btn" onClick={giveConsent}>
            Agree & Activate Copilot
          </button>
        </div>
      )}

      {hasConsent && (
        <div className="physio-chat-box" style={{ minHeight: 520 }}>
          <div className="physio-messages-area" style={{ maxHeight: '62vh' }}>
            {messages.length === 0 && (
              <div className="physio-welcome-card">
                <h3>Welcome, {user?.displayName || 'Clinician'}.</h3>
                <p>
                  Use your clinical copilot to rapidly audit patient exercise adherence, highlight movement score declines, and draft personalized session feedback.
                </p>
                <div className="physio-suggestion-grid">
                  {CLINICIAN_PROMPTS.map((prompt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className="physio-suggestion-card"
                      onClick={() => handleSend(prompt)}
                    >
                      <span>⚡</span>
                      <span>{prompt}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, idx) => (
              <div key={idx} className={`physio-msg-row ${m.role}`}>
                <div className="physio-msg-avatar">
                  {m.role === 'assistant' ? 'AI' : 'DR'}
                </div>
                <div className="physio-bubble">
                  <FormattedAiMessage content={m.content} role={m.role} />
                </div>
              </div>
            ))}

            {loading && (
              <div className="physio-msg-row assistant">
                <div className="physio-msg-avatar">AI</div>
                <div className="physio-bubble">
                  <div className="physio-typing-indicator">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="demo" role="alert" style={{ color: 'var(--bad, #dc2626)' }}>
                {error}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className="physio-form-container">
            <form
              className="physio-input-wrap"
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
            >
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Copilot: Summarize compliance, draft feedback for patient, analyze scores..."
                rows={1}
              />
              <button
                type="submit"
                className="physio-send-btn"
                style={{ background: '#10b981' }}
                disabled={!input.trim() || loading}
                aria-label="Send clinical inquiry"
              >
                <Icon name="send" size={17} color="#ffffff" />
              </button>
            </form>
            <div className="physio-disclaimer">
              Clinical Copilot assistance is advisory. All clinical decisions, diagnosis, and prescription authority remain with the licensed practitioner.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
