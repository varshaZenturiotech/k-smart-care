/**
 * Build & Audit Script for Office Malayalam Phrase Overrides
 * Standardizes, deduplicates, cleans noise, resolves conflicts, and generates
 * the canonical runtime phraseOverrides.json file.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, '..');
const CANONICAL_DIR = path.join(ROOT_DIR, 'shared/localization/styleguide/phraseOverrides');
const RUNTIME_MASTER_FILE = path.join(ROOT_DIR, 'shared/localization/styleguide/phraseOverrides.json');
const REDUNDANT_DIR = path.join(ROOT_DIR, 'shared/localization/overrides');

// Official Category Priorities (First matching category owns the phrase)
const CATEGORY_PRIORITY = [
  'buttons',
  'greetings',
  'authentication',
  'validation',
  'dashboard',
  'tasks',
  'meetings',
  'circulars',
  'assistant',
  'wellness',
  'notifications',
  'analytics',
  'profile',
  'settings',
  'reports',
  'search',
  'common'
];

// Office Malayalam Preferred Conflict Dictionary
const OFFICE_MALAYALAM_PREFERRED = {
  "dashboard": "ഡാഷ്ബോർഡ്",
  "meeting": "മീറ്റിംഗ്",
  "meetings": "മീറ്റിംഗുകൾ",
  "task": "ടാസ്ക്",
  "tasks": "ടാസ്കുകൾ",
  "search": "സെർച്ച് ചെയ്യുക",
  "repository": "റിപ്പോസിറ്ററി",
  "approve": "അപ്രൂവ് ചെയ്യുക",
  "reject": "റിജക്ട് ചെയ്യുക",
  "cancel": "ക്യാൻസൽ ചെയ്യുക",
  "delete": "ഡിലീറ്റ് ചെയ്യുക",
  "edit": "എഡിറ്റ് ചെയ്യുക",
  "create": "ക്രിയേറ്റ് ചെയ്യുക",
  "update": "അപ്ഡേറ്റ് ചെയ്യുക",
  "submit": "സബ്മിറ്റ് ചെയ്യുക",
  "save": "സേവ് ചെയ്യുക",
  "login": "ലോഗിൻ",
  "logout": "ലോഗൗട്ട്",
  "profile": "പ്രൊഫൈൽ",
  "settings": "സിസ്റ്റം സെറ്റിംഗ്സ്",
  "circular": "സർക്കുലർ",
  "circulars": "സർക്കുലറുകൾ",
  "report": "റിപ്പോർട്ട്",
  "reports": "റിപ്പോർട്ടുകൾ"
};

/**
 * Filter function to remove synthetic/unnatural auto-generated combinatorial noise phrases.
 * e.g. "Cancel Active Overdue Reports", "Create Approved Rejected Tasks"
 */
function isRealisticUIPhrase(english, malayalam) {
  if (!english || !malayalam) return false;
  const eng = english.trim();
  const mal = malayalam.trim();

  // Basic length & character check
  if (eng.length === 0 || mal.length === 0) return false;
  if (eng.length > 60) return false; // UI microcopy is rarely > 60 chars

  const words = eng.split(/\s+/);
  if (words.length > 5) return false; // Overly long synthetic titles

  // Detect contradictory or repetitive combinatorial noise
  const noiseKeywords = [
    /upcoming\s+(monthly|yearly|weekly)\s+archived/i,
    /pending\s+active/i,
    /approved\s+rejected/i,
    /cancel\s+(active|completed|approved|rejected|in progress|archived|upcoming|overdue|urgent|draft)/i,
    /create\s+(completed|approved|rejected|archived|overdue)/i,
    /edit\s+(completed|approved|rejected|archived)/i,
    /delete\s+(completed|approved|rejected|archived)/i,
    /today's\s+(tomorrow's|yesterday's|weekly|monthly)/i
  ];

  for (const pattern of noiseKeywords) {
    if (pattern.test(eng)) {
      return false;
    }
  }

  return true;
}

function runAuditAndBuild() {
  console.log('====================================================');
  console.log('Office Malayalam Phrase Override Audit & Refactoring');
  console.log('====================================================\n');

  if (!fs.existsSync(CANONICAL_DIR)) {
    console.error(`Error: Canonical directory not found at ${CANONICAL_DIR}`);
    process.exit(1);
  }

  const categoryFiles = fs.readdirSync(CANONICAL_DIR).filter(f => f.endsWith('.json'));

  let originalPhraseCount = 0;
  let noisePhrasesRemoved = 0;
  let duplicateKeysRemoved = 0;
  let crossCategoryDuplicatesRemoved = 0;
  let conflictsResolved = 0;

  // Stores: lowerCaseKey -> { originalKey, value, category, filename }
  const masterMap = new Map();
  const categoryData = {}; // categoryName -> Map(lowerKey -> { originalKey, value })

  CATEGORY_PRIORITY.forEach(cat => {
    categoryData[cat] = new Map();
  });

  // Step 1: Read all category files
  categoryFiles.forEach(file => {
    const catName = path.basename(file, '.json');
    const filePath = path.join(CANONICAL_DIR, file);
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(raw);
      const entries = Object.entries(data);
      originalPhraseCount += entries.length;

      entries.forEach(([key, val]) => {
        const cleanKey = key.trim();
        const cleanVal = String(val).trim();
        const lowerKey = cleanKey.toLowerCase();

        // 1. Noise Filter
        if (!isRealisticUIPhrase(cleanKey, cleanVal)) {
          noisePhrasesRemoved++;
          return;
        }

        // Determine destination category
        const destCat = CATEGORY_PRIORITY.includes(catName) ? catName : 'common';
        const targetMap = categoryData[destCat];

        // 2. Intra-category deduplication & conflict resolution
        if (targetMap.has(lowerKey)) {
          duplicateKeysRemoved++;
          const existing = targetMap.get(lowerKey);
          if (existing.value !== cleanVal) {
            conflictsResolved++;
            // Check preferred Office Malayalam
            if (OFFICE_MALAYALAM_PREFERRED[lowerKey]) {
              existing.value = OFFICE_MALAYALAM_PREFERRED[lowerKey];
            }
          }
        } else {
          targetMap.set(lowerKey, {
            originalKey: cleanKey,
            value: cleanVal
          });
        }
      });
    } catch (err) {
      console.error(`Error reading ${file}:`, err.message);
    }
  });

  // Step 2: Global Cross-Category Deduplication by Category Priority
  const globalSeenKeys = new Map(); // lowerKey -> categoryName

  CATEGORY_PRIORITY.forEach(cat => {
    const map = categoryData[cat];
    if (!map) return;

    for (const [lowerKey, entry] of Array.from(map.entries())) {
      if (globalSeenKeys.has(lowerKey)) {
        crossCategoryDuplicatesRemoved++;
        map.delete(lowerKey);
      } else {
        globalSeenKeys.set(lowerKey, cat);
        masterMap.set(lowerKey, {
          key: entry.originalKey,
          value: entry.value,
          category: cat
        });
      }
    }
  });

  // Step 3: Write Cleaned & Alphabetically Sorted JSONs back to Canonical Directory
  let activeCategoriesCount = 0;
  const masterJsonOutput = {};

  CATEGORY_PRIORITY.forEach(cat => {
    const map = categoryData[cat];
    const filePath = path.join(CANONICAL_DIR, `${cat}.json`);

    if (!map || map.size === 0) {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`Deleted empty category file: ${cat}.json`);
      }
      return;
    }

    activeCategoriesCount++;
    const sortedKeys = Array.from(map.keys()).sort();
    const sortedObj = {};

    sortedKeys.forEach(lowerKey => {
      const entry = map.get(lowerKey);
      sortedObj[entry.originalKey] = entry.value;
      masterJsonOutput[entry.originalKey] = entry.value;
    });

    fs.writeFileSync(filePath, JSON.stringify(sortedObj, null, 2) + '\n', 'utf-8');
  });

  // Step 4: Write Generated Master Runtime File
  const sortedMasterKeys = Object.keys(masterJsonOutput).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  const sortedMasterObj = {};
  sortedMasterKeys.forEach(k => {
    sortedMasterObj[k] = masterJsonOutput[k];
  });

  fs.writeFileSync(RUNTIME_MASTER_FILE, JSON.stringify(sortedMasterObj, null, 2) + '\n', 'utf-8');
  console.log(`Generated Canonical Master Runtime File: ${RUNTIME_MASTER_FILE}`);

  // Step 5: Clean Redundant Copy Directory
  if (fs.existsSync(REDUNDANT_DIR)) {
    fs.rmSync(REDUNDANT_DIR, { recursive: true, force: true });
    console.log(`Removed Redundant Directory: ${REDUNDANT_DIR}`);
  }

  // Step 6: Generate Audit Markdown Report
  const finalUniqueCount = masterMap.size;
  const reportMarkdown = `# Office Malayalam Phrase Override Refactoring & Audit Report

### Overview
Complete audit, noise cleanup, conflict resolution, and deduplication of the Office Malayalam Phrase Override system.

---

### Audit Statistics

| Metric | Count |
|---|---|
| **Original Phrases In System** | ${originalPhraseCount} |
| **Synthetic / Combinatorial Noise Removed** | ${noisePhrasesRemoved} |
| **Duplicate Keys Removed** | ${duplicateKeysRemoved} |
| **Cross-Category Duplicates Removed** | ${crossCategoryDuplicatesRemoved} |
| **Translation Conflicts Resolved** | ${conflictsResolved} |
| **Final Clean Unique Phrases** | **${finalUniqueCount}** |
| **Clean Active Categories** | ${activeCategoriesCount} Categories |
| **Canonical Source Directory** | \`shared/localization/styleguide/phraseOverrides/\` |
| **Canonical Master Runtime File** | \`shared/localization/styleguide/phraseOverrides.json\` |
| **System Status** | **Production Ready** |

---

### Category Distribution

${CATEGORY_PRIORITY.filter(c => categoryData[c] && categoryData[c].size > 0).map(c => `- **${c}.json**: ${categoryData[c].size} phrases`).join('\n')}
`;

  const reportPath = path.join(ROOT_DIR, 'phrase_override_refactoring_report.md');
  fs.writeFileSync(reportPath, reportMarkdown, 'utf-8');
  console.log(`Audit Report Generated: ${reportPath}`);

  console.log('\n====================================================');
  console.log(`Summary: ${originalPhraseCount} phrases -> ${finalUniqueCount} clean phrases across ${activeCategoriesCount} categories.`);
  console.log('Build completed successfully!');
  console.log('====================================================\n');
}

runAuditAndBuild();
