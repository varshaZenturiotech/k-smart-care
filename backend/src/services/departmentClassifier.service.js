import { ChatGroq } from "@langchain/groq";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { DEPARTMENTS, ALL_DEPARTMENTS } from "../config/departments.js";
import dotenv from "dotenv";

dotenv.config();

const VALID_TAGS = [...DEPARTMENTS, ALL_DEPARTMENTS];

const CLASSIFY_PROMPT = `You are classifying a Kerala Local Self Government circular by which
department(s) it is relevant to.

Choose ONLY from this exact list (copy the spelling exactly):
${DEPARTMENTS.map((d) => `- ${d}`).join("\n")}
- ${ALL_DEPARTMENTS} (use this if the circular applies broadly to every department, e.g. general leave policy or holiday notices)

Respond with ONLY a JSON array of strings, nothing else. Pick 1-2 department
names that best fit. Example: ["Health"] or ["${ALL_DEPARTMENTS}"]

Circular text:
{text}

JSON array:`;

function hasGroqKey() {
  const apiKey = process.env.GROQ_API_KEY;
  return apiKey && apiKey !== "your_groq_api_key_here" && apiKey.trim() !== "";
}

/**
 * Suggests department tags for a circular's text. Returns an array of
 * strings drawn from the fixed DEPARTMENTS list (or ALL_DEPARTMENTS).
 * This is a *suggestion* — the uploader can always override it via
 * PATCH /api/circulars/:id/department.
 */
export async function classifyDepartments(text) {
  if (!text || !text.trim()) return [ALL_DEPARTMENTS];

  if (!hasGroqKey()) {
    console.warn("GROQ_API_KEY not configured — defaulting department tag to 'All Departments'.");
    return [ALL_DEPARTMENTS];
  }

  try {
    const truncated = text.length > 6000 ? text.slice(0, 6000) : text;

    const llm = new ChatGroq({
      apiKey: process.env.GROQ_API_KEY,
      model: "llama-3.1-8b-instant",
      temperature: 0,
    });
    const prompt = PromptTemplate.fromTemplate(CLASSIFY_PROMPT);
    const parser = new StringOutputParser();
    const chain = prompt.pipe(llm).pipe(parser);

    const raw = await chain.invoke({ text: truncated });
    const parsed = safeParseArray(raw);

    // Filter to only tags that are actually in our controlled list — an LLM
    // can still hallucinate a department name that isn't real.
    const valid = parsed.filter((tag) => VALID_TAGS.includes(tag));

    return valid.length > 0 ? valid : [ALL_DEPARTMENTS];
  } catch (err) {
    console.error("Department classification failed, defaulting to All Departments:", err);
    return [ALL_DEPARTMENTS];
  }
}

function safeParseArray(raw) {
  try {
    // Models sometimes wrap JSON in ```json fences despite instructions — strip those.
    const cleaned = raw.trim().replace(/^```json\s*|```$/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}