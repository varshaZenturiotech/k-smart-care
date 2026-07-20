import { BREATHING_PATTERNS, MOTIVATIONAL_QUOTES } from "../../constants/wellbeing.js";
import { formatAssistantResponse } from "../../utils/responseFormatter.js";

/**
 * Wellbeing & Workplace Health Service
 */
class WellbeingService {
  /**
   * Generates structured breathing exercise data.
   * @param {string} question
   * @param {string} effectiveLanguage
   * @returns {Object} Formatted response with type "breathing_exercise"
   */
  getBreathingExercise(question = "", effectiveLanguage = "english") {
    const isMalayalam = effectiveLanguage === "malayalam";

    const exercise = BREATHING_PATTERNS.RELAXING_478;

    const answer = isMalayalam
      ? `**${exercise.name} (${exercise.pattern})**\n\n${exercise.description}\n\n**നിർദ്ദേശങ്ങൾ (Steps):**\n` +
        exercise.steps.map((s, i) => `${i + 1}. ${s}`).join("\n") +
        `\n\n4 പ്രാവശ്യം ആഴത്തിൽ ശ്വാസമെടുത്ത് പൂർത്തിയാക്കുക. പൂർത്തിയായ ശേഷം **"Done"** എന്ന് ടൈപ്പ് ചെയ്യുക അല്ലെങ്കിൽ ബട്ടൺ അമർത്തുക.`
      : `**${exercise.name} (${exercise.pattern})**\n\n${exercise.description}\n\n**Instructions:**\n` +
        exercise.steps.map((s, i) => `${i + 1}. ${s}`).join("\n") +
        `\n\nTake 4 slow cycles to relax. Click or type **"Done"** when you have completed the exercise.`;

    return formatAssistantResponse({
      type: "breathing_exercise",
      mode: "general_knowledge",
      answer,
      usedGeneralKnowledge: true,
      options: [{ id: "done", label: "✅ Done" }],
      structuredData: {
        title: exercise.name,
        pattern: exercise.pattern,
        duration: exercise.duration,
        steps: exercise.steps,
      },
    });
  }

  /**
   * Gets daily motivation statement.
   * @param {string} effectiveLanguage
   * @returns {Object}
   */
  getDailyMotivation(effectiveLanguage = "english") {
    const quote = MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)];
    const isMalayalam = effectiveLanguage === "malayalam";

    const answer = isMalayalam
      ? `🌟 **ഇന്നത്തെ പ്രചോദനം (Daily Motivation):**\n\n${quote}\n\nപ്രവർത്തനങ്ങൾ ഒരോന്നായി പൂർത്തിയാക്കുക. നിങ്ങളുടെ പരിശ്രമത്തിന് നന്ദി.`
      : `🌟 **Daily Motivation:**\n\n"${quote}"\n\nTake things step by step today. Your work makes a real difference.`;

    return formatAssistantResponse({
      type: "general_answer",
      mode: "general_knowledge",
      answer,
      usedGeneralKnowledge: true,
    });
  }
}

export const wellbeingService = new WellbeingService();
export default wellbeingService;
