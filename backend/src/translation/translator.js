import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { detectContext } from './contextDetector.js';
import { buildTranslationPrompt } from './promptBuilder.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Populate process.env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') });
dotenv.config();

const GROQ_API_URL = process.env.GROQ_API_URL || 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
const DEFAULT_TIMEOUT_MS = 10000;
const MAX_RETRIES = 3;

/**
 * Get configured Groq API Key if present.
 * @returns {string|null}
 */
function getApiKey() {
  const key = process.env.GROQ_API_KEY;
  if (key && key !== 'your_groq_api_key_here' && key.trim() !== '') {
    return key.trim();
  }
  return null;
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Groq's 429 body includes a human-readable hint like "Please try again in
 * 470ms" or "Please try again in 2.92s". Parse that instead of guessing a
 * fixed backoff -- it tells us almost exactly how long the token-per-minute
 * window needs to drain, which fixed exponential backoff can't know.
 *
 * @param {string} errBody Raw response body text from a 429 response.
 * @returns {number|null} Suggested wait time in milliseconds, or null if not found.
 */
export function parseRetryAfterMs(errBody) {
  if (!errBody || typeof errBody !== 'string') return null;
  const match = errBody.match(/try again in\s+([\d.]+)(ms|s)\b/i);
  if (!match) return null;
  const value = parseFloat(match[1]);
  if (Number.isNaN(value)) return null;
  return match[2].toLowerCase() === 's' ? Math.ceil(value * 1000) : Math.ceil(value);
}

/**
 * Mask placeholders, HTML tags, and ICU variables before translation.
 */
function protectTokens(text) {
  const tokens = [];
  // Match {{var}}, {var}, %s, HTML tags, URLs, email addresses
  const regex = /(\{\{[\s\S]*?\}\}|\{[\s\S]*?\}|%[sd]|<[^>]+>|https?:\/\/[^\s]+|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
  
  const maskedText = text.replace(regex, (match) => {
    const placeholder = `__TOKEN_${tokens.length}__`;
    tokens.push({ placeholder, original: match });
    return placeholder;
  });

  return { maskedText, tokens };
}

/**
 * Restore protected tokens into translated text.
 */
function unprotectTokens(text, tokens) {
  let result = text;
  for (const token of tokens) {
    result = result.replaceAll(token.placeholder, token.original);
  }
  return result;
}

/**
 * Translate English UI text into natural Malayalam using context-aware prompts and Groq LLM.
 * 
 * @param {string} text Source English text.
 * @param {Object} [options] Configuration & context options.
 * @param {Object} [options.context] Pre-detected context object.
 * @param {string} [options.category] Category override.
 * @param {string} [options.component] Component override.
 * @param {number} [options.timeoutMs=10000] Request timeout in ms.
 * @param {number} [options.retries=3] Max retries.
 * @returns {Promise<string>} Translated Malayalam text or original string fallback.
 */
export async function translate(text, options = {}) {
  if (!text || typeof text !== 'string' || !text.trim()) {
    return text || '';
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn('[Translator] GROQ_API_KEY is not configured. Returning original text fallback.');
    return text;
  }

  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const maxRetries = options.retries !== undefined ? options.retries : MAX_RETRIES;

  // Step 1: Detect Context
  const context = options.context || detectContext(text, options);

  // Step 2: Protect Tokens (placeholders, HTML tags, URLs)
  const { maskedText, tokens } = protectTokens(text);

  // Step 3: Build Context-Aware Prompt with Glossary & Few-shot Examples
  const { systemPrompt, userPrompt } = buildTranslationPrompt(maskedText, context);

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
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.05,
          max_tokens: 500
        }),
        signal: controller.signal
      });

      clearTimeout(timer);

      if (!response.ok) {
        const errBody = await response.text();
        if (response.status === 429) {
          console.warn(`[Translator] Groq 429 Rate Limit encountered. Activating graceful fallback to English/Cache.`);
          return text; // Graceful fallback — never throw 429 to controllers
        }
        console.warn(`[Translator] Attempt ${attempt} failed with status ${response.status}: ${errBody}`);
        if (attempt < maxRetries) {
          await delay(Math.pow(2, attempt - 1) * 1000);
          continue;
        }
        return text;
      }

      const data = await response.json();
      let translated = data.choices?.[0]?.message?.content?.trim() || '';

      // Strip enclosing quotes or preamble explanations
      translated = translated.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();
      const quotedMatch = translated.match(/^["']([^"']+)["']/);
      if (quotedMatch) {
        translated = quotedMatch[1].trim();
      } else if (translated.includes(' എന്നത് ')) {
        translated = translated.split(' എന്നത് ')[0].replace(/^["']|["']$/g, '').trim();
      } else if ((translated.startsWith('"') && translated.endsWith('"')) || (translated.startsWith('\'') && translated.endsWith('\''))) {
        translated = translated.slice(1, -1).trim();
      }

      // Unprotect placeholders
      if (tokens.length > 0) {
        translated = unprotectTokens(translated, tokens);
      }

      return translated || text;

    } catch (error) {
      clearTimeout(timer);
      console.warn(`[Translator] Groq API warning on attempt ${attempt}:`, error.message);
      if (attempt < maxRetries && !error.message.includes('429')) {
        await delay(Math.pow(2, attempt - 1) * 1000);
      }
    }
  }

  return text;
}

/**
 * Single Structured Batch Translation for Multiple Strings to Groq.
 * Drastically reduces HTTP requests, tokens, and rate limits.
 * 
 * @param {string[]} texts Array of English UI strings to translate.
 * @param {Object} [options] Context & options passed to Groq.
 * @returns {Promise<string[]>} Array of translated Malayalam strings.
 */
export async function translateBatch(texts, options = {}) {
  if (!Array.isArray(texts) || texts.length === 0) return [];
  if (texts.length === 1) {
    const single = await translate(texts[0], options);
    return [single];
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    return texts;
  }

  const startTime = Date.now();

  try {
    const systemPrompt = `You are a Senior Kerala Government Local Body Localization Expert.
Translate the following JSON array of English UI strings into natural Office Malayalam used in Panchayat, Municipal, and Corporation software.
Rule 1: Keep English technical terms in Malayalam script (e.g., Dashboard -> ഡാഷ്ബോർഡ്, Task -> ടാസ്ക്).
Rule 2: Respond ONLY with a valid JSON array of strings matching the exact length and order of the input array.
Rule 3: No preambles, no Markdown formatting outside JSON.`;

    const userPrompt = JSON.stringify(texts);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.05,
        max_tokens: 1500
      }),
      signal: controller.signal
    });

    clearTimeout(timer);

    if (!response.ok) {
      console.warn(`[Translator Batch] Groq returned status ${response.status}. Fallback to individual strings.`);
      return texts;
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content?.trim() || '';
    content = content.replace(/^```json\n?/i, '').replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();

    const parsed = JSON.parse(content);
    if (Array.isArray(parsed) && parsed.length === texts.length) {
      const execTime = Date.now() - startTime;
      if (!options.suppressLogs) {
        console.log('\n====================================');
        console.log('Groq Batch Translation');
        console.log('====================================');
        console.log(`Batch Size     : ${texts.length} strings`);
        console.log(`Execution Time : ${execTime}ms`);
        console.log('====================================\n');
      }
      return parsed.map((t, idx) => (typeof t === 'string' && t.trim() ? t.trim() : texts[idx]));
    }
  } catch (err) {
    console.warn(`[Translator Batch] Batch Groq request failed (${err.message}). Returning original texts.`);
  }

  return texts;
}

export default {
  translate,
  translateBatch
};