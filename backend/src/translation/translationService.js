import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { detectContext } from './contextDetector.js';
import { replaceGlossaryTerms } from './glossaryService.js';
import { transliterate } from './transliterator.js';
import { fixGrammar } from './malayalamGrammar.js';
import { refine } from './llmRefiner.js';
import { validateOfficeMalayalam } from '../../../shared/localization/validators/officeMalayalamValidator.js';
import { autoCorrectMalayalam } from './autoCorrector.js';
import cacheManager from './cacheManager.js';
import translationMemoryService from './translationMemoryService.js';
import phraseOverrideService from './phraseOverrideService.js';
import { translate, translateBatch } from './translator.js';
import { isProperEntity } from './properNameDetector.js';
import {
  extractDynamicTemplate,
  getCachedTemplateTranslation,
  cacheTemplateTranslation,
  injectDynamicVariables
} from './templateMasker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONTEXT_RULES_PATH = path.resolve(__dirname, '../../../shared/localization/styleguide/contextRules.json');
let contextRulesData = {};

const CACHE_VERSION = 'v2.1_office_malayalam';
let currentLanguage = 'ml';
let isInitialized = false;

// Priority 8 — Circuit Breaker for Groq
let groqConsecutiveFailures = 0;
let groqCircuitBreakerUntil = 0;

function recordGroqFailure() {
  groqConsecutiveFailures++;
  if (groqConsecutiveFailures >= 3) {
    groqCircuitBreakerUntil = Date.now() + 60000; // Disable Groq for 60 seconds
    console.warn('[CircuitBreaker] 3 consecutive Groq failures. Disabling Groq for 60 seconds.');
  }
}

function recordGroqSuccess() {
  groqConsecutiveFailures = 0;
}

function isGroqAvailable() {
  return Date.now() >= groqCircuitBreakerUntil;
}

const RESERVED_WORDS = new Set([
  'ok', 'cancel', 'yes', 'no', 'true', 'false', 'id', 'url', 'uri', 'api',
  'pdf', 'png', 'jpg', 'jpeg', 'svg', 'json', 'csv', 'xlsx', 'html', 'css',
  'js', 'http', 'https', 'get', 'post', 'put', 'delete', 'patch'
]);

export const TRANSLATABLE_FIELDS = new Set([
  'title', 'description', 'subject', 'category', 'status', 'summary',
  'heading', 'label', 'message', 'name', 'greeting', 'aiTip', 'action',
  'instructions', 'notes', 'actionItem', 'meetingType', 'location'
]);

export function setLanguage(lang) {
  if (lang === 'en' || lang === 'ml') {
    currentLanguage = lang;
  }
  return currentLanguage;
}

export function resolveLanguage(targetLangOrHeader) {
  if (!targetLangOrHeader) return currentLanguage;
  const normalized = String(targetLangOrHeader).toLowerCase().trim();
  if (normalized === 'en' || normalized.startsWith('en-')) {
    return 'en';
  }
  return 'ml';
}

/**
 * Priority 6 — Check if string contains mostly Malayalam script.
 */
export function isMalayalamText(str) {
  if (!str || typeof str !== 'string') return false;
  const trimmed = str.trim();
  if (!trimmed) return false;
  const mlCharCount = (trimmed.match(/[\u0D00-\u0D7F]/g) || []).length;
  return mlCharCount > 0 && (mlCharCount / trimmed.length) > 0.3;
}

export function needsTranslation(text) {
  if (!text || typeof text !== 'string') return false;
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (RESERVED_WORDS.has(trimmed.toLowerCase())) return false;
  if (/^[\d\s\-_.,!?:;"'()\[\]{}@#$%^&*+=/\\|<>`~]*$/.test(trimmed)) return false;
  if (/^https?:\/\//i.test(trimmed) || /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(trimmed)) return false;
  if (/^[0-9a-fA-F]{24}$/.test(trimmed)) return false;
  if (/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})?)?$/.test(trimmed)) return false;

  const strippedHtml = trimmed.replace(/<[^>]*>/g, '').trim();
  if (trimmed.includes('<') && trimmed.includes('>') && !strippedHtml) return false;

  return true;
}

function ensurePipelineDataLoaded() {
  if (isInitialized) return;
  try {
    translationMemoryService.load();
    phraseOverrideService.load();
    cacheManager.load();
    if (fs.existsSync(CONTEXT_RULES_PATH)) {
      try {
        contextRulesData = JSON.parse(fs.readFileSync(CONTEXT_RULES_PATH, 'utf-8'));
      } catch (e) {}
    }
    isInitialized = true;
  } catch (err) {
    console.warn('[Pipeline] Data preloading warning:', err.message);
  }
}

function getPhraseOverride(text) {
  return phraseOverrideService.lookup(text);
}

function applyContextRulesToSource(text, contextName) {
  if (!text || typeof text !== 'string') return text;
  const trimmed = text.trim();
  const ctxMap = contextRulesData[contextName] || contextRulesData['General'];
  if (ctxMap && ctxMap[trimmed]) {
    return ctxMap[trimmed];
  }
  return text;
}

function saveToTranslationMemory(english, translation, score, contextStr) {
  translationMemoryService.learn(english, translation, contextStr, score);
}

export const NON_TRANSLATABLE_CONTEXTS = new Set([
  'WellnessQuestion',
  'WellnessAssessment',
  'Questionnaire',
  'SurveyQuestion',
  'DailyCheckQuestion',
  'WellnessForm',
  'AssessmentPrompt',
  'WellnessOption',
  'WellnessPrompt'
]);

export const TRANSLATABLE_WELLNESS_MESSAGES = new Set([
  'Would you like to complete your Daily Wellness Check? It takes less than one minute and helps personalize your AI recommendations.',
  'Would you like to complete your Daily Wellness Check?',
  'It takes less than one minute and helps personalize your AI recommendations.'
]);

export function shouldTranslate(text, context = {}) {
  if (!text || typeof text !== 'string') return false;
  const trimmed = text.trim();

  // 1. Check non-translatable contexts
  const ctxName = context.category || context.component || context.contextName;
  if (ctxName && NON_TRANSLATABLE_CONTEXTS.has(ctxName)) {
    return false;
  }

  // 2. Wellness Module Guard: Allow ONLY static UI description messages
  const endpoint = (context.endpoint || '').toLowerCase();
  const category = (context.category || '').toLowerCase();
  const key = (context.key || '').toLowerCase();

  const isWellness = endpoint.includes('/api/wellness') ||
                     category.includes('wellness') ||
                     category.includes('questionnaire') ||
                     key.includes('wellness');

  if (isWellness) {
    if (!TRANSLATABLE_WELLNESS_MESSAGES.has(trimmed)) {
      return false;
    }
  }

  return true;
}

/**
 * Main translation function orchestrating the Office Malayalam v2 Optimized Pipeline.
 * Priority 5 — Never throws errors; always returns string fallback on failure.
 */
export async function translateToMalayalam(text, context = {}) {
  try {
    if (!text || typeof text !== 'string' || !text.trim()) {
      return text || '';
    }

    const targetLang = resolveLanguage(context.targetLang);
    if (targetLang !== 'ml') {
      return text;
    }

    // Daily Wellness Filter & Non-translatable context check
    if (!shouldTranslate(text, context)) {
      return text;
    }

    // Priority 6 — Skip recursive translation of already translated Malayalam text
    if (isMalayalamText(text) || !needsTranslation(text) || isProperEntity(text)) {
      return text;
    }

    ensurePipelineDataLoaded();

    // Priority 3 & 4 — Dynamic Greeting & Template Masking Integration
    const { template, variables, isDynamic } = extractDynamicTemplate(text);
    if (isDynamic) {
      const cachedTemplate = getCachedTemplateTranslation(template);
      if (cachedTemplate) {
        if (!context.suppressLogs) console.log(`[TEMPLATE HIT] ${template} -> ${cachedTemplate}`);
        return injectDynamicVariables(cachedTemplate, variables);
      }
    }

    const detectedContext = detectContext(text, context);
    const contextName = detectedContext.category || detectedContext.component || 'General';
    const category = detectedContext.category;
    const component = detectedContext.component;

    // Step 1: Intelligent Translation Memory Lookup (Immediate Return < 1ms)
    const tmRecord = translationMemoryService.lookup(text, contextName);
    if (tmRecord && tmRecord.translation) {
      if (isDynamic) cacheTemplateTranslation(template, tmRecord.translation);
      if (!context.suppressLogs) console.log(`[TM HIT] ${contextName} -> ${text}`);
      return tmRecord.translation;
    }

    // Step 2: Phrase Overrides Check (Immediate Return < 1ms)
    const phraseMatch = getPhraseOverride(text);
    if (phraseMatch) {
      translationMemoryService.learn(text, phraseMatch, contextName, 100);
      if (isDynamic) cacheTemplateTranslation(template, phraseMatch);
      if (!context.suppressLogs) console.log(`[PHRASE HIT] ${contextName} -> ${text}`);
      return phraseMatch;
    }

    // Step 3: Context Rules Check (Immediate Return < 1ms)
    const contextRuleText = applyContextRulesToSource(text, contextName);
    if (contextRuleText !== text) {
      translationMemoryService.learn(text, contextRuleText, contextName, 95);
      if (isDynamic) cacheTemplateTranslation(template, contextRuleText);
      if (!context.suppressLogs) console.log(`[CONTEXT RULE HIT] ${contextName} -> ${text}`);
      return contextRuleText;
    }

    // Step 4: Main Cache Lookup
    const cachedRecord = cacheManager.get(text, category, component);
    if (cachedRecord && cachedRecord.translation) {
      translationMemoryService.learn(text, cachedRecord.translation, 95, contextName);
      if (isDynamic) cacheTemplateTranslation(template, cachedRecord.translation);
      if (!context.suppressLogs) console.log(`[CACHE HIT] ${contextName} -> ${text}`);
      return cachedRecord.translation;
    }

    // Priority 8 — Check Groq Circuit Breaker
    if (!isGroqAvailable()) {
      if (!context.suppressLogs) console.log(`[CIRCUIT BREAKER] Groq disabled. Returning English fallback for "${text}"`);
      return text;
    }

    // Step 5: Groq Translation
    let rawTranslation = text;
    try {
      rawTranslation = await translate(text, { context: detectedContext, retries: 1 });
      if (rawTranslation !== text) {
        recordGroqSuccess();
      }
    } catch (err) {
      recordGroqFailure();
      console.warn(`[Pipeline] Groq API warning for "${text}":`, err.message);
      return text; // Graceful fallback
    }

    // Step 6: Government Glossary Override
    const glossaryResult = replaceGlossaryTerms(rawTranslation, { category });

    // Step 7: Technical Transliteration
    const transliteratedResult = await transliterate(glossaryResult);

    // Step 8: Malayalam Grammar Engine
    const grammarRes = fixGrammar(transliteratedResult, { category });
    let currentTranslation = grammarRes.text;

    // Step 9: Validation & Auto Correction
    const autoCorrRes = autoCorrectMalayalam(currentTranslation, contextName, text);
    const correctedTranslation = autoCorrRes.repairedText;

    const valPass = validateOfficeMalayalam({ source: text, translation: correctedTranslation, context: contextName, suppressLogs: true });
    const finalScore = valPass.overall;

    // Priority 1 & 2 — Optional Best-Effort LLM Refiner for Low Confidence Translations ONLY
    if (finalScore < 95 && isGroqAvailable()) {
      try {
        const refined = await refine(correctedTranslation, { englishOriginal: text, category }, { retries: 1 });
        if (refined && refined !== correctedTranslation) {
          currentTranslation = refined;
        }
      } catch (refinerErr) {
        console.warn(`[Pipeline] Optional refinement skipped for "${text}":`, refinerErr.message);
      }
    }

    // Step 10: Learn High Scoring Translation
    if (finalScore >= 95) {
      saveToTranslationMemory(text, correctedTranslation, finalScore, contextName);
    }
    if (isDynamic) {
      cacheTemplateTranslation(template, correctedTranslation);
    }

    if (!context.suppressLogs) console.log(`[GROQ SUCCESS] ${contextName} -> ${text}`);
    return correctedTranslation;

  } catch (globalErr) {
    // Priority 5 — Never fail because of localization
    console.warn(`[Localization Shield] Exception caught for "${text}":`, globalErr.message);
    return text;
  }
}

/**
 * Priority 7 — Batch Response Translation for Object Payloads & Arrays.
 * Collects untranslated strings into a single batch Groq API request.
 */
export async function translateResponse(data, targetLangOrHeader = 'ml', endpoint = null) {
  try {
    const targetLang = resolveLanguage(targetLangOrHeader);
    if (targetLang !== 'ml' || data === null || data === undefined) {
      return data;
    }

    if (typeof data === 'string') {
      if (needsTranslation(data)) {
        return await translateToMalayalam(data, { targetLang, endpoint });
      }
      return data;
    }

    if (typeof data !== 'object') {
      return data;
    }

    if (Array.isArray(data)) {
      const results = [];
      for (const item of data) {
        results.push(await translateResponse(item, targetLang, endpoint));
      }
      return results;
    }

    if (data instanceof Date || data._bsontype || (data.constructor && data.constructor.name !== 'Object')) {
      return data;
    }

    const translatedObj = { ...data };
    const untranslatedKeys = [];
    const untranslatedValues = [];

    // Phase 1: Fast in-memory resolution (TM, Phrase Overrides, Context Rules)
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string') {
        if (!shouldTranslate(value, { category: key, endpoint })) {
          translatedObj[key] = value;
          continue;
        }
        if (TRANSLATABLE_FIELDS.has(key) || needsTranslation(value)) {
          if (isMalayalamText(value) || isProperEntity(value)) {
            translatedObj[key] = value;
          } else {
            // Instant TM / Phrase lookup check
            const detected = detectContext(value, { category: key, endpoint });
            const ctxName = detected.category || 'General';
            const tmRec = translationMemoryService.lookup(value, ctxName);
            const overrideMatch = phraseOverrideService.lookup(value);

            if (tmRec && tmRec.translation) {
              translatedObj[key] = tmRec.translation;
            } else if (overrideMatch) {
              translatedObj[key] = overrideMatch;
              translationMemoryService.learn(value, overrideMatch, ctxName, 100);
            } else {
              untranslatedKeys.push(key);
              untranslatedValues.push(value);
            }
          }
        }
      } else if (typeof value === 'object' && value !== null) {
        translatedObj[key] = await translateResponse(value, targetLang, endpoint);
      }
    }

    // Phase 2: Batch Groq Translation for remaining untranslated strings
    if (untranslatedValues.length > 0 && isGroqAvailable()) {
      try {
        const batchResults = await translateBatch(untranslatedValues, { suppressLogs: true });
        if (Array.isArray(batchResults) && batchResults.length === untranslatedValues.length) {
          untranslatedKeys.forEach((k, idx) => {
            const translatedVal = batchResults[idx];
            translatedObj[k] = translatedVal;
            if (translatedVal && translatedVal !== untranslatedValues[idx]) {
              saveToTranslationMemory(untranslatedValues[idx], translatedVal, 95, k);
            }
          });
        }
      } catch (batchErr) {
        console.warn(`[translateResponse Batch Warning] ${batchErr.message}`);
      }
    }

    return translatedObj;

  } catch (err) {
    // Priority 5 & 10 — Localization shield
    console.warn(`[translateResponse Shield] Fallback to raw data:`, err.message);
    return data;
  }
}

export default {
  translateToMalayalam,
  translateResponse,
  setLanguage,
  resolveLanguage,
  needsTranslation,
  isMalayalamText,
  TRANSLATABLE_FIELDS
};