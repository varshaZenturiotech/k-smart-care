import { INTENTS } from "../../constants/intents.js";
import { getBasePrompt } from "../../prompts/base.prompt.js";
import { getCircularPrompt } from "../../prompts/circular.prompt.js";
import { getProductivityPrompt } from "../../prompts/productivity.prompt.js";
import { getWellbeingPrompt } from "../../prompts/wellbeing.prompt.js";
import { getTranslationPrompt } from "../../prompts/translation.prompt.js";
import { getEmailPrompt } from "../../prompts/email.prompt.js";
import { getMeetingPrompt } from "../../prompts/meeting.prompt.js";
import { composePrompt } from "../../utils/promptComposer.js";

/**
 * Prompt Builder Service.
 * Dynamically selects and composes prompt modules based on classified intent and effective language.
 */
class PromptBuilder {
  /**
   * Constructs the full system prompt for LLM invocation.
   * @param {string} intent
   * @param {string} effectiveLanguage
   * @param {{ context?: string, extraInstructions?: string, historyText?: string, isOngoingConversation?: boolean }} options
   * @returns {string}
   */
  buildPrompt(
    intent,
    effectiveLanguage = "english",
    { context = "", extraInstructions = "", historyText = "", isOngoingConversation = false } = {}
  ) {
    const basePrompt = getBasePrompt(effectiveLanguage);
    let modulePrompt = "";

    switch (intent) {
      case INTENTS.DOCUMENT_QA:
      case INTENTS.DOCUMENT_SUMMARY:
      case INTENTS.POLICY_EXPLANATION:
        modulePrompt = getCircularPrompt();
        break;

      case INTENTS.TASK_ASSISTANCE:
      case INTENTS.PRODUCTIVITY_COACHING:
        modulePrompt = getProductivityPrompt();
        break;

      case INTENTS.WORKPLACE_WELLBEING:
      case INTENTS.DAILY_MOTIVATION:
        modulePrompt = getWellbeingPrompt();
        break;

      case INTENTS.TRANSLATION:
        modulePrompt = getTranslationPrompt(effectiveLanguage);
        break;

      case INTENTS.EMAIL_DRAFTING:
        modulePrompt = getEmailPrompt();
        break;

      case INTENTS.MEETING_ASSISTANCE:
        modulePrompt = getMeetingPrompt();
        break;

      case INTENTS.GENERAL_GOVERNMENT:
      case INTENTS.UNKNOWN:
      default:
        modulePrompt = "";
        break;
    }

    return composePrompt({
      basePrompt,
      modulePrompt,
      languageDirective: "", // Base prompt already includes language instructions
      context,
      extraInstructions,
      historyText,
      isOngoingConversation,
    });
  }

}

export function getPromptFileName(intent) {
  switch (intent) {
    case INTENTS.DOCUMENT_QA:
    case INTENTS.DOCUMENT_SUMMARY:
    case INTENTS.POLICY_EXPLANATION:
      return "circular.prompt.js";
    case INTENTS.TASK_ASSISTANCE:
    case INTENTS.PRODUCTIVITY_COACHING:
      return "productivity.prompt.js";
    case INTENTS.WORKPLACE_WELLBEING:
    case INTENTS.DAILY_MOTIVATION:
      return "wellbeing.prompt.js";
    case INTENTS.TRANSLATION:
      return "translation.prompt.js";
    case INTENTS.EMAIL_DRAFTING:
      return "email.prompt.js";
    case INTENTS.MEETING_ASSISTANCE:
      return "meeting.prompt.js";
    default:
      return "base.prompt.js";
  }
}

export const promptBuilder = new PromptBuilder();
export default promptBuilder;


