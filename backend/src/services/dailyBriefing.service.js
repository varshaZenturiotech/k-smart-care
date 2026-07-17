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
  const tasks = `${data.todayTasksCount || 0}_${(data.todayTasksList || []).join(",")}`;
  const meetings = `${data.upcomingMeetingsCount || 0}_${(data.upcomingMeetingsList || []).join(",")}`;
  const circulars = `${data.newCircularsCount || 0}_${(data.newCircularsList || []).join(",")}`;
  return `${wellness}::${tasks}::${meetings}::${circulars}`;
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
        if (err.headers) {
          if (typeof err.headers.get === "function") {
            retryAfter = err.headers.get("retry-after");
          } else {
            retryAfter = err.headers["retry-after"] || err.headers["Retry-After"];
          }
        }
        if (retryAfter) {
          const seconds = parseFloat(retryAfter);
          if (!isNaN(seconds)) {
            waitMs = seconds * 1000;
          } else {
            const date = Date.parse(retryAfter);
            if (!isNaN(date)) {
              waitMs = Math.max(0, date - Date.now());
            }
          }
        }
        console.warn(`[Daily Briefing] Groq rate limit hit (429). Waiting ${waitMs}ms before retrying (attempt ${attempt}/${maxRetries}).`);
      } else {
        console.warn(`[Daily Briefing] Transient error hit (${status || err.message}). Waiting ${waitMs}ms before retrying (attempt ${attempt}/${maxRetries}).`);
      }

      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
}

/**
 * Entrypoint: Handles simultaneous request deduplication and delegates to generation logic.
 */
export async function generateDailyBriefing(data, forceRefresh = false) {
  const employeeId = data.employeeId || "unknown";
  const resolvedLanguage = data.resolvedLanguage || "english";
  const currentDate = getLocalDateString();

  const cacheKey = `${employeeId}_${currentDate}_${resolvedLanguage}`;

  if (inFlightRequests.has(cacheKey)) {
    console.log(`[Daily Briefing] Reusing in-flight request for cacheKey: ${cacheKey}`);
    return inFlightRequests.get(cacheKey);
  }

  const promise = (async () => {
    try {
      const res = await generateDailyBriefingInternal(data, forceRefresh, currentDate, resolvedLanguage);
      if (res && Array.isArray(res.smartPriorities)) {
        res.smartPriorities = res.smartPriorities.map(item => {
          if (typeof item !== "string") return item;
          return item.replace(/^[①②③④⑤⑥⑦⑧⑨⑩\d\.\-\*\s•]+/, "").trim();
        });
      }
      return res;
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  })();

  inFlightRequests.set(cacheKey, promise);
  return promise;
}

/**
 * Internal logic for Daily Briefing generation (caching, LLM invocation, logging).
 */
async function generateDailyBriefingInternal(data, forceRefresh, currentDate, resolvedLanguage) {
  const employeeId = data.employeeId || "unknown";
  const currentFingerprint = computeInputFingerprint(data);

  // 1. Caching & Lazy Generation validation
  if (!forceRefresh) {
    try {
      const cached = await DailyBriefing.findOne({
        employeeId,
        dateString: currentDate,
        language: resolvedLanguage,
      });

      if (cached && cached.inputFingerprint === currentFingerprint) {
        console.log(`[Daily Briefing Log]:
          - Cache: HIT
          - Duration: 0ms
          - Prompt Token Estimate: 0
          - Completion Token Estimate: 0
          - Total Token Usage: 0
          - Retry Attempts: 0
        `);
        return cached.briefing;
      }
    } catch (cacheErr) {
      console.error("[Daily Briefing Cache Error]:", cacheErr);
    }
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey === "your_groq_api_key_here") {
    console.warn("GROQ_API_KEY is not configured. Returning local rule-based fallback briefing.");
    return getLocalFallbackBriefing(data, resolvedLanguage);
  }

  try {
    const llm = new ChatGroq({
      apiKey: process.env.GROQ_API_KEY,
      model: "llama-3.1-8b-instant",
      temperature: 0.5,
      maxTokens: 512, // Reduced to support compact 120-word response format
    });

    const isMl = resolvedLanguage === "malayalam";
    const department = isMl ? getMalayalamDepartment(data.department) : data.department;
    const district = isMl ? getMalayalamDistrict(data.district) : data.district;
    const wellnessStatus = isMl ? getMalayalamWellnessStatus(data.wellnessStatus) : data.wellnessStatus;
    const burnoutRisk = isMl ? getMalayalamBurnoutRisk(data.burnoutRisk) : data.burnoutRisk;

    const userPromptTemplate = `
Employee Profile & Context:
- Name: {name}
- Department: {department}
- District: {district}
- Resolved Target Language: {resolvedLanguage}
- Current Local Time: {currentTime}
- Current Local Hour (24h): {localHour} — use this to determine the English greeting prefix:
  - If 5 <= localHour < 12: Good Morning
  - If 12 <= localHour < 17: Good Afternoon
  - If 17 <= localHour < 21: Good Evening
  - Otherwise: Good Night

Today's Statistics:
- Wellness Status: {wellnessStatus}
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
3. For all other fields ("statusMessage", "briefing", "recommendation", "priority", "smartPriorities", "motivation"), you MUST write them in the target language ({resolvedLanguage}). If the target language is Malayalam, follow the Malayalam Response Style Rules: write complete sentences in Malayalam script, but keep the specific English workplace, government, and technology terms (e.g. Tasks, Meetings, Circular, Deadline, Wellness Score, etc.) in English script/characters. Do not translate them to Malayalam.
4. Return ONLY a valid JSON object starting with '{{' and ending with '}}'.

Generate a tailored response matching the requested JSON structure. Keep sentences elegant, calm, and tailored to Kerala public service context.
`;

    const fullTemplate = `${dailyBriefingSystemPrompt}\n\n${userPromptTemplate}`;
    const prompt = PromptTemplate.fromTemplate(fullTemplate);
    const parser = new StringOutputParser();
    const chain = prompt.pipe(llm).pipe(parser);

    // Limit lists and counts to prevent rate limit and token bloat (prompt size reduction)
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
    const totalTokens = promptTokens + completionTokens;

    let parsed = safeParseLLMJson(raw);
    if (!parsed.success) {
      console.warn(`[Daily Briefing JSON Parse Error]: ${parsed.error}. Retrying LLM once...`);
      const retryTemplate = `${fullTemplate}\n\nIMPORTANT: The previous output failed JSON validation. You MUST return ONLY a valid, properly escaped and fully terminated JSON object. Do not include markdown code fences, and escape all special characters properly.`;
      const retryPrompt = PromptTemplate.fromTemplate(retryTemplate);
      const retryChain = retryPrompt.pipe(llm).pipe(parser);
      const startRetry = Date.now();
      const retryRes = await invokeLlmWithRetry(retryChain, variables);
      const retryRaw = retryRes.raw;
      const retryDuration = Date.now() - startRetry;
      
      parsed = safeParseLLMJson(retryRaw);
      
      console.log(`[Daily Briefing Log]:
        - Cache: MISS
        - Duration: ${genDuration + retryDuration}ms
        - Prompt Token Estimate: ${promptTokens + estimateTokens(retryTemplate)}
        - Completion Token Estimate: ${completionTokens + estimateTokens(retryRaw)}
        - Total Token Usage: ${promptTokens + estimateTokens(retryTemplate) + completionTokens + estimateTokens(retryRaw)}
        - Retry Attempts: ${retryRes.attempt + 1}
      `);

      if (!parsed.success) {
        return getLocalFallbackBriefing(data, resolvedLanguage);
      }
    } else {
      console.log(`[Daily Briefing Log]:
        - Cache: MISS
        - Duration: ${genDuration}ms
        - Prompt Token Estimate: ${promptTokens}
        - Completion Token Estimate: ${completionTokens}
        - Total Token Usage: ${totalTokens}
        - Retry Attempts: ${attempt}
      `);
    }

    // Cache generated briefing to MongoDB
    try {
      await DailyBriefing.findOneAndUpdate(
        { employeeId, dateString: currentDate, language: resolvedLanguage },
        { inputFingerprint: currentFingerprint, briefing: parsed.data },
        { upsert: true, new: true }
      );
    } catch (cacheSaveErr) {
      console.error("[Daily Briefing Cache Save Error]:", cacheSaveErr);
    }

    return parsed.data;
  } catch (err) {
    console.error("Failed to generate AI Daily Briefing, falling back:", err);
    return getLocalFallbackBriefing(data, resolvedLanguage);
  }
}

/**
 * High-quality rule-based fallback when AI is unavailable
 */
function getLocalFallbackBriefing(data, resolvedLanguage = "english") {
  const { name, currentTime, wellnessStatus, wellnessScore, focusScore, todayTasksCount, overdueTasksCount, upcomingMeetingsCount, newCircularsCount } = data;

  const isMalayalam = resolvedLanguage === "malayalam";

  // Determine time-aware greeting using local hour
  let timeGreeting = "Good Morning";
  let greetingSuffix = isMalayalam 
    ? "ഇന്നത്തെ നിങ്ങളുടെ Tasks plan ചെയ്യാൻ സഹായിക്കുന്ന വിവരങ്ങൾ താഴെ നൽകുന്നു."
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

  // Status message
  let statusMessage = isMalayalam ? "നിങ്ങളുടെ Status പരിശോധിക്കുന്നു..." : "Checking your daily status...";
  if (wellnessStatus === "pending") {
    statusMessage = isMalayalam ? "ഇന്നത്തെ നിങ്ങളുടെ Wellness Check-in pending ആണ്." : "Your Daily Wellness check-in is pending.";
  } else if (wellnessScore >= 80) {
    statusMessage = isMalayalam 
      ? "നിങ്ങളുടെ Wellness Score-ഉം Focus Score-ഉം വളരെ നല്ലതാണ്." 
      : "You have stable energy and excellent focus capacity today.";
  } else {
    statusMessage = isMalayalam 
      ? "ഇന്ന് നിങ്ങളുടെ Tasks പതുക്കെ ചെയ്യാനും Breaks എടുക്കാനും Recommendation ചെയ്യുന്നു." 
      : "Pacing yourself and taking regular breaks is recommended today.";
  }

  // Briefing
  let briefing = "";
  if (isMalayalam) {
    briefing = `ഇന്ന് നിങ്ങൾക്ക് ചെയ്യേണ്ട ${todayTasksCount || 0} Tasks-ഉം Schedule ചെയ്ത ${upcomingMeetingsCount || 0} Meetings-ഉമുണ്ട്.`;
    if (overdueTasksCount > 0) {
      briefing += ` അതിൽ നിങ്ങളുടെ അടിയന്തിര ശ്രദ്ധ ആവശ്യമുള്ള ${overdueTasksCount} Tasks Pending ആണ്.`;
    }
    if (newCircularsCount > 0) {
      briefing += ` കൂടാതെ നിങ്ങളുടെ Department-മായി ബന്ധപ്പെട്ട ${newCircularsCount} പുതിയ Circulars-ഉമുണ്ട്.`;
    }
  } else {
    briefing = `You have ${todayTasksCount || 0} task(s) due today and ${upcomingMeetingsCount || 0} meeting(s) scheduled.`;
    if (overdueTasksCount > 0) {
      briefing += ` Note that you have ${overdueTasksCount} overdue task(s) needing immediate attention.`;
    }
    if (newCircularsCount > 0) {
      briefing += ` There are also ${newCircularsCount} new Kerala Government circulars relevant to your department.`;
    }
  }

  // Recommendation
  let recommendation = "";
  if (wellnessStatus === "pending") {
    recommendation = isMalayalam 
      ? "ദയവായി ഇന്നത്തെ Wellness Check-in പൂർത്തിയാക്കൂ, അതിലൂടെ നിങ്ങൾക്ക് അനുയോജ്യമായ Recommendations തരാൻ സാധിക്കും." 
      : "Please complete today's wellness check so we can customize your focus recommendations.";
  } else if (focusScore > 80) {
    recommendation = isMalayalam 
      ? "കൂടുതൽ Focus ആവശ്യമുള്ള Files ഇന്ന് തന്നെ ചെയ്യാൻ ശ്രമിക്കുക." 
      : "With high focus capacity, tackle complex file clearances first.";
  } else {
    recommendation = isMalayalam 
      ? "Stress കുറയ്ക്കുന്നതിനായി ഓരോ മണിക്കൂറിലും 5 minutes Stretch ചെയ്യുക." 
      : "Make sure to schedule 5-minute stretch breaks to manage stress levels effectively.";
  }

  // Priority
  let priority = "";
  if (overdueTasksCount > 0) {
    priority = isMalayalam ? "Pending Tasks എത്രയും വേഗം പൂർത്തിയാക്കുക." : "Clear overdue planner tasks immediately.";
  } else if (newCircularsCount > 0) {
    priority = isMalayalam ? "പുതിയ Department Circulars Review ചെയ്യുക." : "Review the newly issued departmental circulars.";
  } else {
    priority = isMalayalam ? "ഇന്നത്തെ നിങ്ങളുടെ Tasks-ഉം Meetings-ഉം കൃത്യമായി plan ചെയ്യുക." : "Plan your schedule and tasks for the day.";
  }

  // Smart Priorities List
  const priorityWeight = { "High": 3, "Medium": 2, "Low": 1 };
  const sortedTasks = (data.todayTasksObjects || []).sort((a, b) => {
    const weightA = priorityWeight[a.priority] || 2;
    const weightB = priorityWeight[b.priority] || 2;
    return weightB - weightA;
  });
  
  let smartPriorities = [];
  if (sortedTasks.length > 0) {
    smartPriorities = sortedTasks.slice(0, 3).map(t => t.title);
  } else {
    smartPriorities = isMalayalam 
      ? ["നിങ്ങളുടെ Tasks plan ചെയ്യുക", "പുതിയ Circulars Review ചെയ്യുക", "Wellness Status check ചെയ്യുക"]
      : ["Plan your tasks", "Review pending circulars", "Check wellness status"];
  }

  // Motivation
  const motivation = isMalayalam 
    ? "ഓരോ File clearance-ഉം കേരളത്തിലെ ജനങ്ങൾക്ക് മികച്ച സർക്കാർ സേവനം നൽകാൻ സഹായിക്കുന്നു."
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
