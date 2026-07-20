/**
 * Dynamic Greetings Prompt Module for K-SMART CARE AI Assistant
 * Provides workplace-tailored, time-sensitive, bilingual, and context-aware welcome messages.
 */

// Time-based category ranges (local time hours)
export function getTimeOfDay(hour = new Date().getHours()) {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night"; // 21:00 - 04:59
}

export const GREETINGS = {
  english: {
    morning: [
      "Good morning! 👋 I hope your day is off to a great start. What would you like to work on today?",
      "Good morning! Ready to make today productive? I'm here whenever you need a hand.",
      "Wishing you a productive morning. How can I assist you with your work today?",
      "Good morning! Hope you had a restful evening. What's on your agenda for today?",
      "Good morning! Let's get today started smoothly. How can I help you right now?",
      "Good morning! Hope your day starts with high energy and focus. What are we tackling first?",
      "Wishing you a calm and effective morning. What can I help you organize today?",
      "Good morning! I'm ready to assist with your circulars, tasks, or daily planning. Where shall we begin?",
      "Good morning! Let's make progress on today's priorities together. How can I assist?",
      "Good morning! Hope you have a pleasant day ahead. What would you like to focus on?",
    ],
    afternoon: [
      "Good afternoon! Hope your workday is going smoothly. What can I help you with?",
      "Welcome back! Let me know what you're working on this afternoon.",
      "Hope you're having a productive afternoon. What's next on your agenda?",
      "Good afternoon! How is your day coming along? Let me know if you need any assistance.",
      "Good afternoon! Taking a moment to organize your tasks or check circulars? I'm here to help.",
      "Hope your afternoon is going well. What would you like to work on right now?",
      "Good afternoon! Ready to power through the rest of the workday? How can I assist?",
      "Wishing you a steady and productive afternoon. How may I support your work today?",
      "Good afternoon! Need help reviewing documents, drafting notes, or organizing tasks?",
      "Good afternoon! Let me know if there is anything I can streamline for you today.",
    ],
    evening: [
      "Good evening! Need help wrapping up today's work or planning tomorrow?",
      "Good evening! I'm here if you need assistance before you finish for the day.",
      "Hope your workday finished smoothly. How can I assist you this evening?",
      "Good evening! Let's get things organized so you can wrap up work peacefully.",
      "Good evening! Ready to review today's progress or prepare for tomorrow?",
      "Hope you had a productive day. Is there anything you'd like to check before heading out?",
      "Good evening! Let me know if you need a quick summary of today's circulars or tasks.",
      "Wishing you a relaxing evening. How can I assist with your final tasks for today?",
      "Good evening! Need help drafting a quick reply or organizing tomorrow's priorities?",
      "Good evening! Let's wrap up today's key items cleanly. Where should we start?",
    ],
    night: [
      "Good evening! Working a little late today? Let me know how I can help.",
      "Hope everything is going well. What would you like to work on tonight?",
      "Working late tonight? I'm right here to help make things easier for you.",
      "Good evening! Let's get this finished quickly so you can rest. What do you need?",
      "Burning the midnight oil? I'm available if you need help with circulars or task notes.",
      "Hope your night is peaceful. What would you like to review or prepare right now?",
      "Working after hours? Let me help you find the circular or information you need.",
      "Late shift or wrapping up? How can I assist you tonight?",
      "Good evening! Take it easy tonight—let me handle summarizing or drafting for you.",
      "Still at work? Let's take care of your tasks step by step. What's first?",
    ],
    contextAware: {
      pendingTasks: (count) =>
        `Good morning! You have ${count} pending task${count > 1 ? "s" : ""} waiting today. How would you like to get started?`,
      meetings: (count) =>
        `Good afternoon! You have ${count} meeting${count > 1 ? "s" : ""} scheduled today. Let me know if you'd like help preparing.`,
      unreadCirculars: (count) =>
        `Good morning! There ${count > 1 ? "are" : "is"} ${count} new government circular${count > 1 ? "s" : ""} available. Would you like a quick summary?`,
      clearSchedule: () =>
        "Good morning! Your schedule looks clear for now. What would you like to focus on today?",
    },
  },
  malayalam: {
    morning: [
      "സുപ്രഭാതം! 👋 ഇന്നത്തെ ദിവസം നന്നായി തുടങ്ങാൻ ആശംസിക്കുന്നു. ഇന്ന് എന്താണ് ചെയ്യാൻ ആഗ്രഹിക്കുന്നത്?",
      "സുപ്രഭാതം! ഇന്നത്തെ ജോലികൾ കാര്യക്ഷമമായി പൂർത്തിയാക്കാം. സഹായിക്കാൻ ഞാൻ ഇവിടെയുണ്ട്.",
      "ഒരു നല്ല പ്രഭാതം ആശംസിക്കുന്നു! ഇന്നത്തെ നിങ്ങളുടെ ജോലികളിൽ എങ്ങനെ സഹായിക്കണം?",
      "സുപ്രഭാതം! ഇന്നത്തെ നിങ്ങളുടെ പ്രധാന ജോലികൾ എന്തൊക്കെയാണ്?",
      "സുപ്രഭാതം! ഇന്നത്തെ പ്രവൃത്തിദിനം സുഗമമായി ആരംഭിക്കാം. ഇപ്പോൾ എങ്ങനെ സഹായിക്കണം?",
      "സുപ്രഭാതം! മികച്ച ഊർജ്ജത്തോടെ ഇന്നത്തെ ജോലികൾ ആരംഭിക്കാം. ആദ്യമായി എന്താണ് ചെയ്യേണ്ടത്?",
      "ശാന്തവും ഉൽപ്പാദനക്ഷമവുമായ ഒരു പ്രഭാതം ആശംസിക്കുന്നു! ഇന്ന് എന്തൊക്കെ ക്രമീകരിക്കണം?",
      "സുപ്രഭാതം! സർക്കുലറുകൾ, ടാസ്കുകൾ, പ്രതിദിന പ്ലാനിംഗ് എന്നിവയിൽ സഹായിക്കാൻ ഞാൻ തയ്യാറാണ്.",
      "സുപ്രഭാതം! ഇന്നത്തെ മുൻഗണനകൾ ഒന്നിച്ചു പൂർത്തിയാക്കാം. എങ്ങനെ സഹായിക്കണം?",
      "സുപ്രഭാതം! ഇന്ന് നല്ലൊരു ദിവസം ആശംസിക്കുന്നു. എന്തിലാണ് ആദ്യം ശ്രദ്ധ കേന്ദ്രീകരിക്കേണ്ടത്?",
    ],
    afternoon: [
      "ഗുഡ് ആഫ്റ്റർനൂൺ! ഇന്നത്തെ ജോലി സുഗമമായി നടക്കുന്നു എന്ന് കരുതുന്നു. എങ്ങനെ സഹായിക്കണം?",
      "തിരികെ സ്വാഗതം! ഉച്ചയ്ക്ക് ശേഷം എന്താണ് ചെയ്തുകൊണ്ടിരിക്കുന്നത് എന്ന് പറയൂ.",
      "ഉച്ചയ്ക്ക് ശേഷമുള്ള ജോലികൾ നന്നായി പോകുന്നു എന്ന് കരുതുന്നു. അടുത്തത് എന്താണ് പ്ലാൻ?",
      "ഗുഡ് ആഫ്റ്റർനൂൺ! ദിവസത്തെ ജോലികൾ എങ്ങനെ പുരോഗമിക്കുന്നു? എന്തെങ്കിലും സഹായം വേണമെങ്കിൽ അറിയിക്കൂ.",
      "ഗുഡ് ആഫ്റ്റർനൂൺ! ടാസ്കുകൾ ക്രമീകരിക്കാനോ സർക്കുലറുകൾ പരിശോധിക്കാനോ സഹായിക്കാൻ ഞാൻ തയ്യാറാണ്.",
      "ഉച്ചയ്ക്ക് ശേഷം നിങ്ങളുടെ ജോലികൾ സുഗമമായി നടക്കട്ടെ. ഇപ്പോൾ എന്താണ് ചെയ്യാൻ ആഗ്രഹിക്കുന്നത്?",
      "ഗുഡ് ആഫ്റ്റർനൂൺ! ബാക്കി ജോലികൾ പെട്ടെന്ന് തീർക്കാം. എങ്ങനെ സഹായിക്കണം?",
      "കാര്യക്ഷമമായ ഒരു ഉച്ചസമയം ആശംസിക്കുന്നു. ഇന്ന് നിങ്ങളുടെ ജോലികളിൽ എങ്ങനെ പിന്തുണയ്ക്കണം?",
      "ഗുഡ് ആഫ്റ്റർനൂൺ! രേഖകൾ പരിശോധിക്കാനോ ഇമെയിലുകൾ ഡ്രാഫ്റ്റ് ചെയ്യാനോ സഹായം വേണമോ?",
      "ഗുഡ് ആഫ്റ്റർനൂൺ! ഇന്നത്തെ ഏതെങ്കിലും ജോലി ലളിതമാക്കാൻ സഹായം ആവശ്യമുണ്ടോ?",
    ],
    evening: [
      "ഗുഡ് ഈവനിംഗ്! ഇന്നത്തെ ജോലികൾ പൂർത്തിയാക്കാനോ നാളത്തെ പ്ലാൻ ചെയ്യാനോ സഹായം വേണമോ?",
      "ഗുഡ് ഈവനിംഗ്! ഇന്നത്തെ ജോലി അവസാനിപ്പിക്കുന്നതിന് മുമ്പ് എന്തെങ്കിലും സഹായം ആവശ്യമുണ്ടോ?",
      "ഇന്നത്തെ ജോലി നന്നായി പൂർത്തിയായി എന്ന് കരുതുന്നു. വൈകുന്നേരം എങ്ങനെ സഹായിക്കണം?",
      "ഗുഡ് ഈവനിംഗ്! ഇന്നത്തെ ജോലികൾ സമാധാനമായി അവസാനിപ്പിക്കാൻ സഹായിക്കാം.",
      "ഗുഡ് ഈവനിംഗ്! ഇന്നത്തെ പുരോഗതി വിലയിരുത്താനോ നാളത്തേക്ക് തയ്യാറെടുക്കാനോ ആഗ്രഹിക്കുന്നുവോ?",
      "ഇന്ന് നല്ലൊരു പ്രവൃത്തിദിനമായിരുന്നു എന്ന് കരുതുന്നു. ഇറങ്ങുന്നതിന് മുമ്പ് എന്തെങ്കിലും പരിശോധിക്കണമോ?",
      "ഗുഡ് ഈവനിംഗ്! സർക്കുലറുകളുടെയോ ടാസ്കുകളുടെയോ ചുരുക്കം വേണമെങ്കിൽ അറിയിക്കൂ.",
      "സമാധാനപരമായ ഒരു വൈകുന്നേരം ആശംസിക്കുന്നു. അവസാന ജോലികളിൽ എങ്ങനെ സഹായിക്കണം?",
      "ഗുഡ് ഈവനിംഗ്! പെട്ടെന്ന് മറുപടി തയാറാക്കാനോ നാളത്തെ കാര്യങ്ങൾ പ്ലാൻ ചെയ്യാനോ സഹായം വേണമോ?",
      "ഗുഡ് ഈവനിംഗ്! ഇന്നത്തെ പ്രധാന കാര്യങ്ങൾ ഭംഗിയായി പൂർത്തിയാക്കാം. എവിടെ നിന്ന് തുടങ്ങണം?",
    ],
    night: [
      "ഗുഡ് ഈവനിംഗ്! ഇന്ന് വൈകിയും ജോലി ചെയ്യുകയാണോ? ഞാൻ എങ്ങനെ സഹായിക്കണം എന്ന് പറയൂ.",
      "എല്ലാം നന്നായി പോകുന്നു എന്ന് കരുതുന്നു. ഇന്ന് രാത്രി എന്താണ് ചെയ്യാൻ ആഗ്രഹിക്കുന്നത്?",
      "രാത്രി വൈകിയും ജോലിയിലാണോ? കാര്യങ്ങൾ എളുപ്പമാക്കാൻ ഞാൻ ഇവിടെയുണ്ട്.",
      "ഗുഡ് ഈവനിംഗ്! ജോലി വേഗത്തിൽ പൂർത്തിയാക്കി വിശ്രമിക്കാം. എന്താണ് ചെയ്യേണ്ടത്?",
      "വൈകിയും ജോലി ചെയ്യുകയാണോ? സർക്കുലറുകളിലോ ടാസ്ക് നോട്ടുകളിലോ സഹായം ആവശ്യമുണ്ടെങ്കിൽ പറയൂ.",
      "രാത്രി സുഗമമായി കടന്നുപോകട്ടെ. ഇപ്പോൾ എന്താണ് പരിശോധിക്കേണ്ടത്?",
      "ഓഫീസ് സമയത്തിന് ശേഷവും ജോലിയിലാണോ? ആവശ്യമായ സർക്കുലറോ വിവരങ്ങളോ കണ്ടെത്താൻ സഹായിക്കാം.",
      "നൈറ്റ് ഷിഫ്റ്റിലാണോ? ഇന്ന് രാത്രി എങ്ങനെ സഹായിക്കണം?",
      "ഗുഡ് ഈവനിംഗ്! കാര്യങ്ങൾ ലളിതമാക്കാം—സമ്മറി തയ്യാറാക്കാനോ ഡ്രാഫ്റ്റ് ചെയ്യാനോ ഞാൻ സഹായിക്കാം.",
      "ഇപ്പോഴും ജോലിയിലാണോ? ടാസ്കുകൾ ഓരോന്നായി പൂർത്തിയാക്കാം. ആദ്യമായി എന്താണ് ചെയ്യേണ്ടത്?",
    ],
    contextAware: {
      pendingTasks: (count) =>
        `സുപ്രഭാതം! നിങ്ങൾക്ക് ഇന്ന് ${count} ടാസ്കുകൾ ബാക്കിയുണ്ട്. എവിടെ നിന്ന് ആരംഭിക്കണം?`,
      meetings: (count) =>
        `ഗുഡ് ആഫ്റ്റർനൂൺ! നിങ്ങൾക്ക് ഇന്ന് ${count} മീറ്റിംഗുകൾ നിശ്ചയിച്ചിട്ടുണ്ട്. തയ്യാറെടുപ്പുകളിൽ സഹായം വേണമോ?`,
      unreadCirculars: (count) =>
        `സുപ്രഭാതം! പുതിയ ${count} ഗവൺമെന്റ് സർക്കുലറുകൾ ലഭ്യമാണ്. പ്രധാന വിവരങ്ങൾ പരിശോധിക്കണമോ?`,
      clearSchedule: () =>
        "സുപ്രഭാതം! നിങ്ങളുടെ ഇന്നത്തെ ഷെഡ്യൂൾ ക്ലിയറാണ്. ഇന്ന് എന്തിലാണ് ശ്രദ്ധ നൽകേണ്ടത്?",
    },
  },
};

/**
 * Returns a dynamically selected, friendly workplace greeting.
 * 
 * Supports both function signatures:
 * 1. getWelcomeMessage({ language, timeOfDay, context, lastIndex })
 * 2. getWelcomeMessage(language, timeOfDay, context, lastIndex)
 */
export function getWelcomeMessage(langOrOptions = "en", tod, ctx = {}, lastIdx = -1) {
  let language = "en";
  let timeOfDay = tod;
  let context = ctx;
  let lastIndex = lastIdx;

  if (typeof langOrOptions === "object" && langOrOptions !== null) {
    language = langOrOptions.language || "en";
    timeOfDay = langOrOptions.timeOfDay;
    context = langOrOptions.context || {};
    lastIndex = typeof langOrOptions.lastIndex === "number" ? langOrOptions.lastIndex : -1;
  } else {
    language = langOrOptions || "en";
  }

  // Normalize language
  const normalizedLang =
    language === "ml" || language === "malayalam" ? "malayalam" : "english";
  const langGreetings = GREETINGS[normalizedLang] || GREETINGS.english;

  // Determine timeOfDay if not provided
  const resolvedTime =
    timeOfDay && ["morning", "afternoon", "evening", "night"].includes(timeOfDay.toLowerCase())
      ? timeOfDay.toLowerCase()
      : getTimeOfDay();

  // Check for context-aware greetings
  if (context) {
    if (typeof context.pendingTasksCount === "number" && context.pendingTasksCount > 0) {
      const text = langGreetings.contextAware.pendingTasks(context.pendingTasksCount);
      return typeof langOrOptions === "string" ? text : { text, timeOfDay: resolvedTime, language: normalizedLang, index: -1 };
    }
    if (typeof context.unreadCircularsCount === "number" && context.unreadCircularsCount > 0) {
      const text = langGreetings.contextAware.unreadCirculars(context.unreadCircularsCount);
      return typeof langOrOptions === "string" ? text : { text, timeOfDay: resolvedTime, language: normalizedLang, index: -1 };
    }
    if (typeof context.meetingsCount === "number" && context.meetingsCount > 0) {
      const text = langGreetings.contextAware.meetings(context.meetingsCount);
      return typeof langOrOptions === "string" ? text : { text, timeOfDay: resolvedTime, language: normalizedLang, index: -1 };
    }
    if (context.clearSchedule) {
      const text = langGreetings.contextAware.clearSchedule();
      return typeof langOrOptions === "string" ? text : { text, timeOfDay: resolvedTime, language: normalizedLang, index: -1 };
    }
  }

  // Select greeting list
  const greetingList = langGreetings[resolvedTime] || langGreetings.morning;

  // Choose random index ensuring no consecutive duplicate
  let chosenIndex = Math.floor(Math.random() * greetingList.length);
  if (greetingList.length > 1 && chosenIndex === lastIndex) {
    chosenIndex = (chosenIndex + 1) % greetingList.length;
  }

  const selectedText = greetingList[chosenIndex];

  if (typeof langOrOptions === "string" && !tod && !Object.keys(ctx).length) {
    return selectedText;
  }

  return {
    text: selectedText,
    timeOfDay: resolvedTime,
    language: normalizedLang,
    index: chosenIndex,
  };
}

export default getWelcomeMessage;
