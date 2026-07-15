/**
 * Safely parses and repairs potentially malformed or truncated JSON responses from LLMs.
 */
function repairTruncatedJson(str) {
  let start = str.indexOf('{');
  if (start === -1) return null;
  let trimmed = str.substring(start).trim();

  let inString = false;
  let escape = false;
  let stack = [];

  let repaired = "";
  for (let i = 0; i < trimmed.length; i++) {
    let char = trimmed[i];
    repaired += char;

    if (escape) {
      escape = false;
      continue;
    }

    if (char === '\\') {
      escape = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === '{') {
        stack.push('}');
      } else if (char === '[') {
        stack.push(']');
      } else if (char === '}' || char === ']') {
        if (stack.length > 0 && stack[stack.length - 1] === char) {
          stack.pop();
        }
      }
    }
  }

  if (inString) {
    if (repaired.endsWith('\\')) {
      repaired = repaired.slice(0, -1);
    }
    repaired += '"';
  }

  // Remove trailing comma if present at the end of the content before closing structures
  let cleanRepaired = repaired.trim();
  if (cleanRepaired.endsWith(',')) {
    cleanRepaired = cleanRepaired.slice(0, -1);
  }

  // Pop from stack in reverse to close all open braces and brackets
  while (stack.length > 0) {
    let closeChar = stack.pop();
    cleanRepaired += closeChar;
  }

  // Clean trailing commas that might have been formed inside, e.g. ,} or ,]
  cleanRepaired = cleanRepaired.replace(/,\s*([}\]])/g, '$1');

  return cleanRepaired;
}

export function safeParseLLMJson(raw) {
  if (!raw || typeof raw !== "string") {
    return { success: false, error: "Input is not a string" };
  }

  let cleaned = raw.trim();

  // Strip Unicode Byte Order Mark (BOM) if present
  if (cleaned.charCodeAt(0) === 0xFEFF) {
    cleaned = cleaned.substring(1);
  }

  // Strip markdown code fences if wrapping the whole string
  cleaned = cleaned.replace(/^```json\s*|```$/g, "").trim();

  // Try direct parse first
  try {
    const parsed = JSON.parse(cleaned);
    return { success: true, data: parsed };
  } catch (e) {
    // Attempt block extraction: ignore preamble/postamble
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const extracted = cleaned.substring(firstBrace, lastBrace + 1);
      try {
        const parsed = JSON.parse(extracted);
        return { success: true, data: parsed };
      } catch (innerErr) {
        // Fall through to repair logic
      }
    }

    // Try repairing truncated JSON (unclosed strings, braces, brackets)
    try {
      const repaired = repairTruncatedJson(cleaned);
      if (repaired) {
        const parsed = JSON.parse(repaired);
        return { success: true, data: parsed };
      }
    } catch (repairErr) {
      return { success: false, error: repairErr.message, raw };
    }

    return { success: false, error: e.message, raw };
  }
}
