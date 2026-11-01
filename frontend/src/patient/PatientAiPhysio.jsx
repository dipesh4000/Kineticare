import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRecords } from '../records/recordsContext';
import { useAuth } from '../auth/authContext';
import { getChatStatus, sendChat } from '../services/chatApi';
import Icon from '../components/Icon';
import './PatientAiPhysio.css';

const TRIAGE_CATEGORIES = [
  { id: 'all', label: 'All Guidance', icon: 'sparkle' },
  { id: 'form', label: 'Form & Biomechanics', icon: 'compass', prompt: 'According to Kisner & Colby exercise principles, what are the exact biomechanical alignment cues and common substitutions to avoid during my exercises?' },
  { id: 'pain', label: 'Pain & Soreness Check', icon: 'pulse', prompt: 'I feel some soreness after my session. Applying Kisner & Colby soreness rules, help me differentiate delayed-onset muscle soreness (DOMS) from joint inflammation or strain.' },
  { id: 'phases', label: 'Tissue Healing & Phases', icon: 'shield', prompt: 'Explain the three phases of tissue healing (acute, subacute, chronic) from Kisner & Colby and how my rehabilitation exercise intensity progresses.' },
  { id: 'warmup', label: 'Warm-Up & Mobility', icon: 'zap', prompt: 'Provide a tailored dynamic warm-up and mobility routine for my assigned rehabilitation exercises based on therapeutic exercise protocols.' },
  { id: 'prog', label: 'Plan & Score Review', icon: 'target', prompt: 'How is my exercise score calculated and what should I focus on to improve my movement excursion?' },
];

function formatInlineText(text) {
  if (!text) return '';
  const parts = [];
  let lastIdx = 0;
  const boldRegex = /\*\*(.*?)\*\*/g;
  let match;
  while ((match = boldRegex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push(text.slice(lastIdx, match.index));
    }
    parts.push(<strong key={match.index}>{match[1]}</strong>);
    lastIdx = boldRegex.lastIndex;
  }
  if (lastIdx < text.length) {
    parts.push(text.slice(lastIdx));
  }
  return parts.length ? parts : text;
}

function FormattedMessage({ content }) {
  if (!content) return null;
  const blocks = content.split(/\n\s*\n/);

  return (
    <div className="physio-formatted-content">
      {blocks.map((block, bIdx) => {
        const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
        if (!lines.length) return null;

        // Check if block is a list of bullets
        const isBulletList = lines.every(l => /^[-*•]\s+/.test(l));
        if (isBulletList) {
          return (
            <ul key={bIdx} className="physio-bubble-list">
              {lines.map((line, lIdx) => {
                const cleaned = line.replace(/^[-*•]\s+/, '');
                return <li key={lIdx}>{formatInlineText(cleaned)}</li>;
              })}
            </ul>
          );
        }

        // Check if single line is a numbered schema section heading
        const sectionMatch = lines[0].match(/^([1-3]\))\s*(.*)$/);
        if (sectionMatch && lines.length === 1) {
          return (
            <div key={bIdx} className="physio-section-heading">
              <span className="physio-section-badge">{sectionMatch[1]}</span>
              <span className="physio-section-title">{formatInlineText(sectionMatch[2])}</span>
            </div>
          );
        }

        return (
          <p key={bIdx} className="physio-bubble-p">
            {lines.map((line, lIdx) => (
              <span key={lIdx}>
                {formatInlineText(line)}
                {lIdx < lines.length - 1 && <br />}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

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
      setError(err.message || 'Unable to connect to Kira.');
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
          <div className="physio-avatar-mark kira" aria-hidden="true">
            <Icon name="kira" size={22} color="#ffffff" />
          </div>
          <div className="physio-header-text">
            <div className="physio-title-row">
              <h1>Kira</h1>
              <span className="physio-role-chip">AI Physio</span>
            </div>
            <p>
              <span className="physio-status-dot" />
              {configured !== false ? 'Active · Grounded in Kisner & Colby (6th Ed.)' : 'Offline'}
            </p>
          </div>
        </div>
        <div className="physio-header-actions">
          {messages.length > 0 && (
            <button
              type="button"
              className="physio-btn-subtle"
              onClick={() => { setMessages([]); setError(null); }}
              title="Clear conversation"
            >
              <Icon name="trash" size={13} />
              <span>Clear</span>
            </button>
          )}
          <button
            type="button"
            className="physio-btn-subtle"
            onClick={() => nav('/patient/home')}
            title="Return home"
          >
            <Icon name="home" size={13} />
            <span>Home</span>
          </button>
        </div>
      </div>

      {/* Meta Bar: Foundation + Active Plan */}
      <div className="physio-meta-bar">
        <div className="physio-meta-item">
          <Icon name="book" size={14} color="var(--pri, #6454e8)" />
          <span>Foundation: <strong>Kisner & Colby (6th Ed.)</strong></span>
        </div>
        <div className="physio-meta-divider" />
        <div className="physio-meta-item">
          <Icon name="workout" size={14} color="var(--pri, #6454e8)" />
          <span>Plan: <strong>{assignedNames.length ? assignedNames.join(', ') : 'Self-guided'}</strong></span>
          <span className="physio-session-tag">{sessionList.length} done</span>
        </div>
      </div>

      {/* Consent Screen */}
      {!hasConsent && (
        <div className="physio-consent-screen">
          <div className="physio-avatar-mark kira" style={{ margin: '0 auto 14px' }}>
            <Icon name="kira" size={26} color="#ffffff" />
          </div>
          <h2>Meet Kira · Your AI Physio Companion</h2>
          <p>
            Kira provides 24/7 rehabilitation guidance, biomechanics cueing, and symptom triage strictly grounded in <strong>Kisner & Colby, Therapeutic Exercise: Foundations and Techniques (6th Ed.)</strong>.
          </p>
          <ul>
            <li>Analyzes your assigned movements and historical scores for personalized advice.</li>
            <li>Strictly private: no camera feeds, video files, or emails are ever shared.</li>
            <li>Evidence-backed clinical physical therapy protocols designed for recovery.</li>
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
                <Icon name={cat.icon} size={14} />
                <span>{cat.label}</span>
              </button>
            ))}
          </div>

          <div className="physio-chat-box">
            <div className="physio-messages-area">
              {messages.length === 0 && (
                <div className="physio-welcome-card">
                  <div className="physio-welcome-header">
                    <div className="physio-welcome-avatar">
                      <Icon name="kira" size={22} color="#ffffff" />
                    </div>
                    <div>
                      <h3>Hi {user?.displayName?.split(' ')[0] || 'there'}! I'm Kira, your AI Physio.</h3>
                      <p>
                        I'm here to support your rehabilitation using evidence-backed movement principles from <em>Kisner & Colby Therapeutic Exercise</em>. How does your body feel today?
                      </p>
                    </div>
                  </div>
                  <div className="physio-suggestion-grid">
                    {suggestions.map((sug, idx) => (
                      <button
                        key={idx}
                        type="button"
                        className="physio-suggestion-card"
                        onClick={() => handleSend(sug)}
                      >
                        <Icon name="sparkle" size={13} color="var(--pri, #6454e8)" />
                        <span>{sug}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m, idx) => (
                <div key={idx} className={`physio-msg-row ${m.role}`}>
                  <div className="physio-msg-avatar" aria-hidden="true">
                    {m.role === 'assistant' ? (
                      <Icon name="kira" size={16} color="#ffffff" />
                    ) : (
                      user?.displayName?.[0]?.toUpperCase() || 'U'
                    )}
                  </div>
                  <div className="physio-msg-body">
                    {m.role === 'assistant' && (
                      <div className="physio-msg-author">
                        <span className="physio-author-name">Kira</span>
                        <span className="physio-author-badge">AI Physio</span>
                      </div>
                    )}
                    <div className="physio-bubble">
                      <FormattedMessage content={m.content} />
                    </div>
                  </div>
                </div>
              ))}

              {loading && (
                <div className="physio-msg-row assistant">
                  <div className="physio-msg-avatar" aria-hidden="true">
                    <Icon name="kira" size={16} color="#ffffff" />
                  </div>
                  <div className="physio-msg-body">
                    <div className="physio-msg-author">
                      <span className="physio-author-name">Kira</span>
                      <span className="physio-author-badge">Thinking...</span>
                    </div>
                    <div className="physio-bubble typing">
                      <div className="physio-typing-indicator" aria-label="Kira is typing">
                        <span />
                        <span />
                        <span />
                      </div>
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
                  placeholder="Ask Kira about Kisner & Colby form cues, soreness, or exercise tips..."
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
                Kira provides rehabilitation & exercise guidance grounded in Kisner & Colby protocols. If you experience severe tearing pain, numbness, or dizziness, stop immediately and seek medical care.
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
