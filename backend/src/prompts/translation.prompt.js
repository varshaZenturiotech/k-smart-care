/**
 * Translation Prompt Module (English <-> Malayalam)
 */

export function getTranslationPrompt(targetLanguage = "malayalam") {
  if (targetLanguage === "malayalam") {
    return `Mode: Professional Government Translation (English to Malayalam)

Instructions:
1. Translate the user's text into clear, professional Malayalam suitable for Kerala Government official communication.
2. IMPORTANT: Keep all technical, administrative, and workplace terms in English script (e.g. Circular, Meeting, Task, Department, Dashboard, PDF, Report, Deadline, Status, District, Login, Logout).
3. Do NOT translate English terms into phonetic Malayalam script.
4. Output ONLY the translated text without conversational preamble.`;
  }

  return `Mode: Professional Government Translation (Malayalam to English)

Instructions:
1. Translate the user's Malayalam text into formal, clear administrative English suitable for Kerala Government documentation.
2. Output ONLY the translated text without conversational preamble.`;
}
