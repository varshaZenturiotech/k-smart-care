import { ChatGroq } from "@langchain/groq";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import WellnessCheck from "../models/WellnessCheck.model.js";
import { calculateScores } from "./wellnessScoring.service.js";
import { safeParseLLMJson } from "../utils/safeParseLLMJson.js";
import dotenv from "dotenv";

dotenv.config();

function hasGroqKey() {
  const apiKey = process.env.GROQ_API_KEY;
  return apiKey && apiKey !== "your_groq_api_key_here" && apiKey.trim() !== "";
}

/**
 * Get date string (YYYY-MM-DD) for local server time
 */
export function getLocalDateString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Get wellness status of the employee for today
 */
export async function getTodayStatus(employeeId) {
  const dateString = getLocalDateString();
  const wellnessCheck = await WellnessCheck.findOne({ employeeId, dateString });

  if (!wellnessCheck) {
    return { completed: false, status: "pending", data: null };
  }

  return {
    completed: wellnessCheck.status === "completed",
    status: wellnessCheck.status,
    data: wellnessCheck,
  };
}

/**
 * Record a skipped check-in for today
 */
export async function skipToday(employeeId) {
  const dateString = getLocalDateString();

  const wellnessCheck = await WellnessCheck.findOneAndUpdate(
    { employeeId, dateString },
    {
      $set: {
        status: "skipped",
        date: new Date(),
      },
    },
    { upsert: true, new: true }
  );

  return { success: true, status: "skipped", data: wellnessCheck };
}

/**
 * Submit answers and generate scores & AI recommendations
 */
export async function submitCheckin(employeeId, answers, requestLanguage) {
  const { mood, sleepHours, energy, stress, workload, note } = answers;
  const dateString = getLocalDateString();

  // Retrieve user to parse preferredLanguage and employeeName
  const User = (await import("../models/User.model.js")).default;
  const user = await User.findById(employeeId);
  const preferredLanguage = user?.preferredLanguage || "auto";
  const employeeName = user?.name || "Employee";
  const structuralMetadata = {
    designation: user?.designation || "Panchayat Secretary",
    department: user?.department || "Local Self Government",
    district: user?.district || "Thiruvananthapuram"
  };

  // Resolve language (prioritize requestLanguage/header over stored database preferredLanguage)
  let resolvedLanguage = "english";
  if (requestLanguage === "ml" || requestLanguage === "malayalam" || requestLanguage === "en" || requestLanguage === "english") {
    resolvedLanguage = (requestLanguage === "ml" || requestLanguage === "malayalam") ? "malayalam" : "english";
  } else if (preferredLanguage && preferredLanguage !== "auto") {
    resolvedLanguage = preferredLanguage;
  } else {
    // Detect if the note or mood contains Malayalam Unicode chars
    const containsMalayalam = /[\u0D00-\u0D7F]/.test((note || "") + " " + (mood || ""));
    resolvedLanguage = containsMalayalam ? "malayalam" : "english";
  }

  // 1. Calculate deterministic scores
  const { wellnessScore, focusScore, burnoutRisk } = calculateScores({
    mood,
    sleepHours,
    energy,
    stress,
    workload,
  });

  // 2. Generate AI summary and recommendations
  let aiData;
  if (!hasGroqKey()) {
    console.warn("GROQ_API_KEY is not configured. Using local wellness recommendations fallback.");
    aiData = getLocalFallbackAI({ mood, sleepHours, energy, stress, workload, note }, resolvedLanguage);
  } else {
    try {
      aiData = await generateAIRecommendations({
        mood,
        sleepHours,
        energy,
        stress,
        workload,
        note,
        preferredLanguage,
        employeeName,
        structuralMetadata,
        resolvedLanguage
      });
    } catch (err) {
      console.error("Failed to generate AI recommendations, using local fallback:", err);
      aiData = getLocalFallbackAI({ mood, sleepHours, energy, stress, workload, note }, resolvedLanguage);
    }
  }

  // 3. Save to database (Upsert)
  const wellnessCheck = await WellnessCheck.findOneAndUpdate(
    { employeeId, dateString },
    {
      $set: {
        status: "completed",
        mood,
        sleepHours,
        energy,
        stress,
        workload,
        note,
        wellnessScore,
        focusScore,
        burnoutRisk,
        aiSummary: aiData.summary,
        recommendations: [
          `Focus Suggestion: ${aiData.focusSuggestion}`,
          `Wellbeing Tip: ${aiData.wellbeingTip}`,
          `Motivation: ${aiData.motivation}`,
          ...(aiData.recommendations || []),
        ],
        date: new Date(),
      },
    },
    { upsert: true, new: true }
  );

  return wellnessCheck;
}

/**
 * Get historical wellness checks for an employee
 */
export async function getHistory(employeeId) {
  return await WellnessCheck.find({ employeeId })
    .sort({ dateString: -1 })
    .limit(30); // limit to last 30 days
}

/**
 * AI Recommendation Generator using LangChain and ChatGroq
 */
const getMalayalamMood = (m) => {
  switch (m?.toLowerCase()) {
    case "great": return "വളരെ നല്ലത്";
    case "good": return "നല്ലത്";
    case "okay": return "കുഴപ്പമില്ല";
    case "tired": return "ക്ഷീണം";
    case "overwhelmed": return "അതിയായ സമ്മർദ്ദം";
    default: return m;
  }
};

const getMalayalamEnergy = (e) => {
  switch (e?.toLowerCase()) {
    case "very low": return "വളരെ കുറവ്";
    case "low": return "കുറവ്";
    case "moderate": return "മിതത്വം";
    case "high": return "കൂടുതൽ";
    case "excellent": return "മികച്ചത്";
    default: return e;
  }
};

const getMalayalamStress = (s) => {
  switch (s?.toLowerCase()) {
    case "very low": return "വളരെ കുറവ്";
    case "low": return "കുറവ്";
    case "moderate": return "മിതത്വം";
    case "high": return "കൂടുതൽ";
    case "very high": return "വളരെ കൂടുതൽ";
    default: return s;
  }
};

const getMalayalamWorkload = (w) => {
  switch (w?.toLowerCase()) {
    case "light": return "കുറവ്";
    case "normal": return "സാധാരണം";
    case "heavy": return "കൂടുതൽ";
    case "very heavy": return "വളരെ കൂടുതൽ";
    default: return w;
  }
};

const getMalayalamDepartment = (d) => {
  if (!d) return "";
  return d.endsWith("Department") ? d : d + " Department";
};

const getMalayalamDesignation = (d) => {
  return d;
};

const getMalayalamDistrict = (d) => {
  if (!d) return "";
  return d.endsWith("District") ? d : d + " District";
};

/**
 * AI Recommendation Generator using LangChain and ChatGroq
 */
async function generateAIRecommendations({
  mood,
  sleepHours,
  energy,
  stress,
  workload,
  note,
  preferredLanguage,
  employeeName,
  structuralMetadata,
  resolvedLanguage
}) {
  const isMl = resolvedLanguage === "malayalam";

  // Pre-translate contextual labels to reinforce target language behavior in LLM context
  const designationVal = structuralMetadata?.designation || "Panchayat Secretary";
  const departmentVal = structuralMetadata?.department || "Local Self Government";
  const districtVal = structuralMetadata?.district || "Thiruvananthapuram";

  const designation = isMl ? getMalayalamDesignation(designationVal) : designationVal;
  const department = isMl ? getMalayalamDepartment(departmentVal) : departmentVal;
  const district = isMl ? getMalayalamDistrict(districtVal) : districtVal;

  const moodVal = isMl ? getMalayalamMood(mood) : mood;
  const energyVal = isMl ? getMalayalamEnergy(energy) : energy;
  const stressVal = isMl ? getMalayalamStress(stress) : stress;
  const workloadVal = isMl ? getMalayalamWorkload(workload) : workload;

  const jsonStructure = isMl
    ? `{
  "summary": "[ഇവിടെ മലയാളത്തിൽ എഴുതുക, e.g. നിങ്ങളുടെ Wellness Score ഇന്ന് വളരെ നല്ലതാണ്.]",
  "focusSuggestion": "[ഇവിടെ മലയാളത്തിൽ എഴുതുക, e.g. Focus Score മെച്ചപ്പെടുത്താൻ Tasks ചെറിയ ഭാഗങ്ങളായി തിരിക്കുക.]",
  "wellbeingTip": "[ഇവിടെ മലയാളത്തിൽ എഴുതുക, e.g. 5 മിനിറ്റ് screen-free walk ചെയ്യൂ.]",
  "motivation": "[ഇവിടെ മലയാളത്തിൽ എഴുതുക: ജീവനക്കാരനെ പ്രോത്സാഹിപ്പിക്കുന്നതിനുള്ള നല്ലൊരു വാക്ക്]",
  "recommendations": ["[ഇവിടെ മലയാളത്തിൽ എഴുതുക: ഇന്ന് ചെയ്യാവുന്ന Recommendation 1]", "[ഇവിടെ മലയാളത്തിൽ എഴുതുക: ഇന്ന് ചെയ്യാവുന്ന Recommendation 2]"]
}`
    : `{
  "summary": "A brief 1-2 sentence summary of the employee's current state based on their inputs",
  "focusSuggestion": "A practical recommendation to maintain focus and manage their tasks today",
  "wellbeingTip": "A physical or mental health exercise/action to try during working hours",
  "motivation": "A short, warm encouraging quote or phrase to motivate the employee",
  "recommendations": ["A list of 2-3 specific, actionable steps they can take today"]
}`;

  const promptTemplate = `You are the K-SMART CARE Wellbeing Assistant.
You support Kerala Government employees.
You do not diagnose medical conditions.
Provide practical workplace wellbeing recommendations.
Return JSON.

Employee context:
- Name: {employeeName}
- Designation: {designation}
- Department: {department}
- District: {district}
- Resolved Target Language: {resolvedLanguage}

Employee answers:
- Mood: {mood}
- Sleep: {sleepHours} hours
- Energy: {energy}
- Stress: {stress}
- Workload: {workload}
- Note/Comment: {note}
IMPORTANT: You MUST generate all text fields directly in the target language: {resolvedLanguage}.
If the target language is Malayalam, follow the Malayalam Response Style Rules:
- Write complete sentences in Malayalam script, but keep common office/workplace terminology in English (using English script/characters).
- DO NOT translate the following words into Malayalam (neither to phonetic Malayalam script like ടാസ്ക്/റിപ്പോർട്ട് nor to literal Malayalam like യോഗം/അവസാന തീയതി). They MUST be written in English characters:
  * AI
  * Dashboard
  * Task
  * Tasks
  * Meeting
  * Meetings
  * Reminder
  * Notification
  * Notifications
  * Profile
  * Settings
  * Department
  * District
  * Circular
  * Circular Summary
  * Meeting Summary
  * Daily Briefing
  * Wellness
  * Wellness Score
  * Focus Score
  * Burnout Score
  * Stress Score
  * Report
  * Document
  * Priority
  * Deadline
  * Status
  * Assistant
  * Chat
  * Search
  * Upload
  * Download
  * Login
  * Logout
  * Session
  * Calendar
  * PDF
  * Email
  * Password
  * OTP
  * Admin
  * Employee
  * Official Portal
  * Government Order
  * Online
  * Offline
- Do NOT use Manglish (writing Malayalam words in English script). Write Malayalam words in Malayalam script and English words in English script.
- Sentence structure must remain Malayalam, but the specific English terms must remain in English script/characters.
- Example correct output:
  * "ഇന്ന് 2 Tasks pending ഉണ്ട്."
  * "ഈ Circular ഇന്ന് വായിക്കുന്നത് നല്ലതാണ്."
  * "Meeting 2 PM ന് Town Hall ൽ ആണ്."
  * "Report submit ചെയ്യാൻ ഇനി 3 മണിക്കൂർ മാത്രം ബാക്കി."
  * "ഇന്നത്തെ AI Briefing നോക്കൂ."
  * "നിങ്ങളുടെ Wellness Score ഇന്നലെക്കാൾ മെച്ചപ്പെട്ടിട്ടുണ്ട്."
  * "Focus Score വളരെ നല്ലതാണ്."
  * "നിങ്ങളുടെ Wellness Score ഇന്ന് വളരെ നല്ലതാണ്."
  * "Circular Summary വായിക്കാൻ മറക്കരുത്."
- Tone should sound like how Kerala Government employees naturally communicate in offices and professional conversations (professional, friendly, and encouraging).

Return a JSON object with this exact structure:
{jsonStructure}

Do not include any explanation, code blocks, or markdown formatting in your response. Start with '{{' and end with '}}'.

JSON:`;

  const llm = new ChatGroq({
    apiKey: process.env.GROQ_API_KEY,
    model: "llama-3.1-8b-instant",
    temperature: 0.5,
    maxTokens: 1024, // Increased to support rich Malayalam without truncation
  });

  const prompt = PromptTemplate.fromTemplate(promptTemplate);
  const parser = new StringOutputParser();
  const chain = prompt.pipe(llm).pipe(parser);

  const variables = {
    mood: moodVal,
    sleepHours,
    energy: energyVal,
    stress: stressVal,
    workload: workloadVal,
    note: note || (isMl ? "ഒന്നുമില്ല" : "None"),
    employeeName,
    resolvedLanguage,
    designation,
    department,
    district,
    jsonStructure,
  };

  const raw = await chain.invoke(variables);

  let parsed = safeParseLLMJson(raw);
  if (!parsed.success) {
    console.warn(`[Wellness Recommendations JSON Parse Error]: ${parsed.error}. Retrying LLM once...`);
    console.warn(`[Wellness Recommendations] Raw output was: ${raw}`);

    // Retry with stronger instructions
    const retryTemplate = `${promptTemplate}\n\nIMPORTANT: The previous output failed JSON validation. You MUST return ONLY a valid, properly escaped and fully terminated JSON object. Do not include markdown code fences (like \`\`\`json), do not include any preamble/explanations, do not leave any strings unterminated, and escape all special characters properly.`;
    const retryPrompt = PromptTemplate.fromTemplate(retryTemplate);
    const retryChain = retryPrompt.pipe(llm).pipe(parser);
    const retryRaw = await retryChain.invoke(variables);

    parsed = safeParseLLMJson(retryRaw);
    if (!parsed.success) {
      console.error(`[Wellness Recommendations JSON Parse Retry Error]: ${parsed.error}.`);
      console.error(`[Wellness Recommendations] Retry raw output was: ${retryRaw}`);
      throw new Error(`JSON parsing failed after retry: ${parsed.error}`);
    }
  }

  return parsed.data;
}

/**
 * Local rule-based fallback when AI is unavailable
 */
function getLocalFallbackAI({ mood, sleepHours, energy, stress, workload, note }, resolvedLanguage = "english") {
  let summary = "";
  let focusSuggestion = "";
  let wellbeingTip = "";
  let motivation = "";
  let recommendations = [];

  const isMalayalam = resolvedLanguage === "malayalam";

  if (mood === "overwhelmed" || stress === "Very High" || stress === "High") {
    if (isMalayalam) {
      summary = "ഇന്ന് നിങ്ങളുടെ Stress Level വളരെ കൂടുതലായി കാണുന്നു. Rest-ന് Priority നൽകുക.";
      focusSuggestion = "Tasks ചെറിയ ഭാഗങ്ങളായി തിരിക്കുക. Burnout ഒഴിവാക്കാൻ Pomodoro method (25 minutes work, 5 minutes rest) ഉപയോഗിക്കുക.";
      wellbeingTip = "ഇപ്പോൾ തന്നെ 3 Deep Breaths എടുക്കുക. തോളുകൾക്ക് Relax നൽകുക.";
      motivation = "ക്ഷമയും ചെറിയ steps-ഉം ഏറ്റവും busy ആയ ദിവസങ്ങളെയും എളുപ്പമാക്കും.";
      recommendations = [
        "ഇന്നത്തെ work hours-ന് കൃത്യമായ Deadline നിശ്ചയിക്കുക.",
        "Priority കുറഞ്ഞ ഏതെങ്കിലും ഒരു Task നാളത്തേക്ക് മാറ്റിവയ്ക്കുക.",
        "Lunch-ന് ശേഷം 5 minutes Screen-free walk ചെയ്യൂ.",
      ];
    } else {
      summary = "You seem to be carrying a heavy stress load or feeling overwhelmed today. Pacing yourself is crucial.";
      focusSuggestion = "Break your workday into small chunks. Use the Pomodoro technique (25 mins work, 5 mins rest) to avoid mental exhaustion.";
      wellbeingTip = "Take 3 slow, deep belly breaths right now. Release your shoulders away from your ears.";
      motivation = "Patience and small steps will get you through the busiest days.";
      recommendations = [
        "Set boundary guidelines for your work hours today.",
        "Identify one low-priority task and push it to tomorrow.",
        "Take a brief 5-minute screen-free walk after lunch.",
      ];
    }
  } else if (mood === "tired" || energy === "Very Low" || energy === "Low" || sleepHours === "<4") {
    if (isMalayalam) {
      summary = "ക്ഷീണം കാരണം നിങ്ങളുടെ Energy Level ഇന്ന് കുറവാണ്.";
      focusSuggestion = "കൂടുതൽ Focus ആവശ്യമുള്ള Tasks രാവിലെ തന്നെ ചെയ്യുക, വൈകുന്നേരത്തേക്ക് simple ജോലികൾ മാറ്റിവയ്ക്കുക.";
      wellbeingTip = "എഴുന്നേറ്റ് നിന്ന് ശരീരം പതുക്കെ ഒന്ന് Stretch ചെയ്യുക. ഒരു glass വെള്ളം കുടിക്കുക.";
      motivation = "നിങ്ങളുടെ ശരീരത്തിന്റെ ആവശ്യങ്ങൾ മനസ്സിലാക്കി sustainable pace-ൽ പ്രവർത്തിക്കുക.";
      recommendations = [
        "Lunch-ന് ശേഷം caffeine ഒഴിവാക്കുക.",
        "ഇന്ന് വൈകുന്നേരം നേരത്തെ rest ചെയ്യാൻ തയ്യാറെടുക്കുക.",
        "എല്ലാ മണിക്കൂറിലും വെള്ളം കുടിക്കാൻ Reminder വയ്ക്കുക.",
      ];
    } else {
      summary = "Your energy levels are low today, likely due to fatigue or insufficient sleep.";
      focusSuggestion = "Tackle complex analytical tasks in the morning when focus is highest, and transition to lighter administrative duties later.";
      wellbeingTip = "Stand up and do a gentle full-body stretch. Stay hydrated by drinking a glass of water.";
      motivation = "Listen to your body and give yourself permission to move at a steady, sustainable pace.";
      recommendations = [
        "Avoid heavy caffeine intake late in the afternoon.",
        "Plan for an early, restful evening routine tonight.",
        "Set a reminder to drink water every hour.",
      ];
    }
  } else {
    if (isMalayalam) {
      summary = "നിങ്ങൾ നല്ല Energy Level-ഓടെയാണ് ഇന്ന് ദിവസം ആരംഭിക്കുന്നത്.";
      focusSuggestion = "Wellness Score-ഉം Energy Level-ഉം നല്ലതായതിനാൽ, ഇന്ന് complex ഫയലുകളോ വെല്ലുവിളി നിറഞ്ഞ Tasks-ഓ ഏറ്റെടുക്കാൻ പറ്റിയ ദിവസമാണ്.";
      wellbeingTip = "സഹപ്രവർത്തകരുമായി നല്ലൊരു വാക്ക് share ചെയ്തുകൊണ്ട് ഈ നല്ല Mood നിലനിർത്തുക.";
      motivation = "ഇന്നത്തെ Focus പരമാവധി പ്രയോജനപ്പെടുത്തുക, എന്നാൽ ഇടയ്ക്ക് rest ചെയ്യാൻ മറക്കരുത്.";
      recommendations = [
        "ഇന്നത്തെ പ്രധാന Tasks-ലെയോ goals-ലെയോ പുരോഗതി രേഖപ്പെടുത്തി വെക്കുക.",
        "Distractions ഒഴിവാക്കാൻ workspace വൃത്തിയായി സൂക്ഷിക്കുക.",
        "ഈ ആഴ്ചയിലെ നിങ്ങളുടെ Priorities plan ചെയ്യാൻ 10 minutes ചിലവഴിക്കുക.",
      ];
    } else {
      summary = "You are starting the day with stable energy and a positive outlook.";
      focusSuggestion = "With good energy levels, today is a great day to tackle challenging projects or creative problem-solving.";
      wellbeingTip = "Maintain this positive momentum by sharing a word of encouragement with a colleague.";
      motivation = "Make the most of today's focus, but don't forget to take regular intervals of rest.";
      recommendations = [
        "Document your progress on key goals today.",
        "Keep a clean workspace to minimize distractions.",
        "Spend 10 minutes planning your priorities for the rest of the week.",
      ];
    }
  }

  return {
    summary,
    focusSuggestion,
    wellbeingTip,
    motivation,
    recommendations,
  };
}
