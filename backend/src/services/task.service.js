import Task from "../models/Task.model.js";
import User from "../models/User.model.js";
import { safeParseLLMJson } from "../utils/safeParseLLMJson.js";
import { invalidateDailyBriefingCache } from "./dailyBriefing.service.js";

// Helper to parse dueTime string (e.g., "10:00 AM" or "14:30") to minutes for sorting
function getDueTimeMinutes(dueTime) {
  if (!dueTime) return 9999; // tasks with no time go to the end
  const match = dueTime.match(/^(\d+):(\d+)\s*(AM|PM)?$/i);
  if (!match) return 9999;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const ampm = match[3];

  if (ampm) {
    if (ampm.toUpperCase() === "PM" && hours < 12) hours += 12;
    if (ampm.toUpperCase() === "AM" && hours === 12) hours = 0;
  }
  return hours * 60 + minutes;
}

// Helper to sort tasks by priority (High > Medium > Low) and then by dueTime
function sortTasks(tasks) {
  const priorityWeight = { "High": 3, "Medium": 2, "Low": 1 };
  return tasks.sort((a, b) => {
    const weightA = priorityWeight[a.priority] || 2;
    const weightB = priorityWeight[b.priority] || 2;

    if (weightA !== weightB) {
      return weightB - weightA; // Higher weight first
    }

    // Secondary sort by dueTime
    const timeA = getDueTimeMinutes(a.dueTime);
    const timeB = getDueTimeMinutes(b.dueTime);
    return timeA - timeB;
  });
}

/**
 * Get all tasks for an employee
 */
export async function getTasks(employeeId) {
  return await Task.find({ employee: employeeId }).sort({ dueDate: 1, createdAt: -1 });
}

/**
 * Get today's tasks
 */
export async function getTodayTasks(employeeId) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const tasks = await Task.find({
    employee: employeeId,
    status: { $in: ["Pending", "In Progress"] },
    dueDate: { $gte: startOfToday, $lte: endOfToday }
  });

  return sortTasks(tasks);
}

/**
 * Get upcoming tasks (tomorrow and next 7 days)
 */
export async function getUpcomingTasks(employeeId) {
  const now = new Date();
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const endOf7Days = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000); // 8 days total to cover full 7 days upcoming
  endOf7Days.setHours(23, 59, 59, 999);

  return await Task.find({
    employee: employeeId,
    status: { $in: ["Pending", "In Progress"] },
    dueDate: { $gt: endOfToday, $lte: endOf7Days }
  }).sort({ dueDate: 1, dueTime: 1 });
}

/**
 * Get overdue tasks
 */
export async function getOverdueTasks(employeeId) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);

  return await Task.find({
    employee: employeeId,
    status: { $in: ["Pending", "In Progress"] },
    dueDate: { $lt: startOfToday }
  }).sort({ dueDate: 1 });
}

/**
 * Get scheduled meeting tasks (category === "Meeting") for the Scheduled Meetings widget.
 *
 * Rules:
 * - Only tasks with category "Meeting" (English canonical enum)
 * - status != Completed / Cancelled
 * - dueDate >= today  (date comparison using Date objects, never strings)
 * - For today's meetings: include all (time filtering is done in JS so we don't miss
 *   meetings that are still upcoming later today)
 * - Sorted by dueDate ASC, then dueTime ASC
 * - Limit 10 (enough to fill the sidebar widget with headroom)
 */
export async function getScheduledMeetingTasks(employeeId) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const tasks = await Task.find({
    employee: employeeId,
    category: "Meeting",
    status: { $in: ["Pending", "In Progress"] },
    dueDate: { $gte: startOfToday }
  })
    .sort({ dueDate: 1, dueTime: 1 });

  return tasks.map(t => {
    const taskObj = t.toObject();
    const taskDate = t.dueDate ? new Date(t.dueDate) : null;
    const isToday = taskDate && taskDate >= startOfToday && taskDate <= endOfToday;
    return {
      ...taskObj,
      meetingType: isToday ? "today" : "upcoming"
    };
  });
}


const CATEGORY_MAP_EN_TO_ML = {
  "Official Work": "ഔദ്യോഗിക ജോലി",
  "Government Circular": "സർക്കാർ സർക്കുലർ",
  "Meeting": "യോഗം",
  "Follow-up": "ഫോളോ അപ്പ്",
  "Personal Reminder": "വ്യക്തിഗത ഓർമ്മപ്പെടുത്തൽ",
  "Training": "പരിശീലനം",
  "Other": "മറ്റുള്ളവ"
};

const CATEGORY_MAP_ML_TO_EN = {
  "ഔദ്യോഗിക കാര്യങ്ങൾ": "Official Work",
  "ഔദ്യോഗിക ജോലി": "Official Work",
  "ഔദ്യോഗിക പ്രവർത്തനം": "Official Work",
  "സർക്കാർ സർക്കുലർ": "Government Circular",
  "യോഗം": "Meeting",
  "മീറ്റിംഗ്": "Meeting",
  "തുടർനടപടി": "Follow-up",
  "ഫോളോ അപ്പ്": "Follow-up",
  "വ്യക്തിഗത ഓർമ്മപ്പെടുത്തൽ": "Personal Reminder",
  "വ്യക്തിഗതം": "Personal Reminder",
  "പരിശീലനം": "Training",
  "മറ്റുള്ളവ": "Other"
};

const PRIORITY_MAP_EN_TO_ML = {
  "High": "ഉയർന്നത്",
  "Medium": "ഇടത്തരം",
  "Low": "കുറഞ്ഞത്"
};

const PRIORITY_MAP_ML_TO_EN = {
  "ഉയർന്നത്": "High",
  "അടിയന്തിരം": "High",
  "സാധാരണം": "Medium",
  "ഇടത്തരം": "Medium",
  "മധ്യം": "Medium",
  "കുറഞ്ഞത്": "Low"
};

const MEETING_TYPE_MAP_EN_TO_ML = {
  "Offline": "ഓഫ്ലൈൻ",
  "Online": "ഓൺലൈൻ",
  "Hybrid": "സങ്കരം"
};

const MEETING_TYPE_MAP_ML_TO_EN = {
  "നേരിട്ട്": "Offline",
  "ഓഫ്ലൈൻ": "Offline",
  "ഓൺലൈൻ": "Online",
  "ഹൈബ്രിഡ്": "Hybrid",
  "സങ്കരം": "Hybrid",
  "ഒന്നുമില്ല": "None"
};

export function normalizeTaskDataToEnglish(taskData) {
  if (!taskData) return taskData;
  const data = { ...taskData };

  if (data.category && CATEGORY_MAP_ML_TO_EN[data.category]) {
    data.category = CATEGORY_MAP_ML_TO_EN[data.category];
  }
  if (data.priority && PRIORITY_MAP_ML_TO_EN[data.priority]) {
    data.priority = PRIORITY_MAP_ML_TO_EN[data.priority];
  }
  if (data.meetingType && MEETING_TYPE_MAP_ML_TO_EN[data.meetingType]) {
    data.meetingType = MEETING_TYPE_MAP_ML_TO_EN[data.meetingType];
  }

  return data;
}

/**
 * Create a task
 */
export async function createTask(employeeId, taskData) {
  const normalizedData = normalizeTaskDataToEnglish(taskData);
  const task = new Task({
    ...normalizedData,
    employee: employeeId
  });
  const saved = await task.save();
  await invalidateDailyBriefingCache(employeeId);
  return saved;
}

/**
 * Update a task
 */
export async function updateTask(employeeId, taskId, taskData) {
  const task = await Task.findOne({ _id: taskId, employee: employeeId });
  if (!task) throw new Error("Task not found or access denied");

  const normalizedData = normalizeTaskDataToEnglish(taskData);
  Object.assign(task, normalizedData);
  const saved = await task.save();
  await invalidateDailyBriefingCache(employeeId);
  return saved;
}


/**
 * Update task status
 */
export async function updateTaskStatus(employeeId, taskId, status) {
  const task = await Task.findOne({ _id: taskId, employee: employeeId });
  if (!task) throw new Error("Task not found or access denied");

  task.status = status;
  const saved = await task.save();
  await invalidateDailyBriefingCache(employeeId);
  return saved;
}

/**
 * Delete a task
 */
export async function deleteTask(employeeId, taskId) {
  const result = await Task.deleteOne({ _id: taskId, employee: employeeId });
  if (result.deletedCount === 0) throw new Error("Task not found or access denied");
  await invalidateDailyBriefingCache(employeeId);
  return { success: true };
}

function getNextDayOfWeek(dayName, refDate) {
  const days = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
  const targetDay = days[dayName.toLowerCase()];
  if (targetDay === undefined) return refDate;

  const resultDate = new Date(refDate);
  const currentDay = resultDate.getDay();
  let distance = targetDay - currentDay;
  if (distance <= 0) {
    distance += 7; // coming week's day
  }
  resultDate.setDate(resultDate.getDate() + distance);
  return resultDate;
}

/**
 * Deterministically resolves a dueDate from free text relative to a reference date.
 *
 * IMPORTANT: This is the single source of truth for due-date math. It is used both
 * for the local fallback parser AND to override whatever the LLM produces, because
 * small models (e.g. llama-3.1-8b-instant) are unreliable at day-of-week arithmetic
 * ("this Friday" from a Monday was previously miscalculated by the LLM as Thursday).
 * Never trust LLM-computed dates for this reason - always recompute here.
 */
function computeDueDate(text, refDate = new Date()) {
  const lowercaseText = text.toLowerCase();
  let dueDate = new Date(refDate);

  if (lowercaseText.includes("day after") || lowercaseText.includes("മറ്റന്നാൾ")) {
    dueDate.setDate(dueDate.getDate() + 2);
    return dueDate;
  }
  if (lowercaseText.includes("tomorrow") || lowercaseText.includes("നാളെ")) {
    dueDate.setDate(dueDate.getDate() + 1);
    return dueDate;
  }
  if (lowercaseText.includes("next week") || lowercaseText.includes("അടുത്ത ആഴ്ച")) {
    dueDate.setDate(dueDate.getDate() + 7);
    return dueDate;
  }

  // Check days of week (English)
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  // Malayalam day names mapped to day index
  const mlDays = { "ഞായർ": 0, "തിങ്കൾ": 1, "ചൊവ്വ": 2, "ബുധൻ": 3, "വ്യാഴം": 4, "വെള്ളി": 5, "ശനി": 6 };

  for (const d of days) {
    if (lowercaseText.includes(d)) {
      return getNextDayOfWeek(d, dueDate);
    }
  }
  for (const [mlDay, idx] of Object.entries(mlDays)) {
    if (lowercaseText.includes(mlDay)) {
      const diff = (idx - dueDate.getDay() + 7) % 7 || 7;
      dueDate.setDate(dueDate.getDate() + diff);
      return dueDate;
    }
  }

  return dueDate; // default: today
}

/**
 * Deterministically resolves a dueTime ("HH:MM", 24h) from free text.
 * Same rationale as computeDueDate: don't trust the LLM's clock-time math either.
 */
function computeDueTime(text) {
  const lowercaseText = text.toLowerCase();

  const timeRegex = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i; // require am/pm to avoid false hits on stray numbers
  const strictTimeRegex = /\b([01]?\d|2[0-3]):([0-5]\d)\b/; // 24h HH:MM
  let match = text.match(timeRegex) || text.match(strictTimeRegex);

  if (match) {
    let hr = parseInt(match[1], 10);
    let min = match[2] || "00";
    let ampm = match[3] ? match[3].toLowerCase() : "";
    if (ampm === "pm" && hr < 12) {
      hr += 12;
    } else if (ampm === "am" && hr === 12) {
      hr = 0;
    }
    return `${String(hr).padStart(2, "0")}:${min}`;
  }

  if (lowercaseText.includes("noon") || lowercaseText.includes("ഉച്ച") || lowercaseText.includes("നട്ടുച്ച")) {
    return "12:00";
  }
  if (lowercaseText.includes("midnight") || lowercaseText.includes("അർദ്ധരാത്രി")) {
    return "00:00";
  }
  if (lowercaseText.includes("morning") || lowercaseText.includes("രാവിലെ")) {
    return "09:00";
  }
  if (lowercaseText.includes("afternoon") || lowercaseText.includes("ഉച്ചയ്ക്ക്")) {
    return "14:00";
  }
  if (lowercaseText.includes("evening") || lowercaseText.includes("വൈകുന്നേരം")) {
    return "17:00";
  }
  if (lowercaseText.includes("night") || lowercaseText.includes("രാത്രി")) {
    return "20:00";
  }

  return null;
}

// Malayalam display labels for the (English-enum) category/priority values.
// NOTE: Task.model.js constrains `category`/`priority` to fixed English enum strings,
// so the stored/canonical values always stay English regardless of preferredLanguage -
// changing that would break schema validation, sorting weights, and filter queries.
// These maps only provide a translated label for UI display when preferredLanguage
// resolves to Malayalam; they are never written to the database.
const CATEGORY_LABELS_ML = {
  "Official Work": "ഔദ്യോഗിക ജോലി",
  "Government Circular": "സർക്കാർ സർക്കുലർ",
  "Meeting": "യോഗം",
  "Follow-up": "ഫോളോ അപ്പ്",
  "Personal Reminder": "വ്യക്തിഗത ഓർമ്മപ്പെടുത്തൽ",
  "Training": "പരിശീലനം",
  "Other": "മറ്റുള്ളവ"
};

const PRIORITY_LABELS_ML = {
  "High": "ഉയർന്നത്",
  "Medium": "ഇടത്തരം",
  "Low": "കുറഞ്ഞത്"
};

const MEETING_TYPE_LABELS_ML = {
  "Offline": "നേരിട്ട്",
  "Online": "ഓൺലൈൻ",
  "Hybrid": "സങ്കരം"
};

// Known offline venue keywords (matched case-insensitively). Kept as a fixed list rather
// than left to the LLM, same rationale as the date-math fix: deterministic keyword
// matching is reliable and auditable, an 8B model's judgement on this isn't.
const OFFLINE_LOCATION_KEYWORDS = [
  "town hall", "panchayat office", "collectorate", "district office",
  "conference hall", "municipality office", "village office"
];

// Known online meeting platform keywords/domains.
const ONLINE_PLATFORM_KEYWORDS = [
  "google meet", "meet.google.com", "zoom", "microsoft teams", "ms teams", "teams", "webex", "jitsi"
];

const MEETING_URL_REGEX = /\bhttps?:\/\/[^\s]+/i;

function titleCase(str) {
  return str.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

function extractLocation(text) {
  const lower = text.toLowerCase();
  for (const kw of OFFLINE_LOCATION_KEYWORDS) {
    if (lower.includes(kw)) return titleCase(kw);
  }
  return null;
}

function detectsOnlinePlatform(text) {
  const lower = text.toLowerCase();
  return ONLINE_PLATFORM_KEYWORDS.some(kw => lower.includes(kw)) || MEETING_URL_REGEX.test(text);
}

function extractMeetingLink(text) {
  const match = text.match(MEETING_URL_REGEX);
  return match ? match[0] : null;
}

/**
 * Offline if only a known venue is mentioned, Online if only a platform/link is
 * mentioned, Hybrid if both are present, or null if neither is detectable (left for
 * the employee to pick manually in the confirmation dialog rather than guessed).
 */
function inferMeetingType(text) {
  const hasLocation = !!extractLocation(text);
  const hasOnline = detectsOnlinePlatform(text);
  if (hasLocation && hasOnline) return "Hybrid";
  if (hasOnline) return "Online";
  if (hasLocation) return "Offline";
  return null;
}

const DEPARTMENT_STOPWORDS = new Set(["the", "a", "an", "with", "for", "and", "meeting", "in", "at", "this", "that", "of"]);

function extractDepartment(text) {
  const match = text.match(/((?:[A-Za-z]+\s+){0,2}[A-Za-z]+)\s+Department\b/i);
  if (match) {
    const words = match[1].trim().split(/\s+/).filter(w => !DEPARTMENT_STOPWORDS.has(w.toLowerCase()));
    if (words.length) return `${titleCase(words.join(" "))} Department`;
  }
  const mlMatch = text.match(/([\u0D00-\u0D7F]+)\s*വകുപ്പ്/);
  if (mlMatch) return `${mlMatch[1]} വകുപ്പ്`;
  return null;
}

function extractMeetingDetails(text) {
  return {
    meetingType: inferMeetingType(text),
    location: extractLocation(text),
    meetingLink: extractMeetingLink(text),
    department: extractDepartment(text),
    participants: null,
    notes: null
  };
}

function buildMeetingTypeLabel(meetingType, generationLanguage) {
  if (!meetingType) return null;
  const mtEn = MEETING_TYPE_MAP_ML_TO_EN[meetingType] || meetingType;
  if (generationLanguage === "Malayalam") return MEETING_TYPE_MAP_EN_TO_ML[mtEn] || meetingType;
  return mtEn;
}

function resolveGenerationLanguage(preferredLanguage, detectedLanguage) {
  if (preferredLanguage === "english") return "English";
  if (preferredLanguage === "malayalam") return "Malayalam";
  return detectedLanguage;
}

function buildDisplayLabels(category, priority, generationLanguage) {
  const catEn = CATEGORY_MAP_ML_TO_EN[category] || category;
  const priEn = PRIORITY_MAP_ML_TO_EN[priority] || priority;
  if (generationLanguage === "Malayalam") {
    return {
      categoryLabel: CATEGORY_MAP_EN_TO_ML[catEn] || category,
      priorityLabel: PRIORITY_MAP_EN_TO_ML[priEn] || priority
    };
  }
  return { categoryLabel: catEn, priorityLabel: priEn };
}

function parseNlpLocally(text, preferredLanguage = "auto") {
  const lowercaseText = text.toLowerCase();

  // Language detection of the original input
  const hasMalayalam = /[\u0D00-\u0D7F]/.test(text);
  const hasEnglish = /[a-zA-Z]/.test(text);
  let language = "English";
  if (hasMalayalam && hasEnglish) {
    language = "Mixed";
  } else if (hasMalayalam) {
    language = "Malayalam";
  }

  let resolvedLanguage = "English";
  if (preferredLanguage === "english") {
    resolvedLanguage = "English";
  } else if (preferredLanguage === "malayalam") {
    resolvedLanguage = "Malayalam";
  } else {
    resolvedLanguage = language === "Malayalam" || language === "Mixed" ? "Malayalam" : "English";
  }

  let category = "Official Work";
  let priority = "Medium";

  // Category detection
  if (lowercaseText.includes("circular") || lowercaseText.includes("സർക്കുലർ")) {
    category = "Government Circular";
  } else if (lowercaseText.includes("meeting") || lowercaseText.includes("discuss") || lowercaseText.includes("യോഗം") || lowercaseText.includes("മീറ്റിംഗ്")) {
    category = "Meeting";
  } else if (lowercaseText.includes("follow up") || lowercaseText.includes("followup") || lowercaseText.includes("ഫോളോ")) {
    category = "Follow-up";
  } else if (lowercaseText.includes("training") || lowercaseText.includes("course") || lowercaseText.includes("പരിശീലനം")) {
    category = "Training";
  } else {
    const isPersonal = lowercaseText.includes("pay") || lowercaseText.includes("bill") || lowercaseText.includes("buy") || lowercaseText.includes("വാങ്ങുക") || lowercaseText.includes("അടയ്ക്കുക") || lowercaseText.includes("വ്യക്തിഗതം");
    if (isPersonal) {
      category = "Personal Reminder";
    }
  }

  // Priority detection
  if (lowercaseText.includes("urgent") || lowercaseText.includes("asap") || lowercaseText.includes("immediate") || lowercaseText.includes("today") || lowercaseText.includes("അടിയന്തിരം") || lowercaseText.includes("പ്രധാനം") || lowercaseText.includes("ഇന്ന്")) {
    priority = "High";
  } else if (lowercaseText.includes("low priority") || lowercaseText.includes("when you can") || lowercaseText.includes("കുറഞ്ഞ മുൻഗണന") || lowercaseText.includes("അടുത്ത മാസം")) {
    priority = "Low";
  }

  const dueDate = computeDueDate(text);
  const dueTime = computeDueTime(text);

  // Clean title
  let title = text;
  title = title
    .replace(/remind me (tomorrow|today)?\s*(at \d{1,2}(:\d{2})?\s*(am|pm)?)?\s*to/i, "")
    .replace(/before Friday|by Friday|tomorrow|next week|at \d{1,2}(:\d{2})?\s*(am|pm)?/ig, "")
    .replace(/എന്നെ ഓർമ്മിപ്പിക്കൂ/g, "")
    .replace(/ഓർമ്മിപ്പിക്കൂ/g, "")
    .replace(/ചെയ്യണം/g, "")
    .replace(/ചെയ്യുക/g, "")
    .trim();

  if (title.length > 50) {
    title = title.substring(0, 50) + "...";
  }
  if (!title) {
    title = text;
  }
  title = title.charAt(0).toUpperCase() + title.slice(1);

  // Apply translations for resolvedLanguage
  let finalCategory = category;
  let finalPriority = priority;
  if (resolvedLanguage === "Malayalam") {
    finalCategory = CATEGORY_MAP_EN_TO_ML[category] || category;
    finalPriority = PRIORITY_MAP_EN_TO_ML[priority] || priority;
  }

  const { categoryLabel, priorityLabel } = buildDisplayLabels(finalCategory, finalPriority, resolvedLanguage);

  const titleTranslationSkipped =
    (resolvedLanguage === "English" && language === "Malayalam") ||
    (resolvedLanguage === "Malayalam" && language === "English");

  return {
    title,
    description: text,
    category: finalCategory,
    priority: finalPriority,
    categoryLabel,
    priorityLabel,
    dueDate: dueDate.toISOString().split("T")[0],
    dueTime,
    status: "Pending",
    source: "AI",
    language,
    ...(titleTranslationSkipped ? { titleTranslationSkipped: true } : {})
  };
}

const VALID_PREFERRED_LANGUAGES = ["auto", "english", "malayalam"];

/**
 * Creates a task automatically by parsing natural language using AI.
 *
 * @param {string} employeeId
 * @param {string} text - raw natural language input from the employee
 * @param {"auto"|"english"|"malayalam"} preferredLanguage - from the employee profile.
 */
export async function createTaskFromNlp(employeeId, text, preferredLanguage = "auto") {
  const apiKey = process.env.GROQ_API_KEY;
  const today = new Date();

  // 1. Read user's Preferred Language from profile
  let dbPreferredLanguage = preferredLanguage;
  try {
    const userObj = await User.findById(employeeId);
    if (userObj) {
      dbPreferredLanguage = userObj.preferredLanguage || dbPreferredLanguage;
    }
  } catch (err) {
    // Ignore DB errors
  }

  const activePreferredLanguage = VALID_PREFERRED_LANGUAGES.includes(dbPreferredLanguage)
    ? dbPreferredLanguage
    : "auto";

  // 2. Resolve target response language (resolvedLanguage)
  let resolvedLanguage = "English";
  if (activePreferredLanguage === "english") {
    resolvedLanguage = "English";
  } else if (activePreferredLanguage === "malayalam") {
    resolvedLanguage = "Malayalam";
  } else {
    // preferredLanguage == auto: Detect the input language
    const hasMalayalam = /[\u0D00-\u0D7F]/.test(text);
    resolvedLanguage = hasMalayalam ? "Malayalam" : "English";
  }

  let taskDetails;
  if (!apiKey || apiKey === "your_groq_api_key_here") {
    taskDetails = parseNlpLocally(text, activePreferredLanguage);
  } else {
    try {
      const { ChatGroq } = await import("@langchain/groq");
      const { PromptTemplate } = await import("@langchain/core/prompts");
      const { StringOutputParser } = await import("@langchain/core/output_parsers");

      const promptTemplate = `You are an AI assistant that converts natural language into structured government tasks.
Return every user-visible field in {resolvedLanguage}.
Generate:
- taskTitle
- category
- priority
- meetingType
- notes
- location (only translate when appropriate)

Never mix languages.
If resolvedLanguage is Malayalam, all generated labels and values must be in Malayalam. This includes the 'title' field, which MUST be translated to Malayalam script (മലയാളം), even if the input text was in English.
If resolvedLanguage is English, all generated labels and values must be in English.

Extract the following fields and return ONLY a valid JSON object matching the JSON FORMAT:
- title: Short descriptive action-oriented title of the task (the taskTitle). Keep it concise. It must describe ONLY the work to be done. Do NOT include dates, times, reminder words, conversation words, or polite words. Must be in {resolvedLanguage}. If {resolvedLanguage} is Malayalam, you MUST translate the title to Malayalam script.
- description: Store the original user/employee sentence exactly as entered. Do not rewrite. Do not translate.
- category: Determine by actual work/meaning. Use one of:
  If {resolvedLanguage} is English: "Official Work" | "Government Circular" | "Meeting" | "Follow-up" | "Personal Reminder" | "Training" | "Other"
  If {resolvedLanguage} is Malayalam: "ഔദ്യോഗിക ജോലി" | "സർക്കാർ സർക്കുലർ" | "യോഗം" | "ഫോളോ അപ്പ്" | "വ്യക്തിഗത ഓർമ്മപ്പെടുത്തൽ" | "പരിശീലനം" | "മറ്റുള്ളവ"
- priority: Determine by meaning. Use one of:
  If {resolvedLanguage} is English: "High" | "Medium" | "Low"
  If {resolvedLanguage} is Malayalam: "ഉയർന്നത്" | "ഇടത്തരം" | "കുറഞ്ഞത്"
- meetingType: Infer from text if it's a meeting. Use one of:
  If {resolvedLanguage} is English: "Offline" | "Online" | "Hybrid"
  If {resolvedLanguage} is Malayalam: "ഓഫ്ലൈൻ" | "ഓൺലാൻ" | "സങ്കരം"
- location: Extract location if mentioned (e.g. "Town Hall", "Zoom"). Only translate when appropriate.
- notes: AI notes about the task/meeting. Must be in {resolvedLanguage}.
- status: "Pending"
- source: "AI"
- language: The language of the ORIGINAL INPUT TEXT itself ("English" | "Malayalam" | "Mixed").
- confidence: A float value from 0.0 to 1.0 representing your confidence in this extraction.

Reference Date (Today): {referenceDate} (Day: {referenceDayOfWeek})

Input text: "{text}"

JSON FORMAT:
{{
  "title": "",
  "description": "",
  "category": "",
  "priority": "",
  "meetingType": "",
  "location": "",
  "notes": "",
  "status": "Pending",
  "source": "AI",
  "language": "",
  "confidence": 1.0
}}

Return ONLY JSON. No explanations, no markdown.`;

      const llm = new ChatGroq({
        apiKey,
        model: "llama-3.1-8b-instant",
        temperature: 0.1,
      });

      const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const refDay = daysOfWeek[today.getDay()];

      const prompt = PromptTemplate.fromTemplate(promptTemplate);
      const parser = new StringOutputParser();
      const chain = prompt.pipe(llm).pipe(parser);

      const raw = await chain.invoke({
        text,
        referenceDate: today.toISOString().split("T")[0],
        referenceDayOfWeek: refDay,
        resolvedLanguage,
      });

      const parsedRes = safeParseLLMJson(raw);
      if (!parsedRes.success) {
        throw new Error(`NLP JSON Parsing failed: ${parsedRes.error}`);
      }
      const parsed = parsedRes.data;

      taskDetails = {
        title: parsed.title,
        description: text,
        category: parsed.category || (resolvedLanguage === "Malayalam" ? "ഔദ്യോഗിക ജോലി" : "Official Work"),
        priority: parsed.priority || (resolvedLanguage === "Malayalam" ? "ഇടത്തരം" : "Medium"),
        dueDate: null,
        dueTime: null,
        meetingType: parsed.meetingType || undefined,
        location: parsed.location || undefined,
        notes: parsed.notes || undefined,
        status: "Pending",
        source: "AI",
        language: parsed.language || "English",
        confidence: parsed.confidence || 0.85
      };
    } catch (err) {
      console.error("Groq NLP parsing failed, falling back to local regex parser:", err);
      taskDetails = parseNlpLocally(text, activePreferredLanguage);
    }
  }

  // Ensure fields are translated consistently to resolvedLanguage
  if (resolvedLanguage === "Malayalam") {
    taskDetails.category = CATEGORY_MAP_EN_TO_ML[CATEGORY_MAP_ML_TO_EN[taskDetails.category] || taskDetails.category] || taskDetails.category;
    taskDetails.priority = PRIORITY_MAP_EN_TO_ML[PRIORITY_MAP_ML_TO_EN[taskDetails.priority] || taskDetails.priority] || taskDetails.priority;
    if (taskDetails.meetingType) {
      taskDetails.meetingType = MEETING_TYPE_MAP_EN_TO_ML[MEETING_TYPE_MAP_ML_TO_EN[taskDetails.meetingType] || taskDetails.meetingType] || taskDetails.meetingType;
    }
  } else {
    taskDetails.category = CATEGORY_MAP_ML_TO_EN[taskDetails.category] || taskDetails.category;
    taskDetails.priority = PRIORITY_MAP_ML_TO_EN[taskDetails.priority] || taskDetails.priority;
    if (taskDetails.meetingType) {
      taskDetails.meetingType = MEETING_TYPE_MAP_ML_TO_EN[taskDetails.meetingType] || taskDetails.meetingType;
    }
  }

  // Meeting-specific structured fields (location/meetingLink/department) are
  // computed deterministically from the original text - same reasoning as due date/time.
  const isMeeting = taskDetails.category === "Meeting" || taskDetails.category === "യോഗം";
  if (isMeeting) {
    const details = extractMeetingDetails(text);
    // Keep location/notes from AI if already set, else assign
    taskDetails.location = taskDetails.location || details.location;
    taskDetails.meetingLink = taskDetails.meetingLink || details.meetingLink;
    taskDetails.department = taskDetails.department || details.department;
    taskDetails.participants = taskDetails.participants || details.participants;
    taskDetails.notes = taskDetails.notes || details.notes;
    taskDetails.meetingType = taskDetails.meetingType || details.meetingType;

    // ensure meetingType is translated
    if (taskDetails.meetingType) {
      if (resolvedLanguage === "Malayalam") {
        taskDetails.meetingType = MEETING_TYPE_MAP_EN_TO_ML[MEETING_TYPE_MAP_ML_TO_EN[taskDetails.meetingType] || taskDetails.meetingType] || taskDetails.meetingType;
      } else {
        taskDetails.meetingType = MEETING_TYPE_MAP_ML_TO_EN[taskDetails.meetingType] || taskDetails.meetingType;
      }
    }
  }

  // ALWAYS recompute dueDate/dueTime deterministically from the original text
  const resolvedDueDate = computeDueDate(text, today);
  taskDetails.dueDate = resolvedDueDate.toISOString().split("T")[0];
  taskDetails.dueTime = computeDueTime(text);

  // Attach display-only, localized labels for category/priority/meetingType
  const labels = buildDisplayLabels(taskDetails.category, taskDetails.priority, resolvedLanguage);
  taskDetails.categoryLabel = labels.categoryLabel;
  taskDetails.priorityLabel = labels.priorityLabel;

  if (isMeeting) {
    taskDetails.meetingTypeLabel = buildMeetingTypeLabel(taskDetails.meetingType, resolvedLanguage);
  }

  return taskDetails;
}