import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from '../../../backend/node_modules/dotenv/lib/main.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure process.env is populated from backend/.env
dotenv.config({ path: path.resolve(__dirname, '../../../backend/.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

import { loadGlossary } from '../../../backend/src/translation/glossaryService.js';
import { detectContext } from '../../../backend/src/translation/contextDetector.js';
import { cacheManager, CACHE_VERSION } from '../../../backend/src/translation/cacheManager.js';
import { runTranslationQA } from '../validators/translationValidator.js';
import {
  setLanguage,
  translateToMalayalam
} from '../../../backend/src/translation/translationService.js';

// NOTE ON THIS REWRITE:
// This script previously ran its OWN translation pipeline (translate ->
// replaceGlossaryTerms -> transliterate -> refine) and its OWN cache file
// format (`{ version, translations: { english: malayalam } }`), completely
// separate from cacheManager.js / translateToMalayalam(), which is what the
// live app actually uses at request time. The two caches drifted: entries
// written by one were invisible/invalid to the other (missing cacheVersion,
// wrong data shape), so this batch script was silently re-translating
// strings the live service had already cached correctly, and vice versa.
//
// Fix: this script now calls the exact same translateToMalayalam() pipeline
// the live app uses, so both paths read/write the one cacheManager-backed
// cache file with a consistent schema and CACHE_VERSION going forward.

// Relative paths
const ROOT_DIR = path.resolve(__dirname, '../../../');
const EN_JSON_PATH = path.join(ROOT_DIR, 'frontend/src/locales/en.json');
const ML_GENERATED_PATH = path.join(ROOT_DIR, 'frontend/src/locales/ml.generated.json');
const ML_FALLBACK_PATH = path.join(ROOT_DIR, 'frontend/src/locales/ml.json');
const CACHE_DIR = path.join(ROOT_DIR, 'shared/localization/cache');
const REPORT_FILE_PATH = path.join(CACHE_DIR, 'translation_report.json');

// Command line option detection (--sample dry-run mode)
const IS_SAMPLE_MODE = process.argv.includes('--sample');
const VERBOSE = process.argv.includes('--verbose');
const SAMPLE_LIMIT = 20;

// Ensure cache directory exists (cacheManager also does this, but keep for
// the report file write below)
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function flattenObject(obj, prefix = '', result = {}) {
  for (const key of Object.keys(obj)) {
    const propName = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      flattenObject(obj[key], propName, result);
    } else {
      result[propName] = obj[key];
    }
  }
  return result;
}

function unflattenObject(flatObj) {
  const result = {};
  for (const keyPath of Object.keys(flatObj)) {
    const keys = keyPath.split('.');
    let current = result;
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (i === keys.length - 1) {
        current[k] = flatObj[keyPath];
      } else {
        if (!current[k] || typeof current[k] !== 'object') {
          current[k] = {};
        }
        current = current[k];
      }
    }
  }
  return result;
}

function validateTranslation(originalStr, translatedStr, keyPath) {
  if (typeof originalStr !== 'string' || typeof translatedStr !== 'string') {
    return { valid: true, placeholderError: false, validationError: false };
  }

  let placeholderError = false;
  let validationError = false;
  let reason = '';

  if (!translatedStr.trim()) {
    validationError = true;
    reason = `Empty translation for key '${keyPath}'`;
    return { valid: false, placeholderError, validationError, reason };
  }

  const origPlaceholders = originalStr.match(/(\{\{[^}]+\}\}|\{[^}]+\}|%s|%d)/g) || [];
  const transPlaceholders = translatedStr.match(/(\{\{[^}]+\}\}|\{[^}]+\}|%s|%d)/g) || [];

  for (const p of origPlaceholders) {
    if (!transPlaceholders.includes(p)) {
      placeholderError = true;
      reason = `Missing placeholder '${p}' in translation for key '${keyPath}'`;
      break;
    }
  }

  const origTags = originalStr.match(/<[^>]+>/g) || [];
  const transTags = translatedStr.match(/<[^>]+>/g) || [];
  if (origTags.length !== transTags.length) {
    validationError = true;
    reason = `Mismatched HTML tags count in translation for key '${keyPath}'`;
  }

  return { valid: !placeholderError && !validationError, placeholderError, validationError, reason };
}

function detectRemainingEnglish(text) {
  if (typeof text !== 'string') return [];

  const clean = text
    .replace(/(\{\{[^}]+\}\}|\{[^}]+\}|%s|%d|<[^>]+>|https?:\/\/\S+)/g, ' ')
    .replace(/[0-9]/g, ' ');

  const matches = clean.match(/\b[A-Za-z]{3,}\b/g) || [];
  return matches.filter(w => !/^(http|https|pdf|url|id|app|css|html|js|json)$/i.test(w));
}

export async function runTranslationPipeline() {
  const startTime = Date.now();

  console.log('Reading en.json...');
  if (!fs.existsSync(EN_JSON_PATH)) {
    throw new Error(`Source locale file not found at: ${EN_JSON_PATH}`);
  }

  const enRaw = fs.readFileSync(EN_JSON_PATH, 'utf-8');
  const enObj = JSON.parse(enRaw);

  console.log('Flattening...');
  loadGlossary();
  setLanguage('ml');

  const flatEn = flattenObject(enObj);
  const totalEnglishKeys = Object.keys(flatEn).length;

  const uniqueStringsMap = new Map();
  for (const [keyPath, val] of Object.entries(flatEn)) {
    if (typeof val === 'string') {
      if (!uniqueStringsMap.has(val)) {
        uniqueStringsMap.set(val, []);
      }
      uniqueStringsMap.get(val).push(keyPath);
    }
  }

  let uniqueEntries = Array.from(uniqueStringsMap.entries());

  if (IS_SAMPLE_MODE) {
    console.log(`[Dry Run Mode] --sample flag detected. Limiting execution to first ${SAMPLE_LIMIT} unique strings.`);
    uniqueEntries = uniqueEntries.slice(0, SAMPLE_LIMIT);
  }

  const uniqueStringsCount = uniqueEntries.length;
  console.log(`Unique Strings: ${uniqueStringsCount}`);

  let cacheHits = 0;
  let groqCalls = 0;
  let glossaryOverridesCount = 0;
  let refinedCount = 0;
  let placeholderErrorCount = 0;
  let validationErrorCount = 0;
  let qaFailedCount = 0;

  const translatedFlatMap = {};
  const remainingEnglishSet = new Set();

  console.log('Translating via shared translationService pipeline (cache-aware)...');

  for (let i = 0; i < uniqueEntries.length; i++) {
    const [englishStr, keyPaths] = uniqueEntries[i];

    // Same context detection the live service uses, so the cache key here
    // matches the cache key translateToMalayalam() will look up internally.
    const detectedContext = detectContext(englishStr);
    const category = detectedContext.category;
    const component = detectedContext.component;

    const preExisting = cacheManager.get(englishStr, category, component);
    const wasCacheHit = !!(preExisting && preExisting.translation);

    const finalMalayalam = await translateToMalayalam(englishStr, {
      targetLang: 'ml',
      category,
      component,
      suppressLogs: !VERBOSE
    });

    if (wasCacheHit) {
      cacheHits++;
    } else {
      groqCalls++;
    }

    // Read back the authoritative cache record translateToMalayalam() just
    // wrote (or confirmed), so reporting reflects real pipeline state
    // instead of a second, locally-duplicated set of stats.
    const record = cacheManager.get(englishStr, category, component);
    if (record) {
      if (record.glossaryApplied) glossaryOverridesCount++;
      if (record.refinementApplied) refinedCount++;
      if (record.qaPassed === false) qaFailedCount++;
    }

    for (const kp of keyPaths) {
      const valRes = validateTranslation(englishStr, finalMalayalam, kp);
      if (valRes.placeholderError) placeholderErrorCount++;
      if (valRes.validationError) validationErrorCount++;
      translatedFlatMap[kp] = finalMalayalam;
    }

    const unhandledEnglish = detectRemainingEnglish(finalMalayalam);
    for (const w of unhandledEnglish) {
      remainingEnglishSet.add(w);
    }
  }

  console.log('Writing ml.generated.json...');

  // No manual cache save needed -- cacheManager.persist() is called by
  // translateToMalayalam() via cacheManager.set() on every miss/repair.

  const mlNestedObj = unflattenObject(translatedFlatMap);
  fs.writeFileSync(ML_GENERATED_PATH, JSON.stringify(mlNestedObj, null, 2), 'utf-8');
  fs.writeFileSync(ML_FALLBACK_PATH, JSON.stringify(mlNestedObj, null, 2), 'utf-8');

  const executionTimeSec = ((Date.now() - startTime) / 1000).toFixed(2);
  const remainingEnglishArray = Array.from(remainingEnglishSet);

  const reportData = {
    timestamp: new Date().toISOString(),
    isSampleMode: IS_SAMPLE_MODE,
    cacheVersion: CACHE_VERSION,
    metrics: {
      englishKeys: totalEnglishKeys,
      uniqueStrings: uniqueStringsCount,
      translated: groqCalls + cacheHits,
      cacheHits,
      groqCalls,
      glossaryOverrides: glossaryOverridesCount,
      refined: refinedCount,
      qaFailed: qaFailedCount,
      remainingEnglish: remainingEnglishArray.length,
      placeholderErrors: placeholderErrorCount,
      validationErrors: validationErrorCount,
      executionTimeSeconds: parseFloat(executionTimeSec)
    },
    remainingEnglishWords: remainingEnglishArray,
    outputFile: 'frontend/src/locales/ml.generated.json'
  };

  fs.writeFileSync(REPORT_FILE_PATH, JSON.stringify(reportData, null, 2), 'utf-8');

  console.log('\n======================================');
  console.log('K-SMART CARE Malayalam Generator Report');
  console.log('======================================');
  console.log(`English Keys           : ${totalEnglishKeys}`);
  console.log(`Unique Strings         : ${uniqueStringsCount}`);
  console.log(`Translated             : ${groqCalls + cacheHits}`);
  console.log(`Cache Hits             : ${cacheHits}`);
  console.log(`Groq Calls             : ${groqCalls}`);
  console.log(`Glossary Overrides     : ${glossaryOverridesCount}`);
  console.log(`Refined                : ${refinedCount}`);
  console.log(`QA Failed (needs review): ${qaFailedCount}`);
  console.log(`Remaining English      : ${remainingEnglishArray.length}`);
  console.log(`Placeholder Errors     : ${placeholderErrorCount}`);
  console.log(`Validation Errors      : ${validationErrorCount}`);
  console.log(`Execution Time         : ${executionTimeSec}s`);
  console.log('\nOutput File:');
  console.log('frontend/src/locales/ml.generated.json');

  if (!process.env.GROQ_API_KEY) {
    console.warn('\n[CI/Build Alert] GROQ_API_KEY is not set in environment! Any cache misses will fall back to glossary/grammar-only text.');
  }
  if (remainingEnglishArray.length > 0 && groqCalls === 0 && cacheHits < uniqueStringsCount) {
    console.warn('[CI/Build Alert] Remaining English words detected with 0 Groq calls made. Check API key and cache miss logic!');
  }
  if (qaFailedCount > 0) {
    console.warn(`[Manual Review] ${qaFailedCount} strings failed structural QA even after retry. Check translation_report.json / cache records with qaPassed:false.`);
  }

  console.log('Done\n');

  // Automatically execute Translation QA Audit at the end of translation generation
  console.log('Running Automatic QA Audit...');
  await runTranslationQA();
}

// Execute when run via Node CLI
runTranslationPipeline().catch(err => {
  console.error('\n[Generator Fatal Error]:', err.message);
  process.exit(1);
});