import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRecords } from '../records/recordsContext';
import { useAuth } from '../auth/authContext';
import { getChatStatus, sendChat } from '../services/chatApi';
import Icon from '../components/Icon';
import './PatientAiPhysio.css';

const TRIAGE_CATEGORIES = [
  { id: 'all', label: 'All Guidance', icon: 'physio' },
  { id: 'form', label: '📐 Form & Biomechanics', prompt: 'According to Kisner & Colby exercise principles, what are the exact biomechanical alignment cues and common substitutions to avoid during my exercises?' },
  { id: 'pain', label: '🩺 Pain & Soreness Check', prompt: 'I feel some soreness after my session. Applying Kisner & Colby soreness rules, help me differentiate delayed-onset muscle soreness (DOMS) from joint inflammation or strain.' },
  { id: 'phases', label: '🩹 Tissue Healing & Progression', prompt: 'Explain the three phases of tissue healing (acute, subacute, chronic) from Kisner & Colby and how my rehabilitation exercise intensity progresses.' },
  { id: 'warmup', label: '⚡ Warm-Up & Mobility', prompt: 'Provide a tailored dynamic warm-up and mobility routine for my assigned rehabilitation exercises based on therapeutic exercise protocols.' },
  { id: 'prog', label: '🎯 Plan & Score Review', prompt: 'How is my exercise score calculated and what should I focus on to improve my movement excursion?' },
];

export default function PatientAiPhysio() {
  const nav = useNavigate();
  const { user } = useAuth();
  const { patientId, patientPlan, assignment, sessions, feedback } = useRecords();

  const plan = patientPlan(patientId);
  const activeAssignment = assignment(patientId);
  const sessionList = sessions(patientId);
  const feedbackList = feedback(patientId);

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
  const [activeCategory, setActiveCategory] = useState('all');

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
    } catch {}
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
      const res = await sendChat(payloadMessages, { patientId });
      setMessages([...nextMessages, { role: 'assistant', content: res.reply }]);
    } catch (err) {
      setError(err.message || 'Unable to connect to AI Physiotherapist.');
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

  const assignedNames = (plan?.items || []).map(i => i.name || i.ex || 'Exercise');
  const suggestions = [
    assignedNames.length
      ? `Kisner & Colby form cues for ${assignedNames[0]}`
      : 'Kisner & Colby form cues for bilateral mini-squat',
    'How does Kisner & Colby define delayed-onset muscle soreness (DOMS)?',
    'What breathing pattern prevents the Valsalva maneuver during reps?',
    'What are common compensatory substitutions during squats?',
  ];

  return (
    <div className="physio-page">
      {/* Header */}
      <div className="physio-header">
        <div className="physio-header-title">
          <div className="physio-avatar-mark" aria-hidden="true">
            <Icon name="physio" size={24} color="#ffffff" />
          </div>
          <div className="physio-header-text">
            <h1>AI Physiotherapist</h1>
            <p>
              <span className="physio-status-dot" />
              {configured !== false ? 'Grounded in Kisner & Colby (6th Ed.) · Groq AI Online' : 'Offline'}
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
              Clear Chat
            </button>
          )}
          <button
            type="button"
            className="physio-btn-subtle"
            onClick={() => nav('/patient/home')}
          >
            Back Home
          </button>
        </div>
      </div>

      {/* Textbook Citation Pill */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--mut)', marginBottom: 10, padding: '0 4px' }}>
        <span>📖</span>
        <span>Clinical Foundation: <strong>Kisner & Colby, Therapeutic Exercise: Foundations and Techniques (6th Ed.)</strong></span>
      </div>

      {/* Active Rehabilitation Plan Summary */}
      <div className="physio-plan-bar">
        <div>
          <span>Your Active Care Plan: </span>
          <strong>{assignedNames.length ? assignedNames.join(', ') : 'Self-guided movements'}</strong>
        </div>
        <span>{sessionList.length} completed sessions</span>
      </div>

      {/* Consent Screen */}
      {!hasConsent && (
        <div className="physio-consent-screen">
          <div className="physio-avatar-mark" style={{ margin: '0 auto 14px' }}>
            <Icon name="physio" size={26} color="#ffffff" />
          </div>
          <h2>Consult Your AI Physiotherapist</h2>
          <p>
            Kineticare AI provides 24/7 rehabilitation guidance, biomechanics cueing, and post-workout symptom triage grounded in <strong>Kisner & Colby, Therapeutic Exercise: Foundations and Techniques</strong>.
          </p>
          <ul>
            <li>Analyzes your assigned exercises and scores to give personalized advice.</li>
            <li>No camera feeds, video streams, or personal emails are shared.</li>
            <li>Guidance is based on evidence-backed physical therapy science.</li>
          </ul>
          <button type="button" className="btn" onClick={giveConsent}>
            Agree & Start Consultation
          </button>
        </div>
      )}

      {/* Main Consultation Room */}
      {hasConsent && (
        <>
          {/* Triage Pills */}
          <div className="physio-triage-tabs" role="tablist" aria-label="Clinical topics">
            {TRIAGE_CATEGORIES.map(cat => (
              <button
                key={cat.id}
                type="button"
                className={`physio-triage-pill ${activeCategory === cat.id ? 'active' : ''}`}
                onClick={() => {
                  setActiveCategory(cat.id);
                  if (cat.prompt) handleSend(cat.prompt);
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="physio-chat-box">
            <div className="physio-messages-area">
              {messages.length === 0 && (
                <div className="physio-welcome-card">
                  <h3>Hello {user?.displayName?.split(' ')[0] || 'there'}, how does your body feel today?</h3>
                  <p>
                    I am your Clinical AI Physiotherapist, trained on the gold-standard <em>Kisner & Colby Therapeutic Exercise</em> foundation. Ask me about movement form, pain differentiation, tissue healing stages, or how your Kineticare scores are calculated.
                  </p>
                  <div className="physio-suggestion-grid">
                    {suggestions.map((sug, idx) => (
                      <button
                        key={idx}
                        type="button"
                        className="physio-suggestion-card"
                        onClick={() => handleSend(sug)}
                      >
                        <span>💡</span>
                        <span>{sug}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m, idx) => (
                <div key={idx} className={`physio-msg-row ${m.role}`}>
                  <div className="physio-msg-avatar" aria-hidden="true">
                    {m.role === 'assistant' ? 'PT' : (user?.displayName?.[0] || 'U')}
                  </div>
                  <div className="physio-bubble">
                    {m.content.split('\n\n').map((paragraph, pIdx) => (
                      <p key={pIdx}>{paragraph}</p>
                    ))}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="physio-msg-row assistant">
                  <div className="physio-msg-avatar">PT</div>
                  <div className="physio-bubble">
                    <div className="physio-typing-indicator" aria-label="Physiotherapist thinking">
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="physio-error-banner" role="alert">
                  <span>⚠️ {error}</span>
                  <button
                    type="button"
                    onClick={() => {
                      const lastUser = [...messages].reverse().find(m => m.role === 'user');
                      if (lastUser) handleSend(lastUser.content);
                    }}
                  >
                    Retry
                  </button>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Form */}
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
                  placeholder="Ask your AI Physiotherapist about Kisner & Colby form cues, joint pain, or exercises..."
                  rows={1}
                />
                <button
                  type="submit"
                  className="physio-send-btn"
                  disabled={!input.trim() || loading}
                  aria-label="Send message"
                >
                  <Icon name="send" size={17} color="#ffffff" />
                </button>
              </form>
              <div className="physio-disclaimer">
                Kineticare AI provides movement & physical therapy education based on Kisner & Colby protocols. If you experience acute tearing pain, chest tightness, or numbness, stop immediately and seek medical care.
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
