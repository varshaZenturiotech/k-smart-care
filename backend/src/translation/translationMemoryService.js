/**
 * Intelligent Translation Memory (TM) Service
 * Production-grade learning and fuzzy matching localization memory engine for K-SMART CARE.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TM_FILE_PATH1 = path.resolve(__dirname, '../../../shared/localization/cache/translationMemory.json');
const TM_FILE_PATH2 = path.resolve(__dirname, '../../../shared/localization/cache/translation_memory.json');

/**
 * Text Normalization Utility
 * Normalizes case, whitespace, quotes, and punctuation for deterministic matching.
 */
export function normalizeText(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .trim()
    .replace(/[\u2018\u2019\u201C\u201D]/g, "'")
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/**
 * Calculate Levenshtein similarity ratio between two strings (0.0 to 1.0)
 */
export function calculateSimilarity(str1, str2) {
  const n1 = normalizeText(str1);
  const n2 = normalizeText(str2);
  if (n1 === n2) return 1.0;
  if (!n1 || !n2) return 0.0;

  const len1 = n1.length;
  const len2 = n2.length;
  const maxLen = Math.max(len1, len2);
  if (maxLen === 0) return 1.0;

  const matrix = Array(len2 + 1).fill(null).map(() => Array(len1 + 1).fill(null));
  for (let i = 0; i <= len1; i++) matrix[0][i] = i;
  for (let j = 0; j <= len2; j++) matrix[j][0] = j;

  for (let j = 1; j <= len2; j++) {
    for (let i = 1; i <= len1; i++) {
      const indicator = n1[i - 1] === n2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + indicator
      );
    }
  }

  const distance = matrix[len2][len1];
  return 1.0 - (distance / maxLen);
}

class TranslationMemoryService {
  constructor() {
    this.entries = new Map(); // Composite Key (normalizedEnglish:::normalizedContext) -> Record
    this.normIndex = new Map(); // normalizedEnglish -> Array of Record
    this.saveTimer = null;
    this.isLoaded = false;
    this.statsData = {
      cacheHits: 0,
      exactMatches: 0,
      fuzzyMatches: 0,
      totalLookupTimeMs: 0,
      totalLookups: 0
    };
  }

  /**
   * Load TM database into fast memory structures
   */
  load() {
    this.entries.clear();
    this.normIndex.clear();

    const targetPaths = [TM_FILE_PATH1, TM_FILE_PATH2];
    targetPaths.forEach(filePath => {
      if (fs.existsSync(filePath)) {
        try {
          const raw = fs.readFileSync(filePath, 'utf-8');
          const data = JSON.parse(raw);
          this.batchLoad(data);
        } catch (err) {
          console.warn(`[TM] Error reading ${filePath}:`, err.message);
        }
      }
    });

    this.isLoaded = true;
    return this.entries.size;
  }

  /**
   * Batch load entries object into memory indexes
   */
  batchLoad(data) {
    if (!data || typeof data !== 'object') return;

    for (const [key, item] of Object.entries(data)) {
      if (!item || !item.translation) continue;

      const english = item.english || key.split(':::')[0];
      const context = item.context || key.split(':::')[1] || 'General';
      const normEng = normalizeText(english);
      const normCtx = normalizeText(context);
      const compositeKey = `${normEng}:::${normCtx}`;

      const record = {
        english: item.english || english,
        translation: item.translation,
        context: item.context || context,
        score: item.score || 95,
        reviewed: item.reviewed !== undefined ? item.reviewed : (item.score >= 98),
        approvedBy: item.approvedBy || (item.score >= 98 ? 'system' : 'auto'),
        usageCount: item.usageCount || 1,
        lastUsed: item.lastUsed || new Date().toISOString().split('T')[0],
        createdAt: item.createdAt || new Date().toISOString(),
        updatedAt: item.updatedAt || new Date().toISOString(),
        locked: !!item.locked
      };

      this.entries.set(compositeKey, record);

      if (!this.normIndex.has(normEng)) {
        this.normIndex.set(normEng, []);
      }
      const existingList = this.normIndex.get(normEng);
      const idx = existingList.findIndex(r => normalizeText(r.context) === normCtx);
      if (idx >= 0) {
        existingList[idx] = record;
      } else {
        existingList.push(record);
      }
    }
  }

  /**
   * Fast O(1) & Intelligent Fuzzy TM Lookup
   * 
   * @param {string} text English phrase to translate
   * @param {string} [contextStr='General'] Application context
   * @returns {Object|null} Match result or null
   */
  lookup(text, contextStr = 'General') {
    if (!this.isLoaded) {
      this.load();
    }

    if (!text || typeof text !== 'string') return null;

    const startTime = performance.now();
    const normText = normalizeText(text);
    const normCtx = normalizeText(contextStr || 'General');
    const compositeKey = `${normText}:::${normCtx}`;

    let matchRecord = null;
    let matchType = 'Exact';
    let similarityScore = 1.0;

    // 1. Exact Match on (English + Context)
    if (this.entries.has(compositeKey)) {
      matchRecord = this.entries.get(compositeKey);
      matchType = 'Exact';
    }
    // 2. Exact Match on (English + General)
    else if (this.entries.has(`${normText}:::general`)) {
      matchRecord = this.entries.get(`${normText}:::general`);
      matchType = 'Exact';
    }
    // 3. Fallback Exact Match on English across any context
    else if (this.normIndex.has(normText) && this.normIndex.get(normText).length > 0) {
      matchRecord = this.normIndex.get(normText)[0];
      matchType = 'Exact';
    }

    // 4. Fuzzy Match (Similarity >= 90%)
    if (!matchRecord) {
      let bestSim = 0;
      let bestCandidate = null;

      for (const [normEng, records] of this.normIndex.entries()) {
        const sim = calculateSimilarity(normText, normEng);
        if (sim >= 0.90 && sim > bestSim) {
          bestSim = sim;
          // Prefer matching context candidate
          const ctxMatch = records.find(r => normalizeText(r.context) === normCtx);
          bestCandidate = ctxMatch || records[0];
        }
      }

      if (bestCandidate) {
        matchRecord = bestCandidate;
        matchType = 'Fuzzy';
        similarityScore = bestSim;
      }
    }

    const duration = performance.now() - startTime;
    this.statsData.totalLookups++;
    this.statsData.totalLookupTimeMs += duration;

    if (!matchRecord) {
      return null;
    }

    // Update usage metrics
    matchRecord.usageCount = (matchRecord.usageCount || 0) + 1;
    matchRecord.lastUsed = new Date().toISOString().split('T')[0];
    this.statsData.cacheHits++;

    if (matchType === 'Exact') this.statsData.exactMatches++;
    else this.statsData.fuzzyMatches++;

    this.scheduleSave();

    // Determine Confidence Rating
    let confidence = 100;
    if (matchType === 'Exact') {
      confidence = matchRecord.reviewed ? 100 : 95;
    } else {
      confidence = matchRecord.reviewed ? 90 : 85;
    }

    return {
      translation: matchRecord.translation,
      confidence,
      source: 'Translation Memory',
      matchType,
      similarity: similarityScore,
      reviewed: !!matchRecord.reviewed,
      locked: !!matchRecord.locked,
      usageCount: matchRecord.usageCount,
      lastUsed: matchRecord.lastUsed,
      lookupTimeMs: duration.toFixed(2),
      context: matchRecord.context,
      score: matchRecord.score
    };
  }

  /**
   * Automatic Learning: Store high quality translations (Score >= 95)
   */
  learn(english, translation, contextStr = 'General', score = 95) {
    if (!this.isLoaded) {
      this.load();
    }

    if (!english || !translation || score < 95) return false;

    const normEng = normalizeText(english);
    const normCtx = normalizeText(contextStr || 'General');
    const compositeKey = `${normEng}:::${normCtx}`;

    const existing = this.entries.get(compositeKey);

    // Rule: Locked entries must NEVER be overwritten
    if (existing && existing.locked) {
      return false;
    }

    const isReviewed = score >= 98;
    const record = {
      english: english.trim(),
      translation: translation.trim(),
      context: contextStr || 'General',
      score,
      reviewed: existing ? (existing.reviewed || isReviewed) : isReviewed,
      approvedBy: isReviewed ? 'validator' : 'auto',
      usageCount: existing ? existing.usageCount + 1 : 1,
      lastUsed: new Date().toISOString().split('T')[0],
      createdAt: existing ? existing.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      locked: existing ? !!existing.locked : false
    };

    this.entries.set(compositeKey, record);

    if (!this.normIndex.has(normEng)) {
      this.normIndex.set(normEng, []);
    }
    const list = this.normIndex.get(normEng);
    const idx = list.findIndex(r => normalizeText(r.context) === normCtx);
    if (idx >= 0) list[idx] = record;
    else list.push(record);

    this.scheduleSave();
    return true;
  }

  /**
   * Schedule debounced save to file system
   */
  scheduleSave() {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.save();
    }, 1000);
  }

  /**
   * Synchronous save to persistent JSON disk storage
   */
  save() {
    const dataObj = {};
    for (const [key, record] of this.entries.entries()) {
      dataObj[`${record.english}:::${record.context}`] = record;
    }

    try {
      const jsonStr = JSON.stringify(dataObj, null, 2);
      fs.writeFileSync(TM_FILE_PATH1, jsonStr, 'utf-8');
      fs.writeFileSync(TM_FILE_PATH2, jsonStr, 'utf-8');
    } catch (err) {
      console.warn('[TM] Save error:', err.message);
    }
  }

  /**
   * Reload from disk
   */
  reload() {
    console.log('[TM] Reloading Translation Memory from disk...');
    return this.load();
  }

  /**
   * Export all database records
   */
  export() {
    if (!this.isLoaded) {
      this.load();
    }
    const dataObj = {};
    for (const record of this.entries.values()) {
      dataObj[`${record.english}:::${record.context}`] = record;
    }
    return dataObj;
  }

  /**
   * Return statistics report object
   */
  stats() {
    if (!this.isLoaded) {
      this.load();
    }
    let reviewed = 0;
    let learned = 0;
    for (const record of this.entries.values()) {
      if (record.reviewed) reviewed++;
      else learned++;
    }

    const avgLookupTime = this.statsData.totalLookups > 0
      ? `${(this.statsData.totalLookupTimeMs / this.statsData.totalLookups).toFixed(2)}ms`
      : '0.00ms';

    return {
      entries: this.entries.size,
      reviewed,
      learned,
      fuzzyMatches: this.statsData.fuzzyMatches,
      exactMatches: this.statsData.exactMatches,
      cacheHits: this.statsData.cacheHits,
      averageLookupTime: avgLookupTime
    };
  }
}

export const translationMemoryService = new TranslationMemoryService();
export default translationMemoryService;
