/**
 * HTML Structure & Tag Integrity Validator for Localization.
 * Ensures HTML elements (<strong>, <div>, <a>, <span>, <br/>, etc.) are preserved and valid.
 */

/**
 * Extract HTML tags from a string.
 * @param {string} text 
 * @returns {string[]} List of HTML tag strings.
 */
function extractHtmlTags(text) {
  if (typeof text !== 'string') return [];
  return text.match(/<[^>]+>/g) || [];
}

/**
 * Validate HTML tags between English and Malayalam strings.
 * 
 * @param {string} english Original English string.
 * @param {string} translated Translated Malayalam string.
 * @param {string} key Dot-notation key path.
 * @returns {Array<{ key: string, english: string, translated: string, type: string, severity: string, details: string }>}
 */
export function validateHtml(english, translated, key) {
  const issues = [];
  if (typeof english !== 'string' || typeof translated !== 'string') return issues;

  const origTags = extractHtmlTags(english);
  const transTags = extractHtmlTags(translated);

  if (origTags.length === 0 && transTags.length === 0) return issues;

  // Tag count mismatch
  if (origTags.length !== transTags.length) {
    issues.push({
      key,
      english,
      translated,
      type: 'HTML Error',
      severity: 'Critical',
      details: `HTML tag count mismatch. Original has ${origTags.length} tag(s), translation has ${transTags.length}`
    });
    return issues;
  }

  // Tag equivalence check
  for (let i = 0; i < origTags.length; i++) {
    const origTagClean = origTags[i].toLowerCase().replace(/\s+/g, '');
    const transTagClean = transTags[i] ? transTags[i].toLowerCase().replace(/\s+/g, '') : '';

    if (origTagClean !== transTagClean) {
      issues.push({
        key,
        english,
        translated,
        type: 'HTML Error',
        severity: 'Critical',
        details: `HTML tag mismatch at index ${i}: expected '${origTags[i]}', found '${transTags[i]}'`
      });
    }
  }

  return issues;
}

export default {
  validateHtml
};
