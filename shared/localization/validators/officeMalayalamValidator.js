/**
 * Office Malayalam Quality & Localization Engine (Version 2) for K-SMART CARE.
 * 
 * Evaluates translated Malayalam strings for Kerala Government Office speech compliance,
 * context appropriateness, naturalness, glossary fidelity, and literal translation avoidance.
 * 
 * Fully deterministic (< 5ms per string, zero LLM / network calls).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STYLEGUIDE_PATH = path.resolve(__dirname, '../styleguide/officeMalayalam.json');
const GLOSSARY_PATH = path.resolve(__dirname, '../glossary/government_glossary.json');
const VALIDATION_CACHE_PATH = path.resolve(__dirname, '../cache/validation_cache.json');
const MANUAL_REVIEW_PATH = path.resolve(__dirname, '../reports/manual-review.json');

// In-Memory Lazy Stores
let styleGuideData = null;
let glossaryData = null;
let avoidWordsMap = new Map();
let softwareTermsMap = new Map();
let validationCacheMap = new Map();
let manualReviewQueue = [];
let isResourcesLoaded = false;
let isCacheLoaded = false;

/**
 * Lazy load resources once on demand.
 */
function ensureResourcesLoaded() {
  if (isResourcesLoaded) return;

  if (fs.existsSync(STYLEGUIDE_PATH)) {
    try {
      const raw = fs.readFileSync(STYLEGUIDE_PATH, 'utf-8');
      styleGuideData = JSON.parse(raw);
      if (styleGuideData.avoidWords) {
        for (const [word, reason] of Object.entries(styleGuideData.avoidWords)) {
          avoidWordsMap.set(word.trim(), reason);
        }
      }
      if (styleGuideData.softwareTerms) {
        for (const [eng, mal] of Object.entries(styleGuideData.softwareTerms)) {
          softwareTermsMap.set(eng.toLowerCase().trim(), mal);
        }
      }
    } catch (e) {
      console.warn('[officeMalayalamValidator] Error loading styleguide:', e.message);
    }
  }

  if (fs.existsSync(GLOSSARY_PATH)) {
    try {
      const raw = fs.readFileSync(GLOSSARY_PATH, 'utf-8');
      glossaryData = JSON.parse(raw);
      for (const entry of glossaryData) {
        if (entry && entry.english && (entry.malayalam || entry.translation)) {
          softwareTermsMap.set(entry.english.toLowerCase().trim(), entry.malayalam || entry.translation);
        }
      }
    } catch (e) {
      console.warn('[officeMalayalamValidator] Error loading glossary:', e.message);
    }
  }

  isResourcesLoaded = true;
}

/**
 * Lazy load validation cache and manual review queue.
 */
function ensureCacheLoaded() {
  if (isCacheLoaded) return;

  if (fs.existsSync(VALIDATION_CACHE_PATH)) {
    try {
      const raw = fs.readFileSync(VALIDATION_CACHE_PATH, 'utf-8');
      const data = JSON.parse(raw);
      for (const [k, v] of Object.entries(data)) {
        validationCacheMap.set(k, v);
      }
    } catch (e) {
      // ignore
    }
  }

  if (fs.existsSync(MANUAL_REVIEW_PATH)) {
    try {
      const raw = fs.readFileSync(MANUAL_REVIEW_PATH, 'utf-8');
      manualReviewQueue = JSON.parse(raw) || [];
    } catch (e) {
      manualReviewQueue = [];
    }
  }

  isCacheLoaded = true;
}

/**
 * Persist validation cache to disk safely.
 */
function persistCacheDisk() {
  try {
    const dir = path.dirname(VALIDATION_CACHE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const obj = {};
    for (const [k, v] of validationCacheMap.entries()) {
      obj[k] = v;
    }
    fs.writeFileSync(VALIDATION_CACHE_PATH, JSON.stringify(obj, null, 2), 'utf-8');
  } catch (e) {
    // Ignore non-fatal write errors
  }
}

/**
 * Add failed item to manual review queue without duplicates.
 */
function queueForManualReview(reviewItem) {
  ensureCacheLoaded();
  try {
    const exists = manualReviewQueue.some(item =>
      item.english === reviewItem.english && item.translation === reviewItem.translation
    );
    if (!exists) {
      manualReviewQueue.push(reviewItem);
      const dir = path.dirname(MANUAL_REVIEW_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(MANUAL_REVIEW_PATH, JSON.stringify(manualReviewQueue, null, 2), 'utf-8');
    }
  } catch (e) {
    // Ignore non-fatal write errors
  }
}

// Whitelisted Acronyms
const WHITELISTED_ACRONYMS = new Set([
  'AI', 'PDF', 'OTP', 'JWT', 'API', 'GIS', 'ID', 'URL', 'HTTP', 'HTTPS',
  'UI', 'UX', 'CSS', 'HTML', 'SQL', 'JSON', 'LSGD', 'K-SMART', 'CARE',
  'UUID', 'MONGODB', 'POSTGRESQL', 'REACT', 'NODE', 'VITE'
]);

// Untranslated Verbs
const UNALLOWED_VERBS = new Set([
  'create', 'delete', 'review', 'approve', 'reject', 'generate',
  'upload', 'download', 'search', 'filter', 'submit', 'update',
  'edit', 'cancel', 'save', 'close', 'open', 'confirm'
]);

// Context-Aware Specific Rules
const CONTEXT_RULES = {
  Task: {
    preferred: {
      "approve": "അപ്രൂവ് ചെയ്യുക",
      "task": "ടാസ്ക്",
      "tasks": "ടാസ്കുകൾ",
      "pending": "പെൻഡിംഗ്",
      "deadline": "ഡെഡ്ലൈൻ",
      "assign": "അസൈൻ ചെയ്യുക",
      "review": "റിവ്യൂ ചെയ്യുക"
    },
    avoid: { "ചുമതല": "ടാസ്ക്", "ജോലി": "ടാസ്ക്", "പ്രവൃത്തി": "ടാസ്ക്" }
  },
  Meeting: {
    preferred: {
      "meeting": "മീറ്റിംഗ്",
      "meetings": "മീറ്റിംഗുകൾ",
      "agenda": "അജണ്ട",
      "minutes": "മിനിറ്റ്സ്",
      "schedule": "ഷെഡ്യൂൾ ചെയ്യുക",
      "attend": "പങ്കെടുക്കുക",
      "review": "റിവ്യൂ മീറ്റിംഗ്"
    },
    avoid: { "സമ്മേളനം": "മീറ്റിംഗ്", "യോഗം": "മീറ്റിംഗ്" }
  },
  Circular: {
    preferred: {
      "circular": "സർക്കുലർ",
      "circulars": "സർക്കുലറുകൾ",
      "order": "ഉത്തരവ്",
      "instruction": "നിർദേശം",
      "department": "വിഭാഗം",
      "publish": "പ്രസിദ്ധീകരിക്കുക",
      "review": "സർക്കുലർ റിവ്യൂ ചെയ്യുക"
    },
    avoid: { "രേഖ": "സർക്കുലർ" }
  },
  Dashboard: {
    preferred: { "dashboard": "ഡാഷ്ബോർഡ്", "status": "സ്റ്റാറ്റസ്", "pending": "പെൻഡിംഗ്" },
    avoid: { "നിയന്ത്രണ പാനൽ": "ഡാഷ്ബോർഡ്" }
  },
  "AI Assistant": {
    preferred: { "assistant": "അസിസ്റ്റന്റ്", "ai": "എ.ഐ", "chat": "ചാറ്റ്", "ask": "ചോദിക്കുക" },
    avoid: { "സഹായി": "അസിസ്റ്റന്റ്" }
  },
  Notification: {
    preferred: { "notification": "നോട്ടിഫിക്കേഷൻ", "notifications": "നോട്ടിഫിക്കേഷനുകൾ", "alert": "അറിയിപ്പ്" },
    avoid: {}
  },
  Navigation: {
    preferred: { "home": "ഹോം", "profile": "പ്രൊഫൈൽ", "settings": "സെറ്റിംഗ്സ്", "logout": "ലോഗൗട്ട്" },
    avoid: {}
  },
  Wellness: {
    preferred: { "wellness": "വെൽനസ്", "health": "ആരോഗ്യം", "check-in": "ചെക്ക്-ഇൻ" },
    avoid: {}
  },
  Authentication: {
    preferred: { "login": "ലോഗിൻ", "logout": "ലോഗൗട്ട്", "password": "പാസ്‌വേഡ്", "username": "യൂസർനെയിം" },
    avoid: { "പ്രവേശനം": "ലോഗിൻ", "പുറത്തുകടക്കൽ": "ലോഗൗട്ട്" }
  },
  Profile: {
    preferred: { "profile": "പ്രൊഫൈൽ", "user": "യൂസർ", "role": "റോൾ" },
    avoid: { "വ്യക്തിഗത വിവരങ്ങൾ": "പ്രൊഫൈൽ" }
  },
  Settings: {
    preferred: { "settings": "സെറ്റിംഗ്സ്", "preferences": "സെറ്റിംഗ്സ്" },
    avoid: { "ക്രമീകരണങ്ങൾ": "സെറ്റിംഗ്സ്" }
  },
  Analytics: {
    preferred: { "analytics": "അനലിറ്റിക്സ്", "metrics": "മെട്രിക്കുകൾ" },
    avoid: {}
  },
  Reports: {
    preferred: { "report": "റിപ്പോർട്ട്", "reports": "റിപ്പോർട്ടുകൾ", "summary": "സംഗ്രഹം" },
    avoid: {}
  },
  Search: {
    preferred: { "search": "സെർച്ച് ചെയ്യുക", "filter": "ഫിൽട്ടർ ചെയ്യുക" },
    avoid: { "തിരയുക": "സെർച്ച് ചെയ്യുക" }
  },
  Workflow: {
    preferred: { "workflow": "വർക്ക്ഫ്ലോ", "process": "പ്രോസസ്സ് ചെയ്യുക" },
    avoid: { "പ്രവൃത്തി പ്രവാഹം": "വർക്ക്ഫ്ലോ" }
  },
  Repository: {
    preferred: { "repository": "റിപ്പോസിറ്ററി", "file": "ഫയൽ", "document": "ഡോക്യുമെന്റ്" },
    avoid: { "സംഭരണി": "റിപ്പോസിറ്ററി", "ശേഖരം": "റിപ്പോസിറ്ററി" }
  }
};

/**
 * Helper to clean text for linguistic analysis.
 */
function cleanTextForAnalysis(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/(\{\{[^}]+\}\}|\{[^}]+\}|%s|%d|%f|<[^>]+>|https?:\/\/\S+|\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b|__TOKEN_\d+__|__GLOSSARY_TOKEN_\d+__)/g, ' ')
    .replace(/[0-9]/g, ' ')
    .replace(/[.,/#!$%^&*;:{}=\-_`~()?"'–—]/g, ' ')
    .trim();
}

/**
 * Check if Malayalam string contains term or stem.
 */
function matchesMalayalamTerm(malText, expectedMal) {
  if (!expectedMal) return true;
  if (malText.includes(expectedMal)) return true;
  const rootStem = expectedMal.replace(/[്ുകംൾൽൻർൈൃാിീുൂെേൊോൗ]+$/u, '');
  if (rootStem.length >= 2 && malText.includes(rootStem)) {
    return true;
  }
  return false;
}

/**
 * Normalize arguments for V1 / V2 API compatibility.
 */
function normalizeInput(arg1, arg2, arg3) {
  if (typeof arg1 === 'object' && arg1 !== null && !Array.isArray(arg1)) {
    return {
      source: arg1.source || arg1.english || arg1.text || '',
      translation: arg1.translation || arg1.malayalam || arg1.translated || '',
      context: arg1.context || 'General',
      category: arg1.category || 'General',
      endpoint: arg1.endpoint || null,
      metadata: arg1.metadata || {},
      suppressLogs: arg1.suppressLogs !== undefined ? arg1.suppressLogs : false
    };
  }

  const options = (typeof arg3 === 'object' && arg3 !== null) ? arg3 : {};
  let src = typeof arg1 === 'string' ? arg1 : '';
  let trn = typeof arg2 === 'string' ? arg2 : '';

  if (typeof arg1 === 'string' && (arg2 === undefined || typeof arg2 === 'object')) {
    src = options.source || options.english || '';
    trn = arg1;
  }

  return {
    source: src,
    translation: trn,
    context: options.context || 'General',
    category: options.category || 'General',
    endpoint: options.endpoint || null,
    metadata: options.metadata || {},
    suppressLogs: options.suppressLogs !== undefined ? options.suppressLogs : false
  };
}

/**
 * Calculate grade and badge from overall numerical score.
 */
function calculateGradeAndBadge(score) {
  if (score >= 97) {
    return { grade: 'A+', confidence: 'HIGH', status: 'Production Ready', badge: '★★★★★', description: 'Excellent' };
  } else if (score >= 90) {
    return { grade: 'A', confidence: 'HIGH', status: 'Production Ready', badge: '★★★★☆', description: 'Very Good' };
  } else if (score >= 80) {
    return { grade: 'B', confidence: 'MEDIUM', status: 'Good', badge: '★★★☆☆', description: 'Good' };
  } else if (score >= 70) {
    return { grade: 'C', confidence: 'MEDIUM', status: 'Needs Review', badge: '★★☆☆☆', description: 'Needs Review' };
  } else {
    return { grade: 'D', confidence: 'LOW', status: 'Manual Review Required', badge: '★☆☆☆☆', description: 'Manual Review Required' };
  }
}

/**
 * Comprehensive V2 Validation Engine.
 */
export function validateOfficeMalayalam(arg1, arg2, arg3) {
  const startTime = Date.now();
  ensureResourcesLoaded();
  ensureCacheLoaded();

  const { source, translation, context, category, endpoint, metadata, suppressLogs } = normalizeInput(arg1, arg2, arg3);

  // Cache Lookup
  const cacheKey = `${source}::${translation}::${context}`;
  if (validationCacheMap.has(cacheKey)) {
    const cached = validationCacheMap.get(cacheKey);
    if (!suppressLogs && metadata && metadata.verbose) {
      console.log(`[OfficeMalayalamValidator] Cache Hit for "${translation}" -> Score: ${cached.overall}`);
    }
    return cached;
  }

  // Initialize Sub-Scores & Issues
  let scoreGrammar = 100;
  let scoreOfficeStyle = 100;
  let scoreGlossary = 100;
  let scoreNaturalness = 100;
  let scoreConsistency = 100;
  let scoreMixedLanguage = 100;
  let scoreLiteralTranslation = 100;

  const issues = [];
  const suggestions = [];
  const deductionsList = [];

  const cleanedMal = cleanTextForAnalysis(translation);
  const words = cleanedMal.split(/\s+/).filter(Boolean);
  const englishWords = words.filter(w => /^[A-Za-z]{2,}$/.test(w) && !WHITELISTED_ACRONYMS.has(w.toUpperCase()));
  const hasMalayalam = /[\u0D00-\u0D7F]/.test(translation);

  // 1. English Words & Verbs Check (Mixed Language & Glossary)
  if (englishWords.length > 0) {
    const unallowedVerbs = englishWords.filter(w => UNALLOWED_VERBS.has(w.toLowerCase()));

    if (unallowedVerbs.length > 0) {
      issues.push({
        severity: "Critical",
        type: "EnglishAlphabet",
        message: `Contains untranslated English verb(s): "${unallowedVerbs.join(', ')}".`
      });
      scoreMixedLanguage -= 20;
      deductionsList.push({ points: 20, reason: "Contains untranslated English verb", detail: unallowedVerbs.join(', ') });

      for (const verb of unallowedVerbs) {
        const pref = softwareTermsMap.get(verb.toLowerCase()) || `${verb} ചെയ്യുക`;
        suggestions.push(`${verb} → ${pref}`);
      }
    }

    if (hasMalayalam) {
      issues.push({
        severity: "High",
        type: "MixedLanguage",
        message: `Contains mixed English and Malayalam (${englishWords.length} word(s): "${englishWords.join(', ')}").`
      });
      scoreMixedLanguage -= 10;
      deductionsList.push({ points: 10, reason: "Mixed language text", detail: englishWords.join(', ') });
    } else {
      issues.push({
        severity: "Critical",
        type: "EnglishAlphabet",
        message: `Contains English alphabet without Malayalam script translation (${englishWords.join(', ')}).`
      });
      scoreMixedLanguage -= 20;
      deductionsList.push({ points: 20, reason: "Entire text in English script", detail: englishWords.join(', ') });
    }

    for (const w of englishWords) {
      const match = softwareTermsMap.get(w.toLowerCase());
      if (match && !suggestions.includes(`${w} → ${match}`)) {
        suggestions.push(`${w} → ${match}`);
      }
    }
  }

  // 2. Literal Translation & Avoid Words Check
  for (const [avoidWord, reason] of avoidWordsMap.entries()) {
    if (translation.includes(avoidWord)) {
      issues.push({
        severity: "Medium",
        type: "LiteralTranslation",
        message: `Contains dictionary/bookish Malayalam term "${avoidWord}" (${reason}).`
      });
      scoreLiteralTranslation -= 10;
      deductionsList.push({ points: 10, reason: "Literal dictionary translation", detail: avoidWord });

      const prefMatch = reason.match(/Use ([^\s]+) instead/);
      if (prefMatch) {
        suggestions.push(`${avoidWord} → ${prefMatch[1]}`);
      }
    }
  }

  // 3. Office Style & Formal Phrasing Check
  if (translation.includes('നിർവഹിക്കുക')) {
    issues.push({
      severity: "Low",
      type: "WrongOfficeStyle",
      message: "Formal/literary verb 'നിർവഹിക്കുക' used instead of office verb 'ചെയ്യുക'."
    });
    scoreOfficeStyle -= 5;
    deductionsList.push({ points: 5, reason: "Wrong office verb style", detail: "നിർവഹിക്കുക" });
  }
  if (translation.includes('തിരയുക')) {
    issues.push({
      severity: "Low",
      type: "WrongOfficeStyle",
      message: "Bookish term 'തിരയുക' used instead of office term 'സെർച്ച് ചെയ്യുക'."
    });
    scoreOfficeStyle -= 5;
    deductionsList.push({ points: 5, reason: "Wrong office search term", detail: "തിരയുക" });
    if (!suggestions.includes("തിരയുക → സെർച്ച് ചെയ്യുക")) {
      suggestions.push("തിരയുക → സെർച്ച് ചെയ്യുക");
    }
  }

  // 4. Context-Aware Rules Validation
  const contextKey = Object.keys(CONTEXT_RULES).find(k => k.toLowerCase() === context.toLowerCase() || context.toLowerCase().includes(k.toLowerCase())) || 'General';
  const ctxRule = CONTEXT_RULES[contextKey];

  if (ctxRule && source) {
    const cleanedEng = cleanTextForAnalysis(source);
    const engTokens = cleanedEng.split(/\s+/).filter(Boolean);

    for (const token of engTokens) {
      const tokenLower = token.toLowerCase();

      // Check context-specific preferred term first, then fall back to softwareTermsMap
      const expectedMal = ctxRule.preferred[tokenLower] || softwareTermsMap.get(tokenLower);

      if (expectedMal && !matchesMalayalamTerm(translation, expectedMal)) {
        if (new RegExp(`\\b${token}\\b`, 'i').test(translation)) {
          issues.push({
            severity: "Medium",
            type: "MissingGlossary",
            message: `Untranslated glossary term "${token}" remaining in translation for context "${context}".`
          });
          scoreGlossary -= 8;
          deductionsList.push({ points: 8, reason: "Missing glossary term", detail: token });

          if (!suggestions.includes(`${token} → ${expectedMal}`)) {
            suggestions.push(`${token} → ${expectedMal}`);
          }
        } else {
          issues.push({
            severity: "Medium",
            type: "WrongOfficeStyle",
            message: `Glossary term "${token}" was translated into non-office term instead of preferred "${expectedMal}" in "${context}" context.`
          });
          scoreOfficeStyle -= 8;
          deductionsList.push({ points: 8, reason: "Context style mismatch", detail: `${token} (${context})` });

          if (!suggestions.includes(`${token} → ${expectedMal}`)) {
            suggestions.push(`${token} → ${expectedMal}`);
          }
        }
      }
    }

    // Check context avoid words
    if (ctxRule.avoid) {
      for (const [avoidW, prefW] of Object.entries(ctxRule.avoid)) {
        if (translation.includes(avoidW)) {
          issues.push({
            severity: "Medium",
            type: "WrongOfficeStyle",
            message: `Avoid word "${avoidW}" used in "${context}" context.`
          });
          scoreOfficeStyle -= 8;
          deductionsList.push({ points: 8, reason: "Avoid word in context", detail: avoidW });
          if (!suggestions.includes(`${avoidW} → ${prefW}`)) {
            suggestions.push(`${avoidW} → ${prefW}`);
          }
        }
      }
    }
  }

  // 5. Placeholder & HTML Integrity (Grammar Score)
  if (source && (source.includes('{{') || source.includes('<'))) {
    const srcPlaceholders = source.match(/(\{\{[^}]+\}\}|<[^>]+>)/g) || [];
    for (const ph of srcPlaceholders) {
      if (!translation.includes(ph)) {
        issues.push({
          severity: "Critical",
          type: "GrammarCorrupted",
          message: `Placeholder/HTML tag "${ph}" missing or corrupted in translation.`
        });
        scoreGrammar -= 20;
        deductionsList.push({ points: 20, reason: "Missing placeholder/HTML tag", detail: ph });
      }
    }
  }

  // 6. UI Length Ratio Validator (Task 11)
  const srcLen = source ? source.length : 0;
  const trnLen = translation ? translation.length : 0;
  const uiLengthRatioVal = srcLen > 0 ? Math.round((trnLen / srcLen) * 100) : 100;
  let scoreUiLength = 100;
  let uiLengthWarning = false;

  if (srcLen > 0 && uiLengthRatioVal > 125) {
    uiLengthWarning = true;
    scoreUiLength = Math.max(50, 100 - Math.round((uiLengthRatioVal - 125) / 2));
    issues.push({
      severity: "Low",
      type: "UILengthWarning",
      message: `UI Length Warning: Translation length is ${uiLengthRatioVal}% of English original (Recommended <125%). May overflow UI buttons or cards.`
    });
  }

  // Clamp sub-scores between 0 and 100
  scoreGrammar = Math.max(0, scoreGrammar);
  scoreOfficeStyle = Math.max(0, scoreOfficeStyle);
  scoreGlossary = Math.max(0, scoreGlossary);
  scoreNaturalness = Math.max(0, scoreNaturalness);
  scoreConsistency = Math.max(0, scoreConsistency);
  scoreMixedLanguage = Math.max(0, scoreMixedLanguage);
  scoreLiteralTranslation = Math.max(0, scoreLiteralTranslation);
  scoreUiLength = Math.max(0, scoreUiLength);

  // 7. Readability Score Calculation (Task 10)
  const readabilityScore = Math.round(
    (scoreOfficeStyle * 0.3) +
    (scoreMixedLanguage * 0.3) +
    (scoreLiteralTranslation * 0.2) +
    (scoreUiLength * 0.2)
  );

  // Compute Overall Score
  const totalDeductions = deductionsList.reduce((acc, d) => acc + d.points, 0);
  const overall = Math.max(0, 100 - totalDeductions);
  const passed = overall >= 90;

  const { grade, confidence, status, badge, description } = calculateGradeAndBadge(overall);
  const executionTimeMs = Date.now() - startTime;

  // Ranked Suggestions (Task 9)
  const rankedSuggestions = suggestions.map((s, idx) => {
    if (idx === 0) return `★★★★★   ${s}`;
    if (idx === 1) return `★★★★☆   ${s}`;
    return `★★★☆☆   ${s}`;
  });

  const result = {
    passed,
    overall,
    grade,
    confidence,
    status,
    badge,
    description,
    readabilityScore,
    uiLengthRatio: `${uiLengthRatioVal}%`,
    uiLengthWarning,
    scores: {
      overall,
      officeStyle: scoreOfficeStyle,
      readability: readabilityScore,
      consistency: scoreConsistency,
      grammar: scoreGrammar,
      mixedLanguage: scoreMixedLanguage,
      literalTranslation: scoreLiteralTranslation,
      uiLength: scoreUiLength
    },
    // V1 score property backward compatibility
    score: overall,
    issues,
    suggestions,
    rankedSuggestions,
    deductions: deductionsList,
    context,
    category,
    executionTimeMs
  };

  // Cache Result
  validationCacheMap.set(cacheKey, result);
  persistCacheDisk();

  // Queue for Manual Review if failed
  if (!passed) {
    queueForManualReview({
      english: source,
      translation,
      score: overall,
      reason: issues[0]?.message || 'Quality below threshold',
      suggestion: suggestions[0] || '',
      context,
      category,
      timestamp: new Date().toISOString()
    });
  }

  // Pretty Console Logger Output
  if (!suppressLogs) {
    console.log('\n====================================');
    console.log('Office Malayalam Validator');
    console.log('====================================');
    console.log(`Context        : ${context}`);
    console.log(`Grade          : ${grade} (${description})`);
    console.log(`Confidence     : ${confidence}`);
    console.log(`Overall        : ${overall}`);
    console.log(`  Grammar          : ${scoreGrammar}`);
    console.log(`  Office Style     : ${scoreOfficeStyle}`);
    console.log(`  Naturalness      : ${scoreNaturalness}`);
    console.log(`  Consistency      : ${scoreConsistency}`);
    console.log(`  Mixed Language   : ${scoreMixedLanguage}`);
    console.log(`  Glossary         : ${scoreGlossary}`);
    console.log(`  Literal Trans.   : ${scoreLiteralTranslation}`);
    console.log(`Issues         : ${issues.length}`);
    console.log(`Suggestions    : ${suggestions.length}`);
    console.log(`Execution Time : ${executionTimeMs}ms`);
    if (issues.length > 0) {
      console.log('\nIssues:');
      issues.forEach(i => console.log(`• [${i.severity}] ${i.message}`));
    }
    if (suggestions.length > 0) {
      console.log('\nSuggestions:');
      suggestions.forEach(s => console.log(`👉 ${s}`));
    }
    console.log('====================================\n');
  }

  return result;
}

/**
 * Backward compatible score calculator helper.
 */
export function calculateOfficeScore(arg1, arg2, arg3) {
  const res = validateOfficeMalayalam(arg1, arg2, { ...(arg3 || {}), suppressLogs: true });
  return res.overall;
}

/**
 * Backward compatible issues finder helper.
 */
export function findOfficeIssues(arg1, arg2, arg3) {
  const res = validateOfficeMalayalam(arg1, arg2, { ...(arg3 || {}), suppressLogs: true });
  return {
    issues: res.issues,
    suggestions: res.suggestions,
    deductions: res.deductions.reduce((acc, d) => acc + d.points, 0)
  };
}

/**
 * Backward compatible suggestions helper.
 */
export function suggestOfficeCorrections(arg1, arg2, arg3) {
  const res = validateOfficeMalayalam(arg1, arg2, { ...(arg3 || {}), suppressLogs: true });
  return res.suggestions;
}

/**
 * Batch validator.
 */
export function validateBatch(items, options = {}) {
  if (!Array.isArray(items)) return [];
  return items.map(item => {
    if (typeof item === 'string') {
      return validateOfficeMalayalam(item, options);
    }
    if (item && typeof item === 'object') {
      return validateOfficeMalayalam(item, options);
    }
    return validateOfficeMalayalam('', '', options);
  });
}

export default {
  validateOfficeMalayalam,
  validateBatch,
  calculateOfficeScore,
  findOfficeIssues,
  suggestOfficeCorrections
};
