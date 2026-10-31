import React from 'react';
import { mapError } from '../services/errorMapping.js';

/**
 * React Error Boundary with emergency session draft preservation
 * and reassuring human-readable recovery screen.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, recoveredDraft: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an unhandled component error:', error, errorInfo);
    this.setState({ errorInfo });

    // Save recoverable draft state to localStorage to prevent data loss
    try {
      const rescuePayload = {
        rescuedAt: new Date().toISOString(),
        url: window.location.href,
        errorMessage: error?.message || 'Component crash',
        stack: errorInfo?.componentStack?.slice(0, 300) || '',
      };
      localStorage.setItem('kineticare-emergency-rescue', JSON.stringify(rescuePayload));
      this.setState({ recoveredDraft: true });
    } catch (saveErr) {
      console.warn('Could not persist emergency crash snapshot:', saveErr);
    }

    if (typeof this.props.onError === 'function') {
      this.props.onError(error, errorInfo);
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReturnHome = () => {
    window.location.href = this.props.fallbackPath || '/';
  };

  render() {
    if (this.state.hasError) {
      const mapped = mapError(this.state.error);

      return (
        <div className="center" style={{ padding: '32px 16px', maxWidth: 520, margin: '0 auto' }}>
          <div className="card" role="alert" style={{ borderLeft: '4px solid var(--warn, #946020)', padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 24 }}>🛡️</span>
              <h2 style={{ margin: 0, fontSize: 18 }}>Something interrupted this screen</h2>
            </div>

            <p style={{ fontSize: 14, color: 'var(--ink, #202023)', lineHeight: 1.5, margin: '0 0 12px' }}>
              {mapped.message}
            </p>

            <div style={{ background: 'var(--soft, #f5f4f8)', padding: '10px 14px', borderRadius: 8, fontSize: 12, margin: '0 0 16px', color: 'var(--ink-secondary, #56545f)' }}>
              <b>Recovery advice:</b> {mapped.action}
            </div>

            {this.state.recoveredDraft && (
              <p className="tag ok" style={{ display: 'inline-block', fontSize: 11, marginBottom: 16 }}>
                ✓ Any in-progress workout draft has been safely saved on this device.
              </p>
            )}

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
              <button className="btn session-primary" onClick={this.handleReload}>
                Reload this screen
              </button>
              <button className="btn s" onClick={this.handleReturnHome}>
                Return to Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
