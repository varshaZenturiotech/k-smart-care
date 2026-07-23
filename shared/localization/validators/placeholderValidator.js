/**
 * Placeholder & Variable Integrity Validator for Localization.
 * Verifies that ICU variables, interpolation tags, and placeholders remain unaltered.
 */

/**
 * Extract placeholders from a string.
 * @param {string} text 
 * @returns {string[]} List of extracted placeholder strings.
 */
function extractPlaceholders(text) {
  if (typeof text !== 'string') return [];
  const matches = text.match(/(\{\{[^}]+\}\}|\{[^}]+\}|%s|%d|%f)/g) || [];
  return matches;
}

/**
 * Validate placeholders between English and Malayalam strings.
 * 
 * @param {string} english Original English string.
 * @param {string} translated Translated Malayalam string.
 * @param {string} key Dot-notation key path.
 * @returns {Array<{ key: string, english: string, translated: string, type: string, severity: string, details: string }>}
 */
export function validatePlaceholders(english, translated, key) {
  const issues = [];
  if (typeof english !== 'string' || typeof translated !== 'string') return issues;

  const origPlaceholders = extractPlaceholders(english);
  if (origPlaceholders.length === 0) return issues;

  const transPlaceholders = extractPlaceholders(translated);

  // Check missing or altered placeholders
  for (const p of origPlaceholders) {
    if (!transPlaceholders.includes(p)) {
      issues.push({
        key,
        english,
        translated,
        type: 'Placeholder Error',
        severity: 'Critical',
        details: `Missing or modified placeholder '${p}' in translation`
      });
    }
  }

  // Check extra unexpected placeholders added
  for (const tp of transPlaceholders) {
    if (!origPlaceholders.includes(tp)) {
      issues.push({
        key,
        english,
        translated,
        type: 'Placeholder Error',
        severity: 'Critical',
        details: `Unexpected extra placeholder '${tp}' found in translation`
      });
    }
  }

  return issues;
}

export default {
  validatePlaceholders
};
