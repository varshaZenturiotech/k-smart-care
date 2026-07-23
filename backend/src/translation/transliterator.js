/**
 * Static dictionary mapping technical terms, brand names, and acronyms
 * to their standard Malayalam script representations.
 */
const dictionary = {
  Dashboard: "ഡാഷ്ബോർഡ്",
  Meeting: "മീറ്റിംഗ്",
  Meetings: "മീറ്റിംഗുകൾ",
  meetings: "മീറ്റിംഗുകൾ",
  Task: "ടാസ്ക്",
  Tasks: "ടാസ്കുകൾ",
  tasks: "ടാസ്കുകൾ",
  Workflow: "വർക്ക്ഫ്ലോ",
  Repository: "റിപ്പോസിറ്ററി",
  Upload: "അപ്ലോഡ്",
  Download: "ഡൗൺലോഡ്",
  Search: "സെർച്ച്",
  Login: "ലോഗിൻ",
  Logout: "ലോഗൗട്ട്",
  File: "ഫയൽ",
  Files: "ഫയലുകൾ",
  AI: "എ.ഐ",
  PDF: "പി.ഡി.എഫ്",
  OTP: "ഒ.ടി.പി",
  JWT: "ജെ.ഡബ്ല്യു.ടി",
  API: "എ.പി.ഐ",
  GIS: "ജി.ഐ.എസ്",
  GeoJSON: "ജിയോജെസൺ",
  MongoDB: "മോംഗോ ഡി.ബി",
  PostgreSQL: "പോസ്റ്റ്ഗ്രെഎസ്ക്യുഎൽ",
  Redis: "റെഡിസ്",
  React: "റിയാക്റ്റ്",
  "Node.js": "നോഡ്.ജെ.എസ്",
  CSV: "സി.എസ്.വി",
  Excel: "എക്സൽ",
  Analytics: "അനലിറ്റിക്സ്",
  Notification: "നോട്ടിഫിക്കേഷൻ"
};

/**
 * Case-insensitive lookup map built from the static dictionary.
 */
const lookupMap = new Map();
for (const [key, value] of Object.entries(dictionary)) {
  lookupMap.set(key.toLowerCase(), value);
}

/**
 * Set of recognized technical terms / acronyms that are allowed to be transliterated.
 */
const recognizedTechnicalTerms = new Set(
  Object.keys(dictionary).map(k => k.toLowerCase())
);

/**
 * Transliterates technical English words or sentences into Malayalam script.
 * Only transliterates known technical terms/acronyms; normal English words are preserved or handled by translator.
 * 
 * @param {string} text Input text or technical word.
 * @returns {Promise<string>|string} Transliterated Malayalam text.
 */
export async function transliterate(text) {
  if (!text || typeof text !== 'string' || !text.trim()) {
    return text || '';
  }

  try {
    const cleaned = text.trim();
    const lowerKey = cleaned.toLowerCase();

    // Direct dictionary lookup
    if (lookupMap.has(lowerKey)) {
      return lookupMap.get(lowerKey);
    }

    // Sentence level word replacement for terms in the fallback dictionary
    let result = text;
    for (const [key, val] of Object.entries(dictionary)) {
      const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
      if (regex.test(result)) {
        result = result.replace(regex, val);
      }
    }

    // Secondary cleanup: normalize any loose English plural suffixes (e.g. ടാസ്ക്സ് -> ടാസ്കുകൾ)
    result = result.replace(/ടാസ്ക്സ്/g, "ടാസ്കുകൾ").replace(/മീറ്റിംഗ്സ്/g, "മീറ്റിംഗുകൾ");

    return result;
  } catch (error) {
    console.error(`[Transliterator] Error transliterating "${text}":`, error.message);
    return text;
  }
}

/**
 * Transliterates a batch of technical terms into Malayalam script.
 * 
 * @param {string[]} texts Array of terms or sentences to transliterate.
 * @returns {Promise<string[]>} Array of transliterated Malayalam strings.
 */
export async function transliterateBatch(texts) {
  if (!Array.isArray(texts)) {
    console.error('[Transliterator] transliterateBatch expected an array of strings.');
    return [];
  }
  return Promise.all(texts.map(item => transliterate(item)));
}

export default {
  transliterate,
  transliterateBatch
};
