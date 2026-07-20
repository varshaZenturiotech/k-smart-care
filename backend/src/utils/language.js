/**
 * Language Utilities for Malayalam and English Resolution
 */

/**
 * Normalizes Malayalam unicode text for robust pattern matching.
 * @param {string} text
 * @returns {string}
 */
export function normalizeMalayalamText(text = "") {
  if (!text) return "";
  return text
    .normalize("NFC")
    .replace(/[\u200B-\u200D]/g, "") // Remove zero-width spaces / joiners
    .trim();
}

/**
 * Scans message text for explicit language requests.
 * @param {string} question
 * @returns {"english" | "malayalam" | null}
 */
export function detectLanguageOverride(question = "") {
  if (!question) return null;
  const q = question.toLowerCase();

  const malayalamPatterns = [
    "in malayalam", "answer in malayalam", "reply in malayalam",
    "explain in malayalam", "translate to malayalam", "translate into malayalam",
    "respond in malayalam", "write in malayalam", "summary in malayalam"
  ];
  const nativeMalayalamTokens = ["മലയാളത്തിൽ", "മലയാളത്തില്‍", "മലയാളം", "മൊഴിമാറ്റുക"];

  for (const pattern of malayalamPatterns) {
    if (new RegExp(pattern).test(q)) return "malayalam";
  }
  for (const native of nativeMalayalamTokens) {
    if (question.includes(native)) return "malayalam";
  }

  const englishPatterns = [
    "in english", "answer in english", "reply in english",
    "explain in english", "translate to english", "translate into english",
    "respond in english", "write in english", "summary in english"
  ];
  for (const pattern of englishPatterns) {
    if (new RegExp(pattern).test(q)) return "english";
  }

  return null;
}

/**
 * Resolves effective language for response generation.
 * Priority: Explicit query override > User profile preference > Auto-detect (Malayalam if text contains Malayalam script).
 * @param {string} question
 * @param {string} preferredLanguage
 * @returns {"english" | "malayalam" | "auto"}
 */
export function resolveResponseLanguage(question = "", preferredLanguage = "auto") {
  const override = detectLanguageOverride(question);
  if (override) return override;
  if (preferredLanguage !== "auto") return preferredLanguage;

  const containsMalayalam = /[\u0D00-\u0D7F]/.test(question);
  if (containsMalayalam) return "malayalam";

  return "english";
}
