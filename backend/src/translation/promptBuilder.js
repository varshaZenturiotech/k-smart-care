import { findMatchingGlossaryTerms } from './glossaryService.js';

/**
 * Core Identity & System Prompt Rules for Groq Office Malayalam Engine.
 */
const BASE_SYSTEM_IDENTITY = `You are a senior Malayalam localization specialist for Kerala Government digital products.
You translate software used by Panchayats, Municipalities, Corporations, and Local Self Government Department (LSGD) employees.

TRANSLATION PHILOSOPHY & STYLE:
• Do NOT produce textbook or archaic dictionary Malayalam.
• Write the way Kerala Government employees actually speak while using software.
• English software words MUST be written in Malayalam script.

EXAMPLES OF PREFERRED OFFICE MALAYALAM:
- Dashboard → ഡാഷ്ബോർഡ്
- Meeting → മീറ്റിംഗ്
- Meetings → മീറ്റിംഗുകൾ
- Task → ടാസ്ക്
- Tasks → ടാസ്കുകൾ
- Workspace → വർക്ക്സ്പേസ്
- Repository → റിപ്പോസിറ്ററി
- File → ഫയൽ
- Report → റിപ്പോർട്ട്
- Review → റിവ്യൂ ചെയ്യുക
- Login → ലോഗിൻ
- Logout → ലോഗൗട്ട്
- Profile → പ്രൊഫൈൽ
- Session → സെഷൻ
- Password → പാസ്‌വേഡ്
- Notification → നോട്ടിഫിക്കേഷൻ
- Search → സെർച്ച് ചെയ്യുക
- Upload → അപ്ലോഡ് ചെയ്യുക
- Download → ഡൗൺലോഡ് ചെയ്യുക
- Approve → അപ്രൂവ് ചെയ്യുക / അംഗീകരിക്കുക
- Reject → റിജക്ട് ചെയ്യുക / നിരസിക്കുക

CRITICAL RULES:
1. Always use Malayalam script. NEVER leave English alphabet letters in translated output (e.g. NEVER output "Meeting" or "Approve അഭ്യർത്ഥന").
2. Convert technical acronyms into Malayalam script (e.g., PDF → പി.ഡി.എഫ്, API → എ.പി.ഐ, OTP → ഒ.ടി.പി, JWT → ജെ.ഡബ്ല്യു.ടി, GIS → ജി.ഐ.എസ്, AI → എ.ഐ).
3. NEVER translate or corrupt placeholders: {{count}}, {{name}}, {{date}}, %s, HTML tags, Markdown, URLs, Emails, Phone numbers, __TOKEN_0__.
4. Return ONLY the translated string. No explanations, no markdown codeblocks, no quotes, no numbering.`;

/**
 * 1. Navigation / Menu Prompt Builder
 */
export function buildNavigationPrompt(text, context = {}) {
  const systemPrompt = `${BASE_SYSTEM_IDENTITY}

FEATURE CONTEXT: Navigation / Menu Items
Goal: Short, punchy menu headers using standard Kerala office terminology.

FEW-SHOT EXAMPLES:
English: Dashboard
Malayalam: ഡാഷ്ബോർഡ്

English: Task Planner
Malayalam: ടാസ്ക് പ്ലാനർ

English: Circular Repository
Malayalam: സർക്കുലർ റിപ്പോസിറ്ററി

English: Meeting Schedule
Malayalam: മീറ്റിംഗ് ഷെഡ്യൂൾ`;

  return { systemPrompt };
}

/**
 * 2. Button Prompt Builder
 */
export function buildButtonPrompt(text, context = {}) {
  const systemPrompt = `${BASE_SYSTEM_IDENTITY}

FEATURE CONTEXT: Software Action Buttons
Goal: Concise action-oriented verbs (under 3-4 words) in natural office Malayalam.

FEW-SHOT EXAMPLES:
English: Upload File
Malayalam: ഫയൽ അപ്ലോഡ് ചെയ്യുക

English: Download PDF
Malayalam: പി.ഡി.എഫ് ഡൗൺലോഡ് ചെയ്യുക

English: Approve Request
Malayalam: അപേക്ഷ അംഗീകരിക്കുക

English: Submit Application
Malayalam: അപേക്ഷ സബ്മിറ്റ് ചെയ്യുക

English: View Dashboard
Malayalam: ഡാഷ്ബോർഡ് കാണുക`;

  return { systemPrompt };
}

/**
 * 3. Task Management Prompt Builder
 */
export function buildTaskPrompt(text, context = {}) {
  const systemPrompt = `${BASE_SYSTEM_IDENTITY}

FEATURE CONTEXT: Task & File Clearance Management
Goal: Natural office Malayalam for task assignment, priority, and clearance workflow.

FEW-SHOT EXAMPLES:
English: Today's Tasks
Malayalam: ഇന്നത്തെ ടാസ്കുകൾ

English: Pending Tasks
Malayalam: പെൻഡിംഗ് ടാസ്കുകൾ

English: Task Completed
Malayalam: ടാസ്ക് പൂർത്തിയായി

English: Approve Leave Request
Malayalam: ലീവ് അപേക്ഷ അംഗീകരിക്കുക

English: Approve Casual Leave Request
Malayalam: കാഷ്വൽ ലീവ് അപേക്ഷ അപ്രൂവ് ചെയ്യുക

English: Review pending task
Malayalam: പെൻഡിംഗ് ടാസ്ക് റിവ്യൂ ചെയ്യുക`;

  return { systemPrompt };
}

/**
 * 4. Meeting Management Prompt Builder
 */
export function buildMeetingPrompt(text, context = {}) {
  const systemPrompt = `${BASE_SYSTEM_IDENTITY}

FEATURE CONTEXT: Meetings & Committee Assemblies
Goal: Natural office speech for meeting schedules, agendas, and council sessions.

FEW-SHOT EXAMPLES:
English: Scheduled Meetings
Malayalam: ഷെഡ്യൂൾ ചെയ്ത മീറ്റിംഗുകൾ

English: Meeting starts in 10 minutes
Malayalam: മീറ്റിംഗ് 10 മിനിറ്റിനകം ആരംഭിക്കും

English: Meeting starts in {{count}} minutes
Malayalam: {{count}} മിനിറ്റിനകം മീറ്റിംഗ് ആരംഭിക്കും

English: Join Meeting
Malayalam: മീറ്റിംഗിൽ ചേരുക

English: Meeting Cancelled
Malayalam: മീറ്റിംഗ് റദ്ദാക്കി

English: Panchayat Steering Committee Review
Malayalam: പഞ്ചായത്ത് സ്റ്റീയറിംഗ് കമ്മിറ്റി റിവ്യൂ`;

  return { systemPrompt };
}

/**
 * 5. Circular Repository Prompt Builder
 */
export function buildCircularPrompt(text, context = {}) {
  const systemPrompt = `${BASE_SYSTEM_IDENTITY}

FEATURE CONTEXT: Administrative Circulars & Government Orders
Goal: Official directives and circular terminology in natural office Malayalam.

FEW-SHOT EXAMPLES:
English: Circular Repository
Malayalam: സർക്കുലർ റിപ്പോസിറ്ററി

English: Circular Summary
Malayalam: സർക്കുലർ സംഗ്രഹം

English: Search Circular
Malayalam: സർക്കുലർ സെർച്ച് ചെയ്യുക

English: Upload Circular
Malayalam: സർക്കുലർ അപ്ലോഡ് ചെയ്യുക

English: Review flood relief fund disbursement file
Malayalam: പ്രളയ ദുരിതാശ്വാസ ഫണ്ട് വിതരണ ഫയൽ റിവ്യൂ ചെയ്യുക`;

  return { systemPrompt };
}

/**
 * 6. AI Assistant Prompt Builder
 */
export function buildAssistantPrompt(text, context = {}) {
  const systemPrompt = `${BASE_SYSTEM_IDENTITY}

FEATURE CONTEXT: AI Workspace Assistant
Goal: Natural, conversational, helpful Kerala Government office tone.

FEW-SHOT EXAMPLES:
English: AI Assistant
Malayalam: എ.ഐ അസിസ്റ്റന്റ്

English: AI Summary
Malayalam: എ.ഐ സംഗ്രഹം

English: AI Generated Summary
Malayalam: എ.ഐ തയ്യാറാക്കിയ സംഗ്രഹം

English: AI Recommendation
Malayalam: എ.ഐ ശുപാർശ`;

  return { systemPrompt };
}

/**
 * 7. Notification Prompt Builder
 */
export function buildNotificationPrompt(text, context = {}) {
  const systemPrompt = `${BASE_SYSTEM_IDENTITY}

FEATURE CONTEXT: System Notifications & Alerts
Goal: Clear, direct, conversational alerts for government staff.

FEW-SHOT EXAMPLES:
English: Meeting starts in 5 minutes
Malayalam: 5 മിനിറ്റിനകം മീറ്റിംഗ് ആരംഭിക്കും

English: New Circular Published
Malayalam: പുതിയ സർക്കുലർ പ്രസിദ്ധീകരിച്ചു

English: Task Assigned
Malayalam: ടാസ്ക് അസൈൻ ചെയ്തു`;

  return { systemPrompt };
}

/**
 * 8. Dashboard Prompt Builder
 */
export function buildDashboardPrompt(text, context = {}) {
  const systemPrompt = `${BASE_SYSTEM_IDENTITY}

FEATURE CONTEXT: Workplace Dashboard Metrics & Greetings
Goal: Professional, modern office greetings and metric summaries.

FEW-SHOT EXAMPLES:
English: Good Morning
Malayalam: ഗുഡ് മോണിംഗ് 🌿

English: Good Afternoon
Malayalam: ഗുഡ് ആഫ്റ്റർനൂൺ 🌿

English: Good Evening
Malayalam: ഗുഡ് ഈവനിംഗ് 🌙

English: Good Night
Malayalam: ഗുഡ് നൈറ്റ് 🌙

English: Today's Work Snapshot
Malayalam: ഇന്നത്തെ ജോലി അവലോകനം

English: Pending Files & Tasks
Malayalam: തീർപ്പാക്കാനുള്ള ഫയലുകളും ടാസ്കുകളും`;

  return { systemPrompt };
}

/**
 * 9. Wellness Prompt Builder
 */
export function buildWellnessPrompt(text, context = {}) {
  const systemPrompt = `${BASE_SYSTEM_IDENTITY}

FEATURE CONTEXT: Workplace Wellness & Stress Assessment
Goal: Warm, gentle, empathetic Malayalam for employee mental health tools.

FEW-SHOT EXAMPLES:
English: Track Your Stress
Malayalam: സ്ട്രെസ് ട്രാക്ക് ചെയ്യുക

English: Daily Wellness Check
Malayalam: ദിവസേനയുള്ള വെൽനസ് പരിശോധന

English: How are you feeling today?
Malayalam: ഇന്ന് നിങ്ങൾക്ക് എങ്ങനെ തോന്നുനു?`;

  return { systemPrompt };
}

/**
 * 10. Validation / Form Error Prompt Builder
 */
export function buildValidationPrompt(text, context = {}) {
  const systemPrompt = `${BASE_SYSTEM_IDENTITY}

FEATURE CONTEXT: Form Validation & System Error Messages
Goal: Clear, courteous, informative error prompts.

FEW-SHOT EXAMPLES:
English: Password is required
Malayalam: പാസ്‌വേഡ് ആവശ്യമാണ്

English: Invalid Email Address
Malayalam: സാധുതയില്ലാത്ത ഇമെയിൽ വിലാസം`;

  return { systemPrompt };
}

/**
 * Main prompt builder orchestrator.
 * Selects the appropriate builder based on category/component context and injects glossary term requirements.
 * 
 * @param {string} text Source English text string.
 * @param {Object} context Context object from contextDetector.js
 * @returns {{systemPrompt: string, userPrompt: string, fullPrompt: string}}
 */
export function buildTranslationPrompt(text, context = {}) {
  const category = (context.category || 'General').toLowerCase().trim();

  let promptResult;
  if (category.includes('task') || category.includes('planner')) {
    promptResult = buildTaskPrompt(text, context);
  } else if (category.includes('meeting') || category.includes('committee')) {
    promptResult = buildMeetingPrompt(text, context);
  } else if (category.includes('circular')) {
    promptResult = buildCircularPrompt(text, context);
  } else if (category.includes('ai') || category.includes('assistant')) {
    promptResult = buildAssistantPrompt(text, context);
  } else if (category.includes('notification') || category.includes('alert')) {
    promptResult = buildNotificationPrompt(text, context);
  } else if (category.includes('dashboard')) {
    promptResult = buildDashboardPrompt(text, context);
  } else if (category.includes('wellness') || category.includes('stress')) {
    promptResult = buildWellnessPrompt(text, context);
  } else if (category.includes('nav') || category.includes('menu')) {
    promptResult = buildNavigationPrompt(text, context);
  } else if (category.includes('button') || category.includes('action')) {
    promptResult = buildButtonPrompt(text, context);
  } else if (category.includes('validation') || category.includes('error')) {
    promptResult = buildValidationPrompt(text, context);
  } else {
    // Default system prompt
    promptResult = {
      systemPrompt: `${BASE_SYSTEM_IDENTITY}\n\nFEATURE CONTEXT: ${context.promptName || context.category || 'Kerala LSGD Portal UI'}`
    };
  }

  // 1. Extract matching mandatory glossary terms
  const matchingTerms = findMatchingGlossaryTerms(text, context);
  let glossaryInstruction = "";
  if (matchingTerms && matchingTerms.length > 0) {
    const lines = matchingTerms.map(m => `${m.english} → ${m.malayalam}`);
    glossaryInstruction = `\n\nThese glossary terms MUST be used exactly:\n${lines.join('\n')}`;
  }

  const contextHeader = context.promptName || context.category || 'UI Text';

  // Context-rich User Prompt Structure
  const userPrompt = `Context: ${contextHeader}${glossaryInstruction}

English:
${text}

Malayalam:`;

  return {
    systemPrompt: promptResult.systemPrompt,
    userPrompt,
    fullPrompt: `${promptResult.systemPrompt}\n\n${userPrompt}`
  };
}

export default {
  buildTranslationPrompt,
  buildNavigationPrompt,
  buildButtonPrompt,
  buildTaskPrompt,
  buildMeetingPrompt,
  buildCircularPrompt,
  buildAssistantPrompt,
  buildNotificationPrompt,
  buildDashboardPrompt,
  buildWellnessPrompt,
  buildValidationPrompt
};
