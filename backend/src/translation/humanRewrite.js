/**
 * Human-like Rewrite Engine for K-SMART CARE Localization
 * Applies final stylistic polishes to remove redundant word patterns, literal English phrasing,
 * and streamline Malayalam sentences while strictly preserving placeholders, HTML, and glossary words.
 */

const REDUNDANT_PATTERNS = [
  // Plural normalization for Tasks and Meetings in Malayalam (Unicode safe)
  { pattern: /ടാസ്ക്സ്/g, replacement: "ടാസ്കുകൾ" },
  { pattern: /മീറ്റിംഗ്സ്/g, replacement: "മീറ്റിംഗുകൾ" },
  
  // Remove redundant "നിങ്ങളുടെ" (your) in generic instructions (e.g., "നിങ്ങളുടെ വിവരങ്ങൾ" -> "വിവരങ്ങൾ")
  { pattern: /\bദയവായി നിങ്ങളുടെ\b/g, replacement: "ദയവായി" },
  { pattern: /\bനിങ്ങളുടെ പ്രൊഫൈൽ\b/g, replacement: "പ്രൊഫൈൽ" },
  
  // Normalize polite click directives
  { pattern: /\bക്ലിക്ക് ചെയ്യുക\b/g, replacement: "ക്ലിക്ക് ചെയ്യുക" },
  
  // Remove literal translation artifacts
  { pattern: /\bശ്രമിക്കുക വിജയകരമായി\b/g, replacement: "വിജയകരമായി പൂർത്തിയായി" },
  { pattern: /\bഡാഷ്‌ബോർഡ് പേജിലേക്ക്\b/g, replacement: "ഡാഷ്ബോർഡിലേക്ക്" }
];

/**
 * Perform final human-like polish pass on Malayalam string.
 * 
 * @param {string} text Input Malayalam string.
 * @param {Object} [context] Context object from contextDetector.
 * @param {Object} [options]
 * @returns {string} Polished Malayalam string.
 */
export function humanRewrite(text, context = {}, options = {}) {
  if (!text || typeof text !== 'string' || !text.trim()) {
    return text || '';
  }

  let result = text.trim();

  // Apply clean pattern simplifications
  for (const rule of REDUNDANT_PATTERNS) {
    result = result.replace(rule.pattern, rule.replacement);
  }

  // Ensure Unicode Normalization Form C (NFC)
  result = result.normalize('NFC');

  return result;
}

export default {
  humanRewrite
};
