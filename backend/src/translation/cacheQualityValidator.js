/**
 * Smart Self-Healing Cache Quality Validator for K-SMART CARE
 * Validates cached Malayalam translations to detect poor quality, remaining untranslated English, mixed language, and broken placeholders.
 */

export const WHITELIST = new Set([
  "AI", "PDF", "OTP", "JWT", "GIS", "API", "URL", "SMS", "ID", "GPS",
  "HTML", "CSS", "JAVASCRIPT", "MONGODB", "NODE.JS", "REACT", "K-SMART", "LSGD"
]);

const UNPROCESSED_VERBS = new Set([
  "APPROVE", "REVIEW", "GENERATE", "UPLOAD", "DOWNLOAD", "SEARCH",
  "DELETE", "UPDATE", "CREATE", "VIEW", "ASSIGN", "SUBMIT", "REQUEST"
]);

/**
 * Calculates the confidence score of a cached translation based on quality rules.
 *
 * @param {string} english Original English source.
 * @param {string} malayalam Cached Malayalam translation.
 * @param {Object} [details] Pre-computed validation metadata.
 * @returns {number} Confidence score clamped between 0.00 and 1.00.
 */
export function calculateConfidence(english, malayalam, details = {}) {
  if (!malayalam || typeof malayalam !== 'string' || !malayalam.trim()) {
    return 0.0;
  }

  let score = 1.0;

  if (details.emptyTranslation) {
    score -= 0.40;
  }
  if (details.englishWordsRemaining > 0) {
    score -= 0.30;
  }
  if (details.mixedLanguage) {
    score -= 0.25;
  }
  if (details.brokenPlaceholder) {
    score -= 0.25;
  }
  if (details.brokenHTML) {
    score -= 0.20;
  }
  if (details.veryShort) {
    score -= 0.10;
  }

  if (details.glossaryApplied) {
    score += 0.05;
  }
  if (details.refinementApplied) {
    score += 0.05;
  }

  return Math.min(1.0, Math.max(0.0, Math.round(score * 100) / 100));
}

/**
 * Validates a cached translation string against strict quality standards.
 *
 * @param {string} english Original English text.
 * @param {string} malayalam Cached Malayalam text.
 * @param {Object} [options] Optional parameters (glossaryApplied, refinementApplied).
 * @returns {{valid: boolean, confidence: number, reasons: Array<string>, englishWordsRemaining: number, mixedLanguage: boolean}}
 */
export function validateCachedTranslation(english, malayalam, options = {}) {
  const reasons = [];

  // 1. Empty / Null / Undefined check
  if (!malayalam || typeof malayalam !== 'string' || !malayalam.trim()) {
    return {
      valid: false,
      confidence: 0.0,
      reasons: ["Empty Translation"],
      englishWordsRemaining: 0,
      mixedLanguage: false
    };
  }

  const trimmedEng = (english || '').trim();
  const trimmedMl = (malayalam || '').trim();

  // 2. Remaining English Words & Partial Verb Check
  const rawEnglishMatches = trimmedMl.match(/\b[A-Za-z0-9._-]+\b/g) || [];
  let englishWordsRemaining = 0;
  let hasUnprocessedVerbs = false;

  for (const token of rawEnglishMatches) {
    const upper = token.toUpperCase();
    if (!WHITELIST.has(upper) && !/^\d+$/.test(token)) {
      englishWordsRemaining++;
      if (UNPROCESSED_VERBS.has(upper)) {
        hasUnprocessedVerbs = true;
      }
    }
  }

  if (englishWordsRemaining > 0) {
    reasons.push("Remaining English");
  }
  if (hasUnprocessedVerbs && !reasons.includes("Partial Translation")) {
    reasons.push("Partial Translation");
  }

  // 3. Mixed Language Detection (Malayalam -> English -> Malayalam OR English -> Malayalam -> English)
  const mlEngMlPattern = /[\u0D00-\u0D7F]+\s+[A-Za-z]+\s+[\u0D00-\u0D7F]+/;
  const engMlEngPattern = /[A-Za-z]+\s+[\u0D00-\u0D7F]+\s+[A-Za-z]+/;
  const mixedLanguage = mlEngMlPattern.test(trimmedMl) || engMlEngPattern.test(trimmedMl);

  if (mixedLanguage) {
    reasons.push("Mixed Language");
  }

  // 4. Placeholder Validation
  const engPlaceholders = trimmedEng.match(/\{\{[^}]+\}\}|\{[^}]+\}|%s|%d/g) || [];
  let brokenPlaceholder = false;

  for (const ph of engPlaceholders) {
    if (!trimmedMl.includes(ph)) {
      brokenPlaceholder = true;
      break;
    }
  }

  if (brokenPlaceholder) {
    reasons.push("Broken Placeholder");
  }

  // 5. HTML Validation
  const engTags = trimmedEng.match(/<[^>]+>/g) || [];
  let brokenHTML = false;

  for (const tag of engTags) {
    if (!trimmedMl.includes(tag)) {
      brokenHTML = true;
      break;
    }
  }

  if (brokenHTML) {
    reasons.push("Broken HTML");
  }

  // 6. Very Short Translation Check
  const engWordCount = trimmedEng.split(/\s+/).filter(Boolean).length;
  const mlCharCount = trimmedMl.length;
  const veryShort = engWordCount >= 3 && mlCharCount < 3;

  if (veryShort) {
    reasons.push("Very Short Translation");
  }

  // 7. Calculate Confidence Score
  const confidence = calculateConfidence(trimmedEng, trimmedMl, {
    emptyTranslation: false,
    englishWordsRemaining,
    mixedLanguage,
    brokenPlaceholder,
    brokenHTML,
    veryShort,
    glossaryApplied: options.glossaryApplied || false,
    refinementApplied: options.refinementApplied || false
  });

  // Quality threshold: confidence >= 0.90 and no critical broken placeholders/HTML
  const valid = confidence >= 0.90 && !brokenPlaceholder && !brokenHTML && englishWordsRemaining === 0 && !mixedLanguage;

  return {
    valid,
    confidence,
    reasons,
    englishWordsRemaining,
    mixedLanguage
  };
}

export default {
  validateCachedTranslation,
  calculateConfidence,
  WHITELIST
};
