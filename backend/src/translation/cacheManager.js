import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CACHE_DIR = path.resolve(__dirname, '../../../shared/localization/cache');
const CACHE_FILE_PATH = path.join(CACHE_DIR, 'translation_cache.json');

export const CACHE_VERSION = "v3";

/**
 * Smarter Translation Cache Manager with Cache Versioning and Rich Metadata
 * Keyed by English + Category + Component with persistent JSON storage.
 */
class TranslationCacheManager {
  constructor() {
    this.cache = new Map();
    this.isLoaded = false;
    this._ensureLoaded();
  }

  /**
   * Build composite key from English text, category, and component.
   * @private
   */
  _buildKey(english, category = 'General', component = 'UI Element') {
    const normEng = (english || '').toLowerCase().trim();
    const normCat = (category || 'General').toLowerCase().trim();
    const normComp = (component || 'UI Element').toLowerCase().trim();
    return `${normEng}||${normCat}||${normComp}`;
  }

  load() {
    this.isLoaded = false;
    this._ensureLoaded();
  }

  /**
   * Ensure cache file directory exists and load persisted cache entries.
   * @private
   */
  _ensureLoaded() {
    if (this.isLoaded) return;
    try {
      if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
      }

      if (fs.existsSync(CACHE_FILE_PATH)) {
        const raw = fs.readFileSync(CACHE_FILE_PATH, 'utf-8');
        const data = JSON.parse(raw);
        if (Array.isArray(data)) {
          for (const entry of data) {
            const key = this._buildKey(entry.english, entry.category, entry.component);
            this.cache.set(key, entry);
          }
        }
      }
      this.isLoaded = true;
    } catch (err) {
      console.error('[CacheManager] Error loading persistent cache file:', err.message);
      this.isLoaded = true;
    }
  }

  /**
   * Retrieve cached translation record by English + Category + Component (with fallbacks).
   * Verifies CACHE_VERSION.
   * 
   * @param {string} english 
   * @param {string} [category="General"] 
   * @param {string} [component="UI Element"] 
   * @returns {Object|null} Cached translation record or null.
   */
  get(english, category = 'General', component = 'UI Element') {
    this._ensureLoaded();
    if (!english) return null;

    let match = null;
    const primaryKey = this._buildKey(english, category, component);

    if (this.cache.has(primaryKey)) {
      match = this.cache.get(primaryKey);
    } else {
      // Fallback 1: Match English + Category
      const categoryKeyPrefix = `${(english || '').toLowerCase().trim()}||${(category || 'General').toLowerCase().trim()}||`;
      for (const [key, entry] of this.cache.entries()) {
        if (key.startsWith(categoryKeyPrefix)) {
          match = entry;
          break;
        }
      }

      if (!match) {
        // Fallback 2: Match English
        const englishPrefix = `${(english || '').toLowerCase().trim()}||`;
        for (const [key, entry] of this.cache.entries()) {
          if (key.startsWith(englishPrefix)) {
            match = entry;
            break;
          }
        }
      }
    }

    if (match && match.cacheVersion !== CACHE_VERSION) {
      // Outdated cache version automatically invalid
      return null;
    }

    return match;
  }

  /**
   * Store translation record into cache with rich metadata and persist to disk.
   * 
   * @param {Object} record
   */
  set(record) {
    this._ensureLoaded();
    if (!record || !record.english || !record.translation) return;

    const now = new Date().toISOString();
    const entry = {
      english: record.english,
      translation: record.translation,
      confidence: record.confidence !== undefined ? record.confidence : 1.0,
      createdAt: record.createdAt || now,
      updatedAt: now,
      glossaryApplied: record.glossaryApplied || false,
      refinementApplied: record.refinementApplied || false,
      qaPassed: record.qaPassed !== undefined ? record.qaPassed : true,
      remainingEnglish: record.remainingEnglish || 0,
      cacheVersion: CACHE_VERSION,
      category: record.category || 'General',
      component: record.component || 'UI Element',
      promptType: record.promptType || record.category || 'General'
    };

    const key = this._buildKey(entry.english, entry.category, entry.component);
    this.cache.set(key, entry);

    this.persist();
  }

  /**
   * Flush in-memory cache to JSON disk storage.
   */
  persist() {
    try {
      const data = Array.from(this.cache.values());
      fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error('[CacheManager] Failed to persist cache to disk:', err.message);
    }
  }
}

export const cacheManager = new TranslationCacheManager();
export default cacheManager;
