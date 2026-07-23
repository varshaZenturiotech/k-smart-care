import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { isTechnicalWord, shouldTransliterate } from './glossaryService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure process.env is populated
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') });
dotenv.config();

const GROQ_API_URL = process.env.GROQ_API_URL || 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
const DEFAULT_TIMEOUT_MS = 10000;
const MAX_RETRIES = 3;

/**
 * Refinement System Prompt adhering strictly to Step 6 requirements.
 */
const REFINE_SYSTEM_PROMPT = `You are a Malayalam style refiner for Kerala Local Self Government Department office communications.

Rules:
• Rewrite the provided Malayalam string to sound like natural Kerala Government office Malayalam.
• Keep meaning identical to original.
• Keep placeholders (e.g. {{count}}, {name}, %s) and HTML tags intact.
• Keep glossary terms and technical terms intact.
• Do not translate again. Only improve fluency and sentence rhythm.
• Return ONLY the refined Malayalam text. Never include explanations.`;

function getApiKey() {
  const key = process.env.GROQ_API_KEY;
  if (key && key !== 'your_groq_api_key_here' && key.trim() !== '') {
    return key.trim();
  }
  return null;
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Parse Groq's "Please try again in Xms/Xs" hint from a 429 body.
 * @param {string} errBody
 * @returns {number|null} Milliseconds to wait, or null if not found.
 */
function parseRetryAfterMs(errBody) {
  if (!errBody || typeof errBody !== 'string') return null;
  const match = errBody.match(/try again in\s+([\d.]+)(ms|s)\b/i);
  if (!match) return null;
  const value = parseFloat(match[1]);
  if (Number.isNaN(value)) return null;
  return match[2].toLowerCase() === 's' ? Math.ceil(value * 1000) : Math.ceil(value);
}

/**
 * Extract technical terms from original English string to preserve in refinement.
 */
function extractDoNotTranslateTerms(englishOriginal) {
  if (!englishOriginal) return [];
  const words = englishOriginal.match(/[A-Za-z][A-Za-z\s-]{1,30}/g) || [];
  const terms = new Set();
  for (const w of words) {
    const trimmed = w.trim();
    if (trimmed && (isTechnicalWord(trimmed) || shouldTransliterate(trimmed))) {
      terms.add(trimmed);
    }
  }
  return Array.from(terms);
}

/**
 * Refines a translated Malayalam string to sound like natural Kerala Government office speech.
 * 
 * @param {string} text Translated Malayalam text to refine.
 * @param {Object} [context] Context object containing optional englishOriginal and category.
 * @param {Object} [options] Timeout & retry configuration.
 * @returns {Promise<string>} Refined Malayalam text.
 */
export async function refine(text, context = {}, options = {}) {
  if (!text || typeof text !== 'string' || !text.trim()) {
    return text || '';
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn('[LLMRefiner] GROQ_API_KEY is not configured. Returning input text unchanged.');
    return text;
  }

  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const maxRetries = options.retries !== undefined ? options.retries : MAX_RETRIES;

  const doNotTranslate = extractDoNotTranslateTerms(context.englishOriginal);
  const doNotTranslateBlock = doNotTranslate.length
    ? `\nDO-NOT-TRANSLATE terms to keep unchanged: ${doNotTranslate.join(', ')}`
    : '';

  const userPrompt = `Malayalam input text to refine:\n"${text}"${doNotTranslateBlock}\n\nReturn ONLY the refined Malayalam text.`;

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
            { role: 'system', content: REFINE_SYSTEM_PROMPT },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.1,
          max_tokens: 500
        }),
        signal: controller.signal
      });

      clearTimeout(timer);

      if (!response.ok) {
        const errText = await response.text();
        if (response.status === 429) {
          console.warn(`[LLMRefiner] Groq 429 rate limit encountered. Skipping refinement gracefully.`);
          return text;
        }
        console.warn(`[LLMRefiner] Attempt ${attempt} failed with status ${response.status}: ${errText}`);
        if (attempt < maxRetries) {
          await delay(Math.pow(2, attempt - 1) * 1000);
          continue;
        }
        return text;
      }

      const data = await response.json();
      let refined = data.choices?.[0]?.message?.content?.trim() || '';

      if ((refined.startsWith('"') && refined.endsWith('"')) || (refined.startsWith('\'') && refined.endsWith('\''))) {
        refined = refined.slice(1, -1).trim();
      }

      return refined || text;

    } catch (error) {
      clearTimeout(timer);
      console.warn(`[LLMRefiner] Warning on attempt ${attempt}:`, error.message);
      if (attempt < maxRetries && !error.message.includes('429')) {
        await delay(Math.pow(2, attempt - 1) * 1000);
      }
    }
  }

  return text;
}

export default {
  refine
};