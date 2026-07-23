/**
 * Malayalam Grammar & Pluralization Engine for K-SMART CARE
 * Rule-based grammar corrector for post-translation Malayalam text.
 * Standardizes plurals, government terminology, sentence order, and mixed-language phrases.
 */

// 1. Static Plural Replacements (English transliterated plurals -> Natural Malayalam plurals)
const PLURAL_MAP = [
  { pattern: /ടാസ്ക്സ്/g, replacement: "ടാസ്കുകൾ" },
  { pattern: /മീറ്റിംഗ്സ്/g, replacement: "മീറ്റിംഗുകൾ" },
  { pattern: /ഫയൽസ്/g, replacement: "ഫയലുകൾ" },
  { pattern: /റിപ്പോർട്ട്സ്/g, replacement: "റിപ്പോർട്ടുകൾ" },
  { pattern: /ഡോക്യുമെന്റ്സ്/g, replacement: "ഡോക്യുമെന്റുകൾ" },
  { pattern: /ഫോൾഡർസ്/g, replacement: "ഫോൾഡറുകൾ" },
  { pattern: /കമ്മിറ്റീസ്/g, replacement: "കമ്മിറ്റികൾ" },
  { pattern: /യൂസർസ്/g, replacement: "ഉപയോക്താക്കൾ" },
  { pattern: /പെൻഡിംഗ്സ്/g, replacement: "പെൻഡിംഗുകൾ" },
  { pattern: /ഐറ്റംസ്/g, replacement: "ഐറ്റങ്ങൾ" }
];

// 2. Government & Committee Terminology Replacements
const GOVT_TERM_MAP = [
  { pattern: /Panchayat Steering Committee/gi, replacement: "പഞ്ചായത്ത് സ്റ്റിയറിംഗ് സമിതി" },
  { pattern: /Ward Development Committee/gi, replacement: "വാർഡ് വികസന സമിതി" },
  { pattern: /Ward development committee/gi, replacement: "വാർഡ് വികസന സമിതി" },
  { pattern: /Steering Committee/gi, replacement: "സ്റ്റിയറിംഗ് സമിതി" },
  { pattern: /committee/gi, replacement: "സമിതി" },
  { pattern: /കമ്മിറ്റികൾ/g, replacement: "സമിതികൾ" },
  { pattern: /കമ്മിറ്റി/g, replacement: "സമിതി" },
  { pattern: /flood relief fund disbursement file/gi, replacement: "പ്രളയ ദുരിതാശ്വാസ ഫണ്ട് വിതരണ ഫയൽ" },
  { pattern: /flood relief fund disbursement/gi, replacement: "പ്രളയ ദുരിതാശ്വാസ ഫണ്ട് വിതരണം" },
  { pattern: /disbursement/gi, replacement: "വിതരണം" },
  { pattern: /relief fund/gi, replacement: "ദുരിതാശ്വാസ ഫണ്ട്" },
  { pattern: /flood relief/gi, replacement: "പ്രളയ ദുരിതാശ്വാസം" },
  { pattern: /casual leave/gi, replacement: "കാഷ്വൽ ലീവ്" }
];

// 3. Mixed-Language Phrasing & Sentence Order Corrections
const SENTENCE_REWRITE_MAP = [
  {
    pattern: /^(?:Approve|അംഗീകരിക്കുക)\s+(?:casual leave request|കാഷ്വൽ ലീവ് അപേക്ഷ|കാഷ്വൽ ലീവ് request)$/i,
    replacement: "കാഷ്വൽ ലീവ് അപേക്ഷ അംഗീകരിക്കുക"
  },
  {
    pattern: /^(?:Review|പരിശോധിക്കുക)\s+(?:flood relief fund disbursement file|പ്രളയ ദുരിതാശ്വാസ ഫണ്ട് വിതരണ ഫയൽ|പ്രളയ ദുരിതാശ്വാസ ഫണ്ട് വിതരണം ഫയൽ)$/i,
    replacement: "പ്രളയ ദുരിതാശ്വാസ ഫണ്ട് വിതരണ ഫയൽ പരിശോധിക്കുക"
  },
  {
    pattern: /^(?:Review|പരിശോധിക്കുക)\s+(?:committee report|സമിതി റിപ്പോർട്ട്)$/i,
    replacement: "സമിതി റിപ്പോർട്ട് പരിശോധിക്കുക"
  },
  {
    pattern: /^Ward development committee\s+(?:review|പരിശോധന)$/i,
    replacement: "വാർഡ് വികസന സമിതി പരിശോധന"
  },
  {
    pattern: /^Panchayat Steering Committee\s+(?:review|പരിശോധന)$/i,
    replacement: "പഞ്ചായത്ത് സ്റ്റിയറിംഗ് സമിതി പരിശോധന"
  }
];

/**
 * Normalizes numbers followed by Malayalam nouns (Rule 6).
 * e.g., 1 ടാസ്കുകൾ -> 1 ടാസ്ക്
 * e.g., 2 ടാസ്ക് -> 2 ടാസ്കുകൾ
 */
function normalizeNumberNouns(text) {
  let count = 0;
  let result = text;

  // Singular enforcement for count = 1
  const singularRules = [
    { pattern: /\b1\s+ടാസ്കുകൾ\b/g, replacement: "1 ടാസ്ക്" },
    { pattern: /\b1\s+മീറ്റിംഗുകൾ\b/g, replacement: "1 മീറ്റിംഗ്" },
    { pattern: /\b1\s+ഫയലുകൾ\b/g, replacement: "1 ഫയൽ" },
    { pattern: /\b1\s+റിപ്പോർട്ടുകൾ\b/g, replacement: "1 റിപ്പോർട്ട്" }
  ];

  for (const rule of singularRules) {
    if (rule.pattern.test(result)) {
      result = result.replace(rule.pattern, rule.replacement);
      count++;
    }
  }

  // Plural enforcement for count > 1
  result = result.replace(/\b([2-9]|\d{2,})\s+ടാസ്ക്\b/g, (match, p1) => {
    count++;
    return `${p1} ടാസ്കുകൾ`;
  });
  result = result.replace(/\b([2-9]|\d{2,})\s+മീറ്റിംഗ്\b/g, (match, p1) => {
    count++;
    return `${p1} മീറ്റിംഗുകൾ`;
  });
  result = result.replace(/\b([2-9]|\d{2,})\s+ഫയൽ\b/g, (match, p1) => {
    count++;
    return `${p1} ഫയലുകൾ`;
  });
  result = result.replace(/\b([2-9]|\d{2,})\s+റിപ്പോർട്ട്\b/g, (match, p1) => {
    count++;
    return `${p1} റിപ്പോർട്ടുകൾ`;
  });

  return { result, count };
}

/**
 * Automatically corrects Malayalam grammar, plurals, terminology, and sentence structure.
 * 
 * @param {string} text Target Malayalam string.
 * @param {Object} [options]
 * @returns {{text: string, corrections: {pluralFixes: number, sentenceRewrite: number, governmentTerms: number, mixedLanguage: number}, confidence: number, changed: boolean}}
 */
export function fixGrammar(text, options = {}) {
  if (!text || typeof text !== 'string' || !text.trim()) {
    return {
      text: text || '',
      corrections: { pluralFixes: 0, sentenceRewrite: 0, governmentTerms: 0, mixedLanguage: 0 },
      confidence: 1.0,
      changed: false
    };
  }

  const original = text.trim();
  let current = original;

  // Step 1: Protect Placeholders, HTML Tags, and Special Entities (Rule 7)
  const tokens = [];
  const protect = (match) => {
    const idx = tokens.length;
    tokens.push(match);
    return `___TOK_${idx}___`;
  };

  current = current
    .replace(/\{\{[^}]+\}\}/g, protect)
    .replace(/\{[^}]+\}/g, protect)
    .replace(/%s|%d/g, protect)
    .replace(/<[^>]+>/g, protect)
    .replace(/https?:\/\/[^\s]+/g, protect)
    .replace(/^[0-9a-fA-F]{24}$/g, protect)
    .replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i, protect);

  let pluralFixes = 0;
  let sentenceRewrite = 0;
  let governmentTerms = 0;
  let mixedLanguage = 0;

  // Step 2: Mixed-Language & Specific Sentence Rewrites (Rule 3 & 5)
  for (const rule of SENTENCE_REWRITE_MAP) {
    if (rule.pattern.test(current)) {
      current = current.replace(rule.pattern, rule.replacement);
      sentenceRewrite++;
      mixedLanguage++;
    }
  }

  // General verb-at-start sentence order fix (e.g., "അംഗീകരിക്കുക കാഷ്വൽ ലീവ് അപേക്ഷ" -> "കാഷ്വൽ ലീവ് അപേക്ഷ അംഗീകരിക്കുക")
  const verbStartMatch = current.match(/^(അംഗീകരിക്കുക|പരിശോധിക്കുക|സമർപ്പിക്കുക|ഡൗൺലോഡ് ചെയ്യുക|അപ്ലോഡ് ചെയ്യുക)\s+(.+)$/);
  if (verbStartMatch) {
    const verb = verbStartMatch[1];
    const objectPhrase = verbStartMatch[2];
    current = `${objectPhrase} ${verb}`;
    sentenceRewrite++;
  }

  // Step 3: Government Terminology & Committee Names (Rule 2 & 4)
  for (const rule of GOVT_TERM_MAP) {
    if (rule.pattern.test(current)) {
      current = current.replace(rule.pattern, rule.replacement);
      governmentTerms++;
    }
  }

  // Step 4: Malayalam Plural Normalization (Rule 1)
  for (const rule of PLURAL_MAP) {
    if (rule.pattern.test(current)) {
      current = current.replace(rule.pattern, rule.replacement);
      pluralFixes++;
    }
  }

  // Step 5: Number-Aware Formatting (Rule 6)
  const numNorm = normalizeNumberNouns(current);
  current = numNorm.result;
  pluralFixes += numNorm.count;

  // Step 6: Remaining English word cleanup if simple translation exists
  if (/\bApprove\b/i.test(current) && /ലീവ്|അപേക്ഷ/i.test(current)) {
    current = current.replace(/\bApprove\b/gi, "").trim();
    if (!current.includes("അംഗീകരിക്കുക")) current += " അംഗീകരിക്കുക";
    mixedLanguage++;
  }
  if (/\bRequest\b/i.test(current) && /ലീവ്|കാഷ്വൽ/i.test(current)) {
    current = current.replace(/\bRequest\b/gi, "അപേക്ഷ");
    mixedLanguage++;
  }
  if (/\bReview\b/i.test(current) && /ഫയൽ|സമിതി|റിപ്പോർട്ട്/i.test(current)) {
    current = current.replace(/\bReview\b/gi, "").trim();
    if (!current.includes("പരിശോധിക്കുക") && !current.includes("പരിശോധന")) current += " പരിശോധിക്കുക";
    mixedLanguage++;
  }

  // Step 7: Restore Protected Tokens
  tokens.forEach((val, idx) => {
    current = current.replace(`___TOK_${idx}___`, val);
  });

  const changed = current !== original;
  const totalCorrections = pluralFixes + sentenceRewrite + governmentTerms + mixedLanguage;
  const confidence = changed ? 0.98 : 1.0;

  return {
    text: current,
    corrections: {
      pluralFixes,
      sentenceRewrite,
      governmentTerms,
      mixedLanguage
    },
    confidence,
    changed
  };
}

/**
 * Processes a batch of Malayalam strings through the Grammar Engine.
 * 
 * @param {string[]} texts Array of Malayalam strings.
 * @param {Object} [options]
 * @returns {Promise<Array<{text: string, corrections: Object, confidence: number, changed: boolean}>>}
 */
export async function fixGrammarBatch(texts, options = {}) {
  if (!Array.isArray(texts)) {
    return [];
  }
  return texts.map(t => fixGrammar(t, options));
}

export default {
  fixGrammar,
  fixGrammarBatch
};
