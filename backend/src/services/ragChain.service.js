import { ChatGroq } from "@langchain/groq";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { getVectorStore } from "./vectorStore.service.js";
import dotenv from "dotenv";

dotenv.config();

/**
 * Scans the question text for an explicit per-message language override.
 * Returns "english" | "malayalam" | null (null = no explicit override found).
 *
 * Patterns detected:
 *  English requests: "answer in english", "reply in english", "explain in english",
 *                    "give the summary in english", "translate to english", etc.
 *  Malayalam requests: "answer in malayalam", "explain in malayalam",
 *                      "മലയാളത്തിൽ", "മലയാളത്തില്‍", "in malayalam", etc.
 */
function detectLanguageOverride(question) {
  if (!question) return null;
  const q = question.toLowerCase();

  // Malayalam override patterns (English spellings + native script)
  const malayalamOverrideEn = [
    "in malayalam", "answer in malayalam", "reply in malayalam",
    "explain in malayalam", "translate to malayalam", "translate into malayalam",
    "respond in malayalam", "give.*malayalam", "summary in malayalam",
    "write in malayalam",
  ];
  // Native Malayalam script for "in Malayalam" / "explain in Malayalam"
  const malayalamOverrideMl = ["മലയാളത്തിൽ", "മലയാളത്തില്‍", "മലയാളം", "മലയാളത്തിൽ "];

  for (const pattern of malayalamOverrideEn) {
    if (new RegExp(pattern).test(q)) return "malayalam";
  }
  for (const native of malayalamOverrideMl) {
    if (question.includes(native)) return "malayalam";
  }

  // English override patterns
  const englishOverride = [
    "in english", "answer in english", "reply in english",
    "explain in english", "translate to english", "translate into english",
    "respond in english", "give.*english", "summary in english",
    "write in english",
  ];
  for (const pattern of englishOverride) {
    if (new RegExp(pattern).test(q)) return "english";
  }

  return null; // no explicit override
}

/**
 * Resolve the effective response language for this single message.
 *
 * Priority:
 *  1. Explicit per-message override in the question text
 *  2. Employee's stored preferredLanguage (if not "auto")
 *  3. Auto-detect from question language (passed to the LLM)
 */
function resolveResponseLanguage(question, preferredLanguage = "auto") {
  const override = detectLanguageOverride(question);
  if (override) return override;                   // explicit request wins
  if (preferredLanguage !== "auto") return preferredLanguage; // profile pref
  return "auto";                                   // let LLM detect
}

/**
 * Build a language directive string to inject into LLM prompts.
 */
function buildLanguageDirective(effectiveLanguage) {
  if (effectiveLanguage === "malayalam") {
    return `IMPORTANT: You MUST respond in Malayalam (മലയാളം) following the Malayalam Response Style Rules:
- Write complete sentences in Malayalam script, but keep common office/workplace terminology in English (using English script/characters).
- DO NOT translate the following words into Malayalam (neither to phonetic Malayalam script like ടാസ്ക്/റിപ്പോർട്ട് nor to literal Malayalam like യോഗം/അവസാന തീയതി). They MUST be written in English characters:
  * AI
  * Dashboard
  * Task
  * Tasks
  * Meeting
  * Meetings
  * Reminder
  * Notification
  * Notifications
  * Profile
  * Settings
  * Department
  * District
  * Circular
  * Circular Summary
  * Meeting Summary
  * Daily Briefing
  * Wellness
  * Wellness Score
  * Focus Score
  * Burnout Score
  * Stress Score
  * Report
  * Document
  * Priority
  * Deadline
  * Status
  * Assistant
  * Chat
  * Search
  * Upload
  * Download
  * Login
  * Logout
  * Session
  * Calendar
  * PDF
  * Email
  * Password
  * OTP
  * Admin
  * Employee
  * Official Portal
  * Government Order
  * Online
  * Offline
- Do NOT use Manglish (writing Malayalam words in English script). Write Malayalam words in Malayalam script and English words in English script.
- Sentence structure must remain Malayalam, but the specific English terms must remain in English script/characters.
- Example correct output:
  * "ഇന്ന് 2 Tasks pending ഉണ്ട്."
  * "ഈ Circular ഇന്ന് വായിക്കുന്നത് നല്ലതാണ്."
  * "Meeting 2 PM ന് Town Hall ൽ ആണ്."
  * "Report submit ചെയ്യാൻ ഇനി 3 മണിക്കൂർ മാത്രം ബാക്കി."
  * "ഇന്നത്തെ AI Briefing നോക്കൂ."
  * "നിങ്ങളുടെ Wellness Score ഇന്നലെക്കാൾ മെച്ചപ്പെട്ടിട്ടുണ്ട്."
  * "Focus Score വളരെ നല്ലതാണ്."
  * "നിങ്ങളുടെ Wellness Score ഇന്ന് വളരെ നല്ലതാണ്."
  * "Circular Summary വായിക്കാൻ മറക്കരുത്."
- Tone should sound like how Kerala Government employees naturally communicate in offices and professional conversations (professional, friendly, and encouraging).`;
  }
  if (effectiveLanguage === "english") {
    return "IMPORTANT: You MUST respond entirely in English. Do not use Malayalam in your response, even if the question is in Malayalam.";
  }
  // auto: mirror the question's language
  return `IMPORTANT: Detect the language of the employee's question and respond in that same language.
If the question is in Malayalam, respond in Malayalam following the Malayalam Response Style Rules:
- Write complete sentences in Malayalam script, but keep common office/workplace terminology in English (using English script/characters).
- DO NOT translate the following words into Malayalam (neither to phonetic Malayalam script like ടാസ്ക്/റിപ്പോർട്ട് nor to literal Malayalam like യോഗം/അവസാന തീയതി). They MUST be written in English characters:
  * AI
  * Dashboard
  * Task
  * Tasks
  * Meeting
  * Meetings
  * Reminder
  * Notification
  * Notifications
  * Profile
  * Settings
  * Department
  * District
  * Circular
  * Circular Summary
  * Meeting Summary
  * Daily Briefing
  * Wellness
  * Wellness Score
  * Focus Score
  * Burnout Score
  * Stress Score
  * Report
  * Document
  * Priority
  * Deadline
  * Status
  * Assistant
  * Chat
  * Search
  * Upload
  * Download
  * Login
  * Logout
  * Session
  * Calendar
  * PDF
  * Email
  * Password
  * OTP
  * Admin
  * Employee
  * Official Portal
  * Government Order
  * Online
  * Offline
- Do NOT use Manglish. Write Malayalam words in Malayalam script and English words in English script.
- Sentence structure must remain Malayalam, but the specific English terms must remain in English script/characters.
- Tone should sound like how Kerala Government employees naturally communicate in offices and professional conversations (professional, friendly, and encouraging).
If in English, respond in English.`;
}

function buildHybridPrompt(effectiveLanguage) {
  const langDirective = buildLanguageDirective(effectiveLanguage);
  return `You are the K-SMART CARE AI Assistant, helping Kerala Local Self Government employees understand circulars, government orders, and policies.

${langDirective}

You also have access to the employee's daily wellness check-in details. If the user asks about their own feelings, wellness status, burnout risk, focus suggestions, how they are doing today, or how to improve, use this wellness data to answer:
{wellnessContext}

First, analyze the retrieved context below and determine if it contains the necessary information to answer the user's question.

If the context contains the answer (or relevant details that directly address the question):
1. Start your response with the exact tag: [CONTEXT_ANSWER]
2. Answer the question using ONLY the provided context.
3. Structure your response to include:
   - A clear, direct answer.
   - A summary of the key points (if applicable).
   - Bullet points for details or steps.
4. Clearly state that this information is based on the uploaded government circulars.
5. At the bottom, include the source citation:
   Source:
   Document: [exact document source name from the context]
   Page: [page number, or "N/A" if not specified]
6. Do not fabricate or hallucinate any document names or page numbers.

If the context DOES NOT contain the answer:
1. Start your response with the exact tag: [GENERAL_KNOWLEDGE_ANSWER]
2. Answer using your general knowledge.
3. Format:
   This answer is based on general knowledge and not on uploaded Kerala Government Circulars.

   [Your detailed answer here, with bullet points if applicable]
4. Do not fabricate or invent citations or document references.

Context:
{context}

Employee's question: {question}

Response:`;
}

function buildGeneralKnowledgePrompt(effectiveLanguage) {
  const langDirective = buildLanguageDirective(effectiveLanguage);
  return `You are the K-SMART CARE AI Assistant.

${langDirective}

You also have access to the employee's daily wellness check-in details. If the user asks about their own feelings, wellness status, burnout risk, focus suggestions, how they are doing today, or how to improve, use this wellness data to answer:
{wellnessContext}

Answer the user's question using your general knowledge.

Response format:
This answer is based on general knowledge and not on uploaded Kerala Government Circulars.

[Your detailed answer here, with bullet points if applicable]

Rules:
- Do not fabricate or invent any citations or document references.

Employee's question: {question}

Response:`;
}

function hasGroqKey() {
  const apiKey = process.env.GROQ_API_KEY;
  return apiKey && apiKey !== "your_groq_api_key_here" && apiKey.trim() !== "";
}

function formatDocsAsContext(docs) {
  return docs
    .map((doc, i) => {
      const circNumStr = doc.metadata.circularNumber ? ` (No: ${doc.metadata.circularNumber})` : "";
      const label = doc.metadata.page
        ? `${doc.metadata.source}${circNumStr}, page ${doc.metadata.page}`
        : `${doc.metadata.source}${circNumStr}`;
      return `[Excerpt ${i + 1} — ${label}]\n${doc.pageContent}`;
    })
    .join("\n\n");
}

function buildCitations(docs) {
  const seen = new Set();
  const citations = [];
  for (const doc of docs) {
    const key = `${doc.metadata.source}::${doc.metadata.page || ""}::${doc.metadata.circularNumber || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    citations.push({
      title: doc.metadata.source,
      circularNumber: doc.metadata.circularNumber || null,
      page: doc.metadata.page || null,
    });
  }
  return citations;
}

/**
 * Answer a question using Hybrid RAG.
 * @param {string} question
 * @param {{ circularId?: string, preferredLanguage?: string, userId?: string }} options
 */
export async function answerQuestion(question, { circularId, preferredLanguage = "auto", userId } = {}) {
  // Resolve the effective language for THIS message:
  // per-message explicit override > profile preference > auto-detect
  const effectiveLanguage = resolveResponseLanguage(question, preferredLanguage);

  // Fetch wellness data if userId is provided
  let hasWellness = false;
  let wellnessContext = "No wellness check-in recorded for today.";
  let wellnessRaw = null;

  if (userId) {
    try {
      const WellnessCheck = (await import("../models/WellnessCheck.model.js")).default;
      // Get the latest completed wellness check for the user
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
      console.error("Error fetching user wellness check-in for assistant:", err);
    }
  }

  // Check if this query is wellness-related and we have wellness details
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

  const vectorStore = await getVectorStore();
  const filter = circularId ? { circularId } : undefined;

  let docs = [];
  // For wellness queries, don't prioritize circular matches first, but let's query circulars anyway
  try {
    docs = await vectorStore.similaritySearch(question, 4, filter);
  } catch (err) {
    console.error("Vector search failed, falling back to general knowledge:", err);
  }

  // Case 1: No documents found
  if (!docs || docs.length === 0 || isWellnessQuery) {
    if (!hasGroqKey()) {
      console.warn("GROQ_API_KEY is not configured. Returning local GK fallback response.");
      return generateLocalGKFallback(isWellnessQuery, wellnessRaw);
    }

    try {
      const llm = new ChatGroq({
        apiKey: process.env.GROQ_API_KEY,
        model: "llama-3.1-8b-instant",
        temperature: 0.3,
      });
      const prompt = PromptTemplate.fromTemplate(buildGeneralKnowledgePrompt(effectiveLanguage));
      const parser = new StringOutputParser();
      const chain = prompt.pipe(llm).pipe(parser);

      const answer = await chain.invoke({ question, wellnessContext });
      return { answer: answer.trim(), citations: [] };
    } catch (err) {
      console.error("General knowledge answer generation failed:", err);
      // Fallback locally if LLM invocation fails
      if (isWellnessQuery) {
        return generateLocalGKFallback(isWellnessQuery, wellnessRaw);
      }
      return {
        answer: "The assistant hit an error generating a general knowledge response. Please try again.",
        citations: [],
      };
    }
  }

  // Case 2: Documents found — run hybrid RAG
  const citations = buildCitations(docs);

  if (!hasGroqKey()) {
    console.warn("GROQ_API_KEY is not configured. Returning local RAG fallback response.");
    return generateLocalRagFallback(docs, citations, isWellnessQuery, wellnessRaw);
  }

  try {
    const context = formatDocsAsContext(docs);
    const llm = new ChatGroq({
      apiKey: process.env.GROQ_API_KEY,
      model: "llama-3.1-8b-instant",
      temperature: 0.1,
    });
    const prompt = PromptTemplate.fromTemplate(buildHybridPrompt(effectiveLanguage));
    const parser = new StringOutputParser();
    const chain = prompt.pipe(llm).pipe(parser);

    const rawAnswer = await chain.invoke({ context, question, wellnessContext });
    let answer = rawAnswer.trim();
    let finalCitations = [];

    if (answer.startsWith("[CONTEXT_ANSWER]")) {
      answer = answer.substring("[CONTEXT_ANSWER]".length).trim();
      finalCitations = citations;
    } else if (answer.startsWith("[GENERAL_KNOWLEDGE_ANSWER]")) {
      answer = answer.substring("[GENERAL_KNOWLEDGE_ANSWER]".length).trim();
      finalCitations = [];
    } else {
      if (answer.includes("[CONTEXT_ANSWER]")) {
        answer = answer.replace("[CONTEXT_ANSWER]", "").trim();
        finalCitations = citations;
      } else if (answer.includes("[GENERAL_KNOWLEDGE_ANSWER]")) {
        answer = answer.replace("[GENERAL_KNOWLEDGE_ANSWER]", "").trim();
        finalCitations = [];
      } else {
        finalCitations = answer.toLowerCase().includes("general knowledge") ? [] : citations;
      }
    }

    return { answer, citations: finalCitations };
  } catch (err) {
    console.error("RAG answer generation failed:", err);
    return {
      answer: "The assistant hit an error generating a response. Please try again.",
      citations,
    };
  }
}

function generateLocalRagFallback(docs, citations, isWellnessQuery = false, wellnessRaw = null) {
  if (isWellnessQuery && wellnessRaw) {
    return generateLocalGKFallback(isWellnessQuery, wellnessRaw);
  }
  const top = docs[0];
  const label = top.metadata.page ? `${top.metadata.source}, page ${top.metadata.page}` : top.metadata.source;
  return {
    answer: `[Development fallback — no GROQ_API_KEY configured]\n\nBased on the most relevant excerpt found in ${label}:\n\n"${top.pageContent.trim()}"\n\nAdd a valid GROQ_API_KEY in backend/.env for a properly synthesized answer.`,
    citations,
  };
}

function generateLocalGKFallback(isWellnessQuery = false, wellnessRaw = null) {
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
