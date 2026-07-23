import { isTechnicalWord } from './glossaryService.js';
import { validateSemanticEquivalence } from './semanticValidator.js';

/**
 * Perform real-time quality assurance checks on a single translation pair.
 * 
 * @param {string} english Original English source string.
 * @param {string} translated Generated Malayalam translated string.
 * @param {Object} [options] Context or glossary options.
 * @returns {{valid: boolean, confidence: number, issues: string[]}}
 */
export function validateSingleTranslation(english, translated, options = {}) {
  const issues = [];
  if (!english || !translated) {
    return { valid: false, confidence: 0, issues: ["Empty English or translated text"] };
  }

  // 1. Placeholder Validation
  const enPlaceholders = english.match(/({{[^}]+}}|{[^}]+}|%[sd])/g) || [];
  const mlPlaceholders = translated.match(/({{[^}]+}}|{[^}]+}|%[sd])/g) || [];

  for (const ph of enPlaceholders) {
    if (!translated.includes(ph)) {
      issues.push(`Missing placeholder '${ph}' in translation`);
    }
  }

  // 2. HTML Tag Validation
  const enHtml = english.match(/<[^>]+>/g) || [];
  const mlHtml = translated.match(/<[^>]+>/g) || [];
  if (enHtml.length !== mlHtml.length) {
    issues.push(`HTML tag count mismatch: English has ${enHtml.length}, Malayalam has ${mlHtml.length}`);
  }

  // 3. Remaining English & Mixed Language (excluding technical terms / acronyms)
  const englishWords = translated.match(/\b[A-Za-z]{3,}\b/g) || [];
  for (const word of englishWords) {
    if (!isTechnicalWord(word) && !/^(PDF|OTP|JWT|API|GIS|GeoJSON|MongoDB|PostgreSQL|Redis|React|Node|CSV|Excel|UI|UX|HTML|CSS|JS)$/i.test(word)) {
      issues.push(`Untransliterated English word detected: '${word}'`);
    }
  }

  // 4. Duplicate Words Check
  const wordsArray = translated.trim().split(/\s+/);
  for (let i = 0; i < wordsArray.length - 1; i++) {
    if (wordsArray[i] === wordsArray[i + 1] && wordsArray[i].length > 2) {
      issues.push(`Duplicate adjacent word detected: '${wordsArray[i]}'`);
    }
  }

  // 5. Unicode Normalization (NFC) check
  const normalized = translated.normalize('NFC');
  if (normalized !== translated) {
    issues.push("Translation contains unnormalized Unicode characters");
  }

  // Calculate confidence score
  let confidence = 1.0;
  if (issues.length > 0) {
    confidence = Math.max(0, 1.0 - (issues.length * 0.25));
  }

  const valid = issues.length === 0;

  return {
    valid,
    confidence: parseFloat(confidence.toFixed(2)),
    issues
  };
}

/**
 * Full QA pass: structural checks (synchronous, free) plus an LLM
 * back-translation meaning check (async, costs a Groq call).
 *
 * Structural checks alone cannot catch a fluent-but-wrong translation —
 * e.g. "Approve casual leave request" rendered with the wrong words for
 * "casual" and "leave" passes every structural check (no stray English,
 * no broken placeholders, valid Unicode) while meaning something
 * unrelated. Run this for anything going to production, not just
 * validateSingleTranslation on its own.
 *
 * @param {string} english Original English source string.
 * @param {string} translated Generated Malayalam translated string.
 * @param {Object} [options] Passed through to both structural and semantic checks.
 * @param {number} [options.passThreshold=90] Minimum semantic meaningScore to count as valid.
 * @returns {Promise<{valid: boolean, confidence: number, issues: string[], meaningScore: number|null, backTranslation: string, needsManualReview: boolean}>}
 *   needsManualReview is true whenever the semantic judge could not be
 *   run (checked: false) — treat those as unverified, not passing.
 */
export async function validateTranslationFull(english, translated, options = {}) {
  const structural = validateSingleTranslation(english, translated, options);

  // No point spending an API call back-translating something already
  // known to be empty / structurally broken in an unrecoverable way.
  if (!english || !translated) {
    return {
      ...structural,
      meaningScore: null,
      backTranslation: '',
      needsManualReview: true
    };
  }

  const semantic = await validateSemanticEquivalence(english, translated, options);

  const issues = [...structural.issues];
  if (semantic.checked && !semantic.valid) {
    issues.push(`Meaning mismatch (score ${semantic.meaningScore}/100): ${semantic.issue || 'back-translation diverges from source'}`);
  }

  return {
    valid: structural.valid && (semantic.checked ? semantic.valid : false),
    confidence: semantic.checked ? Math.min(structural.confidence, semantic.meaningScore / 100) : Math.min(structural.confidence, 0.5),
    issues,
    meaningScore: semantic.meaningScore,
    backTranslation: semantic.backTranslation,
    needsManualReview: !semantic.checked
  };
}

export default {
  validateSingleTranslation,
  validateTranslationFull
};