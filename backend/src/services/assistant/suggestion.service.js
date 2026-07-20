import Circular from "../../models/Circular.model.js";
import User from "../../models/User.model.js";
import llmService from "./llm.service.js";
import { getSuggestionPrompt } from "../../prompts/suggestion.prompt.js";
import { getDefaultSuggestions } from "../../prompts/assistant.prompt.js";

const suggestionsCache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Suggestion Service - Manages AI-generated prompt suggestions and caching.
 */
class SuggestionService {
  /**
   * Generates or retrieves cached prompt suggestions for a circular.
   * @param {{ circularId?: string, preferredLanguage?: string, userId?: string, requestLanguage?: string }} options
   * @returns {Promise<{ success: boolean, suggestions: Array<string>, cached?: boolean }>}
   */
  async getSuggestions({ circularId, preferredLanguage = "auto", userId, requestLanguage = "en" }) {
    let activeLanguage = preferredLanguage;

    if (userId) {
      try {
        const user = await User.findById(userId).select("preferredLanguage");
        if (user?.preferredLanguage) {
          activeLanguage = user.preferredLanguage;
        }
      } catch (err) {
        console.error("[SuggestionService] Error loading user preference:", err.message);
      }
    }

    if (circularId) {
      const dynamicActions = await this.getDynamicCircularActions({
        circularId,
        preferredLanguage: activeLanguage,
      });
      return {
        success: true,
        suggestions: dynamicActions,
        options: dynamicActions,
        actions: dynamicActions,
      };
    }

    return {
      success: true,
      suggestions: getDefaultSuggestions(activeLanguage, requestLanguage),
    };

    try {
      const circular = await Circular.findById(circularId).select("title summary keyPoints");
      if (!circular) {
        return {
          success: true,
          suggestions: getDefaultSuggestions(activeLanguage, requestLanguage),
        };
      }

      const sourceText = [
        circular.title ? `Title: ${circular.title}` : "",
        circular.summary ? `Summary: ${circular.summary}` : "",
        circular.keyPoints ? `Key Points:\n${circular.keyPoints}` : "",
      ]
        .filter(Boolean)
        .join("\n\n")
        .slice(0, 4000);

      if (!llmService.hasKey()) {
        return {
          success: true,
          suggestions: getDefaultSuggestions(activeLanguage, requestLanguage),
        };
      }

      let resolvedLanguage = "english";
      if (activeLanguage === "auto") {
        const containsMalayalam = /[\u0D00-\u0D7F]/.test(sourceText);
        resolvedLanguage = containsMalayalam ? "malayalam" : "english";
      } else {
        resolvedLanguage = activeLanguage;
      }

      const promptTemplateStr = getSuggestionPrompt(resolvedLanguage);
      const rawResponse = await llmService.generateCompletion(
        promptTemplateStr,
        { text: sourceText },
        { temperature: 0.4 }
      );

      if (!rawResponse) {
        return {
          success: true,
          suggestions: getDefaultSuggestions(activeLanguage, requestLanguage),
        };
      }

      const suggestions = this.parseSuggestionsJson(rawResponse, activeLanguage, requestLanguage);
      suggestionsCache.set(cacheKey, { suggestions, generatedAt: Date.now() });

      return {
        success: true,
        suggestions,
      };
    } catch (err) {
      console.error("[SuggestionService] Suggestions error:", err.message);
      return {
        success: true,
        suggestions: getDefaultSuggestions(activeLanguage, requestLanguage),
      };
    }
  }

  /**
   * Safely parses JSON output for suggestions.
   */
  parseSuggestionsJson(raw, activeLanguage, requestLanguage) {
    try {
      const cleaned = raw.trim().replace(/^```json\s*|```$/g, "").trim();
      const parsed = JSON.parse(cleaned);

      let suggestions = [];
      if (parsed && typeof parsed === "object") {
        if (Array.isArray(parsed.suggestions)) {
          if (parsed.suggestions.length > 0 && typeof parsed.suggestions[0] === "object" && parsed.suggestions[0] !== null) {
            const first = parsed.suggestions[0];
            if (Array.isArray(first.questions)) {
              suggestions = first.questions;
            } else {
              suggestions = parsed.suggestions.flatMap((item) => (Array.isArray(item.questions) ? item.questions : []));
            }
          } else {
            suggestions = parsed.suggestions;
          }
        } else if (Array.isArray(parsed.questions)) {
          suggestions = parsed.questions;
        }
      }

      if (!Array.isArray(suggestions) || suggestions.length === 0 || typeof suggestions[0] !== "string") {
        return getDefaultSuggestions(activeLanguage, requestLanguage);
      }

      return suggestions.slice(0, 8);
    } catch (err) {
      console.error("[SuggestionService] JSON parsing error:", err.message);
      return getDefaultSuggestions(activeLanguage, requestLanguage);
    }
  }

  /**
   * Generates dynamic AI options/action chips based on circular content.
   * @param {{ circularId?: string, contextText?: string, preferredLanguage?: string }} options
   * @returns {Promise<Array<{ id: string, label: string, intent: string }>>}
   */
  async getDynamicCircularActions({ circularId, contextText = "", preferredLanguage = "english" }) {
    const isMl = preferredLanguage === "malayalam" || preferredLanguage === "ml";
    const resolvedLanguage = isMl ? "malayalam" : "english";

    let sourceText = contextText;

    if (!sourceText && circularId) {
      try {
        const circular = await Circular.findById(circularId).select("title summary keyPoints content");
        if (circular) {
          sourceText = [
            circular.title ? `Title: ${circular.title}` : "",
            circular.summary ? `Summary: ${circular.summary}` : "",
            circular.keyPoints ? `Key Points:\n${circular.keyPoints}` : "",
            circular.content ? `Content:\n${circular.content.slice(0, 2500)}` : "",
          ]
            .filter(Boolean)
            .join("\n\n");
        }
      } catch (err) {
        console.error("[SuggestionService] Error fetching circular for dynamic actions:", err.message);
      }
    }

    if (!sourceText || !sourceText.trim() || !llmService.hasKey()) {
      return this.getDefaultCircularChoices(resolvedLanguage);
    }

    const cacheKey = `dyn_actions_${circularId || Buffer.from(sourceText.slice(0, 100)).toString("base64")}_${resolvedLanguage}`;
    const cached = suggestionsCache.get(cacheKey);
    if (cached && Date.now() - cached.generatedAt < CACHE_TTL_MS) {
      return cached.actions;
    }

    try {
      const promptTemplateStr = getSuggestionPrompt(resolvedLanguage);
      const rawResponse = await llmService.generateCompletion(
        promptTemplateStr,
        { text: sourceText.slice(0, 3500) },
        { temperature: 0.3 }
      );

      if (!rawResponse) {
        return this.getDefaultCircularChoices(resolvedLanguage);
      }

      const actions = this.parseDynamicActionsJson(rawResponse, resolvedLanguage);
      suggestionsCache.set(cacheKey, { actions, generatedAt: Date.now() });
      return actions;
    } catch (err) {
      console.error("[SuggestionService] Dynamic actions generation error:", err.message);
      return this.getDefaultCircularChoices(resolvedLanguage);
    }
  }

  /**
   * Default fallback circular choices when LLM is unavailable or unparseable.
   */
  getDefaultCircularChoices(language = "english") {
    const isMl = language === "malayalam" || language === "ml";
    if (isMl) {
      return [
        { id: "summarize_circular", label: "📄 Circular സംഗ്രഹിക്കുക", intent: "ഈ സർക്കുലർ സംഗ്രഹിക്കുക" },
        { id: "key_changes", label: "📌 പ്രധാന മാറ്റങ്ങൾ", intent: "ഈ സർക്കുലറിലെ പ്രധാന മാറ്റങ്ങൾ എന്തൊക്കെയാണ്?" },
        { id: "show_deadlines", label: "⏰ അവസാന തീയതികൾ", intent: "ഈ സർക്കുലറിലെ പ്രധാന തീയതികളും ഡെഡ്‌ലൈനുകളും കാണിക്കുക" },
        { id: "who_is_affected", label: "👥 ആർക്കെല്ലാം ബാധകം?", intent: "ഈ സർക്കുലർ ആർക്കെല്ലാമാണ് ബാധകമാകുന്നത്?" },
      ];
    }
    return [
      { id: "summarize_circular", label: "📄 Summarize Circular", intent: "Summarize this circular" },
      { id: "key_changes", label: "📌 Key Changes", intent: "What are the key changes in this circular?" },
      { id: "show_deadlines", label: "⏰ Show Deadlines", intent: "What are the important deadlines and dates in this circular?" },
      { id: "who_is_affected", label: "👥 Who Is Affected?", intent: "Who is affected by this circular?" },
    ];
  }

  /**
   * Safely parses JSON output for dynamic actions.
   */
  parseDynamicActionsJson(raw, language = "english") {
    try {
      const cleaned = raw.trim().replace(/^```json\s*|```$/g, "").replace(/^```\s*|```$/g, "").trim();
      const parsed = JSON.parse(cleaned);

      let items = [];
      if (parsed && typeof parsed === "object") {
        if (Array.isArray(parsed.suggestions)) items = parsed.suggestions;
        else if (Array.isArray(parsed.actions)) items = parsed.actions;
        else if (Array.isArray(parsed.options)) items = parsed.options;
      }

      if (!Array.isArray(items) || items.length === 0) {
        return this.getDefaultCircularChoices(language);
      }

      const formatted = items.slice(0, 4).map((item, idx) => {
        if (typeof item === "string") {
          return { id: `dyn_action_${idx}`, label: item, intent: item };
        }
        return {
          id: item.id || `dyn_action_${idx}`,
          label: item.label || item.text || item.title || item.intent || `Option ${idx + 1}`,
          intent: item.intent || item.label || item.question || `Option ${idx + 1}`,
        };
      });

      return formatted.length > 0 ? formatted : this.getDefaultCircularChoices(language);
    } catch (err) {
      console.error("[SuggestionService] Action JSON parse error:", err.message);
      return this.getDefaultCircularChoices(language);
    }
  }
}

export const suggestionService = new SuggestionService();
export default suggestionService;
