import assistantService from "../services/assistant/assistant.service.js";
import suggestionService from "../services/assistant/suggestion.service.js";
import { getWelcomeMessage } from "../prompts/greetings.js";
import translationService from "../translation/translationService.js";

/**
 * Assistant Controller - Thin Controller Implementation.
 * Performs request validation and HTTP responses only.
 */

/**
 * POST /api/assistant/ask
 * Body: { question, circularId?, preferredLanguage?, allowGeneralKnowledge?, history?, chatHistory?, sessionId? }
 */
export async function askQuestion(req, res) {
  const {
    question,
    circularId,
    preferredLanguage = "auto",
    allowGeneralKnowledge = false,
    history,
    chatHistory,
    sessionId = req.user?.id ? `user-${req.user.id}` : "default-session",
  } = req.body;

  if (!question || typeof question !== "string" || !question.trim()) {
    return res.status(400).json({ error: "A non-empty 'question' string is required." });
  }

  try {
    const result = await assistantService.askQuestion(question, {
      circularId,
      preferredLanguage,
      userId: req.user?.id,
      allowGeneralKnowledge,
      history: history || chatHistory,
      sessionId,
    });
    
    const responsePayload = { question, ...result };
    let translated = responsePayload;
    try {
      translated = await translationService.translateResponse(responsePayload, req.language, "/api/assistant/ask");
    } catch (tErr) {
      console.warn("[AssistantController] Localization fallback to raw payload:", tErr.message);
    }
    return res.json(translated);
  } catch (err) {
    console.error("[AssistantController] Error answering question:", err.message);
    return res.status(500).json({ error: "The assistant failed to generate an answer." });
  }
}

/**
 * POST /api/assistant/suggestions
 * Body: { circularId?, preferredLanguage? }
 */
export async function getSuggestions(req, res) {
  const { circularId, preferredLanguage = "auto" } = req.body;

  try {
    const result = await suggestionService.getSuggestions({
      circularId,
      preferredLanguage,
      userId: req.user?.id,
      requestLanguage: req.language || "en",
    });

    let translated = result;
    try {
      translated = await translationService.translateResponse(result, req.language, "/api/assistant/suggestions");
    } catch (tErr) {
      console.warn("[AssistantController] Localization fallback to raw suggestions:", tErr.message);
    }
    return res.json(translated);
  } catch (err) {
    console.error("[AssistantController] Error generating suggestions:", err.message);
    return res.status(500).json({ error: "Failed to generate prompt suggestions." });
  }
}

/**
 * GET / POST /api/assistant/welcome
 * Query / Body: { language?, timeOfDay?, context?, lastIndex? }
 */
export async function getWelcomeGreeting(req, res) {
  try {
    const payload = req.method === "POST" ? req.body : req.query;
    const language = payload.language || req.user?.preferredLanguage || "en";
    const timeOfDay = payload.timeOfDay;
    const context = payload.context || {};
    const lastIndex = typeof payload.lastIndex !== "undefined" ? Number(payload.lastIndex) : -1;

    const greetingResult = getWelcomeMessage({
      language,
      timeOfDay,
      context,
      lastIndex,
    });

    const responsePayload = {
      success: true,
      text: typeof greetingResult === "string" ? greetingResult : greetingResult.text,
      greeting: greetingResult,
    };

    let translated = responsePayload;
    try {
      translated = await translationService.translateResponse(responsePayload, req.language, "/api/assistant/welcome");
    } catch (tErr) {
      console.warn("[AssistantController] Localization fallback to raw welcome greeting:", tErr.message);
    }
    return res.json(translated);
  } catch (err) {
    console.error("[AssistantController] Welcome greeting error:", err.message);
    return res.status(500).json({ error: "Failed to generate welcome greeting." });
  }
}

export default {
  askQuestion,
  getSuggestions,
  getWelcomeGreeting,
};
