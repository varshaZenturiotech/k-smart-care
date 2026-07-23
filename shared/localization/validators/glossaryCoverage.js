import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_GLOSSARY_PATH = path.resolve(__dirname, '../glossary/government_glossary.json');

/**
 * Analyze Glossary Usage & Coverage across translated localization dataset.
 * 
 * @param {Record<string, string>} flatEn English key-value map.
 * @param {Record<string, string>} flatMl Malayalam key-value map.
 * @param {string} [glossaryPath] Optional path to government_glossary.json.
 * @returns {{
 *   totalEntries: number,
 *   usedEntriesCount: number,
 *   unusedEntriesCount: number,
 *   coveragePercentage: number,
 *   unusedEntries: Array<{ english: string, malayalam: string, category: string }>,
 *   glossarySuggestions: Array<{ key: string, english: string, translated: string, suggestedMalayalam: string, type: string, severity: string, details: string }>
 * }}
 */
export function analyzeGlossaryCoverage(flatEn, flatMl, glossaryPath = DEFAULT_GLOSSARY_PATH) {
  let glossaryEntries = [];
  try {
    if (fs.existsSync(glossaryPath)) {
      const raw = fs.readFileSync(glossaryPath, 'utf-8');
      glossaryEntries = JSON.parse(raw);
    }
  } catch (err) {
    console.error('[GlossaryCoverage] Error reading glossary file:', err.message);
  }

  const totalEntries = glossaryEntries.length;
  const usedEntrySet = new Set();
  const glossarySuggestions = [];

  // Index glossary terms for fast lookup
  const glossaryMap = new Map();
  for (const entry of glossaryEntries) {
    if (entry && entry.english && entry.malayalam) {
      glossaryMap.set(entry.english.toLowerCase().trim(), entry);
    }
  }

  // Scan dataset for glossary term usage
  for (const [key, englishStr] of Object.entries(flatEn)) {
    const malayalamStr = flatMl[key] || '';
    if (typeof englishStr !== 'string' || typeof malayalamStr !== 'string') continue;

    for (const entry of glossaryEntries) {
      if (!entry.english) continue;
      const engLower = entry.english.toLowerCase().trim();
      const engRegex = new RegExp(`\\b${entry.english.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');

      const matchesEng = engRegex.test(englishStr);
      const matchesMl = malayalamStr.includes(entry.malayalam);

      if (matchesEng || matchesMl) {
        usedEntrySet.add(engLower);
      }

      // Check if English string matches glossary term but Malayalam string is missing the glossary translation
      if (matchesEng && !matchesMl && !malayalamStr.toLowerCase().includes(entry.english.toLowerCase())) {
        glossarySuggestions.push({
          key,
          english: englishStr,
          translated: malayalamStr,
          type: 'Glossary Suggestion',
          severity: 'Low',
          details: `English phrase contains '${entry.english}'. Glossary suggests '${entry.malayalam}' (${entry.category || 'General'})`
        });
      }
    }
  }

  const usedEntriesCount = usedEntrySet.size;
  const unusedEntriesCount = Math.max(0, totalEntries - usedEntriesCount);
  const coveragePercentage = totalEntries > 0 ? parseFloat(((usedEntriesCount / totalEntries) * 100).toFixed(1)) : 0;

  const unusedEntries = glossaryEntries
    .filter(e => e.english && !usedEntrySet.has(e.english.toLowerCase().trim()))
    .map(e => ({ english: e.english, malayalam: e.malayalam, category: e.category || 'General' }));

  return {
    totalEntries,
    usedEntriesCount,
    unusedEntriesCount,
    coveragePercentage,
    unusedEntries,
    glossarySuggestions
  };
}

export default {
  analyzeGlossaryCoverage
};
