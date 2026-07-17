import express from "express";
import { answerQuestion } from "../services/ragChain.service.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { ChatGroq } from "@langchain/groq";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { PromptTemplate } from "@langchain/core/prompts";
import Circular from "../models/Circular.model.js";

const router = express.Router();

const DEFAULT_SUGGESTIONS_EN = [
  "Summarize the uploaded circular",
  "What are the key points?",
  "Which departments are affected?",
  "What actions should employees take?",
  "List the compliance requirements",
  "What are the important deadlines?",
];

const DEFAULT_SUGGESTIONS_ML = [
  "ഈ സർക്കുലർ സംഗ്രഹിക്കൂ",
  "പ്രധാന പോയിന്റുകൾ എന്തൊക്കെയാണ്?",
  "ഏതൊക്കെ വകുപ്പുകൾ ബാധിക്കപ്പെടും?",
  "ജീവനക്കാർ എന്ത് നടപടി സ്വീകരിക്കണം?",
  "അനുസരണ ആവശ്യകതകൾ എന്തൊക്കെ?",
  "പ്രധാന സമയപരിധികൾ ഏതൊക്കെ?",
];

function getDefaultSuggestions(preferredLanguage, requestLanguage = "en") {
  const resolved = preferredLanguage === "auto" ? (requestLanguage === "ml" ? "malayalam" : "english") : preferredLanguage;
  if (resolved === "malayalam" || resolved === "ml") return DEFAULT_SUGGESTIONS_ML;
  return DEFAULT_SUGGESTIONS_EN;
}

// Cache key = circularId + "_" + preferredLanguage
const suggestionsCache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * POST /api/assistant/ask
 * Body: { question, circularId?, preferredLanguage? }
 */
router.post("/ask", requireAuth, async (req, res) => {
  const { question, circularId, preferredLanguage = "auto", allowGeneralKnowledge = false } = req.body;

  if (!question || typeof question !== "string" || !question.trim()) {
    return res.status(400).json({ error: "A non-empty 'question' string is required." });
  }

  try {
    const result = await answerQuestion(question, {
      circularId,
      preferredLanguage,
      userId: req.user?.id,
      allowGeneralKnowledge,
    });
    res.json({ question, ...result });
  } catch (err) {
    console.error("Assistant error:", err);
    res.status(500).json({ error: "The assistant failed to generate an answer." });
  }
});

/**
 * POST /api/assistant/suggestions
 * Body: { circularId?, preferredLanguage? }
 * Returns 6-8 AI-generated prompt suggestions in the correct language.
 */
router.post("/suggestions", requireAuth, async (req, res) => {
  const { circularId, preferredLanguage = "auto" } = req.body;

  let activeLanguage = preferredLanguage;
  if (req.user?.id) {
    try {
      const User = (await import("../models/User.model.js")).default;
      const user = await User.findById(req.user.id);
      if (user?.preferredLanguage) {
        activeLanguage = user.preferredLanguage;
      }
    } catch (err) {
      // ignore
    }
  }

  // No circular → return language-appropriate defaults immediately
  if (!circularId) {
    return res.json({ success: true, suggestions: getDefaultSuggestions(activeLanguage, req.language) });
  }

  // Cache check (key includes language so different prefs get different suggestions)
  const cacheKey = `${circularId}_${activeLanguage}`;
  const cached = suggestionsCache.get(cacheKey);
  if (cached && Date.now() - cached.generatedAt < CACHE_TTL_MS) {
    return res.json({ success: true, suggestions: cached.suggestions, cached: true });
  }

  try {
    const circular = await Circular.findById(circularId).select("title summary keyPoints");
    if (!circular) {
      return res.json({ success: true, suggestions: getDefaultSuggestions(activeLanguage, req.language) });
    }

    const sourceText = [
      circular.title ? `Title: ${circular.title}` : "",
      circular.summary ? `Summary: ${circular.summary}` : "",
      circular.keyPoints ? `Key Points:\n${circular.keyPoints}` : "",
    ]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 4000);

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey || apiKey === "your_groq_api_key_here") {
      return res.json({ success: true, suggestions: getDefaultSuggestions(activeLanguage, req.language) });
    }

    // Resolve language
    let resolvedLanguage = "english";
    if (activeLanguage === "auto") {
      const containsMalayalam = /[\u0D00-\u0D7F]/.test(sourceText);
      resolvedLanguage = containsMalayalam ? "malayalam" : "english";
    } else {
      resolvedLanguage = activeLanguage;
    }

    // Build language instruction for suggestions
    let langInstruction = "";
    if (resolvedLanguage === "malayalam") {
      langInstruction = "IMPORTANT: You MUST generate all suggested questions natively in Malayalam (മലയാളം) script only. Do not use English.";
    } else {
      langInstruction = "IMPORTANT: You MUST generate all suggested questions natively in English only. Do not use Malayalam.";
    }

    const promptTemplate = `You are an AI assistant for Kerala Government employees.
Based ONLY on the following Government Circular content, generate questions an employee would naturally ask.

${langInstruction}

Rules:
- Return ONLY valid JSON. No markdown. No explanation.
- Format: {{"suggestions": ["...", "..."]}}
- Generate exactly 7 concise questions (under 12 words each).
- Cover: summary, responsibilities, departments, deadlines, compliance, actions, key changes.
- Do NOT repeat similar questions.

Circular content:
{text}

JSON:`;

    const llm = new ChatGroq({
      apiKey,
      model: "llama-3.1-8b-instant",
      temperature: 0.4,
    });

    const prompt = PromptTemplate.fromTemplate(promptTemplate);
    const parser = new StringOutputParser();
    const chain = prompt.pipe(llm).pipe(parser);

    const raw = await chain.invoke({ text: sourceText });
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
            suggestions = parsed.suggestions.flatMap(item => Array.isArray(item.questions) ? item.questions : []);
          }
        } else {
          suggestions = parsed.suggestions;
        }
      } else if (Array.isArray(parsed.questions)) {
        suggestions = parsed.questions;
      } else if (typeof parsed.suggestions === "object" && parsed.suggestions !== null) {
        if (Array.isArray(parsed.suggestions.questions)) {
          suggestions = parsed.suggestions.questions;
        }
      }
    }

    if (!Array.isArray(suggestions) || suggestions.length === 0 || typeof suggestions[0] !== "string") {
      suggestions = getDefaultSuggestions(activeLanguage, req.language);
    } else {
      suggestions = suggestions.slice(0, 8);
    }

    suggestionsCache.set(cacheKey, { suggestions, generatedAt: Date.now() });
    return res.json({ success: true, suggestions });
  } catch (err) {
    console.error("Suggestions generation error:", err.message);
    return res.json({ success: true, suggestions: getDefaultSuggestions(activeLanguage, req.language) });
  }
});

export default router;
