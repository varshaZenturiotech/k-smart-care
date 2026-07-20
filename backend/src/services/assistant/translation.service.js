import llmService from "./llm.service.js";
import promptBuilder from "./promptBuilder.js";
import { INTENTS } from "../../constants/intents.js";
import { formatAssistantResponse } from "../../utils/responseFormatter.js";

/**
 * Translation Service for English <-> Malayalam
 */
class TranslationService {
  /**
   * Executes translation and returns structured output.
   * @param {string} text
   * @param {string} targetLanguage
   * @returns {Promise<Object>} Formatted response with type "translation"
   */
  async translate(text = "", targetLanguage = "malayalam") {
    if (!llmService.hasKey()) {
      return formatAssistantResponse({
        type: "translation",
        mode: "general_knowledge",
        answer: "[Development fallback - missing GROQ_API_KEY] Translation service requires a valid GROQ_API_KEY.",
        usedGeneralKnowledge: true,
      });
    }

    try {
      const systemPrompt = promptBuilder.buildPrompt(INTENTS.TRANSLATION, targetLanguage);
      const translatedText = await llmService.generateCompletion(systemPrompt, { question: text }, { temperature: 0.2 });

      return formatAssistantResponse({
        type: "translation",
        mode: "general_knowledge",
        answer: translatedText || text,
        usedGeneralKnowledge: true,
        structuredData: {
          originalText: text,
          translatedText: translatedText || text,
          targetLanguage,
        },
      });
    } catch (err) {
      console.error("[TranslationService] Error during translation:", err.message);
      return formatAssistantResponse({
        type: "translation",
        mode: "general_knowledge",
        answer: "Failed to perform translation. Please try again.",
        usedGeneralKnowledge: true,
      });
    }
  }
}

export const translationService = new TranslationService();
export default translationService;
