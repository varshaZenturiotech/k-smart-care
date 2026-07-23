import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure process.env is populated (mirrors translator.js / llmRefiner.js)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') });
dotenv.config();

const GROQ_API_URL = process.env.GROQ_API_URL || 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
const DEFAULT_TIMEOUT_MS = 10000;
const MAX_RETRIES = 3;

/**
 * Semantic QA judge.
 *
 * Structural checks in qaValidator.js (placeholders, HTML tags, remaining
 * English, duplicate words, unicode) cannot detect a fluent-but-wrong
 * translation, e.g. "Approve casual leave request" being rendered as
 * something meaning "permit retirement during the evening interval" —
 * zero structural issues, completely wrong meaning.
 *
 * This module asks the LLM to (a) back-translate the Malayalam output to
 * English and (b) judge whether it is semantically equivalent to the
 * original source string, on a 0-100 scale. It is a judge call, not a
 * second independent translation pipeline, so keep temperature at 0 and
 * force strict JSON output.
 */
const SEMANTIC_JUDGE_SYSTEM_PROMPT = `You are a bilingual (Malayalam/English) quality reviewer for a Kerala Local Self Government office application.

You will be given:
1. The original English source string.
2. A Malayalam translation of that string.

Your job:
- Back-translate the Malayalam text into plain English, as literally and accurately as you can, ignoring style.
- Compare that back-translation to the original English source and judge whether the MEANING is preserved. Wrong words, invented words, wrong grammatical roles (e.g. "leave" translated as "retirement", "flood" translated as "bridge"), or reversed meaning must be scored low even if the Malayalam sentence reads fluently.
- Placeholders (e.g. {{count}}, {name}), HTML tags, and glossary/technical terms in the DO-NOT-TRANSLATE list should be treated as correct if left unchanged; do not penalize for those.
- Score 0-100: 90-100 = fully faithful meaning, minor style differences only. 60-89 = meaning mostly preserved but a word or nuance is off. Below 60 = meaning is wrong, missing, or reversed in a way a Malayalam-speaking government employee would misunderstand.

Return ONLY a single JSON object, no markdown fences, no explanation outside the JSON, in this exact shape:
{"backTranslation": "...", "meaningScore": <integer 0-100>, "meaningPreserved": <true|false>, "issue": "<short reason if meaningScore < 90, else empty string>"}`;

function getApiKey() {
  const key = process.env.GROQ_API_KEY;
  if (key && key !== 'your_groq_api_key_here' && key.trim() !== '') {
    return key.trim();
  }
  return null;
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Best-effort extraction of a JSON object from a model response, in case
 * the model wraps it in ```json fences or adds stray text despite
 * instructions.
 */
function extractJson(raw) {
  if (!raw) return null;
  let text = raw.trim();
  text = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();

  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * Judge whether a Malayalam translation is semantically equivalent to its
 * English source, via LLM back-translation.
 *
 * @param {string} english Original English source string.
 * @param {string} translated Malayalam translation to validate.
 * @param {Object} [options]
 * @param {number} [options.timeoutMs=10000]
 * @param {number} [options.retries=3]
 * @param {number} [options.passThreshold=90] Minimum meaningScore to count as valid.
 * @returns {Promise<{valid: boolean, meaningScore: number|null, backTranslation: string, issue: string, checked: boolean}>}
 *   `checked` is false when the judge call could not be completed (no API
 *   key, exhausted retries, etc.) — callers should treat that as
 *   "unknown", not "passed", and fall back to manual review rather than
 *   silently accepting the translation.
 */
export async function validateSemanticEquivalence(english, translated, options = {}) {
  const passThreshold = options.passThreshold !== undefined ? options.passThreshold : 90;

  if (!english || !translated || typeof translated !== 'string' || !translated.trim()) {
    return { valid: false, meaningScore: 0, backTranslation: '', issue: 'Empty source or translation', checked: true };
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn('[SemanticValidator] GROQ_API_KEY is not configured. Skipping semantic check.');
    return { valid: false, meaningScore: null, backTranslation: '', issue: 'Semantic check skipped: no API key', checked: false };
  }

  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const maxRetries = options.retries !== undefined ? options.retries : MAX_RETRIES;

  const userPrompt = `English source:\n"${english}"\n\nMalayalam translation:\n"${translated}"\n\nReturn ONLY the JSON object described in your instructions.`;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: DEFAULT_MODEL,
          messages: [
            { role: 'system', content: SEMANTIC_JUDGE_SYSTEM_PROMPT },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0,
          max_tokens: 400
        }),
        signal: controller.signal
      });

      clearTimeout(timer);

      if (!response.ok) {
        const errText = await response.text();
        console.warn(`[SemanticValidator] Attempt ${attempt} failed with status ${response.status}: ${errText}`);
        if (response.status === 429) {
          throw new Error('GROQ_RATE_LIMIT');
        }
        if (attempt < maxRetries) {
          await delay(Math.pow(2, attempt - 1) * 1000);
          continue;
        }
        return { valid: false, meaningScore: null, backTranslation: '', issue: 'Semantic check failed: API error', checked: false };
      }

      const data = await response.json();
      const raw = data.choices?.[0]?.message?.content?.trim() || '';
      const parsed = extractJson(raw);

      if (!parsed || typeof parsed.meaningScore !== 'number') {
        console.warn('[SemanticValidator] Could not parse judge response:', raw);
        if (attempt < maxRetries) {
          await delay(Math.pow(2, attempt - 1) * 1000);
          continue;
        }
        return { valid: false, meaningScore: null, backTranslation: '', issue: 'Semantic check failed: unparseable judge response', checked: false };
      }

      const meaningScore = Math.max(0, Math.min(100, Math.round(parsed.meaningScore)));

      return {
        valid: meaningScore >= passThreshold,
        meaningScore,
        backTranslation: parsed.backTranslation || '',
        issue: parsed.issue || '',
        checked: true
      };

    } catch (error) {
      clearTimeout(timer);
      if (error.message === 'GROQ_RATE_LIMIT') {
        throw error;
      }
      console.error(`[SemanticValidator] Error on attempt ${attempt}:`, error.message);
      if (attempt < maxRetries) {
        await delay(Math.pow(2, attempt - 1) * 1000);
      }
    }
  }

  return { valid: false, meaningScore: null, backTranslation: '', issue: 'Semantic check failed: retries exhausted', checked: false };
}

export default {
  validateSemanticEquivalence
};