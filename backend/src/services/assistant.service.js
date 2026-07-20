import llmService from "./llm.service.js";
import ragChainService from "./ragChain.service.js";
import {
  getOfficialCircularPrompt,
  getGeneralKnowledgePrompt,
} from "../prompts/assistant.prompt.js";

/**
 * Scans question text for explicit language overrides.
 */
function detectLanguageOverride(question) {
  if (!question) return null;
  const q = question.toLowerCase();

  const malayalamOverrideEn = [
    "in malayalam", "answer in malayalam", "reply in malayalam",
    "explain in malayalam", "translate to malayalam", "translate into malayalam",
    "respond in malayalam", "give.*malayalam", "summary in malayalam",
    "write in malayalam",
  ];
  const malayalamOverrideMl = ["മലയാളത്തിൽ", "മലയാളത്തില്‍", "മലയാളം", "മലയാളത്തിൽ "];

  for (const pattern of malayalamOverrideEn) {
    if (new RegExp(pattern).test(q)) return "malayalam";
  }
  for (const native of malayalamOverrideMl) {
    if (question.includes(native)) return "malayalam";
  }

  const englishOverride = [
    "in english", "answer in english", "reply in english",
    "explain in english", "translate to english", "translate into english",
    "respond in english", "give.*english", "summary in english",
    "write in english",
  ];
  for (const pattern of englishOverride) {
    if (new RegExp(pattern).test(q)) return "english";
  }

  return null;
}

/**
 * Resolves effective language.
 */
function resolveResponseLanguage(question, preferredLanguage = "auto") {
  const override = detectLanguageOverride(question);
  if (override) return override;
  if (preferredLanguage !== "auto") return preferredLanguage;
  return "auto";
}

/**
 * Checks if general knowledge is explicitly requested in query.
 */
function isGeneralKnowledgeExplicitlyRequested(question) {
  if (!question) return false;
  const q = question.toLowerCase();
  const patterns = [
    "use general knowledge",
    "answer using ai",
    "not from circulars",
    "ignore uploaded documents",
    "general knowledge",
    "using ai",
    "ignore circulars",
  ];
  return patterns.some((pattern) => q.includes(pattern));
}

/**
 * Assistant Service - The Orchestration Layer.
 * Determines execution mode (RAG vs. General Knowledge vs No Document Found),
 * selects the correct prompt, merges context, and coordinates between LLM and RAG services.
 */
class AssistantService {
  /**
   * Main orchestration method for answering user questions.
   * @param {string} question
   * @param {{ circularId?: string, preferredLanguage?: string, userId?: string, allowGeneralKnowledge?: boolean }} options
   * @returns {Promise<Object>}
   */
  async askQuestion(question, { circularId, preferredLanguage = "auto", userId, allowGeneralKnowledge = false } = {}) {
    const effectiveLanguage = resolveResponseLanguage(question, preferredLanguage);
    const isMalayalam = effectiveLanguage === "malayalam";

    // Fetch employee daily wellness data if userId provided
    let hasWellness = false;
    let wellnessContext = "No wellness check-in recorded for today.";
    let wellnessRaw = null;

    if (userId) {
      try {
        const WellnessCheck = (await import("../models/WellnessCheck.model.js")).default;
        const latestCheck = await WellnessCheck.findOne({
          employeeId: userId,
          status: "completed",
        }).sort({ dateString: -1 });

        if (latestCheck) {
          hasWellness = true;
          wellnessRaw = latestCheck;
          wellnessContext = `
[Employee Daily Wellness Check-in Data]
Date: ${latestCheck.dateString}
Mood: ${latestCheck.mood}
Sleep Hours: ${latestCheck.sleepHours} hours
Energy Level: ${latestCheck.energy}
Stress Level: ${latestCheck.stress}
Workload: ${latestCheck.workload}
Optional Note: ${latestCheck.note || "None"}
Wellness Score: ${latestCheck.wellnessScore}/100
Focus Score: ${latestCheck.focusScore}/100
Burnout Risk: ${latestCheck.burnoutRisk}
AI Summary: ${latestCheck.aiSummary}
Recommendations:
${latestCheck.recommendations.map((r) => `- ${r}`).join("\n")}
`;
        }
      } catch (err) {
        console.error("[AssistantService] Error loading wellness check-in:", err.message);
      }
    }

    const isWellnessQuery =
      hasWellness &&
      (question.toLowerCase().includes("doing today") ||
        question.toLowerCase().includes("wellness") ||
        question.toLowerCase().includes("burnout") ||
        question.toLowerCase().includes("focus") ||
        question.toLowerCase().includes("mood") ||
        question.toLowerCase().includes("stress") ||
        question.toLowerCase().includes("sleep") ||
        question.toLowerCase().includes("how am i"));

    const isGKExplicitlyRequested = isGeneralKnowledgeExplicitlyRequested(question);
    const isGKAllowed = allowGeneralKnowledge || isGKExplicitlyRequested || isWellnessQuery;

    // Case 1: General Knowledge requested / wellness query
    if (isGKAllowed) {
      const disclaimer = isMalayalam
        ? "ഈ മറുപടി AI model-ന്റെ general knowledge-ൽ നിന്നും നിർമ്മിച്ചതാണ്, ഇത് അപ്‌ലോഡ് ചെയ്ത ഔദ്യോഗിക Circular-കളെ അടിസ്ഥാനമാക്കിയുള്ളതല്ല."
        : "This answer is generated from the AI model's general knowledge and is NOT based on uploaded government circulars.";

      if (!llmService.hasKey()) {
        const fallback = this.generateLocalGKFallback(isWellnessQuery, wellnessRaw);
        return {
          mode: "general_knowledge",
          answer: fallback.answer,
          disclaimer,
          citations: [],
          sources: [],
          confidence: null,
          usedRAG: false,
          usedGeneralKnowledge: true,
        };
      }

      try {
        const promptTemplateStr = getGeneralKnowledgePrompt(effectiveLanguage);
        const answer = await llmService.generateCompletion(
          promptTemplateStr,
          { question, wellnessContext },
          { temperature: 0.3 }
        );

        return {
          mode: "general_knowledge",
          answer: answer ? answer.trim() : disclaimer,
          disclaimer,
          citations: [],
          sources: [],
          confidence: null,
          usedRAG: false,
          usedGeneralKnowledge: true,
        };
      } catch (err) {
        console.error("[AssistantService] GK answer generation failed:", err.message);
        const fallback = this.generateLocalGKFallback(isWellnessQuery, wellnessRaw);
        return {
          mode: "general_knowledge",
          answer: fallback.answer,
          disclaimer,
          citations: [],
          sources: [],
          confidence: null,
          usedRAG: false,
          usedGeneralKnowledge: true,
        };
      }
    }

    // Case 2: Document RAG search
    const { docs, highestScore } = await ragChainService.retrieveContext(question, { circularId });

    // Case 2a: No documents found
    if (docs.length === 0) {
      const mode = "no_document_found";
      const noDocAnswer = isMalayalam
        ? "അപ്‌ലോഡ് ചെയ്ത Circular കളിൽ പ്രസക്തമായ വിവരങ്ങൾ കണ്ടെത്താൻ എനിക്ക് കഴിഞ്ഞില്ല."
        : "I couldn't find relevant information in the uploaded government circulars.";
      const noDocMessage = isMalayalam
        ? "ഈ ചോദ്യം അപ്‌ലോഡ് ചെയ്ത ഔദ്യോഗിക Document കളിൽ ഉൾപ്പെട്ടിട്ടുള്ളതായി കാണുന്നില്ല."
        : "This question does not appear to be covered by the uploaded official documents.";
      const noDocSuggestions = isMalayalam
        ? [
            "വ്യത്യസ്തമായ വാക്കുകൾ ഉപയോഗിച്ച് Search ചെയ്യുക.",
            "പ്രസക്തമായ Circular Upload ചെയ്യുക.",
            "മറ്റൊരു Department ൽ Search ചെയ്യുക.",
          ]
        : [
            "Try different keywords.",
            "Upload the relevant circular.",
            "Search another department.",
          ];

      return {
        mode,
        answer: noDocAnswer,
        message: noDocMessage,
        suggestions: noDocSuggestions,
        citations: [],
        sources: [],
        confidence: highestScore,
        usedRAG: false,
        usedGeneralKnowledge: false,
      };
    }

    // Case 2b: Official Circular response
    const mode = "official_circular";
    const citations = ragChainService.buildCitations(docs);
    const sources = docs.map((d) => d.metadata.source).filter((val, idx, self) => self.indexOf(val) === idx);

    if (!llmService.hasKey()) {
      const fallback = ragChainService.generateLocalRagFallback(docs, citations);
      return {
        mode,
        answer: fallback.answer,
        citations,
        sources,
        confidence: highestScore,
        usedRAG: true,
        usedGeneralKnowledge: false,
      };
    }

    try {
      const context = ragChainService.formatDocsAsContext(docs);
      const promptTemplateStr = getOfficialCircularPrompt(effectiveLanguage);

      const rawAnswer = await llmService.generateCompletion(
        promptTemplateStr,
        { context, question },
        { temperature: 0.1 }
      );

      return {
        mode,
        answer: rawAnswer ? rawAnswer.trim() : "Unable to format answer.",
        citations,
        sources,
        confidence: highestScore,
        usedRAG: true,
        usedGeneralKnowledge: false,
      };
    } catch (err) {
      console.error("[AssistantService] RAG answer generation failed:", err.message);
      return {
        mode,
        answer: "The assistant hit an error generating an official circular response. Please try again.",
        citations,
        sources,
        confidence: highestScore,
        usedRAG: true,
        usedGeneralKnowledge: false,
      };
    }
  }

  /**
   * Helper for offline/fallback general knowledge answers.
   */
  generateLocalGKFallback(isWellnessQuery = false, wellnessRaw = null) {
    if (isWellnessQuery && wellnessRaw) {
      const recs = wellnessRaw.recommendations.map((r) => r).join("\n");
      return {
        answer: `Based on your daily wellness check-in for today (${wellnessRaw.dateString}):
- **Mood**: ${wellnessRaw.mood.charAt(0).toUpperCase() + wellnessRaw.mood.slice(1)}
- **Sleep**: ${wellnessRaw.sleepHours} hours
- **Energy**: ${wellnessRaw.energy}
- **Stress**: ${wellnessRaw.stress}
- **Workload**: ${wellnessRaw.workload}
- **Wellness Score**: ${wellnessRaw.wellnessScore}/100
- **Focus Score**: ${wellnessRaw.focusScore}/100
- **Burnout Risk**: ${wellnessRaw.burnoutRisk}

**AI Summary**:
${wellnessRaw.aiSummary}

**Recommendations**:
${recs}`,
        citations: [],
      };
    }
    return {
      answer: `This answer is based on general knowledge and not on uploaded Kerala Government Circulars.\n\n[Development fallback — no GROQ_API_KEY configured] Please configure a valid GROQ_API_KEY in backend/.env to get a real response.`,
      citations: [],
    };
  }
}

export const assistantService = new AssistantService();
export default assistantService;
