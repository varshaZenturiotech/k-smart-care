import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dynamic relative resolution to allow non-hardcoded path resolution
const DEFAULT_GLOSSARY_PATH = path.resolve(__dirname, '../../../shared/localization/glossary/government_glossary.json');

/**
 * Singleton Glossary Service to manage government terminology loading,
 * phrase/word matching, token masking, and technical term identification.
 */
class GlossaryService {
  constructor() {
    this.glossaryEntries = [];
    this.glossaryMap = new Map();
    this.isLoaded = false;
  }

  /**
   * Load the shared government glossary from disk (Singleton pattern).
   * @param {string} [customPath] Optional override path for the glossary JSON file.
   * @returns {boolean} True if loaded successfully, false otherwise.
   */
  loadGlossary(customPath = DEFAULT_GLOSSARY_PATH) {
    if (this.isLoaded && customPath === DEFAULT_GLOSSARY_PATH) {
      return true;
    }

    try {
      const resolvedPath = path.resolve(customPath);
      if (!fs.existsSync(resolvedPath)) {
        console.warn(`[GlossaryService] Glossary file not found at: ${resolvedPath}`);
        return false;
      }

      const rawData = fs.readFileSync(resolvedPath, 'utf-8');
      this.glossaryEntries = JSON.parse(rawData);
      this.glossaryMap.clear();

      for (const entry of this.glossaryEntries) {
        if (entry && entry.english && entry.malayalam) {
          const key = entry.english.toLowerCase().trim();
          this.glossaryMap.set(key, entry);
        }
      }

      this.isLoaded = true;
      console.log(`[GlossaryService] Successfully loaded ${this.glossaryEntries.length} glossary terms.`);
      return true;
    } catch (error) {
      console.error('[GlossaryService] Error loading glossary file:', error.message);
      return false;
    }
  }

  /**
   * Get Malayalam translation/transliteration for a specific English word or phrase.
   * @param {string} word English word or phrase.
   * @returns {string|null} Malayalam translation if found, otherwise null.
   */
  getTranslation(word) {
    if (!word || typeof word !== 'string') return null;
    this._ensureLoaded();
    const entry = this.glossaryMap.get(word.toLowerCase().trim());
    return entry ? entry.malayalam : null;
  }

  /**
   * Get category of a word in the government glossary.
   * @param {string} word 
   * @returns {string|null} Category name (UI, AI, Government, etc.) or null.
   */
  getCategory(word) {
    if (!word || typeof word !== 'string') return null;
    this._ensureLoaded();
    const entry = this.glossaryMap.get(word.toLowerCase().trim());
    return entry ? entry.category || null : null;
  }

  /**
   * Check if a word is a technical term (UI, AI, IT acronym, or marked for transliteration).
   * @param {string} word 
   * @returns {boolean}
   */
  isTechnicalWord(word) {
    if (!word || typeof word !== 'string') return false;
    this._ensureLoaded();
    const cleaned = word.toLowerCase().trim();
    const entry = this.glossaryMap.get(cleaned);

    if (entry) {
      return (
        entry.category === 'UI' ||
        entry.category === 'AI' ||
        entry.category === 'Authentication' ||
        entry.type === 'transliterate'
      );
    }

    // Heuristic detection for common IT acronyms/terms
    const techPattern = /^[A-Z0-9_-]{2,10}$/i;
    const knownTech = /^(api|jwt|gis|geojson|mongodb|rag|llm|ocr|url|pdf|id|sso|mfa|ui|ux|http|https|json|css|html|xml|sql)$/i;
    return techPattern.test(word) || knownTech.test(cleaned);
  }

  /**
   * Determine whether a word should be transliterated into Malayalam script instead of translated.
   * @param {string} word 
   * @returns {boolean}
   */
  shouldTransliterate(word) {
    if (!word || typeof word !== 'string') return false;
    this._ensureLoaded();
    const entry = this.glossaryMap.get(word.toLowerCase().trim());

    if (entry) {
      return entry.type === 'transliterate';
    }

    return this.isTechnicalWord(word);
  }

  /**
   * Replace English & non-standard Malayalam terms in text using government glossary.
   * Supports category-specific overrides and synonyms when options parameter is passed.
   * Preserves placeholders like {{count}}, {{date}}, {{user}}, %s, {name}, and HTML tags.
   * @param {string} text Input text to transform.
   * @param {Object|string} [options] Optional configuration object or category string.
   * @param {string} [options.category] Category for context-specific overrides.
   * @returns {string} Text with replaced government terms.
   */
  replaceGlossaryTerms(text, options = {}) {
    if (!text || typeof text !== 'string') return text || '';
    this._ensureLoaded();

    const category = typeof options === 'string' ? options : options?.category;

    try {
      // 1. Mask placeholders and HTML elements to avoid corruption during substitution
      const { maskedText, placeholders } = this._maskPlaceholders(text);

      let result = maskedText;

      // 2. Pre-process known non-standard phrases/mistranslations
      const mistranslations = [
        { target: /നിയന്ത്രണ പാനൽ/gi, replacement: 'ഡാഷ്ബോർഡ്' },
        { target: /സമ്മേളനം/gi, replacement: 'മീറ്റിംഗ്' },
        { target: /തൊഴിൽ പ്ലാനർ/gi, replacement: 'ടാസ്ക് പ്ലാനർ' },
        { target: /വർക്ക് പ്ലാനർ/gi, replacement: 'ടാസ്ക് പ്ലാനർ' },
        { target: /രഹസ്യവാക്ക്/gi, replacement: 'പാസ്‌വേഡ്' }
      ];

      for (const rule of mistranslations) {
        result = result.replace(rule.target, rule.replacement);
      }

      // 3. Sort entries: category match > preferred > phrase length (descending)
      const sortedEntries = [...this.glossaryEntries].sort((a, b) => {
        const aCatMatch = category && a.category?.toLowerCase() === category.toLowerCase() ? 1 : 0;
        const bCatMatch = category && b.category?.toLowerCase() === category.toLowerCase() ? 1 : 0;
        if (aCatMatch !== bCatMatch) return bCatMatch - aCatMatch;

        const aPref = a.preferred ? 1 : 0;
        const bPref = b.preferred ? 1 : 0;
        if (aPref !== bPref) return bPref - aPref;

        return (b.english ? b.english.length : 0) - (a.english ? a.english.length : 0);
      });

      for (const entry of sortedEntries) {
        if (!entry || !entry.english || (!entry.malayalam && !entry.translation)) continue;

        const malTranslation = entry.translation || entry.malayalam;

        // Match main English term
        const escaped = entry.english.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escaped}\\b`, 'gi');

        if (regex.test(result)) {
          result = result.replace(regex, malTranslation);
        }

        // Match synonyms if present
        if (Array.isArray(entry.synonyms)) {
          for (const syn of entry.synonyms) {
            if (!syn || typeof syn !== 'string') continue;
            const synEscaped = syn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const synRegex = new RegExp(`\\b${synEscaped}\\b`, 'gi');
            if (synRegex.test(result)) {
              result = result.replace(synRegex, malTranslation);
            }
          }
        }
      }

      // 4. Restore preserved placeholders and tags
      return this._unmaskPlaceholders(result, placeholders);
    } catch (error) {
      console.error('[GlossaryService] Error replacing glossary terms:', error.message);
      return text;
    }
  }

  /**
   * Find matching glossary terms in source text for LLM prompt injection.
   * @param {string} text Input text string.
   * @param {Object|string} [options] Category string or options object.
   * @returns {Array<{english: string, malayalam: string, category: string}>}
   */
  findMatchingGlossaryTerms(text, options = {}) {
    if (!text || typeof text !== 'string') return [];
    this._ensureLoaded();

    const category = typeof options === 'string' ? options : options?.category;
    const matches = [];
    const seen = new Set();

    const sortedEntries = [...this.glossaryEntries].sort((a, b) => 
      (b.english ? b.english.length : 0) - (a.english ? a.english.length : 0)
    );

    for (const entry of sortedEntries) {
      if (!entry || !entry.english || (!entry.malayalam && !entry.translation)) continue;
      const engLower = entry.english.toLowerCase();
      if (seen.has(engLower)) continue;

      const escaped = entry.english.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'i');

      if (regex.test(text)) {
        seen.add(engLower);
        matches.push({
          english: entry.english,
          malayalam: entry.translation || entry.malayalam,
          category: entry.category
        });
      }
    }

    return matches;
  }

  /**
   * Internal helper to mask placeholders and HTML tags before replacement.
   * @private
   */
  _maskPlaceholders(text) {
    const placeholders = [];
    // Regex matching {{var}}, {var}, %s, and HTML tags like <strong>, <div>, <br/>, etc.
    const tokenRegex = /({{[^}]+}}|{[^}]+}|%s|%d|<[^>]+>)/g;

    const maskedText = text.replace(tokenRegex, (match) => {
      const key = `__GLOSSARY_TOKEN_${placeholders.length}__`;
      placeholders.push({ key, original: match });
      return key;
    });

    return { maskedText, placeholders };
  }

  /**
   * Internal helper to restore masked tokens.
   * @private
   */
  _unmaskPlaceholders(maskedText, placeholders) {
    let unmasked = maskedText;
    for (const token of placeholders) {
      unmasked = unmasked.replace(token.key, token.original);
    }
    return unmasked;
  }

  /**
   * Ensure glossary is loaded prior to performing queries.
   * @private
   */
  _ensureLoaded() {
    if (!this.isLoaded) {
      this.loadGlossary();
    }
  }
}

// Instantiate Singleton
const glossaryService = new GlossaryService();

// Export bound methods and singleton default
export const loadGlossary = (customPath) => glossaryService.loadGlossary(customPath);
export const getTranslation = (word) => glossaryService.getTranslation(word);
export const getCategory = (word) => glossaryService.getCategory(word);
export const isTechnicalWord = (word) => glossaryService.isTechnicalWord(word);
export const shouldTransliterate = (word) => glossaryService.shouldTransliterate(word);
export const replaceGlossaryTerms = (text, options) => glossaryService.replaceGlossaryTerms(text, options);
export const findMatchingGlossaryTerms = (text, options) => glossaryService.findMatchingGlossaryTerms(text, options);

export default glossaryService;

