import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { detectEnglishAndMixedLanguage } from './englishDetector.js';
import { validatePlaceholders } from './placeholderValidator.js';
import { validateHtml } from './htmlValidator.js';
import { analyzeGlossaryCoverage } from './glossaryCoverage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, '../../../');
const EN_JSON_PATH = path.join(ROOT_DIR, 'frontend/src/locales/en.json');
const ML_GENERATED_PATH = path.join(ROOT_DIR, 'frontend/src/locales/ml.generated.json');
const REPORT_DIR = path.join(ROOT_DIR, 'shared/localization/reports');
const REPORT_FILE_PATH = path.join(REPORT_DIR, 'translation-report.json');

// Ensure reports directory exists
if (!fs.existsSync(REPORT_DIR)) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
}

/**
 * Helper to flatten a nested object into dot-notation key paths.
 */
function flattenObject(obj, prefix = '', result = {}) {
  if (!obj || typeof obj !== 'object') return result;
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

/**
 * Main Translation QA & Validation Engine.
 * Analyzes en.json vs ml.generated.json without modifying any translation files.
 */
export async function runTranslationQA() {
  const startTime = Date.now();

  if (!fs.existsSync(EN_JSON_PATH)) {
    throw new Error(`en.json not found at ${EN_JSON_PATH}`);
  }
  if (!fs.existsSync(ML_GENERATED_PATH)) {
    throw new Error(`ml.generated.json not found at ${ML_GENERATED_PATH}`);
  }

  const enRaw = fs.readFileSync(EN_JSON_PATH, 'utf-8');
  const mlRaw = fs.readFileSync(ML_GENERATED_PATH, 'utf-8');

  const enObj = JSON.parse(enRaw);
  const mlObj = JSON.parse(mlRaw);

  const flatEn = flattenObject(enObj);
  const flatMl = flattenObject(mlObj);

  const totalKeys = Object.keys(flatEn).length;

  const allIssues = [];

  // Metrics Counters
  let remainingEnglishCount = 0;
  let mixedLanguageCount = 0;
  let placeholderErrorCount = 0;
  let htmlErrorCount = 0;
  let missingKeysCount = 0;
  let emptyTranslationCount = 0;
  let duplicateTranslationCount = 0;

  // -------------------------------------------------------------
  // Validator Check 6 & 5: Key Hierarchy & Empty Translation Check
  // -------------------------------------------------------------
  const enKeys = new Set(Object.keys(flatEn));
  const mlKeys = new Set(Object.keys(flatMl));

  for (const key of enKeys) {
    if (!mlKeys.has(key)) {
      missingKeysCount++;
      allIssues.push({
        key,
        severity: 'High',
        type: 'Missing Key',
        english: flatEn[key],
        translated: '',
        details: `Key '${key}' is present in en.json but missing from ml.generated.json`
      });
      continue;
    }

    const valMl = flatMl[key];

    // Validator 5: Empty Translation check
    if (valMl === null || valMl === undefined || (typeof valMl === 'string' && !valMl.trim())) {
      emptyTranslationCount++;
      allIssues.push({
        key,
        severity: 'High',
        type: 'Empty Translation',
        english: flatEn[key],
        translated: String(valMl),
        details: `Translation value is empty, null, or undefined`
      });
    }
  }

  // Check extra keys in ml.generated.json
  for (const key of mlKeys) {
    if (!enKeys.has(key)) {
      missingKeysCount++;
      allIssues.push({
        key,
        severity: 'High',
        type: 'Extra Key',
        english: '',
        translated: flatMl[key],
        details: `Key '${key}' exists in ml.generated.json but not in en.json`
      });
    }
  }

  // -------------------------------------------------------------
  // Validator Check 7: Duplicate Translation Detector
  // -------------------------------------------------------------
  const reverseMap = new Map(); // Malayalam text -> array of English strings
  for (const [key, val] of Object.entries(flatMl)) {
    if (typeof val === 'string' && val.trim()) {
      if (!reverseMap.has(val)) {
        reverseMap.set(val, []);
      }
      reverseMap.get(val).push({ key, english: flatEn[key] });
    }
  }

  for (const [mlText, sources] of reverseMap.entries()) {
    // Unique english strings mapping to this same Malayalam text
    const uniqueEnglish = Array.from(new Set(sources.map(s => s.english)));
    if (uniqueEnglish.length >= 3) {
      duplicateTranslationCount++;
      for (const src of sources) {
        allIssues.push({
          key: src.key,
          severity: 'Low',
          type: 'Duplicate Translation',
          english: src.english,
          translated: mlText,
          details: `Same Malayalam translation ("${mlText}") shared across ${uniqueEnglish.length} distinct English terms: [${uniqueEnglish.slice(0, 4).join(', ')}]`
        });
      }
    }
  }

  // -------------------------------------------------------------
  // Validators 1, 2, 3, 4: Language, Placeholder & HTML Validators
  // -------------------------------------------------------------
  for (const [key, englishVal] of Object.entries(flatEn)) {
    const mlVal = flatMl[key];
    if (typeof englishVal !== 'string' || typeof mlVal !== 'string') continue;

    // Validator 1 & 2: English & Mixed Language Detector
    const langIssues = detectEnglishAndMixedLanguage(englishVal, mlVal, key);
    for (const issue of langIssues) {
      if (issue.type === 'Remaining English') remainingEnglishCount++;
      if (issue.type === 'Mixed Language') mixedLanguageCount++;
      allIssues.push(issue);
    }

    // Validator 3: Placeholder Validator
    const placeholderIssues = validatePlaceholders(englishVal, mlVal, key);
    for (const issue of placeholderIssues) {
      placeholderErrorCount++;
      allIssues.push(issue);
    }

    // Validator 4: HTML Validator
    const htmlIssues = validateHtml(englishVal, mlVal, key);
    for (const issue of htmlIssues) {
      htmlErrorCount++;
      allIssues.push(issue);
    }
  }

  // -------------------------------------------------------------
  // Validator 8: Glossary Coverage Analyzer
  // -------------------------------------------------------------
  const glossaryAnalysis = analyzeGlossaryCoverage(flatEn, flatMl);
  for (const suggestion of glossaryAnalysis.glossarySuggestions) {
    allIssues.push(suggestion);
  }

  // -------------------------------------------------------------
  // Classification & Severity Aggregation
  // -------------------------------------------------------------
  let criticalCount = 0;
  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;

  for (const issue of allIssues) {
    if (issue.severity === 'Critical') criticalCount++;
    else if (issue.severity === 'High') highCount++;
    else if (issue.severity === 'Medium') mediumCount++;
    else lowCount++;
  }

  const errorsCount = criticalCount + highCount;
  const warningsCount = mediumCount + lowCount;
  const passedCount = Math.max(0, totalKeys - errorsCount);

  // -------------------------------------------------------------
  // Actionable Recommendations Engine
  // -------------------------------------------------------------
  const recommendations = [];

  // Extract unique unhandled English terms
  const unhandledEnglishWords = new Set();
  for (const issue of allIssues) {
    if (issue.type === 'Remaining English' || issue.type === 'Mixed Language') {
      const words = (issue.english.match(/\b[A-Za-z]{3,}\b/g) || []);
      for (const w of words) unhandledEnglishWords.add(w);
    }
  }

  const wordList = Array.from(unhandledEnglishWords);
  if (wordList.includes('Workspace')) recommendations.push('Add "Workspace" to government glossary.');
  if (wordList.includes('Repository')) recommendations.push('Add "Repository" to transliteration dictionary.');
  if (wordList.includes('Generated')) recommendations.push('Improve Groq translation prompt for "Generated".');

  if (remainingEnglishCount > 0) {
    recommendations.push(`${remainingEnglishCount} strings contain un-translated English words requiring review.`);
  }
  if (duplicateTranslationCount > 0) {
    recommendations.push(`${duplicateTranslationCount} duplicated translation clusters should be verified for contextual precision.`);
  }
  if (glossaryAnalysis.coveragePercentage < 90) {
    recommendations.push(`Glossary coverage is at ${glossaryAnalysis.coveragePercentage}%. Expand government glossary for remaining terms.`);
  }
  if (recommendations.length === 0) {
    recommendations.push('All localization quality checks passed cleanly! Translation dataset is production-ready.');
  }

  const executionTimeSec = parseFloat(((Date.now() - startTime) / 1000).toFixed(2));

  // Build JSON Report
  const qaReport = {
    timestamp: new Date().toISOString(),
    summary: {
      totalKeys,
      validated: totalKeys,
      passed: passedCount,
      warnings: warningsCount,
      errors: errorsCount,
      criticalErrors: criticalCount,
      highErrors: highCount,
      mediumWarnings: mediumCount,
      lowWarnings: lowCount
    },
    metrics: {
      remainingEnglish: remainingEnglishCount,
      mixedLanguage: mixedLanguageCount,
      placeholderErrors: placeholderErrorCount,
      htmlErrors: htmlErrorCount,
      missingKeys: missingKeysCount,
      emptyTranslations: emptyTranslationCount,
      duplicateTranslations: duplicateTranslationCount,
      glossaryCoveragePercentage: glossaryAnalysis.coveragePercentage,
      glossaryEntriesTotal: glossaryAnalysis.totalEntries,
      glossaryEntriesUsed: glossaryAnalysis.usedEntriesCount,
      executionTimeSeconds: executionTimeSec
    },
    recommendations,
    issues: allIssues
  };

  // Write translation-report.json
  fs.writeFileSync(REPORT_FILE_PATH, JSON.stringify(qaReport, null, 2), 'utf-8');

  // Console Report Printing
  console.log('\n====================================');
  console.log('K-SMART CARE Translation QA Report');
  console.log('====================================');
  console.log(`Total Keys              : ${totalKeys}`);
  console.log(`Passed                  : ${passedCount}`);
  console.log(`Warnings                : ${warningsCount}`);
  console.log(`Errors                  : ${errorsCount}`);
  console.log(`Remaining English       : ${remainingEnglishCount}`);
  console.log(`Mixed Language          : ${mixedLanguageCount}`);
  console.log(`Placeholder Errors      : ${placeholderErrorCount}`);
  console.log(`HTML Errors             : ${htmlErrorCount}`);
  console.log(`Missing Keys            : ${missingKeysCount}`);
  console.log(`Duplicate Translations  : ${duplicateTranslationCount}`);
  console.log(`Glossary Coverage       : ${glossaryAnalysis.coveragePercentage}%`);
  console.log(`Execution Time          : ${executionTimeSec} sec`);
  console.log('\nReport Written:');
  console.log('shared/localization/reports/translation-report.json\n');

  return qaReport;
}

// Execute directly if run via CLI
if (process.argv[1] && process.argv[1].endsWith('translationValidator.js')) {
  runTranslationQA().catch(err => {
    console.error('[QA Fatal Error]:', err.message);
    process.exit(1);
  });
}

export default {
  runTranslationQA
};
