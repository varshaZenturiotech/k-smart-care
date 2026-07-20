import { INTENTS } from "../../constants/intents.js";
import { normalizeMalayalamText } from "../../utils/language.js";

/**
 * Lightweight Intent Router for Workplace AI Assistant.
 * Uses regex, keyword matching, and Malayalam text normalization.
 */
class IntentRouter {
  /**
   * Classifies user input into a specific workplace intent.
   * @param {string} text
   * @param {{ circularId?: string }} options
   * @returns {string} Intent Constant
   */
  classify(text = "", options = {}) {
    if (!text || typeof text !== "string") return INTENTS.UNKNOWN;

    const lower = text.toLowerCase().trim();
    const normalized = normalizeMalayalamText(text);

    // 0. Conversation Closing Detection (e.g. "Thank you", "Thanks", "That's all", "Bye")
    const closingPhrases = [
      "thank you", "thanks", "that's all", "thats all", "that's it", "thats it",
      "okay thanks", "ok thanks", "okay, thanks", "ok, thanks", "appreciate it",
      "great, thanks", "great thanks", "great", "bye", "goodbye", "good night",
      "thank you so much", "thanks a lot", "nandi", "നന്ദി", "വളരെ നന്ദി",
      "that's all for now", "thats all for now", "have a good day", "have a nice day"
    ];

    const isClosing =
      closingPhrases.includes(lower) ||
      (lower.split(/\s+/).length <= 4 && closingPhrases.some((p) => lower === p || lower.startsWith(p + " ") || lower.endsWith(" " + p)));

    if (isClosing) {
      return INTENTS.CONVERSATION_CLOSING;
    }

    // 1. Explicit circular focus via widget options (circularId provided)
    if (options.circularId) {
      if (lower.includes("summary") || lower.includes("summarize") || normalized.includes("സംഗ്രഹിക്കുക")) {
        return INTENTS.DOCUMENT_SUMMARY;
      }
      if (lower.includes("policy") || lower.includes("rule") || lower.includes("clause")) {
        return INTENTS.POLICY_EXPLANATION;
      }
      return INTENTS.DOCUMENT_QA;
    }

    // 2. Breathing Exercises
    if (
      lower.includes("breathing") ||
      lower.includes("breath exercise") ||
      lower.includes("4-7-8") ||
      lower.includes("box breathing") ||
      lower.includes("breathe") ||
      normalized.includes("ശ്വാസകോശ") ||
      normalized.includes("ശ്വാസം")
    ) {
      return INTENTS.BREATHING_EXERCISE;
    }

    // 3. Daily Motivation
    if (
      lower.includes("daily motivation") ||
      lower.includes("motivate me") ||
      lower.includes("inspirational quote") ||
      lower.includes("motivation") ||
      normalized.includes("പ്രചോദനം")
    ) {
      return INTENTS.DAILY_MOTIVATION;
    }

    // 4. Translation
    if (
      lower.startsWith("translate") ||
      lower.includes("translate this") ||
      lower.includes("translate into") ||
      lower.includes("translate to") ||
      lower.includes("in malayalam") ||
      lower.includes("in english") ||
      normalized.includes("മൊഴിമാറ്റുക") ||
      normalized.includes("തർജ്ജമ")
    ) {
      return INTENTS.TRANSLATION;
    }

    // 5. Workplace Wellbeing & Mental Health Support
    if (
      lower.includes("not feeling well") ||
      lower.includes("feel unwell") ||
      lower.includes("unwell") ||
      lower.includes("feeling low") ||
      lower.includes("feeling tired") ||
      lower.includes("feeling stressed") ||
      lower.includes("feeling better") ||
      lower.includes("feeling good") ||
      lower.includes("feeling fine") ||
      lower.includes("stressed") ||
      lower.includes("stress") ||
      lower.includes("burnout") ||
      lower.includes("burned out") ||
      lower.includes("burning out") ||
      lower.includes("exhausted") ||
      lower.includes("workload pressure") ||
      lower.includes("work pressure") ||
      lower.includes("overwhelmed") ||
      lower.includes("wellness") ||
      lower.includes("how am i doing") ||
      lower.includes("mental health") ||
      lower.includes("anxious") ||
      lower.includes("anxiety") ||
      normalized.includes("മാനസിക സമ്മർദ്ദം") ||
      normalized.includes("സുഖമില്ല") ||
      normalized.includes("വിഷമം") ||
      normalized.includes("ക്ഷീണം")
    ) {
      return INTENTS.WORKPLACE_WELLBEING;
    }

    // 6. Email & Official Letter Drafting
    if (
      lower.includes("draft email") ||
      lower.includes("draft an email") ||
      lower.includes("draft reply") ||
      lower.includes("official reply") ||
      lower.includes("write email") ||
      lower.includes("write an email") ||
      lower.includes("write letter") ||
      lower.includes("draft letter") ||
      lower.includes("leave email") ||
      normalized.includes("കത്ത് തയ്യാറാക്കുക")
    ) {
      return INTENTS.EMAIL_DRAFTING;
    }

    // 7. Meeting Assistance
    if (
      lower.includes("meeting agenda") ||
      lower.includes("prepare meeting") ||
      lower.includes("prepare for my meeting") ||
      lower.includes("prepare for meeting") ||
      lower.includes("schedule meeting") ||
      lower.includes("meeting minutes") ||
      lower.includes("meeting") ||
      normalized.includes("യോഗം")
    ) {
      return INTENTS.MEETING_ASSISTANCE;
    }

    // 8. Task Assistance & Planning
    if (
      lower.includes("task plan") ||
      lower.includes("today's tasks") ||
      lower.includes("prioritize tasks") ||
      lower.includes("prioritize work") ||
      lower.includes("schedule my day") ||
      lower.includes("task list") ||
      lower.includes("plan my day") ||
      lower.includes("plan today's work") ||
      lower.includes("plan work") ||
      lower.includes("help me plan") ||
      lower.includes("urgent files") ||
      lower.includes("files today") ||
      lower.includes("work planning") ||
      normalized.includes("ടാസ്ക്")
    ) {
      return INTENTS.TASK_ASSISTANCE;
    }

    // 9. Productivity Coaching & Focus
    if (
      lower.includes("productivity") ||
      lower.includes("time management") ||
      lower.includes("work habits") ||
      lower.includes("focus better") ||
      lower.includes("help me focus") ||
      lower.includes("focus")
    ) {
      return INTENTS.PRODUCTIVITY_COACHING;
    }

    // 10. Document Q&A / Circular RAG queries (Only when circular/policy terms are present)
    if (
      lower.includes("circular") ||
      lower.includes("explain this circular") ||
      lower.includes("explain circular") ||
      lower.includes("forget that") ||
      lower.includes("government order") ||
      lower.includes("g.o") ||
      lower.includes("notification") ||
      lower.includes("policy") ||
      lower.includes("rule") ||
      lower.includes("section") ||
      lower.includes("clause") ||
      lower.includes("eligibility criteria") ||
      lower.includes("eligibility") ||
      lower.includes("deadline") ||
      lower.includes("deadlines") ||
      lower.includes("issued this circular") ||
      lower.includes("which department issued") ||
      lower.includes("uploaded document") ||
      lower.includes("this document") ||
      lower.includes("document") ||
      normalized.includes("സർക്കുലർ") ||
      normalized.includes("ഉത്തരവ്")
    ) {
      if (lower.includes("summary") || lower.includes("summarize")) return INTENTS.DOCUMENT_SUMMARY;
      if (lower.includes("explain policy") || lower.includes("policy explanation")) return INTENTS.POLICY_EXPLANATION;
      return INTENTS.DOCUMENT_QA;
    }

    // 11. General Government Administration
    if (
      lower.includes("panchayat") ||
      lower.includes("municipality") ||
      lower.includes("corporation") ||
      lower.includes("lsgd") ||
      lower.includes("k-smart") ||
      lower.includes("kerala government")
    ) {
      return INTENTS.GENERAL_GOVERNMENT;
    }

    // Default Fallback: Return UNKNOWN (Bypasses RAG completely)
    return INTENTS.UNKNOWN;
  }
}

export const intentRouter = new IntentRouter();
export default intentRouter;

