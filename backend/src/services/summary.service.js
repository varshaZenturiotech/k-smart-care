import { ChatGroq } from "@langchain/groq";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { SUMMARY_PROMPT } from "../prompts/summary.prompt.js";
import { KEY_POINTS_PROMPT } from "../prompts/keypoints.prompt.js";
import { safeParseLLMJson } from "../utils/safeParseLLMJson.js";
import dotenv from "dotenv";

dotenv.config();

const MAX_LENGTH = 16000; // keep well within the model's context window

function hasGroqKey() {
  const apiKey = process.env.GROQ_API_KEY;
  return apiKey && apiKey !== "your_groq_api_key_here" && apiKey.trim() !== "";
}

async function runPromptOverText(promptTemplate, text, temperature) {
  const truncatedText =
    text.length > MAX_LENGTH ? text.substring(0, MAX_LENGTH) + "\n[Text truncated for length...]" : text;

  const llm = new ChatGroq({
    apiKey: process.env.GROQ_API_KEY,
    model: "llama-3.1-8b-instant",
    temperature,
  });

  const prompt = PromptTemplate.fromTemplate(promptTemplate);
  const parser = new StringOutputParser();
  const chain = prompt.pipe(llm).pipe(parser);

  const result = await chain.invoke({ text: truncatedText });
  return result.trim();
}

/**
 * Generate a concise bulleted summary from raw text using Llama 3.1 via Groq.
 */
export async function generateSummaryFromText(text) {
  if (!text || !text.trim()) return "No text available for summarization.";

  if (!hasGroqKey()) {
    console.warn("GROQ_API_KEY is not configured. Falling back to local rule-based summarization.");
    return generateLocalFallbackSummary(text);
  }

  try {
    return await runPromptOverText(SUMMARY_PROMPT, text, 0.3);
  } catch (err) {
    console.error("Error generating AI summary:", err);
    throw new Error("Failed to generate AI summary.");
  }
}

/**
 * Generate a short, skimmable key-points list — used by the "Key Points"
 * quick action in the AI Assistant panel. Distinct from generateSummaryFromText:
 * shorter, no overview sentence, just the facts.
 */
export async function generateKeyPointsFromText(text) {
  if (!text || !text.trim()) return "No key points available.";

  if (!hasGroqKey()) {
    console.warn("GROQ_API_KEY is not configured. Falling back to local rule-based key points.");
    return generateLocalFallbackSummary(text);
  }

  try {
    return await runPromptOverText(KEY_POINTS_PROMPT, text, 0.2);
  } catch (err) {
    console.error("Error generating key points:", err);
    throw new Error("Failed to generate key points.");
  }
}

/**
 * Generate a semantic fallback summary using rule-based text heuristics
 * (used only when no GROQ_API_KEY is configured, for both summary and
 * key-points requests, so the feature still works in a dev environment).
 */
function generateLocalFallbackSummary(text) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const title = lines.slice(0, 3).find((l) => l.length > 15) || "LSGD Department Circular";

  const datePattern = /\b\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\b/;
  const dateMatch = text.match(datePattern);
  const effectiveDate = dateMatch ? dateMatch[0] : new Date().toLocaleDateString();

  const keyDirectives = lines
    .filter((line) => line.length > 40 && !line.includes("http") && !line.includes("Page"))
    .slice(0, 3);

  const directivesList =
    keyDirectives.length > 0
      ? keyDirectives.map((points) => `- ${points}`).join("\n")
      : "- Outlines standard departmental procedures.\n- Establishes administrative compliance rules.";

  return `**Overview**: This circular covers "${title}". It establishes departmental guidelines and compliance directives for local self-government employees.

**Key Directive Points**:
${directivesList}

**Effective Date**: ${effectiveDate} (Subject to department verification)`;
}

export async function generateMetadataFromText(text) {
  if (!text || !text.trim()) {
    return getFallbackMetadata();
  }

  if (!hasGroqKey()) {
    console.warn("GROQ_API_KEY is not configured. Falling back to local rule-based metadata.");
    return getFallbackMetadata(text);
  }

  const promptTemplate = `Analyze this Kerala Government Circular.

Return ONLY valid JSON. Do not include any markdown formatting, backticks, or explanation. It must start with '{' and end with '}'.

{{
"title":"",
"summary":"",
"departments":[],
"category":"",
"priority":"",
"keywords":[]
}}

Rules:
Departments must be an array.
Possible Departments:
Health
Finance
Revenue
Engineering
Planning
Agriculture
Education
Administration
IT
Sanitation
Local Self Government

Category:
Government Order
Circular
Notification
Policy
Training
Tender
Recruitment
Meeting

Priority:
High
Medium
Low

Generate 5-10 keywords.

Circular text:
{text}

JSON:`;

  try {
    const rawResult = await runPromptOverText(promptTemplate, text, 0.2);
    const parsedRes = safeParseLLMJson(rawResult);
    if (!parsedRes.success) {
      throw new Error(`Summary JSON Parsing failed: ${parsedRes.error}`);
    }
    const parsed = parsedRes.data;

    // Ensure array departments and keywords
    const departments = Array.isArray(parsed.departments) ? parsed.departments : [];
    const keywords = Array.isArray(parsed.keywords) ? parsed.keywords : [];
    
    // Validate priorities and categories
    const validPriorities = ["High", "Medium", "Low"];
    const priority = validPriorities.includes(parsed.priority) ? parsed.priority : "Medium";
    
    const validCategories = [
      "Government Order",
      "Circular",
      "Notification",
      "Policy",
      "Training",
      "Tender",
      "Recruitment",
      "Meeting"
    ];
    const category = validCategories.includes(parsed.category) ? parsed.category : "Circular";

    return {
      title: parsed.title || "Untitled Circular",
      summary: parsed.summary || "",
      departments,
      category,
      priority,
      keywords,
    };
  } catch (err) {
    console.error("Error generating AI metadata:", err);
    return getFallbackMetadata(text);
  }
}

function getFallbackMetadata(text = "") {
  // Extract a title from the first non-empty lines
  const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);
  const title = lines.slice(0, 3).find(l => l.length > 15) || "LSGD Department Circular";

  // Simple keyword matching for department
  const lowerText = text.toLowerCase();
  const matchedDeps = [];
  if (lowerText.includes("health") || lowerText.includes("medical") || lowerText.includes("hospital")) matchedDeps.push("Health");
  if (lowerText.includes("finance") || lowerText.includes("treasury") || lowerText.includes("budget")) matchedDeps.push("Finance");
  if (lowerText.includes("revenue") || lowerText.includes("tax")) matchedDeps.push("Revenue");
  if (lowerText.includes("engineering") || lowerText.includes("pwd") || lowerText.includes("road")) matchedDeps.push("Engineering");
  if (lowerText.includes("planning") || lowerText.includes("project")) matchedDeps.push("Planning");
  if (lowerText.includes("agriculture") || lowerText.includes("farming") || lowerText.includes("crop")) matchedDeps.push("Agriculture");
  if (lowerText.includes("education") || lowerText.includes("school") || lowerText.includes("teacher")) matchedDeps.push("Education");
  if (lowerText.includes("admin") || lowerText.includes("office") || lowerText.includes("staff")) matchedDeps.push("Administration");
  if (lowerText.includes("it") || lowerText.includes("software") || lowerText.includes("digital")) matchedDeps.push("IT");
  if (lowerText.includes("sanitation") || lowerText.includes("waste") || lowerText.includes("clean")) matchedDeps.push("Sanitation");
  if (lowerText.includes("local") || lowerText.includes("panchayat") || lowerText.includes("municipality")) matchedDeps.push("Local Self Government");

  if (matchedDeps.length === 0) {
    matchedDeps.push("Local Self Government");
  }

  // Simple category detection
  let category = "Circular";
  if (lowerText.includes("order")) category = "Government Order";
  else if (lowerText.includes("notification")) category = "Notification";
  else if (lowerText.includes("policy")) category = "Policy";
  else if (lowerText.includes("tender")) category = "Tender";
  else if (lowerText.includes("recruitment") || lowerText.includes("job")) category = "Recruitment";
  else if (lowerText.includes("meeting") || lowerText.includes("minutes")) category = "Meeting";

  // Simple priority detection
  let priority = "Medium";
  if (lowerText.includes("urgent") || lowerText.includes("immediate") || lowerText.includes("critical")) {
    priority = "High";
  } else if (lowerText.includes("routine") || lowerText.includes("low priority")) {
    priority = "Low";
  }

  return {
    title,
    summary: text ? text.slice(0, 200) + "..." : "No summary available.",
    departments: matchedDeps,
    category,
    priority,
    keywords: ["Kerala", "Government", "Circular", category, ...matchedDeps],
  };
}

