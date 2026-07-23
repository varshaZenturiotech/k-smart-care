/**
 * Dynamic Template Masker & Placeholder Injector for K-SMART CARE
 * Extracts dynamic entities (names, numbers, dates, emojis) into templates for translation & caching.
 */

import { isPersonName, isDistrict, isMunicipality } from './properNameDetector.js';

// Cache for template translations (Template -> Malayalam Template)
const TEMPLATE_CACHE = new Map([
  ["Good Morning, {name} {emoji}", "ഗുഡ് മോണിംഗ്, {name} {emoji}"],
  ["Good morning, {name} {emoji}", "ഗുഡ് മോണിംഗ്, {name} {emoji}"],
  ["Good Morning, {name}", "ഗുഡ് മോണിംഗ്, {name}"],
  ["Good morning, {name}", "ഗുഡ് മോണിംഗ്, {name}"],
  ["Good Afternoon, {name}", "ഗുഡ് ആഫ്റ്റർനൂൺ, {name}"],
  ["Good Evening, {name}", "ഗുഡ് ഈവനിംഗ്, {name}"],
  ["Good morning, {name}. Complete your Daily Wellness Check...", "ഗുഡ് മോണിംഗ്, {name}. നിങ്ങളുടെ ഡെയ്‌ലി വെൽനെസ് ചെക്ക് പൂർത്തിയാക്കൂ..."],
  ["Good Morning, {name}. Complete your Daily Wellness Check...", "ഗുഡ് മോണിംഗ്, {name}. നിങ്ങളുടെ ഡെയ്‌ലി വെൽനെസ് ചെക്ക് പൂർത്തിയാക്കൂ..."],
  ["Today's task list: {count} pending tasks", "ഇന്നത്തെ ടാസ്ക് ലിസ്റ്റ്: {count} പെൻഡിംഗ് ടാസ്കുകൾ"],
  ["Welcome back, {name}", "തിരികെ സ്വാഗതം, {name}"]
]);

/**
 * Mask dynamic values from a greeting string or template string.
 * @param {string} text Input string
 * @returns {Object} { template, variables, isDynamic }
 */
export function extractDynamicTemplate(text) {
  if (!text || typeof text !== 'string') {
    return { template: text, variables: {}, isDynamic: false };
  }

  let template = text.trim();
  const variables = {};

  // 1. Extract Emoji (e.g. 👋, 😊, ☀️)
  const emojiMatch = template.match(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u);
  if (emojiMatch) {
    variables.emoji = emojiMatch[0];
    template = template.replace(emojiMatch[0], '{emoji}').trim();
  }

  // 2. Extract Person Names / Greetings (e.g. "Good Morning, Anjali", "Welcome back, Rahul")
  const greetingNameMatch = template.match(/^(Good Morning|Good morning|Good Afternoon|Good Evening|Welcome back|Hello|Hi)\s*,\s*([A-Za-z\s.]+?)(\s*\.|\s*👋|\s*\{emoji\}|$)/i);
  if (greetingNameMatch) {
    const rawName = greetingNameMatch[2].trim();
    if (rawName && !rawName.startsWith('{')) {
      variables.name = rawName;
      template = template.replace(greetingNameMatch[2], '{name}');
    }
  }

  // 3. Extract Task/Pending counts (e.g. "4 pending tasks", "10 completed")
  const countMatch = template.match(/\b(\d+)\b/);
  if (countMatch && !variables.count && template.includes('task')) {
    variables.count = countMatch[1];
    template = template.replace(countMatch[1], '{count}');
  }

  const isDynamic = Object.keys(variables).length > 0;
  return { template, variables, isDynamic };
}

/**
 * Check if localized template is in template cache.
 */
export function getCachedTemplateTranslation(template) {
  if (!template) return null;
  return TEMPLATE_CACHE.get(template.trim()) || null;
}

/**
 * Store a localized template into cache.
 */
export function cacheTemplateTranslation(template, translation) {
  if (template && translation) {
    TEMPLATE_CACHE.set(template.trim(), translation.trim());
  }
}

/**
 * Re-inject masked variables back into translated template.
 */
export function injectDynamicVariables(translatedTemplate, variables) {
  if (!translatedTemplate || !variables) return translatedTemplate;
  let result = translatedTemplate;

  for (const [key, val] of Object.entries(variables)) {
    result = result.replaceAll(`{${key}}`, val);
  }

  return result;
}

export default {
  extractDynamicTemplate,
  getCachedTemplateTranslation,
  cacheTemplateTranslation,
  injectDynamicVariables
};
