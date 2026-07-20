import { intentRouter } from "./intentRouter.js";
import { crisisDetector } from "./crisisDetector.js";
import { ragChainService } from "../ragChain.service.js";
import { promptBuilder, getPromptFileName } from "./promptBuilder.js";
import { llmService } from "./llm.service.js";
import { wellbeingService } from "./wellbeing.service.js";
import { translationService } from "./translation.service.js";
import { suggestionService } from "./suggestion.service.js";
import {
  conversationMemory,
  WELLBEING_CHOICES,
  WELLBEING_CLARIFICATION_CHOICES,
  BREATHING_POST_CHECKIN_CHOICES,
  EMAIL_CHOICES,
  matchOptionSelection,
} from "./conversationMemory.js";
import { formatAssistantResponse } from "../../utils/responseFormatter.js";
import { resolveResponseLanguage } from "../../utils/language.js";
import { INTENTS } from "../../constants/intents.js";

/**
 * Clean Architecture Orchestrator Service for K-SMART CARE AI Assistant.
 * Routes user queries through deterministic safety checks, intent classification,
 * RAG pipeline, stateful conversation continuation, and response formatting.
 */
class AssistantService {
  /**
   * Main orchestration method for processing user messages.
   * @param {string} question
   * @param {{ circularId?: string, preferredLanguage?: string, userId?: string, allowGeneralKnowledge?: boolean, history?: Array, sessionId?: string }} options
   * @returns {Promise<Object>} Formatted assistant response
   */
  async askQuestion(
    question = "",
    { circularId, preferredLanguage = "auto", userId, allowGeneralKnowledge = false, history = [], sessionId = "default-session" } = {}
  ) {
    if (!question || typeof question !== "string" || !question.trim()) {
      return formatAssistantResponse({
        answer: "Please provide a valid query.",
      });
    }

    // Sync client history if provided
    if (Array.isArray(history) && history.length > 0) {
      conversationMemory.setHistory(sessionId, history);
    }

    const session = conversationMemory.getSession(sessionId);

    // Step 1: Deterministic Crisis Detection (Runs BEFORE any LLM or RAG call)
    const crisisCheck = crisisDetector.detect(question);
    if (crisisCheck.isCrisis) {
      console.log(`[Crisis Detector] Hardcoded safety protocol triggered for user question.`);
      const res = formatAssistantResponse(crisisCheck.response);
      conversationMemory.addMessage(sessionId, "user", question);
      conversationMemory.addMessage(sessionId, "assistant", res.answer);
      return res;
    }

    // Step 2: Language Resolution
    const effectiveLanguage = resolveResponseLanguage(question, preferredLanguage);
    const isMalayalam = effectiveLanguage === "malayalam";

    // Step 2.5: Check Conversation Closing Intent (e.g. "Thank you", "Thanks", "That's all", "Bye")
    const initialIntentCheck = intentRouter.classify(question, { circularId });
    if (initialIntentCheck === INTENTS.CONVERSATION_CLOSING) {
      console.log(`[Conversation Closing] Recognized end of conversation from user message: "${question}"`);

      // Reset all active session pending states
      conversationMemory.updateState(sessionId, {
        currentIntent: null,
        pendingAction: null,
        awaitingChoice: false,
        availableOptions: [],
        awaitingConfirmation: false,
      });

      const closingAnswer = isMalayalam
        ? `തീർച്ചയായും! സന്തോഷത്തോടെ ജോലി ചെയ്യുക. താങ്കളുടെ ആരോഗ്യം നന്നായി ശ്രദ്ധിക്കുക, ആവശ്യമായ ഇടവേളകൾ എടുക്കുക. ഭാവിയിൽ ജോലി സംബന്ധമായ വിവരങ്ങൾക്കോ, ഔദ്യോഗിക സർക്കുലറുകൾക്കോ, മാനസിക ക്ഷേമത്തിനോ സഹായം വേണമെങ്കിൽ ഞാൻ ഇവിടെയുണ്ടാകും. നല്ലൊരു ദിവസം ആശംസിക്കുന്നു!`
        : `You're very welcome! I hope you feel better soon. Take care of yourself, and remember to take breaks when you need them. If you need help in the future—whether it's with your work, government circulars, or workplace wellbeing—I'll be here to help.`;

      const res = formatAssistantResponse({
        type: "general_answer",
        mode: "general_knowledge",
        answer: closingAnswer,
        options: [],
        suggestions: [],
        usedGeneralKnowledge: true,
      });

      conversationMemory.addMessage(sessionId, "user", question);
      conversationMemory.addMessage(sessionId, "assistant", res.answer);
      return res;
    }

    // Step 3: Match Structured Option Selections (by ID, Number "1"/"2", or Label)
    const activeOptions = session.state.availableOptions || [];
    const matchedOption = matchOptionSelection(question, activeOptions);

    if (matchedOption) {
      console.log(`[Conversation] Matched Choice Option: ${matchedOption.id} (${matchedOption.label})`);
      
      let res;
      const optId = matchedOption.id || "";

      if (optId === "physical_health") {
        conversationMemory.updateState(sessionId, { awaitingChoice: true, availableOptions: EMAIL_CHOICES });
        const answer = isMalayalam
          ? `നിങ്ങൾക്ക് ശാരീരികമായി അസ്വസ്ഥതയുള്ളതിൽ വിഷമമുണ്ട്.\n\nശരീരം അമിതമായി ആയാസപ്പെടുത്തതിരിക്കുക, ആവശ്യത്തിന് വിശ്രമിക്കുകയും വെള്ളം കുടിക്കുകയും ചെയ്യുക. രോഗലക്ഷണങ്ങൾ നിങ്ങളുടെ ജോലിയെ ബാധിക്കുന്നുണ്ടെങ്കിൽ ലീവ് എടുക്കുന്നത് പരിഗണിക്കുക.\n\nലീവ് ആപ്ലിക്കേഷൻ ഇമെയിൽ തയ്യാറാക്കാൻ സഹായം വേണമെന്നുണ്ടോ?`
          : `I'm sorry you're feeling physically unwell. Please avoid overexerting yourself today.\n\nIf possible, take short breaks, stay hydrated, and take things easy. If your symptoms are affecting your ability to work, consider informing your supervisor and taking appropriate leave if needed.\n\nWould you like me to help draft a leave application email for you?`;
        res = formatAssistantResponse({
          type: "wellbeing_advice",
          mode: "general_knowledge",
          answer,
          options: EMAIL_CHOICES,
          usedGeneralKnowledge: true,
        });
      } else if (optId === "work_stress") {
        conversationMemory.updateState(sessionId, {
          awaitingChoice: false,
          availableOptions: [],
          pendingAction: "BREATHING_EXERCISE",
          awaitingConfirmation: true,
        });
        const answer = isMalayalam
          ? `ജോലിഭാരം കാരണം സ്ട്രെസ്സ് ഉള്ളതായി തോന്നുന്നതിൽ വിഷമമുണ്ട്.\n\nജോലി സമ്മർദ്ദം കൂടുതലാവുമ്പോൾ സ്ട്രെസ്സ് ഉണ്ടാകുന്നത് സ്വാഭാവികമാണ്. ചെറിയൊരു ഇടവേളയെടുക്കുക, കാര്യങ്ങൾ ഓരോന്നായി സാവധാനം ചെയ്യുക.\n\n1 മിനിറ്റ് ശ്വാസകോശ വ്യായാമം (Breathing Exercise) ചെയ്യാൻ സഹായിക്കണോ?`
          : `I'm sorry you're feeling stressed because of work.\n\nWork pressure can become overwhelming, especially during busy periods. Taking a short break, prioritizing today's most important tasks, and pacing yourself can often help.\n\nWould you like me to guide you through a quick one-minute breathing exercise right now?`;
        res = formatAssistantResponse({
          type: "wellbeing_advice",
          mode: "general_knowledge",
          answer,
          usedGeneralKnowledge: true,
        });
      } else if (optId === "tiredness") {
        const choices = [{ id: "prioritize", label: "📋 Prioritize Today's Tasks" }];
        conversationMemory.updateState(sessionId, { awaitingChoice: true, availableOptions: choices });
        const answer = isMalayalam
          ? `ക്ഷീണം തോന്നുന്നത് ശരീരം വിശ്രമം ആവശ്യപ്പെടുന്നതിന്റെ സൂചനയാണ്. സ്ക്രീനിൽ നിന്ന് 5 മിനിറ്റ് മാറി നിൽക്കുക, ശുദ്ധവായു ശ്വസിക്കുക.\n\nഇന്നത്തെ ഏറ്റവും പ്രധാനപ്പെട്ട ടാസ്കുകൾ മാത്രം പ്ലാൻ ചെയ്ത് കാര്യങ്ങൾ എളുപ്പമാക്കണോ?`
          : `Feeling exhausted is a clear signal from your body that you need rest. Take a 5-minute break away from screens, stretch, and sip some water.\n\nWould you like help prioritizing today's urgent tasks so you can lighten your workload?`;
        res = formatAssistantResponse({
          type: "wellbeing_advice",
          mode: "general_knowledge",
          answer,
          options: choices,
          usedGeneralKnowledge: true,
        });
      } else if (optId === "something_else") {
        conversationMemory.updateState(sessionId, { awaitingChoice: false, availableOptions: [] });
        const answer = isMalayalam
          ? `ഞാൻ കേൾക്കാൻ തയ്യാറാണ്. എന്താണ് താങ്കളെ അലട്ടുന്നത് എന്ന് പങ്കുവെക്കാമോ?`
          : `I'm here to support you. Please feel free to tell me what's on your mind.`;
        res = formatAssistantResponse({
          type: "wellbeing_advice",
          mode: "general_knowledge",
          answer,
          usedGeneralKnowledge: true,
        });
      } else if (optId === "done" || optId === "completed") {
        conversationMemory.updateState(sessionId, {
          pendingAction: null,
          awaitingChoice: true,
          availableOptions: BREATHING_POST_CHECKIN_CHOICES,
          awaitingConfirmation: true,
        });
        const answer = isMalayalam
          ? `ശ്വാസകോശ വ്യായാമം പൂർത്തിയാക്കിയതിന് അഭിനന്ദനങ്ങൾ! 🌟\n\nഇപ്പോൾ എങ്ങനെയുണ്ട്? താങ്കളുടെ അവസ്ഥ താഴെ പറയുന്ന ഓപ്ഷനുകളിൽ നിന്നും തിരഞ്ഞെടുക്കുക:`
          : `Great job completing the breathing exercise! 🌟\n\nHow are you feeling now?`;
        res = formatAssistantResponse({
          type: "choice",
          mode: "general_knowledge",
          answer,
          message: isMalayalam ? "ഇപ്പോൾ എങ്ങനെ തോന്നുന്നു?" : "How are you feeling now?",
          options: BREATHING_POST_CHECKIN_CHOICES,
          usedGeneralKnowledge: true,
        });
      } else if (optId === "feeling_better") {
        conversationMemory.updateState(sessionId, { awaitingChoice: false, availableOptions: [] });
        const answer = isMalayalam
          ? `സന്തോഷം! ചെറുതായി ആശ്വാസം ലഭിച്ചതിൽ സന്തോഷം. ഇന്ന് ഓരോ കാര്യങ്ങളായി പതുക്കെ ചെയ്യുക. എന്തെങ്കിലും സഹായം വേണമെങ്കിൽ ചോദിക്കാം.`
          : `I'm glad to hear you're feeling better and ready! Remember to pace yourself today, stay hydrated, and take short micro-breaks when needed. Let me know if you need any assistance with your tasks!`;
        res = formatAssistantResponse({
          type: "wellbeing_advice",
          mode: "general_knowledge",
          answer,
          usedGeneralKnowledge: true,
        });
      } else if (optId === "still_stressed") {
        const choices = [
          { id: "talk", label: "💬 Talk About My Stress" },
          { id: "prioritize", label: "📋 Prioritize Today's Tasks" },
        ];
        conversationMemory.updateState(sessionId, { awaitingChoice: true, availableOptions: choices });
        const answer = isMalayalam
          ? `അല്പം കൂടി സ്ട്രെസ് ബാക്കിയുണ്ടെങ്കിലും കുഴപ്പമില്ല. നിങ്ങളുടെ സ്ട്രെസ്സിന് കാരണമായ കാര്യങ്ങളെക്കുറിച്ച് സംസാരിക്കണോ അതോ ഇന്നത്തെ ടാസ്കുകൾ ക്രമീകരിക്കണോ?`
          : `It's completely okay if you're still feeling stressed. Deep relaxation takes time. Would you like to talk through what's causing the stress, or help prioritize today's tasks to reduce your workload pressure?`;
        res = formatAssistantResponse({
          type: "choice",
          mode: "general_knowledge",
          answer,
          options: choices,
          usedGeneralKnowledge: true,
        });
      } else if (optId === "breathing" || optId.includes("breathing")) {
        conversationMemory.updateState(sessionId, {
          pendingAction: "BREATHING_CHECKIN",
          awaitingChoice: true,
          availableOptions: [{ id: "done", label: "✅ Done" }],
        });
        res = wellbeingService.getBreathingExercise(question, effectiveLanguage);
      } else if (optId === "prioritize" || optId.includes("prioritize") || optId.includes("task") || optId === "plan_tasks") {
        conversationMemory.updateState(sessionId, { awaitingChoice: false, availableOptions: [] });
        const answer = isMalayalam
          ? `ഇന്നത്തെ ജോലിഭാരം ഒരുമിച്ച് പ്ലാൻ ചെയ്യാം. നിലവിൽ ഏതൊക്കെ ടാസ്കുകളാണ് താങ്കളുടെ ലിസ്റ്റിലുള്ളത്?`
          : `Let's organize today's workload together. What tasks are currently on your list?`;
        res = formatAssistantResponse({
          type: "task_plan",
          mode: "general_knowledge",
          answer,
          usedGeneralKnowledge: true,
        });
      } else if (optId === "talk" || optId.includes("talk") || optId.includes("causing")) {
        conversationMemory.updateState(sessionId, { awaitingChoice: false, availableOptions: [] });
        const answer = isMalayalam
          ? `കേൾക്കാൻ ഞാൻ തയ്യാറാണ്. എന്തൊക്കെ കാര്യങ്ങളാണ് താങ്കൾക്ക് സ്ട്രെസ്സ് ഉണ്ടാക്കുന്നത്?`
          : `I'm here to listen. What specific work situations or responsibilities are causing you stress right now?`;
        res = formatAssistantResponse({
          type: "wellbeing_advice",
          mode: "general_knowledge",
          answer,
          usedGeneralKnowledge: true,
        });
      } else if (optId === "tips" || optId.includes("tip")) {
        conversationMemory.updateState(sessionId, { awaitingChoice: false, availableOptions: [] });
        const answer = isMalayalam
          ? `ജോലിസ്ഥലത്തെ സ്ട്രെസ് കുറയ്ക്കാനുള്ള 4 ലളിതമായ വഴികൾ:\n\n1. **Micro-Breaks**: ഓരോ മണിക്കൂറിലും 2 മിനിറ്റ് ബ്രേക്ക് എടുക്കുക.\n2. **Hydration**: ആവശ്യത്തിന് വെള്ളം കുടിക്കുക.\n3. **Task Batching**: ഒരു സമയം ഒരു പ്രധാന ഫയലിൽ മാത്രം ശ്രദ്ധ കേന്ദ്രീകരിക്കുക.\n4. **Mindful Breathing**: സാവധാനം ആഴത്തിൽ ശ്വാസമെടുക്കുക.`
          : `Here are 4 quick workplace stress management tips:\n\n1. **Micro-Breaks**: Take a 2-minute stretch pause every hour.\n2. **Hydration**: Keep water at your desk and stay hydrated.\n3. **Task Batching**: Focus on one priority file at a time without multitasking.\n4. **Mindful Breathing**: Inhale deeply for 4s, hold for 7s, exhale for 8s.`;
        res = formatAssistantResponse({
          type: "wellbeing_advice",
          mode: "general_knowledge",
          answer,
          usedGeneralKnowledge: true,
        });
      } else if (optId === "formal" || optId === "friendly") {
        conversationMemory.updateState(sessionId, { awaitingChoice: false, availableOptions: [] });
        const toneLabel = optId === "formal" ? "Formal" : "Friendly / Informal";
        const answer = `Here is your ${toneLabel} leave email draft:\n\nSubject: Leave Application - [Your Name]\n\nRespected Sir/Madam,\n\nI am writing to request leave for [Date / Duration] due to personal commitments. I have ensured that all pending urgent files are attended to prior to my leave.\n\nThank you for your understanding.\n\nSincerely,\n[Your Name]`;
        res = formatAssistantResponse({
          type: "email_draft",
          mode: "general_knowledge",
          answer,
          usedGeneralKnowledge: true,
        });
      } else {
        conversationMemory.updateState(sessionId, { awaitingChoice: false, availableOptions: [] });
        res = formatAssistantResponse({
          type: "general_answer",
          mode: "general_knowledge",
          answer: `Understood. Let me help you with ${matchedOption.label}. How would you like to begin?`,
          usedGeneralKnowledge: true,
        });
      }

      conversationMemory.addMessage(sessionId, "user", question);
      conversationMemory.addMessage(sessionId, "assistant", res.answer);
      return res;
    }

    // Step 4: Conversation Continuity & Intent Classification
    const isContinuation = conversationMemory.isConfirmationOrContinuation(question, session);

    // Rule: Handle Breathing Exercise Pending Action
    if (isContinuation && session.state.pendingAction === "BREATHING_EXERCISE") {
      console.log(`[Conversation] Executing Single Pending Action: BREATHING_EXERCISE`);
      conversationMemory.updateState(sessionId, {
        pendingAction: "BREATHING_CHECKIN",
        awaitingConfirmation: false,
        awaitingChoice: true,
        availableOptions: [{ id: "done", label: "✅ Done" }],
      });
      const res = wellbeingService.getBreathingExercise(question, effectiveLanguage);
      conversationMemory.addMessage(sessionId, "user", question);
      conversationMemory.addMessage(sessionId, "assistant", res.answer);
      return res;
    }

    // Rule: Handle Breathing Check-in Pending Action (when user says "done", "completed", etc.)
    if (isContinuation && (session.state.pendingAction === "BREATHING_CHECKIN" || question.toLowerCase().trim() === "done")) {
      console.log(`[Conversation] Executing Pending Action Checkin: BREATHING_CHECKIN`);
      const choices = BREATHING_POST_CHECKIN_CHOICES;
      const checkinAnswer = isMalayalam
        ? `ശ്വാസകോശ വ്യായാമം പൂർത്തിയാക്കിയതിന് അഭിനന്ദനങ്ങൾ! 🌟\n\nഇപ്പോൾ എങ്ങനെ തോന്നുന്നു? താഴെ പറയുന്ന ഓപ്ഷനുകളിൽ നിന്നും തിരഞ്ഞെടുക്കുക:`
        : `Great job completing the breathing exercise! 🌟\n\nHow are you feeling now?`;

      conversationMemory.updateState(sessionId, {
        pendingAction: null,
        awaitingChoice: true,
        availableOptions: choices,
        awaitingConfirmation: true,
      });

      const res = formatAssistantResponse({
        type: "choice",
        mode: "general_knowledge",
        answer: checkinAnswer,
        message: isMalayalam ? "ഇപ്പോൾ എങ്ങനെ തോന്നുന്നു?" : "How are you feeling now?",
        options: choices,
        usedGeneralKnowledge: true,
      });

      conversationMemory.addMessage(sessionId, "user", question);
      conversationMemory.addMessage(sessionId, "assistant", res.answer);
      return res;
    }

    // RULE: Handle Ambiguous Short Replies ("yes", "ok", "sure") when Multiple Options Exist -> DO NOT GUESS!
    if (isContinuation && session.state.awaitingChoice && activeOptions.length > 1) {
      console.log(`[Conversation] Ambiguous short reply received while multiple choices active. Asking for explicit selection.`);
      const choiceAnswer = isMalayalam
        ? `സഹായിക്കാൻ സന്തോഷമുണ്ട്. താഴെ പറയുന്ന ഓപ്ഷനുകളിൽ ഏതുമായാണ് തുടരാൻ താല്പര്യം?\n\n` + activeOptions.map((o, i) => `${i + 1}. ${o.label}`).join("\n")
        : `I'd be happy to help. Which option would you like to continue with?\n\n` + activeOptions.map((o, i) => `${i + 1}. ${o.label}`).join("\n");

      const res = formatAssistantResponse({
        type: "choice",
        mode: "general_knowledge",
        answer: choiceAnswer,
        message: isMalayalam ? "ഓപ്ഷൻ തിരഞ്ഞെടുക്കുക:" : "Please choose an option:",
        options: activeOptions,
        usedGeneralKnowledge: true,
      });

      conversationMemory.addMessage(sessionId, "user", question);
      conversationMemory.addMessage(sessionId, "assistant", res.answer);
      return res;
    }

    let intent;
    const classifiedIntent = intentRouter.classify(question, { circularId });

    if (classifiedIntent !== INTENTS.UNKNOWN) {
      intent = classifiedIntent;
      if (session.state.currentIntent && session.state.currentIntent !== intent) {
        console.log(`[Conversation] Dynamic Context Switch: ${session.state.currentIntent} -> ${intent}`);
        conversationMemory.updateState(sessionId, {
          pendingAction: null,
          awaitingChoice: false,
          availableOptions: [],
          awaitingConfirmation: false,
        });
      }
      console.log(`[Conversation]\nIntent Classified: ${intent}`);
    } else if (isContinuation) {
      intent = session.state.currentIntent || INTENTS.UNKNOWN;
      console.log(
        `[Conversation]\nContinuation detected: true\nPending Action: ${session.state.pendingAction || "NONE"}\nUsing Existing Intent: ${intent}`
      );
    } else {
      intent = INTENTS.UNKNOWN;
      console.log(`[Conversation]\nIntent Unclassified (UNKNOWN)`);
    }

    conversationMemory.updateState(sessionId, { currentIntent: intent, circularId: circularId || session.state.circularId });

    const promptFileName = getPromptFileName(intent);

    // Step 5: Handle Special / Non-LLM Direct Services
    if (intent === INTENTS.WORKPLACE_WELLBEING) {
      console.log(`[Intent Router]\nDetected Intent: ${intent}\nUsing RAG: false\nPrompt: wellbeing.prompt.js`);
      const qLower = question.toLowerCase();

      if (qLower.includes("feeling better") || qLower.includes("feeling good") || qLower.includes("feeling fine") || qLower.includes("better now")) {
        conversationMemory.updateState(sessionId, {
          awaitingChoice: false,
          availableOptions: [],
          pendingAction: null,
          awaitingConfirmation: false,
        });
        const answer = isMalayalam
          ? `സന്തോഷം! കൂടുതൽ മെച്ചമായി തോന്നുന്നതിൽ സന്തോഷമുണ്ട്. നിങ്ങളുടെ ആരോഗ്യം നന്നായി ശ്രദ്ധിക്കുകയും ആവശ്യത്തിന് വിശ്രമിക്കുകയും ചെയ്യുക.`
          : `I'm glad to hear you're feeling better! Remember to pace yourself today, stay hydrated, and take short micro-breaks when needed. Let me know if you need any assistance with your tasks!`;

        const res = formatAssistantResponse({
          type: "wellbeing_advice",
          mode: "general_knowledge",
          answer,
          options: [],
          usedGeneralKnowledge: true,
        });

        conversationMemory.addMessage(sessionId, "user", question);
        conversationMemory.addMessage(sessionId, "assistant", res.answer);
        return res;
      }

      // Case A: Work stress mentioned -> Empathy + Advice + Single question offering breathing exercise
      if (qLower.includes("stressed") || qLower.includes("stress") || qLower.includes("work pressure") || qLower.includes("workload")) {
        const answer = isMalayalam
          ? `ജോലിഭാരം കാരണം സ്ട്രെസ്സ് ഉള്ളതായി തോന്നുന്നതിൽ വിഷമമുണ്ട്.\n\nജോലി സമ്മർദ്ദം കൂടുതലാവുമ്പോൾ സ്ട്രെസ്സ് ഉണ്ടാകുന്നത് സ്വാഭാവികമാണ്. എങ്കിലും ചെറിയൊരു ഇടവേളയെടുക്കുക, കാര്യങ്ങൾ ഓരോന്നായി സാവധാനം ചെയ്യുക.\n\n1 മിനിറ്റ് ശ്വാസകോശ വ്യായാമം (Breathing Exercise) ചെയ്യാൻ സഹായിക്കണോ?`
          : `I'm sorry you're feeling stressed due to work pressure.\n\nWork pressure can become overwhelming, especially during busy periods. Taking short breaks, prioritizing today's most important tasks, and pacing yourself can often help.\n\nWould you like me to guide you through a quick one-minute breathing exercise right now?`;

        conversationMemory.updateState(sessionId, {
          currentIntent: INTENTS.WORKPLACE_WELLBEING,
          pendingAction: "BREATHING_EXERCISE",
          awaitingChoice: false,
          availableOptions: [],
          awaitingConfirmation: true,
        });

        const res = formatAssistantResponse({
          type: "wellbeing_advice",
          mode: "general_knowledge",
          answer,
          usedGeneralKnowledge: true,
          intent,
        });

        conversationMemory.addMessage(sessionId, "user", question);
        conversationMemory.addMessage(sessionId, "assistant", res.answer);
        return res;
      }

      // Case B: Generic unwell query ("I'm not feeling well") -> Clarify gently with choices
      const choices = WELLBEING_CLARIFICATION_CHOICES;
      const answer = isMalayalam
        ? `നിങ്ങൾക്ക് സുഖമില്ലാത്തതിൽ വിഷമമുണ്ട്.\n\nശരിയായ സഹായം നൽകാൻ, താങ്കൾക്ക് എന്താണ് അനുഭവപ്പെടുന്നത് എന്ന് വ്യക്തമാക്കാമോ?\n\n1. 🤒 ശാരീരിക അസ്വസ്ഥത / രോഗലക്ഷണം\n2. 😰 ജോലി സംബന്ധമായ സ്ട്രെസ്സ്\n3. 😴 അമിതമായ ക്ഷീണം\n4. 💬 മറ്റെന്തെങ്കിലും`
        : `I'm sorry you're not feeling well today.\n\nTo help me provide the best support for you, could you share a bit more about what you're experiencing?\n\n1. 🤒 Physical Health / Unwell\n2. 😰 Stress because of work\n3. 😴 Tiredness / Exhaustion\n4. 💬 Something else\n\nPlease choose an option.`;

      conversationMemory.updateState(sessionId, {
        currentIntent: INTENTS.WORKPLACE_WELLBEING,
        pendingAction: null,
        awaitingChoice: true,
        availableOptions: choices,
        awaitingConfirmation: true,
      });

      const res = formatAssistantResponse({
        type: "choice",
        mode: "general_knowledge",
        answer,
        message: isMalayalam ? "ഓപ്ഷൻ തിരഞ്ഞെടുക്കുക:" : "Please choose an option:",
        options: choices,
        usedGeneralKnowledge: true,
      });

      conversationMemory.addMessage(sessionId, "user", question);
      conversationMemory.addMessage(sessionId, "assistant", res.answer);
      return res;
    }

    if (intent === INTENTS.BREATHING_EXERCISE) {
      console.log(`[Intent Router]\nDetected Intent: ${intent}\nUsing RAG: false\nPrompt: N/A (Direct Service)`);
      conversationMemory.updateState(sessionId, {
        pendingAction: "BREATHING_CHECKIN",
        awaitingChoice: true,
        availableOptions: [{ id: "done", label: "✅ Done" }],
      });
      const res = wellbeingService.getBreathingExercise(question, effectiveLanguage);
      conversationMemory.addMessage(sessionId, "user", question);
      conversationMemory.addMessage(sessionId, "assistant", res.answer);
      return res;
    }

    if (intent === INTENTS.DAILY_MOTIVATION) {
      console.log(`[Intent Router]\nDetected Intent: ${intent}\nUsing RAG: false\nPrompt: ${promptFileName}`);
      const res = wellbeingService.getDailyMotivation(effectiveLanguage);
      conversationMemory.addMessage(sessionId, "user", question);
      conversationMemory.addMessage(sessionId, "assistant", res.answer);
      return res;
    }

    if (intent === INTENTS.TRANSLATION) {
      console.log(`[Intent Router]\nDetected Intent: ${intent}\nUsing RAG: false\nPrompt: ${promptFileName}`);
      const res = await translationService.translate(question, effectiveLanguage);
      conversationMemory.addMessage(sessionId, "user", question);
      conversationMemory.addMessage(sessionId, "assistant", res.answer);
      return res;
    }

    // Step 6: Document Intents (RAG Search)
    const activeCircularId = circularId || session.state.circularId;
    const isDocumentIntent =
      Boolean(activeCircularId) ||
      intent === INTENTS.DOCUMENT_QA ||
      intent === INTENTS.DOCUMENT_SUMMARY ||
      intent === INTENTS.POLICY_EXPLANATION;

    const historyText = conversationMemory.getFormattedHistory(sessionId);
    const isOngoingConversation = session.history.length > 0;

    if (isDocumentIntent) {
      const { docs, highestScore } = await ragChainService.retrieveContext(question, { circularId: activeCircularId });

      console.log(
        `[Intent Router]\nDetected Intent: ${intent}\nUsing RAG: true\nRetrieved Chunks: ${docs.length}\nPrompt: ${promptFileName}`
      );

      let res;
      if (docs.length === 0) {
        if (!allowGeneralKnowledge) {
          const noDocAnswer = isMalayalam
            ? "അപ്‌ലോഡ് ചെയ്ത സർക്കുലറുകളിൽ പ്രസക്തമായ വിവരങ്ങളൊന്നും കണ്ടെത്താനായില്ല."
            : "No relevant information was found in the uploaded government circulars.";
          const noDocMessage = isMalayalam
            ? "ഈ ചോദ്യം അപ്‌ലോഡ് ചെയ്ത ഔദ്യോഗിക സർക്കുലറുകളിൽ ഉൾപ്പെട്ടിട്ടുള്ളതായി കാണുന്നില്ല."
            : "This question does not appear to be covered by the uploaded official documents.";
          const suggestions = isMalayalam
            ? ["വ്യത്യസ്തമായ വാക്കുകൾ ഉപയോഗിച്ച് Search ചെയ്യുക.", "പ്രസക്തമായ Circular Upload ചെയ്യുക."]
            : ["Try different keywords.", "Upload the relevant circular."];

          res = formatAssistantResponse({
            type: "document_answer",
            mode: "no_document_found",
            answer: noDocAnswer,
            message: noDocMessage,
            suggestions,
            confidence: highestScore,
            usedRAG: false,
            usedGeneralKnowledge: false,
            intent,
          });
        } else {
          res = await this.handleGeneralKnowledge(question, effectiveLanguage, intent, userId, sessionId, historyText, isOngoingConversation);
        }
      } else {
        const context = ragChainService.formatDocsAsContext(docs);
        const citations = ragChainService.buildCitations(docs);
        const sources = docs.map((d) => d.metadata.source).filter((val, idx, self) => self.indexOf(val) === idx);

        const dynamicActions = await suggestionService.getDynamicCircularActions({
          circularId: activeCircularId,
          contextText: context,
          preferredLanguage: effectiveLanguage,
        });

        if (!llmService.hasKey()) {
          const fallback = ragChainService.generateLocalRagFallback(docs, citations);
          res = formatAssistantResponse({
            type: "document_answer",
            mode: "official_circular",
            answer: fallback.answer,
            citations,
            sources,
            confidence: highestScore,
            usedRAG: true,
            usedGeneralKnowledge: false,
            intent,
            options: dynamicActions,
            suggestedActions: dynamicActions,
          });
        } else {
          try {
            const systemPrompt = promptBuilder.buildPrompt(intent, effectiveLanguage, {
              context,
              historyText,
              isOngoingConversation,
            });
            const rawAnswer = await llmService.generateCompletion(systemPrompt, { question, context }, { temperature: 0.1 });

            res = formatAssistantResponse({
              type: "document_answer",
              mode: "official_circular",
              answer: rawAnswer || "Unable to generate answer from document context.",
              citations,
              sources,
              confidence: highestScore,
              usedRAG: true,
              usedGeneralKnowledge: false,
              intent,
              options: dynamicActions,
              suggestedActions: dynamicActions,
            });
          } catch (err) {
            console.error("[AssistantService] RAG LLM execution failed:", err.message);
            res = formatAssistantResponse({
              type: "document_answer",
              mode: "official_circular",
              answer: "An error occurred while synthesizing document context. Please try again.",
              citations,
              sources,
              confidence: highestScore,
              usedRAG: true,
              intent,
              options: dynamicActions,
              suggestedActions: dynamicActions,
            });
          }
        }
      }

      conversationMemory.addMessage(sessionId, "user", question);
      conversationMemory.addMessage(sessionId, "assistant", res.answer);
      conversationMemory.analyzeAssistantOutput(sessionId, res.answer, intent);
      return res;
    }

    // Step 7: Non-Document Intents (Bypassing Vector Search Completely)
    console.log(`[Intent Router]\nDetected Intent: ${intent}\nUsing RAG: false\nPrompt: ${promptFileName}`);
    const res = await this.handleGeneralIntent(question, effectiveLanguage, intent, userId, sessionId, historyText, isOngoingConversation);

    conversationMemory.addMessage(sessionId, "user", question);
    conversationMemory.addMessage(sessionId, "assistant", res.answer);
    conversationMemory.analyzeAssistantOutput(sessionId, res.answer, intent);
    return res;
  }

  /**
   * Handles General Knowledge, Wellbeing, & Productivity requests (bypasses RAG completely).
   */
  async handleGeneralIntent(
    question,
    effectiveLanguage,
    intent,
    userId,
    sessionId = "default-session",
    historyText = "",
    isOngoingConversation = false
  ) {
    let wellnessContext = "";
    if (userId) {
      try {
        const WellnessCheck = (await import("../../models/WellnessCheck.model.js")).default;
        const latestCheck = await WellnessCheck.findOne({ employeeId: userId, status: "completed" }).sort({ dateString: -1 });
        if (latestCheck) {
          wellnessContext = `Employee Check-in (${latestCheck.dateString}): Mood: ${latestCheck.mood}, Stress: ${latestCheck.stress}, Burnout Risk: ${latestCheck.burnoutRisk}`;
        }
      } catch (err) {
        console.error("[AssistantService] Failed to load employee wellness context:", err.message);
      }
    }

    if (!llmService.hasKey()) {
      return this.generateOfflineIntentFallback(question, effectiveLanguage, intent, isOngoingConversation, sessionId);
    }

    try {
      const systemPrompt = promptBuilder.buildPrompt(intent, effectiveLanguage, {
        extraInstructions: wellnessContext,
        historyText,
        isOngoingConversation,
      });
      const rawAnswer = await llmService.generateCompletion(systemPrompt, { question }, { temperature: 0.3 });

      const analysis = conversationMemory.analyzeAssistantOutput(sessionId, rawAnswer, intent);
      let responseType = analysis.type === "choice" ? "choice" : "general_answer";

      if (responseType !== "choice") {
        if (intent === INTENTS.TASK_ASSISTANCE || intent === INTENTS.PRODUCTIVITY_COACHING) responseType = "task_plan";
        else if (intent === INTENTS.EMAIL_DRAFTING) responseType = "email_draft";
        else if (intent === INTENTS.WORKPLACE_WELLBEING) responseType = "wellbeing_advice";
      }

      return formatAssistantResponse({
        type: responseType,
        mode: "general_knowledge",
        answer: rawAnswer || "Here is the guidance for your query.",
        options: analysis.options || [],
        usedGeneralKnowledge: true,
        intent,
      });
    } catch (err) {
      console.error("[AssistantService] General intent generation failed:", err.message);
      return this.generateOfflineIntentFallback(question, effectiveLanguage, intent, isOngoingConversation, sessionId);
    }
  }

  /**
   * Offline / Fallback Generator for non-document queries.
   */
  generateOfflineIntentFallback(
    question = "",
    effectiveLanguage = "english",
    intent = "",
    isOngoingConversation = false,
    sessionId = "default-session"
  ) {
    const qLower = question.toLowerCase();
    const isMalayalam = effectiveLanguage === "malayalam";

    if (intent === INTENTS.WORKPLACE_WELLBEING) {
      if (qLower.includes("stressed") || qLower.includes("stress") || qLower.includes("work pressure") || qLower.includes("workload")) {
        const answer = isMalayalam
          ? `ജോലിഭാരം കാരണം സ്ട്രെസ്സ് ഉള്ളതായി തോന്നുന്നതിൽ വിഷമമുണ്ട്.\n\nജോലി സമ്മർദ്ദം കൂടുതലാവുമ്പോൾ സ്ട്രെസ്സ് ഉണ്ടാകുന്നത് സ്വാഭാവികമാണ്. എങ്കിലും ചെറിയൊരു ഇടവേളയെടുക്കുക, കാര്യങ്ങൾ ഓരോന്നായി സാവധാനം ചെയ്യുക.\n\n1 മിനിറ്റ് ശ്വാസകോശ വ്യായാമം (Breathing Exercise) ചെയ്യാൻ സഹായിക്കണോ?`
          : `I'm sorry you're feeling stressed due to work pressure.\n\nWork pressure can become overwhelming, especially during busy periods. Taking short breaks, prioritizing today's most important tasks, and pacing yourself can often help.\n\nWould you like me to guide you through a quick one-minute breathing exercise right now?`;

        conversationMemory.updateState(sessionId, {
          currentIntent: INTENTS.WORKPLACE_WELLBEING,
          pendingAction: "BREATHING_EXERCISE",
          awaitingChoice: false,
          availableOptions: [],
          awaitingConfirmation: true,
        });

        return formatAssistantResponse({
          type: "wellbeing_advice",
          mode: "general_knowledge",
          answer,
          usedGeneralKnowledge: true,
          intent,
        });
      }

      // Generic unwell query e.g. "I'm not feeling well" -> Clarify gently
      const choices = WELLBEING_CLARIFICATION_CHOICES;
      const answer = isMalayalam
        ? `നിങ്ങൾക്ക് സുഖമില്ലാത്തതിൽ വിഷമമുണ്ട്.\n\nശരിയായ സഹായം നൽകാൻ, താങ്കൾക്ക് എന്താണ് അനുഭവപ്പെടുന്നത് എന്ന് വ്യക്തമാക്കാമോ?\n\n1. 🤒 ശാരീരിക അസ്വസ്ഥത / രോഗലക്ഷണം\n2. 😰 ജോലി സംബന്ധമായ സ്ട്രെസ്സ്\n3. 😴 അമിതമായ ക്ഷീണം\n4. 💬 മറ്റെന്തെങ്കിലും`
        : `I'm sorry you're not feeling well today.\n\nTo help me provide the best support for you, could you share a bit more about what you're experiencing?\n\n1. 🤒 Physical Health / Unwell\n2. 😰 Stress because of work\n3. 😴 Tiredness / Exhaustion\n4. 💬 Something else\n\nPlease choose an option.`;

      conversationMemory.updateState(sessionId, {
        currentIntent: INTENTS.WORKPLACE_WELLBEING,
        pendingAction: null,
        awaitingChoice: true,
        availableOptions: choices,
        awaitingConfirmation: true,
      });

      return formatAssistantResponse({
        type: "choice",
        mode: "general_knowledge",
        answer,
        message: isMalayalam ? "ഓപ്ഷൻ തിരഞ്ഞെടുക്കുക:" : "Please choose an option:",
        options: choices,
        usedGeneralKnowledge: true,
      });
    }

    if (intent === INTENTS.TASK_ASSISTANCE || intent === INTENTS.PRODUCTIVITY_COACHING) {
      const header = isOngoingConversation ? "" : "Sure. Let's organize your day.\n\n";
      const answer = `${header}Based on your current tasks and responsibilities, here is a suggested priority order:\n\n1. **High Priority**: Urgent approvals, pending official signatures, & immediate communications\n2. **Medium Priority**: Core daily administrative files & review tasks\n3. **Low Priority**: Routine filing & organizing tomorrow's schedule\n\nWhat tasks are currently on your list?`;

      conversationMemory.updateState(sessionId, {
        currentIntent: INTENTS.TASK_ASSISTANCE,
        pendingAction: "TASK_PLANNING_DETAILS",
        awaitingChoice: false,
        availableOptions: [],
        awaitingConfirmation: true,
      });

      return formatAssistantResponse({
        type: "task_plan",
        mode: "general_knowledge",
        answer,
        usedGeneralKnowledge: true,
      });
    }

    if (intent === INTENTS.EMAIL_DRAFTING) {
      const choices = EMAIL_CHOICES;
      const answer = `I'd be happy to help draft your leave email. Which tone would you prefer?\n\n1. 📝 Formal Tone\n2. 😊 Friendly / Informal Tone`;

      conversationMemory.updateState(sessionId, {
        currentIntent: INTENTS.EMAIL_DRAFTING,
        pendingAction: null,
        awaitingChoice: true,
        availableOptions: choices,
        awaitingConfirmation: true,
      });

      return formatAssistantResponse({
        type: "choice",
        mode: "general_knowledge",
        answer,
        options: choices,
        usedGeneralKnowledge: true,
      });
    }

    const answer = isOngoingConversation
      ? `How else can I assist you with your task or topic?`
      : `Hello! How can I assist you with your workplace productivity, daily tasks, or employee well-being today?`;

    return formatAssistantResponse({
      type: "general_answer",
      mode: "general_knowledge",
      answer,
      usedGeneralKnowledge: true,
    });
  }

  /**
   * Helper for direct General Knowledge fallback.
   */
  async handleGeneralKnowledge(question, effectiveLanguage, intent, userId, sessionId, historyText, isOngoingConversation) {
    return this.handleGeneralIntent(question, effectiveLanguage, intent, userId, sessionId, historyText, isOngoingConversation);
  }
}

export const assistantService = new AssistantService();
export default assistantService;
