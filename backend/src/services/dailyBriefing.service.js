import { ChatGroq } from "@langchain/groq";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { dailyBriefingSystemPrompt } from "../prompts/dailyBriefing.system.prompt.js";
import { safeParseLLMJson } from "../utils/safeParseLLMJson.js";
import DailyBriefing from "../models/DailyBriefing.model.js";
import { getLocalDateString } from "./wellness.service.js";

const getMalayalamDepartment = (d) => {
  if (!d) return "";
  return d.endsWith("Department") ? d : d + " Department";
};

const getMalayalamDistrict = (d) => {
  if (!d) return "";
  return d.endsWith("District") ? d : d + " District";
};

const getMalayalamWellnessStatus = (s) => {
  return s;
};

const getMalayalamBurnoutRisk = (r) => {
  return r;
};

const inFlightRequests = new Map();
const transientStatuses = [429, 500, 502, 503, 504];

/**
 * Estimate token count using a character heuristic.
 * 1 token ≈ 4 characters for ASCII, 1.5 characters for non-ASCII/Malayalam.
 */
function estimateTokens(text) {
  if (!text) return 0;
  let asciiCount = 0;
  let nonAsciiCount = 0;
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) < 128) {
      asciiCount++;
    } else {
      nonAsciiCount++;
    }
  }
  return Math.ceil(asciiCount / 4 + nonAsciiCount / 1.5);
}

/**
 * Generate a fingerprint of input data to check if tasks, meetings, or wellness data changed.
 */
function computeInputFingerprint(data) {
  const wellness = `${data.wellnessStatus || ""}_${data.wellnessScore || 0}_${data.focusScore || 0}_${data.burnoutRisk || ""}`;
  const todayTasks = `${data.todayTasksCount || 0}_${(data.todayTasksList || []).join(",")}`;
  const overdueTasks = `${data.overdueTasksCount || 0}_${(data.overdueTasksList || []).join(",")}`;
  const meetings = `${data.upcomingMeetingsCount || 0}_${(data.upcomingMeetingsList || []).join(",")}`;
  const circulars = `${data.newCircularsCount || 0}_${(data.newCircularsList || []).join(",")}`;
  return `${wellness}::today:${todayTasks}::overdue:${overdueTasks}::${meetings}::${circulars}`;
}

/**
 * Invalidate cached Daily Briefing records for an employee for today's date.
 */
export async function invalidateDailyBriefingCache(employeeId) {
  if (!employeeId) return;
  try {
    const currentDate = getLocalDateString();
    await DailyBriefing.deleteMany({
      employeeId: employeeId.toString(),
      dateString: currentDate,
    });
  } catch (err) {
    console.error("[Daily Briefing Cache Invalidation Error]:", err);
  }
}

/**
 * Invoke LLM chain with transient retries, exponential backoff, and Retry-After header parsing.
 */
async function invokeLlmWithRetry(chain, variables, maxRetries = 3) {
  let attempt = 0;
  while (true) {
    try {
      const start = Date.now();
      const raw = await chain.invoke(variables);
      const duration = Date.now() - start;
      return { raw, duration, attempt };
    } catch (err) {
      attempt++;
      const status = err.status || err.statusCode || (err.response && err.response.status);
      const isTransient = transientStatuses.includes(status) || 
                          (err.message && (err.message.includes("429") || err.message.includes("rate limit") || err.message.includes("500") || err.message.includes("502") || err.message.includes("503") || err.message.includes("504")));

      if (!isTransient || attempt >= maxRetries) {
        throw err;
      }

      let waitMs = Math.pow(2, attempt) * 1000; // default backoff

      if (status === 429 || (err.message && err.message.includes("429"))) {
        let retryAfter = null;
        if (err.headers && (err.headers.get("retry-after") || err.headers["retry-after"])) {
          retryAfter = err.headers.get ? err.headers.get("retry-after") : err.headers["retry-after"];
        }
        if (retryAfter) {
          const parsed = parseInt(retryAfter, 10);
          if (!isNaN(parsed) && parsed > 0) {
            waitMs = parsed * 1000;
          }
        } else {
          waitMs = 5000; // fallback 5s wait for 429
        }
      }

      console.warn(`[Daily Briefing LLM Transient Error] Attempt ${attempt}/${maxRetries} failed with status ${status || "unknown"}: ${err.message}. Retrying in ${waitMs}ms...`);
      await new Promise((res) => setTimeout(res, waitMs));
    }
  }
}

/**
 * Generates an AI Daily Briefing for a specific employee.
 * Uses 24-hour persistent MongoDB caching with in-memory deduplication for concurrent calls.
 */
export async function generateDailyBriefing(data, forceRefresh = false) {
  const employeeId = data.employeeId?.toString();
  const currentDate = getLocalDateString();
  const resolvedLanguage = data.resolvedLanguage || (data.preferredLanguage === "malayalam" ? "malayalam" : "english");
  const currentFingerprint = computeInputFingerprint(data);

  if (!employeeId) {
    return sanitizeBriefingLanguage(getLocalFallbackBriefing(data, resolvedLanguage), resolvedLanguage);
  }

  // 1. Check MongoDB Cache (unless forceRefresh is true)
  if (!forceRefresh) {
    try {
      const cached = await DailyBriefing.findOne({
        employeeId,
        dateString: currentDate,
        language: resolvedLanguage,
      });

      if (cached && cached.briefing) {
        const priorities = cached.briefing.smartPriorities;
        const isCorrupted = !Array.isArray(priorities) || priorities.length === 0 || priorities.some(item => typeof item === "string" && (item.endsWith("സർക") || item.trim().length < 5));

        if (cached.inputFingerprint === currentFingerprint && !isCorrupted) {
          return sanitizeBriefingLanguage(cached.briefing, resolvedLanguage);
        } else if (isCorrupted) {
          console.warn(`[Daily Briefing Cache Corrupted] Invalid/truncated smartPriorities detected in cache for employee ${employeeId}. Regenerating briefing...`);
        } else {
          console.log(`[Daily Briefing Cache Stale] Input fingerprint changed for employee ${employeeId}. Regenerating briefing...`);
        }
      }
    } catch (cacheErr) {
      console.error("[Daily Briefing Cache Lookup Error]:", cacheErr);
    }
  }

  // 2. In-Memory Request Deduplication for Concurrent Calls
  const lockKey = `${employeeId}_${currentDate}_${resolvedLanguage}`;
  if (inFlightRequests.has(lockKey)) {
    console.log(`[Daily Briefing Request Deduplicated] Reusing active promise for ${lockKey}`);
    return inFlightRequests.get(lockKey);
  }

  const briefingPromise = (async () => {
    try {
      return await executeLlmBriefingGeneration(data, employeeId, currentDate, currentFingerprint, resolvedLanguage);
    } finally {
      inFlightRequests.delete(lockKey);
    }
  })();

  inFlightRequests.set(lockKey, briefingPromise);
  return briefingPromise;
}

/**
 * Internal execution helper for LLM generation
 */
async function executeLlmBriefingGeneration(data, employeeId, currentDate, currentFingerprint, resolvedLanguage) {
  try {
    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) {
      console.warn("[Daily Briefing] GROQ_API_KEY missing. Using fallback briefing.");
      return sanitizeBriefingLanguage(getLocalFallbackBriefing(data, resolvedLanguage), resolvedLanguage);
    }

    const modelName = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
    const llm = new ChatGroq({
      apiKey: groqApiKey,
      modelName,
      temperature: 0.3,
      maxTokens: 1500, // Increased to 1500 to prevent Malayalam output token exhaustion
    });

    const department = getMalayalamDepartment(data.department);
    const district = getMalayalamDistrict(data.district);
    const wellnessStatus = getMalayalamWellnessStatus(data.wellnessStatus);
    const burnoutRisk = getMalayalamBurnoutRisk(data.burnoutRisk);

    const userPromptTemplate = `Here is today's employee profile and workload status:
- Employee Name: {name}
- Department: {department}
- District: {district}
- Current Time: {currentTime} (Local Hour: {localHour})
- Wellness Check Status: {wellnessStatus}
- Wellness Score: {wellnessScore}/100
- Focus Score: {focusScore}/100
- Burnout Risk: {burnoutRisk}
- Today's Tasks Count: {todayTasksCount} ({todayTasksList})
- Overdue Tasks Count: {overdueTasksCount} ({overdueTasksList})
- Upcoming Meetings Count: {upcomingMeetingsCount} ({upcomingMeetingsList})
- New Government Circulars: {newCircularsCount} ({newCircularsList})

IMPORTANT GUIDELINES:
1. You MUST generate all text fields natively in the target language: {resolvedLanguage}.
2. For the "greeting" field:
   - It MUST start with the English time-based greeting prefix (exactly "Good Morning" or "Good Afternoon" or "Good Evening" or "Good Night" depending on the Current Local Hour), followed by a comma, the employee's English name ("{name}") exactly, and the waving emoji: e.g. "Good Morning, {name} 👋" or "Good Night, {name} 👋".
   - You MUST NOT translate this greeting prefix to Malayalam. It must remain in English.
   - Any text following the emoji can be in the target language: {resolvedLanguage}.
3. For all other fields ("statusMessage", "briefing", "recommendation", "priority", "smartPriorities", "motivation"), you MUST write them strictly in the target language ({resolvedLanguage}). If the target language is English, write ALL fields in English. If the target language is Malayalam, follow the Malayalam Response Style Rules: write complete sentences in Malayalam script, using 'ടാസ്കുകൾ' for tasks and 'മീറ്റിംഗുകൾ' for meetings.
4. Return ONLY a valid JSON object starting with '{{' and ending with '}}'.

Generate a tailored response matching the requested JSON structure. Keep sentences elegant, calm, and tailored to Kerala public service context.

`;

    const fullTemplate = `${dailyBriefingSystemPrompt}\n\n${userPromptTemplate}`;
    const prompt = PromptTemplate.fromTemplate(fullTemplate);
    const parser = new StringOutputParser();
    const chain = prompt.pipe(llm).pipe(parser);

    const slicedTasks = (data.todayTasksList || []).slice(0, 5);
    const slicedOverdue = (data.overdueTasksList || []).slice(0, 5);
    const slicedMeetings = (data.upcomingMeetingsList || []).slice(0, 3);
    const slicedCirculars = (data.newCircularsList || []).slice(0, 5);

    const variables = {
      name: data.name,
      department,
      district,
      currentTime: data.currentTime,
      localHour: data.localHour ?? new Date().getHours(),
      wellnessStatus,
      wellnessScore: data.wellnessScore,
      focusScore: data.focusScore,
      burnoutRisk,
      todayTasksCount: Math.min(data.todayTasksCount || 0, 5),
      todayTasksList: slicedTasks.join(", ") || "None",
      overdueTasksCount: Math.min(data.overdueTasksCount || 0, 5),
      overdueTasksList: slicedOverdue.join(", ") || "None",
      upcomingMeetingsCount: Math.min(data.upcomingMeetingsCount || 0, 3),
      upcomingMeetingsList: slicedMeetings.join(", ") || "None",
      newCircularsCount: Math.min(data.newCircularsCount || 0, 5),
      newCircularsList: slicedCirculars.join(", ") || "None",
      resolvedLanguage
    };

    const renderedPrompt = await prompt.format(variables);
    const promptTokens = estimateTokens(renderedPrompt);

    const startGen = Date.now();
    const { raw, duration, attempt } = await invokeLlmWithRetry(chain, variables);
    const genDuration = Date.now() - startGen;
    const completionTokens = estimateTokens(raw);

    console.log(`[Daily Briefing LLM Response] (${resolvedLanguage}) | Duration: ${genDuration}ms | Est. Tokens: ${completionTokens}/${1500} | Raw:\n${raw}`);

    let parsed = safeParseLLMJson(raw);
    if (!parsed.success) {
      console.warn(`[Daily Briefing JSON Parse Error]: ${parsed.error}. Retrying LLM once...`);
      const retryTemplate = `${fullTemplate}\n\nIMPORTANT: The previous output failed JSON validation. You MUST return ONLY a valid, properly escaped and fully terminated JSON object. Do not include markdown code fences, and escape all special characters properly.`;
      const retryPrompt = PromptTemplate.fromTemplate(retryTemplate);
      const retryChain = retryPrompt.pipe(llm).pipe(parser);
      const retryRes = await invokeLlmWithRetry(retryChain, variables);
      const retryRaw = retryRes.raw;
      
      parsed = safeParseLLMJson(retryRaw);

      if (!parsed.success) {
        return sanitizeBriefingLanguage(getLocalFallbackBriefing(data, resolvedLanguage), resolvedLanguage);
      }
    }

    const sanitizedBriefing = sanitizeBriefingLanguage(parsed.data, resolvedLanguage);

    // Cache generated briefing to MongoDB
    try {
      await DailyBriefing.findOneAndUpdate(
        { employeeId, dateString: currentDate, language: resolvedLanguage },
        { inputFingerprint: currentFingerprint, briefing: sanitizedBriefing },
        { upsert: true, new: true }
      );
    } catch (cacheSaveErr) {
      console.error("[Daily Briefing Cache Save Error]:", cacheSaveErr);
    }

    return sanitizedBriefing;
  } catch (err) {
    console.error("Failed to generate AI Daily Briefing, falling back:", err);
    return sanitizeBriefingLanguage(getLocalFallbackBriefing(data, resolvedLanguage), resolvedLanguage);
  }
}

/**
 * Ensures that all text fields strictly match target language and standard Malayalam plural terms.
 */
function sanitizeBriefingLanguage(briefing, resolvedLanguage) {
  if (!briefing || typeof briefing !== "object") return briefing;

  const isMl = resolvedLanguage === "malayalam";
  const hasMalayalamScript = (str) => typeof str === "string" && /[\u0D00-\u0D7F]/.test(str);

  const cleanString = (val) => {
    if (typeof val !== "string") return val;
    let s = val
      .replace(/\bടാസ്ക്സ്\b/g, "ടാസ്കുകൾ")
      .replace(/\bമീറ്റിംഗ്സ്\b/g, "മീറ്റിംഗുകൾ")
      .replace(/അടച്ച ടാസ്കുകൾ/g, "കാലാവധി കഴിഞ്ഞ ടാസ്കുകൾ")
      .replace(/സമയപരിധി കഴിഞ്ഞ(ത്)? ടാസ്കുകൾ/g, "കാലാവധി കഴിഞ്ഞ ടാസ്കുകൾ")
      .replace(/സമയപരിധി കഴിഞ്ഞ(ത്|വ)/g, "കാലാവധി കഴിഞ്ഞ");

    if (isMl) {
      s = s.replace(/\bTasks\b/g, "ടാസ്കുകൾ")
           .replace(/\bMeetings\b/g, "മീറ്റിംഗുകൾ");
    }
    return s;
  };

  const cleanArray = (arr) => {
    if (!Array.isArray(arr)) return arr;
    return arr.map(item => typeof item === "string" ? cleanString(item) : item);
  };

  const motivationVal = briefing.motivation || briefing["പ്രചോദനം"] || briefing["മോട്ടിവേഷൻ"];
  let motivation = typeof motivationVal === "string" ? motivationVal : "";

  if (!isMl) {
    if (hasMalayalamScript(motivation) || !motivation.trim()) {
      motivation = "Every completed task helps deliver better public services to the people of Kerala.";
    }
  } else {
    if (!hasMalayalamScript(motivation) || !motivation.trim()) {
      motivation = "ഓരോ ഫയൽ തീർപ്പാക്കലും കേരള ജനതയ്ക്ക് മെച്ചപ്പെട്ട സേവനം നൽകാൻ സഹായിക്കുന്നു.";
    }
  }

  return {
    ...briefing,
    greeting: cleanString(briefing.greeting),
    statusMessage: cleanString(briefing.statusMessage),
    briefing: cleanString(briefing.briefing),
    recommendation: cleanString(briefing.recommendation),
    priority: cleanString(briefing.priority),
    smartPriorities: cleanArray(briefing.smartPriorities),
    motivation: cleanString(motivation)
  };
}

/**
 * High-quality rule-based fallback when AI is unavailable
 */
function getLocalFallbackBriefing(data, resolvedLanguage = "english") {
  const { name, currentTime, wellnessStatus, wellnessScore, focusScore, todayTasksCount, overdueTasksCount, upcomingMeetingsCount, newCircularsCount } = data;

  const isMalayalam = resolvedLanguage === "malayalam";

  let timeGreeting = "Good Morning";
  let greetingSuffix = isMalayalam 
    ? "ഇന്നത്തെ നിങ്ങളുടെ ടാസ്കുകൾ പ്ലാൻ ചെയ്യാൻ സഹായിക്കുന്ന വിവരങ്ങൾ താഴെ നൽകുന്നു."
    : "Hope you have a productive day ahead.";
  
  try {
    const hour = data.localHour ?? new Date(currentTime).getHours();
    if (hour >= 5 && hour < 12) {
      timeGreeting = "Good Morning";
      if (!isMalayalam) {
        greetingSuffix = "Hope you have a productive day ahead.";
      }
    } else if (hour >= 12 && hour < 17) {
      timeGreeting = "Good Afternoon";
      if (!isMalayalam) {
        greetingSuffix = "Hope your day is going well. Let's continue making progress.";
      }
    } else if (hour >= 17 && hour < 21) {
      timeGreeting = "Good Evening";
      if (!isMalayalam) {
        greetingSuffix = "You're almost through today's work. Let's finish the remaining priorities.";
      }
    } else {
      timeGreeting = "Good Night";
      if (!isMalayalam) {
        greetingSuffix = "Hope you have a restful evening/night. Keep up the great work.";
      }
    }
  } catch (e) {
    // default to morning
  }

  const greeting = `${timeGreeting}, ${name} 👋\n\n${greetingSuffix}`;

  let statusMessage = isMalayalam ? "നിങ്ങളുടെ സ്റ്റാറ്റസ് പരിശോധിക്കുന്നു..." : "Checking your daily status...";
  if (wellnessStatus === "pending") {
    statusMessage = isMalayalam ? "ഇന്നത്തെ നിങ്ങളുടെ Wellness Check-in pending ആണ്." : "Your Daily Wellness check-in is pending.";
  } else if (wellnessScore >= 80) {
    statusMessage = isMalayalam 
      ? "നിങ്ങളുടെ Wellness Score-ഉം Focus Score-ഉം വളരെ നല്ലതാണ്." 
      : "You have stable energy and excellent focus capacity today.";
  } else {
    statusMessage = isMalayalam 
      ? "ഇന്ന് നിങ്ങളുടെ ടാസ്കുകൾ പതുക്കെ ചെയ്യാനും ഇടവേളകൾ എടുക്കാനും നിർദ്ദേശിക്കുന്നു." 
      : "Pacing yourself and taking regular breaks is recommended today.";
  }

  let briefing = "";
  if (isMalayalam) {
    if ((todayTasksCount || 0) === 0 && (upcomingMeetingsCount || 0) === 0 && (overdueTasksCount || 0) === 0) {
      briefing = "ഇന്നത്തേക്കായി ടാസ്കുകൾ ഷെഡ്യൂൾ ചെയ്തിട്ടില്ല, മീറ്റിംഗുകൾ ഒന്നും തന്നെയില്ല.";
    } else if (overdueTasksCount > 0) {
      const todayText = todayTasksCount > 0 ? `${todayTasksCount} ടാസ്കും ` : "";
      briefing = `നിങ്ങൾക്ക് ഇന്ന് ${todayText}${overdueTasksCount} കാലാവധി കഴിഞ്ഞ ടാസ്കുകളും ഉണ്ട്.`;
    } else if ((upcomingMeetingsCount || 0) > 0) {
      briefing = `നിങ്ങളുടെ ഇന്നത്തെ പ്രവർത്തന പട്ടിക ഇതാ: ${todayTasksCount} ടാസ്കുകൾ, ${upcomingMeetingsCount} മീറ്റിംഗുകൾ ഉണ്ട്.`;
    } else {
      briefing = `നിങ്ങൾക്ക് ഇന്ന് ${todayTasksCount} ടാസ്കുകൾ ഉണ്ട്.`;
    }
    if (newCircularsCount > 0) {
      briefing += ` കൂടാതെ നിങ്ങളുടെ വകുപ്പുമായി ബന്ധപ്പെട്ട ${newCircularsCount} പുതിയ സർക്കുലറുകളുമുണ്ട്.`;
    }
  } else {
    const taskWord = todayTasksCount === 1 ? "task" : "tasks";
    const meetingWord = upcomingMeetingsCount === 1 ? "meeting" : "meetings";
    
    if ((todayTasksCount || 0) === 0 && (upcomingMeetingsCount || 0) === 0 && (overdueTasksCount || 0) === 0) {
      briefing = "No tasks due today and no meetings scheduled today.";
    } else if (overdueTasksCount > 0) {
      const overdueTaskWord = overdueTasksCount === 1 ? "task" : "tasks";
      const todayText = todayTasksCount > 0 ? `${todayTasksCount} ${taskWord} and ` : "";
      briefing = `You have ${todayText}${overdueTasksCount} overdue ${overdueTaskWord} today.`;
    } else if ((upcomingMeetingsCount || 0) > 0) {
      briefing = `You have ${todayTasksCount} ${taskWord} due today and ${upcomingMeetingsCount} ${meetingWord} scheduled.`;
    } else {
      briefing = `You have ${todayTasksCount} ${taskWord} due today.`;
    }
    if (newCircularsCount > 0) {
      briefing += ` There are also ${newCircularsCount} new Kerala Government circulars relevant to your department.`;
    }
  }

  let recommendation = "";
  if (wellnessStatus === "pending") {
    recommendation = isMalayalam 
      ? "ദയവായി ഇന്നത്തെ Wellness Check-in പൂർത്തിയാക്കൂ, അതിലൂടെ നിങ്ങൾക്ക് അനുയോജ്യമായ നിർദ്ദേശങ്ങൾ നൽകാൻ സാധിക്കും." 
      : "Please complete today's wellness check so we can customize your focus recommendations.";
  } else if (focusScore > 80) {
    recommendation = isMalayalam 
      ? "കൂടുതൽ ശ്രദ്ധ ആവശ്യമുള്ള ഫയലുകൾ ഇന്ന് തന്നെ ചെയ്യാൻ ശ്രമിക്കുക." 
      : "With high focus capacity, tackle complex file clearances first.";
  } else {
    recommendation = isMalayalam 
      ? "സമ്മർദ്ദം കുറയ്ക്കുന്നതിനായി ഓരോ മണിക്കൂറിലും 5 മിനിറ്റ് ഇടവേള എടുക്കുക." 
      : "Make sure to schedule 5-minute stretch breaks to manage stress levels effectively.";
  }

  let priority = "";
  if (overdueTasksCount > 0) {
    priority = isMalayalam ? "ബാക്കിയുള്ള ടാസ്കുകൾ എത്രയും വേഗം പൂർത്തിയാക്കുക." : "Clear overdue planner tasks immediately.";
  } else if (newCircularsCount > 0) {
    priority = isMalayalam ? "പുതിയ വകുപ്പ് സർക്കുലറുകൾ പരിശോധിച്ച് വിലയിരുത്തുക." : "Review the newly issued departmental circulars.";
  } else {
    priority = isMalayalam ? "ഇന്നത്തെ നിങ്ങളുടെ ടാസ്കുകളും മീറ്റിംഗുകളും കൃത്യമായി പ്ലാൻ ചെയ്യുക." : "Plan your schedule and tasks for the day.";
  }

  const priorityWeight = { "High": 3, "Medium": 2, "Low": 1 };
  const allActiveTasks = [
    ...(data.todayTasksObjects || []),
    ...(data.overdueTasksObjects || [])
  ].filter(t => t.status === "Pending" || t.status === "In Progress");

  const sortedTasks = allActiveTasks.sort((a, b) => {
    const weightA = priorityWeight[a.priority] || 2;
    const weightB = priorityWeight[b.priority] || 2;
    return weightB - weightA;
  });
  
  let smartPriorities = [];
  if (sortedTasks.length > 0) {
    if (isMalayalam) {
      // Task titles are stored in English; prefix with a Malayalam action marker.
      smartPriorities = sortedTasks.slice(0, 3).map(t => `ടാസ്ക്: ${t.title}`);
    } else {
      smartPriorities = sortedTasks.slice(0, 3).map(t => t.title);
    }
  } else {
    smartPriorities = isMalayalam 
      ? ["നിങ്ങളുടെ ടാസ്കുകൾ പ്ലാൻ ചെയ്യുക", "പുതിയ സർക്കുലറുകൾ പരിശോധിക്കുക", "Wellness Status നോക്കുക"]
      : ["Plan your tasks", "Review pending circulars", "Check wellness status"];
  }

  const motivation = isMalayalam 
    ? "ഓരോ ഫയൽ തീർപ്പാക്കലും കേരള ജനതയ്ക്ക് മെച്ചപ്പെട്ട സേവനം നൽകാൻ സഹായിക്കുന്നു."
    : "Every completed task helps deliver better public services to the people of Kerala.";

  return {
    greeting,
    statusMessage,
    briefing,
    recommendation,
    priority,
    smartPriorities,
    motivation
  };
}

export default generateDailyBriefing;
