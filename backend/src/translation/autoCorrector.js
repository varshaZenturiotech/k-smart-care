/**
 * Auto Correction Engine for K-SMART CARE Office Malayalam.
 * Automatically repairs dictionary/bookish Malayalam translations and untranslated English verbs.
 * Driven by configuration files (officeMalayalam.json, government_glossary.json, contextRules.json).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STYLEGUIDE_PATH = path.resolve(__dirname, '../../../shared/localization/styleguide/officeMalayalam.json');
const CONTEXT_RULES_PATH = path.resolve(__dirname, '../../../shared/localization/styleguide/contextRules.json');

let autoCorrectionMap = new Map();
let contextRulesMap = new Map();
let isLoaded = false;

function ensureCorrectionData() {
  if (isLoaded) return;

  // Load from styleguide avoidWords
  if (fs.existsSync(STYLEGUIDE_PATH)) {
    try {
      const raw = fs.readFileSync(STYLEGUIDE_PATH, 'utf-8');
      const data = JSON.parse(raw);
      if (data.avoidWords) {
        for (const [avoidWord, reason] of Object.entries(data.avoidWords)) {
          const match = reason.match(/Use ([^\s]+) instead/);
          if (match && match[1]) {
            autoCorrectionMap.set(avoidWord.trim(), match[1].trim());
          }
        }
      }
    } catch (e) {
      console.warn('[AutoCorrector] Error loading styleguide:', e.message);
    }
  }

  // Common direct dictionary -> office term fixes
  autoCorrectionMap.set("യോഗം", "മീറ്റിംഗ്");
  autoCorrectionMap.set("സമ്മേളനം", "മീറ്റിംഗ്");
  autoCorrectionMap.set("ചുമതല", "ടാസ്ക്");
  autoCorrectionMap.set("ജോലി", "ടാസ്ക്");
  autoCorrectionMap.set("പ്രവൃത്തി", "ടാസ്ക്");
  autoCorrectionMap.set("നിയന്ത്രണ പാനൽ", "ഡാഷ്ബോർഡ്");
  autoCorrectionMap.set("സംഭരണി", "റിപ്പോസിറ്ററി");
  autoCorrectionMap.set("ശേഖരം", "റിപ്പോസിറ്ററി");
  autoCorrectionMap.set("പ്രവൃത്തി പ്രവാഹം", "വർക്ക്ഫ്ലോ");
  autoCorrectionMap.set("സഹായി", "അസിസ്റ്റന്റ്");
  autoCorrectionMap.set("തിരയുക", "സെർച്ച് ചെയ്യുക");
  autoCorrectionMap.set("അംഗീകരിക്കുക", "അപ്രൂവ് ചെയ്യുക");
  autoCorrectionMap.set("നിരസിക്കുക", "റിജക്ട് ചെയ്യുക");
  autoCorrectionMap.set("ഉണ്ടാക്കുക", "ക്രിയേറ്റ് ചെയ്യുക");
  autoCorrectionMap.set("സൃഷ്ടിക്കുക", "ക്രിയേറ്റ് ചെയ്യുക");

  // Load context rules
  if (fs.existsSync(CONTEXT_RULES_PATH)) {
    try {
      const raw = fs.readFileSync(CONTEXT_RULES_PATH, 'utf-8');
      const rules = JSON.parse(raw);
      for (const [ctx, terms] of Object.entries(rules)) {
        contextRulesMap.set(ctx.toLowerCase(), terms);
      }
    } catch (e) {
      console.warn('[AutoCorrector] Error loading contextRules:', e.message);
    }
  }

  isLoaded = true;
}

/**
 * Automatically repair translation text based on rules and context.
 * 
 * @param {string} translation Current Malayalam translation
 * @param {string} [context="General"] Application context
 * @param {string} [source=""] Source English string
 * @returns {{ repairedText: string, correctionsMade: number, correctionsList: Array }}
 */
export function autoCorrectMalayalam(translation, context = "General", source = "") {
  ensureCorrectionData();

  if (!translation || typeof translation !== 'string' || !translation.trim()) {
    return { repairedText: translation || '', correctionsMade: 0, correctionsList: [] };
  }

  let text = translation;
  let correctionsMade = 0;
  const correctionsList = [];

  // 1. Config-driven Dictionary/Bookish Replacements
  for (const [avoidTerm, preferredTerm] of autoCorrectionMap.entries()) {
    if (text.includes(avoidTerm)) {
      // Regex replace word boundaries or whole substring
      const regex = new RegExp(avoidTerm, 'g');
      text = text.replace(regex, preferredTerm);
      correctionsMade++;
      correctionsList.push({ from: avoidTerm, to: preferredTerm });
    }
  }

  // 2. Context-Aware Replacements
  const ctxKey = (context || 'General').toLowerCase();
  const ctxTerms = contextRulesMap.get(ctxKey) || contextRulesMap.get('general');

  if (ctxTerms && source) {
    for (const [engTerm, preferredMal] of Object.entries(ctxTerms)) {
      const engRegex = new RegExp(`\\b${engTerm}\\b`, 'i');
      if (engRegex.test(source) && engRegex.test(text)) {
        text = text.replace(engRegex, preferredMal);
        correctionsMade++;
        correctionsList.push({ from: engTerm, to: preferredMal });
      }
    }
  }

  // 3. Common English Verb Replacements remaining in text
  const commonVerbs = [
    { eng: "Approve", mal: "അപ്രൂവ് ചെയ്യുക" },
    { eng: "Reject", mal: "റിജക്ട് ചെയ്യുക" },
    { eng: "Review", mal: "റിവ്യൂ ചെയ്യുക" },
    { eng: "Create", mal: "ക്രിയേറ്റ് ചെയ്യുക" },
    { eng: "Delete", mal: "ഡിലീറ്റ് ചെയ്യുക" },
    { eng: "Upload", mal: "അപ്ലോഡ് ചെയ്യുക" },
    { eng: "Download", mal: "ഡൗൺലോഡ് ചെയ്യുക" },
    { eng: "Search", mal: "സെർച്ച് ചെയ്യുക" },
    { eng: "Filter", mal: "ഫിൽട്ടർ ചെയ്യുക" },
    { eng: "Submit", mal: "സബ്മിറ്റ് ചെയ്യുക" }
  ];

  for (const item of commonVerbs) {
    const regex = new RegExp(`\\b${item.eng}\\b`, 'i');
    if (regex.test(text)) {
      text = text.replace(regex, item.mal);
      correctionsMade++;
      correctionsList.push({ from: item.eng, to: item.mal });
    }
  }

  return {
    repairedText: text,
    correctionsMade,
    correctionsList
  };
}

export default {
  autoCorrectMalayalam
};
