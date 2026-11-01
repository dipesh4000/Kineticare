import { useState } from 'react';
import { parseClinicalBlocks, tokenizeInline } from './clinicalTextParser.js';
import './FormattedAiMessage.css';

/**
 * Render tokens produced by tokenizeInline into React elements
 */
function renderInlineElements(text = '') {
  const tokens = tokenizeInline(text);
  return tokens.map((token, idx) => {
    if (token.type === 'bold') return <strong key={idx}>{token.value}</strong>;
    if (token.type === 'italic') return <em key={idx}>{token.value}</em>;
    if (token.type === 'code') return <code key={idx}>{token.value}</code>;
    return token.value;
  });
}

/**
 * Rich Formatted AI Message UI Component
 */
export default function FormattedAiMessage({ content, role = 'assistant' }) {
  const [copied, setCopied] = useState(false);

  if (role === 'user') {
    return (
      <div className="physio-user-content">
        {content}
      </div>
    );
  }

  const blocks = parseClinicalBlocks(content);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard fallback
    }
  };

  return (
    <div className="ai-formatted-container">
      {blocks.map((block, idx) => {
        if (block.type === 'alert') {
          return (
            <div key={idx} className="ai-card-alert" role="alert">
              <div className="ai-card-alert-header">
                <span className="ai-card-alert-icon">🚨</span>
                <strong>{block.title}</strong>
              </div>
              <p className="ai-card-alert-body">{renderInlineElements(block.body)}</p>
            </div>
          );
        }

        if (block.type === 'card') {
          return (
            <div key={idx} className={`ai-clinical-card theme-${block.theme}`}>
              <div className="ai-card-header">
                <div className="ai-card-title-wrap">
                  <span className="ai-card-icon" aria-hidden="true">{block.icon}</span>
                  <h4 className="ai-card-title">{block.title}</h4>
                </div>
                <span className="ai-card-badge">{block.themeLabel}</span>
              </div>

              <div className="ai-card-content">
                {block.items.map((item, itemIdx) => {
                  if (item.type === 'cue') {
                    return (
                      <div key={itemIdx} className="ai-cue-item">
                        <span className="ai-cue-label">{item.label}</span>
                        <div className="ai-cue-body">{renderInlineElements(item.body)}</div>
                      </div>
                    );
                  }
                  if (item.type === 'bullet') {
                    return (
                      <div key={itemIdx} className="ai-bullet-item">
                        <span className="ai-bullet-dot">•</span>
                        <div className="ai-bullet-body">{renderInlineElements(item.body)}</div>
                      </div>
                    );
                  }
                  return (
                    <p key={itemIdx} className="ai-card-text">
                      {renderInlineElements(item.body)}
                    </p>
                  );
                })}
              </div>
            </div>
          );
        }

        if (block.type === 'table') {
          return (
            <div key={idx} className="ai-table-wrap">
              <table className="ai-table">
                <thead>
                  <tr>
                    {block.headers.map((h, hIdx) => (
                      <th key={hIdx}>{renderInlineElements(h)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, rIdx) => (
                    <tr key={rIdx}>
                      {row.map((cell, cIdx) => (
                        <td key={cIdx}>{renderInlineElements(cell)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        // Standard narrative paragraph
        return (
          <p key={idx} className="ai-paragraph">
            {renderInlineElements(block.body)}
          </p>
        );
      })}

      {/* Footer Utility Bar */}
      <div className="ai-message-footer">
        <span className="ai-footer-source">
          📖 <em>Therapeutic Exercise (Kisner & Colby)</em>
        </span>
        <button
          type="button"
          className="ai-copy-btn"
          onClick={handleCopy}
          aria-label="Copy guidance"
        >
          {copied ? '✓ Copied' : '📋 Copy Guidance'}
        </button>
      </div>
    </div>
  );
}
