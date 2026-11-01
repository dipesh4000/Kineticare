/**
 * frontend/src/components/clinicalTextParser.js
 * Pure JavaScript clinical text and markdown parser.
 */

/**
 * Checks if a string contains red-flag medical warning keywords.
 */
export function isRedFlagWarning(text = '') {
  const lower = text.toLowerCase();
  return (
    lower.includes('chest pain') ||
    lower.includes('shortness of breath') ||
    lower.includes('dizziness') ||
    lower.includes('acute tearing') ||
    lower.includes('radiating numbness') ||
    lower.includes('seek urgent medical') ||
    lower.includes('emergency evaluation') ||
    lower.includes('stop immediately and seek') ||
    text.startsWith('> 🚨') ||
    text.startsWith('> ⚠️')
  );
}

/**
 * Categorizes a section title into a visual clinical theme.
 */
export function getSectionTheme(title = '') {
  const lower = title.toLowerCase();
  if (lower.includes('biomechanic') || lower.includes('alignment') || lower.includes('form') || lower.includes('cue')) {
    return { theme: 'biomechanics', icon: '📐', label: 'Form & Biomechanics' };
  }
  if (lower.includes('pacing') || lower.includes('tempo') || lower.includes('breath') || lower.includes('eccentric') || lower.includes('concentric')) {
    return { theme: 'pacing', icon: '⏱️', label: 'Cadence & Breathing' };
  }
  if (lower.includes('safety') || lower.includes('triage') || lower.includes('pain') || lower.includes('soreness') || lower.includes('doms')) {
    return { theme: 'safety', icon: '🛡️', label: 'Safety & Recovery' };
  }
  if (lower.includes('recent activity') || lower.includes('history') || lower.includes('session') || lower.includes('progress') || lower.includes('score')) {
    return { theme: 'activity', icon: '📊', label: 'Activity Insights' };
  }
  if (lower.includes('healing') || lower.includes('tissue') || lower.includes('phase')) {
    return { theme: 'healing', icon: '🩹', label: 'Tissue Healing' };
  }
  return { theme: 'general', icon: '📋', label: 'Clinical Guidance' };
}

/**
 * Tokenizes markdown inline styles (**bold**, *italic*, `code`).
 */
export function tokenizeInline(text = '') {
  if (!text) return [];

  const tokens = [];
  let remaining = text;

  // Regex to match **bold**, *italic*, or `code`
  const regex = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/;

  while (remaining) {
    const match = remaining.match(regex);
    if (!match) {
      tokens.push({ type: 'text', value: remaining });
      break;
    }

    const matchIndex = match.index;
    if (matchIndex > 0) {
      tokens.push({ type: 'text', value: remaining.substring(0, matchIndex) });
    }

    if (match[2]) {
      tokens.push({ type: 'bold', value: match[2] });
    } else if (match[3]) {
      tokens.push({ type: 'italic', value: match[3] });
    } else if (match[4]) {
      tokens.push({ type: 'code', value: match[4] });
    }

    remaining = remaining.substring(matchIndex + match[0].length);
  }

  return tokens;
}

/**
 * Parses raw AI content into structured clinical blocks.
 * Handles both cleanly formatted markdown and inlined/compressed outputs.
 */
export function parseClinicalBlocks(content = '') {
  if (!content || typeof content !== 'string') return [];

  let text = content.replace(/\r\n/g, '\n').trim();

  // If asterisks are concatenated without newlines (e.g. "**Title** * **Item**" or "sentence. * **Item**"),
  // normalize them with line breaks so each bullet is recognized
  text = text.replace(/([^\n])\s*\*\s+\*\*/g, '$1\n* **');
  text = text.replace(/(\*\*[A-Za-z0-9\s&/-]{3,40}\*\*)\s*([*-])/g, '$1\n$2');

  const rawParagraphs = text.split(/\n\s*\n/);
  const blocks = [];

  for (const rawP of rawParagraphs) {
    const p = rawP.trim();
    if (!p) continue;

    // Check if this whole paragraph is an emergency red flag warning
    if (isRedFlagWarning(p)) {
      const cleanAlert = p.replace(/^[>\s*#]+/u, '').replace(/^(?:⚠️|🚨|\s)+/u, '').trim();
      blocks.push({
        type: 'alert',
        title: 'Urgent Medical Safety Boundary',
        body: cleanAlert,
      });
      continue;
    }

    // Check for section headers (e.g. "### 📐 Biomechanical Alignment" or "**Biomechanical Alignment & Cues**")
    const lines = p.split('\n').map(l => l.trim()).filter(Boolean);
    const firstLine = lines[0];

    const headerMatch =
      firstLine.match(/^#{1,4}\s+(.+)$/) ||
      (firstLine.startsWith('**') && firstLine.endsWith('**') && firstLine.length <= 60 && !firstLine.includes(':')) ?
      firstLine.replace(/^#{1,4}\s+/, '').replace(/^\*\*|\*\*$/g, '').trim() :
      null;

    if (headerMatch && lines.length > 1) {
      const sectionMeta = getSectionTheme(headerMatch);
      const items = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (isRedFlagWarning(line)) {
          blocks.push({
            type: 'alert',
            title: 'Urgent Medical Safety Boundary',
            body: line.replace(/^[>\s*#]+/u, '').replace(/^(?:⚠️|🚨|\s)+/u, '').trim(),
          });
          continue;
        }

        // Bullet with key label (e.g. "* **Proximal Stability:** body")
        const bulletKeyMatch = line.match(/^[*•-]\s*\*\*([^*]+?):?\*\*:?\s*(.+)$/);
        if (bulletKeyMatch) {
          items.push({
            type: 'cue',
            label: bulletKeyMatch[1].replace(/:$/, '').trim(),
            body: bulletKeyMatch[2].trim(),
          });
          continue;
        }

        // Standard bullet
        const plainBulletMatch = line.match(/^[*•-]\s*(.+)$/);
        if (plainBulletMatch) {
          items.push({
            type: 'bullet',
            body: plainBulletMatch[1].trim(),
          });
          continue;
        }

        // Plain descriptive line within the card
        items.push({
          type: 'text',
          body: line,
        });
      }

      if (items.length > 0) {
        blocks.push({
          type: 'card',
          title: headerMatch,
          theme: sectionMeta.theme,
          icon: sectionMeta.icon,
          themeLabel: sectionMeta.label,
          items,
        });
        continue;
      }
    }

    // Check if the paragraph is a standalone list without an explicit header
    const bulletLines = lines.filter(l => /^[*•-]/.test(l));
    if (bulletLines.length === lines.length && lines.length > 0) {
      const items = lines.map(line => {
        const bulletKeyMatch = line.match(/^[*•-]\s*\*\*([^*]+?):?\*\*:?\s*(.+)$/);
        if (bulletKeyMatch) {
          return {
            type: 'cue',
            label: bulletKeyMatch[1].replace(/:$/, '').trim(),
            body: bulletKeyMatch[2].trim(),
          };
        }
        return {
          type: 'bullet',
          body: line.replace(/^[*•-]\s*/, '').trim(),
        };
      });

      blocks.push({
        type: 'card',
        title: 'Key Biomechanical Cues',
        theme: 'biomechanics',
        icon: '📐',
        themeLabel: 'Exercise Guidance',
        items,
      });
      continue;
    }

    // Check if paragraph is a markdown table
    if (lines.length >= 2 && lines[0].includes('|') && lines[1].includes('|') && /^[|\s:-]+$/.test(lines[1])) {
      const headers = lines[0].split('|').map(c => c.trim()).filter(Boolean);
      const rows = [];
      for (let i = 2; i < lines.length; i++) {
        if (!lines[i].includes('|')) continue;
        const rowCells = lines[i].split('|').map(c => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length);
        if (rowCells.length) rows.push(rowCells);
      }
      if (headers.length && rows.length) {
        blocks.push({
          type: 'table',
          headers,
          rows,
        });
        continue;
      }
    }

    // Default: Narrative conversational paragraph
    blocks.push({
      type: 'paragraph',
      body: p,
    });
  }

  return blocks;
}
