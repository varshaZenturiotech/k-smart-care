/**
 * English Word & Mixed Language Detector for Malayalam Translations.
 * Detects un-translated English words and mixed-language sentences.
 */

// Whitelisted technical terms, acronyms, and platform names that are allowed in English
const WHITELISTED_ACRONYMS = new Set([
  'AI', 'PDF', 'OTP', 'JWT', 'API', 'GIS', 'ID', 'URL', 'HTTP', 'HTTPS',
  'UI', 'UX', 'CSS', 'HTML', 'SQL', 'JSON', 'LSGD', 'K-SMART', 'CARE',
  'MB', 'GB', 'KG', 'CM', 'MM', 'PM', 'AM'
]);

/**
 * Remove placeholders, HTML tags, URLs, emails, and numbers from text.
 * @param {string} text 
 * @returns {string} Cleaned text for linguistic detection.
 */
function cleanTextForLanguageAnalysis(text) {
  if (typeof text !== 'string') return '';

  return text
    .replace(/(\{\{[^}]+\}\}|\{[^}]+\}|%s|%d|%f|<[^>]+>|https?:\/\/\S+|\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b)/g, ' ')
    .replace(/[0-9]/g, ' ')
    .replace(/[.,/#!$%^&*;:{}=\-_`~()?"'–—]/g, ' ')
    .trim();
}

/**
 * Detect remaining English words and mixed-language usage in a translated sentence.
 * 
 * @param {string} english Original English string.
 * @param {string} translated Translated Malayalam string.
 * @param {string} key Dot-notation key path.
 * @returns {Array<{ key: string, english: string, translated: string, issue: string, severity: string, word?: string }>}
 */
export function detectEnglishAndMixedLanguage(english, translated, key) {
  const issues = [];
  if (typeof translated !== 'string' || !translated.trim()) return issues;

  const cleaned = cleanTextForLanguageAnalysis(translated);
  if (!cleaned) return issues;

  // Extract English words (length >= 2)
  const englishWords = (cleaned.match(/\b[A-Za-z]{2,}\b/g) || [])
    .filter(w => !WHITELISTED_ACRONYMS.has(w.toUpperCase()));

  if (englishWords.length === 0) return issues;

  // Check Malayalam character presence (Unicode range \u0D00-\u0D7F)
  const hasMalayalam = /[\u0D00-\u0D7F]/.test(translated);

  if (hasMalayalam) {
    // Mixed language string (contains both Malayalam and un-whitelisted English words)
    let severity = 'Medium';
    if (englishWords.length > 3) {
      severity = 'High';
    } else if (englishWords.length === 1 && englishWords[0].length <= 3) {
      severity = 'Low';
    }

    issues.push({
      key,
      english,
      translated,
      type: 'Mixed Language',
      severity,
      details: `Contains ${englishWords.length} English word(s): "${englishWords.join(', ')}"`
    });
  } else {
    // Fully English string (no Malayalam characters present)
    issues.push({
      key,
      english,
      translated,
      type: 'Remaining English',
      severity: 'Medium',
      details: `Entire string remained untranslated in English`
    });
  }

  return issues;
}

export default {
  detectEnglishAndMixedLanguage
};
