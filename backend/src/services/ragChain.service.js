import { ChatGroq } from "@langchain/groq";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import CircularEmbedding from "../models/CircularEmbedding.js";
import { generateEmbedding } from "./embedding.service.js";
import mongoose from "mongoose";
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

function buildOfficialCircularPrompt(effectiveLanguage) {
  const langDirective = buildLanguageDirective(effectiveLanguage);
  return `You are the K-SMART CARE AI Assistant, helping Kerala Local Self Government employees understand circulars, government orders, and policies.

${langDirective}

Answer the user's question using ONLY the provided context from the uploaded government circulars.

Requirements:
1. Base your entire response on the provided context. Do not use general knowledge or assumptions not supported by the context.
2. Structure your response to include:
   - A clear, direct answer.
   - A summary of the key points (if applicable).
   - Bullet points for details or steps.
3. The response must clearly indicate that this information is based on the uploaded government circulars.
4. Do not fabricate or invent citations.

Context:
{context}

Employee's question: {question}

Response:`;
}

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
    "ignore circulars"
  ];
  return patterns.some(pattern => q.includes(pattern));
}

/**
 * Answer a question using Hybrid RAG with explicit mode selection.
 * @param {string} question
 * @param {{ circularId?: string, preferredLanguage?: string, userId?: string, allowGeneralKnowledge?: boolean }} options
 */
export async function answerQuestion(question, { circularId, preferredLanguage = "auto", userId, allowGeneralKnowledge = false } = {}) {
  // Resolve the effective language for THIS message:
  // per-message explicit override > profile preference > auto-detect
  const effectiveLanguage = resolveResponseLanguage(question, preferredLanguage);
  const isMalayalam = effectiveLanguage === "malayalam";

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

  const isGKExplicitlyRequested = isGeneralKnowledgeExplicitlyRequested(question);
  const isGKAllowed = allowGeneralKnowledge || isGKExplicitlyRequested || isWellnessQuery;

  // Case 1: General Knowledge requested/fallback allowed
  if (isGKAllowed) {
    const disclaimer = isMalayalam
      ? "ഈ മറുപടി AI model-ന്റെ general knowledge-ൽ നിന്നും നിർമ്മിച്ചതാണ്, ഇത് അപ്‌ലോഡ് ചെയ്ത ഔദ്യോഗിക Circular-കളെ അടിസ്ഥാനമാക്കിയുള്ളതല്ല."
      : "This answer is generated from the AI model's general knowledge and is NOT based on uploaded government circulars.";

    if (!hasGroqKey()) {
      console.warn("GROQ_API_KEY is not configured. Returning local GK fallback response.");
      const fallback = generateLocalGKFallback(isWellnessQuery, wellnessRaw);
      return {
        mode: "general_knowledge",
        answer: fallback.answer,
        disclaimer,
        citations: [],
        sources: [],
        confidence: null,
        usedRAG: false,
        usedGeneralKnowledge: true
      };
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
      return {
        mode: "general_knowledge",
        answer: answer.trim(),
        disclaimer,
        citations: [],
        sources: [],
        confidence: null,
        usedRAG: false,
        usedGeneralKnowledge: true
      };
    } catch (err) {
      console.error("General knowledge answer generation failed:", err);
      const fallback = generateLocalGKFallback(isWellnessQuery, wellnessRaw);
      return {
        mode: "general_knowledge",
        answer: fallback.answer,
        disclaimer,
        citations: [],
        sources: [],
        confidence: null,
        usedRAG: false,
        usedGeneralKnowledge: true
      };
    }
  }

  // Case 2: Document search (Mode 1 or Mode 2)
  let docs = [];
  let highestScore = 0;
  try {
    const queryVector = await generateEmbedding(question);

    const vectorSearchStage = {
      index: "circular_vector_index",
      path: "embedding",
      queryVector: queryVector,
      numCandidates: 100,
      limit: circularId ? 50 : 4,
    };

    const pipeline = [
      { $vectorSearch: vectorSearchStage }
    ];

    if (circularId) {
      pipeline.push({
        $match: {
          circularId: new mongoose.Types.ObjectId(circularId),
        },
      });
    }

    pipeline.push({
      $project: {
        _id: 1,
        circularId: 1,
        chunkIndex: 1,
        page: 1,
        text: 1,
        metadata: 1,
        score: { $meta: "vectorSearchScore" },
      },
    });

    if (circularId) {
      pipeline.push({ $limit: 4 });
    }

    const results = await CircularEmbedding.aggregate(pipeline);

    // Map retrieved MongoDB chunks to LangChain Document-like structure
    docs = results.map((r) => ({
      pageContent: r.text,
      score: r.score,
      metadata: {
        source: r.metadata?.source || r.metadata?.title || "",
        circularId: r.circularId?.toString(),
        circularNumber: r.metadata?.circularNumber || "",
        page: r.page,
      },
    }));

    if (docs.length > 0) {
      highestScore = Math.max(...docs.map(d => d.score || 0));
    }
  } catch (err) {
    console.error("Vector search failed:", err);
  }

  // Case 2a: No documents found -> Mode 2 (No Document Found)
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
          "മറ്റൊരു Department ൽ Search ചെയ്യുക."
        ]
      : [
          "Try different keywords.",
          "Upload the relevant circular.",
          "Search another department."
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
      usedGeneralKnowledge: false
    };
  }

  // Case 2b: Document found -> Mode 1 (Official Circular Response)
  const mode = "official_circular";

  const citations = buildCitations(docs);
  const sources = docs.map(d => d.metadata.source).filter((val, idx, self) => self.indexOf(val) === idx);

  if (!hasGroqKey()) {
    console.warn("GROQ_API_KEY is not configured. Returning local RAG fallback response.");
    const fallback = generateLocalRagFallback(docs, citations, false, null);
    return {
      mode,
      answer: fallback.answer,
      citations,
      sources,
      confidence: highestScore,
      usedRAG: true,
      usedGeneralKnowledge: false
    };
  }

  try {
    const context = formatDocsAsContext(docs);
    const llm = new ChatGroq({
      apiKey: process.env.GROQ_API_KEY,
      model: "llama-3.1-8b-instant",
      temperature: 0.1,
    });
    const prompt = PromptTemplate.fromTemplate(buildOfficialCircularPrompt(effectiveLanguage));
    const parser = new StringOutputParser();
    const chain = prompt.pipe(llm).pipe(parser);

    const rawAnswer = await chain.invoke({ context, question });
    return {
      mode,
      answer: rawAnswer.trim(),
      citations,
      sources,
      confidence: highestScore,
      usedRAG: true,
      usedGeneralKnowledge: false
    };
  } catch (err) {
    console.error("RAG answer generation failed:", err);
    return {
      mode,
      answer: "The assistant hit an error generating an official circular response. Please try again.",
      citations,
      sources,
      confidence: highestScore,
      usedRAG: true,
      usedGeneralKnowledge: false
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

