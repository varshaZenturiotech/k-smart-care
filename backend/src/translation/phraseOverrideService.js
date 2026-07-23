/**
 * PhraseOverrideService
 * Modular, Case-Insensitive, O(1) Office Malayalam Phrase Override Engine.
 * Loads 17 modular JSON files from shared/localization/styleguide/phraseOverrides/
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OVERRIDES_DIR = path.resolve(__dirname, '../../../shared/localization/styleguide/phraseOverrides');
const MASTER_FILE_PATH = path.resolve(__dirname, '../../../shared/localization/styleguide/phraseOverrides.json');

class PhraseOverrideService {
  constructor() {
    this.overrideMap = new Map(); // Case-insensitive key -> { rawKey, value, category }
    this.categoryCounts = {};
    this.totalPhrases = 0;
    this.matchedCount = 0;
    this.missedCount = 0;
    this.isLoaded = false;
  }

  /**
   * Load or reload all modular phrase JSON files from disk.
   */
  load() {
    this.overrideMap.clear();
    this.categoryCounts = {};
    let count = 0;

    if (fs.existsSync(OVERRIDES_DIR)) {
      try {
        const files = fs.readdirSync(OVERRIDES_DIR).filter(f => f.endsWith('.json'));
        files.forEach(file => {
          const catName = path.basename(file, '.json');
          const filePath = path.join(OVERRIDES_DIR, file);
          try {
            const raw = fs.readFileSync(filePath, 'utf-8');
            const data = JSON.parse(raw);
            let catCount = 0;
            for (const [key, value] of Object.entries(data)) {
              if (key && value && typeof value === 'string') {
                const lowerKey = key.trim().toLowerCase();
                if (!this.overrideMap.has(lowerKey)) {
                  this.overrideMap.set(lowerKey, {
                    rawKey: key.trim(),
                    value: value.trim(),
                    category: catName
                  });
                  count++;
                  catCount++;
                }
              }
            }
            this.categoryCounts[catName] = catCount;
          } catch (err) {
            console.warn(`[PhraseOverrideService] Error reading file ${file}:`, err.message);
          }
        });
      } catch (err) {
        console.warn(`[PhraseOverrideService] Error scanning directory ${OVERRIDES_DIR}:`, err.message);
      }
    }

    // Fallback to master file if directory scan loaded nothing
    if (count === 0 && fs.existsSync(MASTER_FILE_PATH)) {
      try {
        const raw = fs.readFileSync(MASTER_FILE_PATH, 'utf-8');
        const data = JSON.parse(raw);
        for (const [key, value] of Object.entries(data)) {
          if (key && value) {
            const lowerKey = key.trim().toLowerCase();
            if (!this.overrideMap.has(lowerKey)) {
              this.overrideMap.set(lowerKey, {
                rawKey: key.trim(),
                value: value.trim(),
                category: 'general'
              });
              count++;
            }
          }
        }
      } catch (err) {
        console.warn(`[PhraseOverrideService] Error reading master file ${MASTER_FILE_PATH}:`, err.message);
      }
    }

    this.totalPhrases = this.overrideMap.size;
    this.isLoaded = true;
    return this.totalPhrases;
  }

  /**
   * Fast O(1) Case-Insensitive Lookup for exact phrase matches.
   * 
   * @param {string} englishText English phrase to translate.
   * @returns {string|null} Curated Malayalam phrase or null if missed.
   */
  lookup(englishText) {
    if (!this.isLoaded) {
      this.load();
    }

    if (!englishText || typeof englishText !== 'string') {
      return null;
    }

    const cleaned = englishText.trim();
    const lower = cleaned.toLowerCase();

    if (this.overrideMap.has(lower)) {
      this.matchedCount++;
      return this.overrideMap.get(lower).value;
    }

    this.missedCount++;
    return null;
  }

  /**
   * Reload method for hot reload support during development.
   */
  reload() {
    console.log('[PhraseOverrideService] Reloading phrase overrides from disk...');
    return this.load();
  }

  /**
   * Get phrase override hit/miss statistics.
   * 
   * @returns {Object} Statistics report object.
   */
  getStats() {
    const totalRequests = this.matchedCount + this.missedCount;
    const hitRatePct = totalRequests > 0 ? Math.round((this.matchedCount / totalRequests) * 100) : 0;

    return {
      totalPhrases: this.totalPhrases,
      categoriesCount: Object.keys(this.categoryCounts).length,
      matched: this.matchedCount,
      missed: this.missedCount,
      totalRequests,
      hitRate: `${hitRatePct}%`
    };
  }

  /**
   * Print pretty statistics table to console.
   */
  logStats() {
    const stats = this.getStats();
    console.log('\n====================================');
    console.log('Phrase Override Statistics');
    console.log('====================================');
    console.log(`Total Phrases : ${stats.totalPhrases}`);
    console.log(`Categories    : ${stats.categoriesCount}`);
    console.log(`Matched       : ${stats.matched}`);
    console.log(`Missed        : ${stats.missed}`);
    console.log(`Hit Rate      : ${stats.hitRate}`);
    console.log('====================================\n');
  }
}

// Export Singleton Instance
export const phraseOverrideService = new PhraseOverrideService();
export default phraseOverrideService;
