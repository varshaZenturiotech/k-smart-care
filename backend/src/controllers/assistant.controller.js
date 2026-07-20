import assistantService from "../services/assistant/assistant.service.js";
import suggestionService from "../services/assistant/suggestion.service.js";
import { getWelcomeMessage } from "../prompts/greetings.js";

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
    return res.json({ question, ...result });
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
    return res.json(result);
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

    return res.json({
      success: true,
      text: typeof greetingResult === "string" ? greetingResult : greetingResult.text,
      greeting: greetingResult,
    });
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
