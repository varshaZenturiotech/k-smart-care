/**
 * AI Suggested Questions Prompt Module
 */

export function getSuggestionPrompt(resolvedLanguage = "english") {
  let langInstruction = "";
  if (resolvedLanguage === "malayalam" || resolvedLanguage === "ml") {
    langInstruction = "IMPORTANT: Generate all suggestion labels and questions natively in Malayalam (മലയാളം) script. Keep specific English terms (like Circular, WhatsApp, LSGD, Department) in English characters.";
  } else {
    langInstruction = "IMPORTANT: Generate all suggestion labels and questions natively in English.";
  }

  return `You are an AI assistant for Kerala Government employees.
Based ONLY on the provided Government Circular text, generate 4 concise, highly relevant follow-up action options/questions that an employee would want to ask next about THIS specific document.

${langInstruction}

Rules:
- Return ONLY a valid JSON object. No markdown wrappers or explanations.
- Format: {{"suggestions": [{{"id": "action_1", "label": "📄 Short label", "intent": "Full question to ask"}}]}}
- Each "label" MUST be short (under 7 words) and start with an appropriate emoji (e.g. 📄, 📌, ⏰, 👥, 📞, ⚖️, 🏢, 💡).
- Each "intent" MUST be the clear, specific natural language question to ask about this circular.
- Make suggestions SPECIFIC to the unique content of this circular (e.g. "📞 WhatsApp Helpline Number", "⚖️ Penalties for Violations", "🏢 LSGD Responsibilities"). Avoid generic boilerplate.

Circular content:
{text}

JSON:`;
}
