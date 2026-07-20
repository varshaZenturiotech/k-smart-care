import { normalizeMalayalamText } from "../../utils/language.js";
import { INTENTS } from "../../constants/intents.js";

/**
 * Deterministic Crisis Detector.
 * Executes BEFORE any LLM call to guarantee absolute safety and instant empathetic crisis support.
 */
class CrisisDetector {
  constructor() {
    // English trigger terms
    this.englishKeywords = [
      "suicide", "kill myself", "end my life", "want to die", "self harm",
      "cut myself", "no reason to live", "hopeless", "can't go on", "feel like dying",
      "ending it all", "take my life"
    ];

    // Malayalam trigger terms
    this.malayalamKeywords = [
      "ആത്മഹത്യ", "മരിക്കണം", "ജീവിതം അവസാനിപ്പിക്കണം", "മരിക്കാൻ തോന്നുന്നു",
      "സ്വയം ഉപദ്രവിക്കുക", "ജീവനെടുക്കുക", "മരിക്കാൻ പോകുന്നു"
    ];
  }

  /**
   * Scans user input for crisis phrases deterministically.
   * @param {string} text
   * @returns {{ isCrisis: boolean, response: Object|null }}
   */
  detect(text = "") {
    if (!text || typeof text !== "string") return { isCrisis: false, response: null };

    const lowerText = text.toLowerCase();
    const normalizedText = normalizeMalayalamText(text);

    const matchEng = this.englishKeywords.some((kw) => lowerText.includes(kw));
    const matchMl = this.malayalamKeywords.some((kw) => normalizedText.includes(kw) || text.includes(kw));

    if (matchEng || matchMl) {
      // Log ONLY an anonymized flag. Do NOT log user text or identity.
      console.warn(`[CRISIS_FLAG] Crisis detected at ${new Date().toISOString()}`);

      const isMalayalam = matchMl || /[\u0D00-\u0D7F]/.test(text);

      const answer = isMalayalam
        ? `നിങ്ങൾ ഒറ്റയ്ക്കല്ല. നിങ്ങളുടെ വികാരങ്ങളെയും പ്രയാസങ്ങളെയും ഞങ്ങൾ മാനിക്കുന്നു. ദയവായി തനിയെ സഹിക്കരുത്, സഹായം ലഭ്യമാണ്.\n\n**സഹായ കേന്ദ്രങ്ങൾ (Kerala Helpline Numbers):**\n- **Tele-MANAS (Govt of India):** 14416 / 1-800-891-4416 (24x7 Toll-free)\n- **DISHA Kerala Health Helpline:** 1056 / 0471-2552056\n- **Maitri Suicide Prevention:** 0484-2540530\n\nദയവായി നിങ്ങളുടെ കുടുംബാംഗങ്ങളോടോ, അടുത്ത സുഹൃത്തുക്കളോടോ, അല്ലെങ്കിൽ ഒരു ആരോഗ്യ വിദഗ്ദ്ധനോടോ സംസാരിക്കുക.`
        : `You are not alone, and support is available right now. Please reach out to someone who can help.\n\n**Kerala & National Mental Health Helplines:**\n- **Tele-MANAS (Govt of India):** 14416 / 1-800-891-4416 (24x7 Toll-free)\n- **DISHA Kerala Health Helpline:** 1056 / 0471-2552056\n- **Maitri Suicide Prevention Line:** 0484-2540530\n\nPlease talk to a family member, trusted colleague, supervisor, or healthcare professional immediately. Your well-being matters.`;

      return {
        isCrisis: true,
        response: {
          type: "crisis_support",
          intent: INTENTS.CRISIS_SUPPORT,
          mode: "general_knowledge",
          answer,
          message: "Crisis safety protocol activated.",
          citations: [],
          sources: [],
          confidence: 1.0,
          usedRAG: false,
          usedGeneralKnowledge: true,
          suggestions: [
            "Tele-MANAS 14416",
            "DISHA Helpline 1056",
            "Talk to a trusted colleague"
          ],
          structuredData: {
            helplines: [
              { name: "Tele-MANAS", number: "14416", desc: "Toll-free 24x7 Mental Health Helpline" },
              { name: "DISHA Kerala", number: "1056", desc: "Kerala State Health Services Helpline" },
              { name: "Maitri Kochi", number: "0484-2540530", desc: "Emotional Support Helpline" }
            ]
          }
        }
      };
    }

    return { isCrisis: false, response: null };
  }
}

export const crisisDetector = new CrisisDetector();
export default crisisDetector;
