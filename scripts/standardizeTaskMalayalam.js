import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

console.log("Starting Malayalam Task Localization Standardization Audit & Update...");

// Helper to safely read and write JSON files
function updateJsonFile(filePath, updateFn) {
  if (!fs.existsSync(filePath)) {
    console.warn(`File not found: ${filePath}`);
    return;
  }
  const content = fs.readFileSync(filePath, "utf-8");
  let json;
  try {
    json = JSON.parse(content);
  } catch (err) {
    console.error(`Error parsing JSON in ${filePath}:`, err.message);
    return;
  }
  const updatedJson = updateFn(json);
  fs.writeFileSync(filePath, JSON.stringify(updatedJson, null, 2), "utf-8");
  console.log(`Updated JSON file: ${path.relative(rootDir, filePath)}`);
}

// Helper for bulk text replacements in raw files
function replaceInFile(filePath, replacements) {
  if (!fs.existsSync(filePath)) {
    console.warn(`File not found: ${filePath}`);
    return;
  }
  let content = fs.readFileSync(filePath, "utf-8");
  let modified = false;
  for (const [target, replacement] of replacements) {
    if (content.includes(target)) {
      content = content.replaceAll(target, replacement);
      modified = true;
    }
  }
  if (modified) {
    fs.writeFileSync(filePath, content, "utf-8");
    console.log(`Replaced text in: ${path.relative(rootDir, filePath)}`);
  }
}

// 1. Audit and update shared/localization/glossary/categories/tasks.json
const tasksCategoryPath = path.join(rootDir, "shared/localization/glossary/categories/tasks.json");
updateJsonFile(tasksCategoryPath, (arr) => {
  if (!Array.isArray(arr)) return arr;
  return arr.map((entry) => {
    if (entry.english === "Overdue Tasks") entry.malayalam = "കാലാവധി കഴിഞ്ഞ ടാസ്കുകൾ";
    if (entry.english === "Overdue") entry.malayalam = "കാലാവധി കഴിഞ്ഞ";
    if (entry.english === "Completed Tasks") entry.malayalam = "പൂർത്തിയാക്കിയ ടാസ്കുകൾ";
    if (entry.english === "Pending Tasks") entry.malayalam = "തീർപ്പാക്കാനുള്ള ടാസ്കുകൾ";
    if (entry.english === "In Progress") entry.malayalam = "പുരോഗമിക്കുന്നു";
    if (entry.english === "Due Today") entry.malayalam = "ഇന്ന് പൂർത്തിയാക്കേണ്ട";
    return entry;
  });
});

// 2. Audit and update shared/localization/glossary/categories/task_management.json
const taskMgmtCategoryPath = path.join(rootDir, "shared/localization/glossary/categories/task_management.json");
updateJsonFile(taskMgmtCategoryPath, (arr) => {
  if (!Array.isArray(arr)) return arr;
  return arr.map((entry) => {
    if (entry.english === "Overdue Tasks") entry.malayalam = "കാലാവധി കഴിഞ്ഞ ടാസ്കുകൾ";
    if (entry.english === "Overdue") entry.malayalam = "കാലാവധി കഴിഞ്ഞ";
    if (entry.english === "Completed") entry.malayalam = "പൂർത്തിയാക്കിയ";
    if (entry.english === "Pending") entry.malayalam = "തീർപ്പാക്കാനുള്ള";
    if (entry.english === "In Progress") entry.malayalam = "പുരോഗമിക്കുന്നു";
    if (entry.english === "Due Today") entry.malayalam = "ഇന്ന് പൂർത്തിയാക്കേണ്ട";
    return entry;
  });
});

// 3. Audit and update shared/localization/glossary/government_glossary.json
const govtGlossaryPath = path.join(rootDir, "shared/localization/glossary/government_glossary.json");
updateJsonFile(govtGlossaryPath, (arr) => {
  if (!Array.isArray(arr)) return arr;
  return arr.map((entry) => {
    if (entry.english === "Overdue Tasks") entry.malayalam = "കാലാവധി കഴിഞ്ഞ ടാസ്കുകൾ";
    if (entry.english === "Overdue") entry.malayalam = "കാലാവധി കഴിഞ്ഞ";
    if (entry.english === "Completed") entry.malayalam = "പൂർത്തിയാക്കിയ";
    if (entry.english === "Pending") entry.malayalam = "തീർപ്പാക്കാനുള്ള";
    if (entry.english === "In Progress") entry.malayalam = "പുരോഗമിക്കുന്നു";
    if (entry.english === "Due Today") entry.malayalam = "ഇന്ന് പൂർത്തിയാക്കേണ്ട";
    return entry;
  });
});

// 4. Audit and update shared/localization/glossary/index.json
const glossaryIndexPath = path.join(rootDir, "shared/localization/glossary/index.json");
updateJsonFile(glossaryIndexPath, (obj) => {
  if (obj.terms && Array.isArray(obj.terms)) {
    obj.terms = obj.terms.map((entry) => {
      if (entry.english === "Overdue Tasks") entry.malayalam = "കാലാവധി കഴിഞ്ഞ ടാസ്കുകൾ";
      if (entry.english === "Overdue") entry.malayalam = "കാലാവധി കഴിഞ്ഞ";
      if (entry.english === "Completed") entry.malayalam = "പൂർത്തിയാക്കിയ";
      if (entry.english === "Pending") entry.malayalam = "തീർപ്പാക്കാനുള്ള";
      if (entry.english === "In Progress") entry.malayalam = "പുരോഗമിക്കുന്നു";
      if (entry.english === "Due Today") entry.malayalam = "ഇന്ന് പൂർത്തിയാക്കേണ്ട";
      return entry;
    });
  }
  return obj;
});

// 5. Audit and update officeMalayalam.json & contextRules.json
const officeMalayalamPath = path.join(rootDir, "shared/localization/styleguide/officeMalayalam.json");
updateJsonFile(officeMalayalamPath, (obj) => {
  if (obj.softwareTerms) {
    obj.softwareTerms["Overdue"] = "കാലാവധി കഴിഞ്ഞ";
    obj.softwareTerms["Overdue Tasks"] = "കാലാവധി കഴിഞ്ഞ ടാസ്കുകൾ";
    obj.softwareTerms["Completed"] = "പൂർത്തിയാക്കിയ";
    obj.softwareTerms["Pending"] = "തീർപ്പാക്കാനുള്ള";
    obj.softwareTerms["In Progress"] = "പുരോഗമിക്കുന്നു";
    obj.softwareTerms["Due Today"] = "ഇന്ന് പൂർത്തിയാക്കേണ്ട";
  }
  return obj;
});

const contextRulesPath = path.join(rootDir, "shared/localization/styleguide/contextRules.json");
updateJsonFile(contextRulesPath, (obj) => {
  if (obj.Task) {
    obj.Task["Overdue"] = "കാലാവധി കഴിഞ്ഞ";
    obj.Task["Pending"] = "തീർപ്പാക്കാനുള്ള";
    obj.Task["Completed"] = "പൂർത്തിയാക്കിയ";
  }
  if (obj.Dashboard) {
    obj.Dashboard["Pending"] = "തീർപ്പാക്കാനുള്ള";
  }
  return obj;
});

// 6. Bulk update phraseOverrides JSON files
const phraseOverridesDir = path.join(rootDir, "shared/localization/styleguide/phraseOverrides");
if (fs.existsSync(phraseOverridesDir)) {
  const files = fs.readdirSync(phraseOverridesDir);
  for (const file of files) {
    if (file.endsWith(".json")) {
      const p = path.join(phraseOverridesDir, file);
      replaceInFile(p, [
        ["സമയപരിധി കഴിഞ്ഞത് ടാസ്കുകൾ", "കാലാവധി കഴിഞ്ഞ ടാസ്കുകൾ"],
        ["സമയപരിധി കഴിഞ്ഞ ടാസ്കുകൾ", "കാലാവധി കഴിഞ്ഞ ടാസ്കുകൾ"],
        ["അടച്ച ടാസ്കുകൾ", "കാലാവധി കഴിഞ്ഞ ടാസ്കുകൾ"],
        ["സമയപരിധി കഴിഞ്ഞത് സെറ്റിംഗ്സ്", "കാലാവധി കഴിഞ്ഞ സെറ്റിംഗ്സ്"],
        ["സമയപരിധി കഴിഞ്ഞത് അനലിറ്റിക്സ്", "കാലാവധി കഴിഞ്ഞ അനലിറ്റിക്സ്"],
        ["സമയപരിധി കഴിഞ്ഞത്", "കാലാവധി കഴിഞ്ഞ"],
        ["സമയപരിധി കഴിഞ്ഞവ", "കാലാവധി കഴിഞ്ഞ"]
      ]);
    }
  }
}

// Update main phraseOverrides.json
const mainPhraseOverridesPath = path.join(rootDir, "shared/localization/styleguide/phraseOverrides.json");
replaceInFile(mainPhraseOverridesPath, [
  ["സമയപരിധി കഴിഞ്ഞത് ടാസ്കുകൾ", "കാലാവധി കഴിഞ്ഞ ടാസ്കുകൾ"],
  ["സമയപരിധി കഴിഞ്ഞ ടാസ്കുകൾ", "കാലാവധി കഴിഞ്ഞ ടാസ്കുകൾ"],
  ["അടച്ച ടാസ്കുകൾ", "കാലാവധി കഴിഞ്ഞ ടാസ്കുകൾ"],
  ["സമയപരിധി കഴിഞ്ഞത്", "കാലാവധി കഴിഞ്ഞ"],
  ["സമയപരിധി കഴിഞ്ഞവ", "കാലാവധി കഴിഞ്ഞ"]
]);

// 7. Update cache / TM files
const cacheFiles = [
  "shared/localization/cache/translation_memory.json",
  "shared/localization/cache/translationMemory.json",
  "shared/localization/cache/validation_cache.json",
  "shared/localization/cache/translation_cache.json",
  "shared/localization/reports/translation-report.json"
];

for (const relPath of cacheFiles) {
  const p = path.join(rootDir, relPath);
  replaceInFile(p, [
    ["അടച്ച ടാസ്കുകൾ", "കാലാവധി കഴിഞ്ഞ ടാസ്കുകൾ"],
    ["സമയപരിധി കഴിഞ്ഞത് ടാസ്കുകൾ", "കാലാവധി കഴിഞ്ഞ ടാസ്കുകൾ"],
    ["സമയപരിധി കഴിഞ്ഞ ടാസ്കുകൾ", "കാലാവധി കഴിഞ്ഞ ടാസ്കുകൾ"]
  ]);
}

console.log("Malayalam Task Localization Standardization finished successfully.");
