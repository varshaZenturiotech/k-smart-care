import { INTENTS } from "../../constants/intents.js";

export const WELLBEING_CHOICES = [
  { id: "breathing", label: "🫁 Breathing Exercise" },
  { id: "prioritize", label: "📋 Prioritize Today's Tasks" },
  { id: "talk", label: "💬 Talk About My Stress" },
  { id: "tips", label: "💡 Stress Management Tips" },
];

export const WELLBEING_CLARIFICATION_CHOICES = [
  { id: "physical_health", label: "🤒 Physical Health / Unwell" },
  { id: "work_stress", label: "😰 Stress because of work" },
  { id: "tiredness", label: "😴 Tiredness / Exhaustion" },
  { id: "something_else", label: "💬 Something else" },
];

export const BREATHING_POST_CHECKIN_CHOICES = [
  { id: "feeling_better", label: "😊 Feeling better & ready" },
  { id: "still_stressed", label: "😐 Still feeling stressed" },
  { id: "plan_tasks", label: "📋 Help me prioritize my tasks" },
];

export const EMAIL_CHOICES = [
  { id: "improve_draft", label: "✏️ Improve Draft" },
  { id: "friendly", label: "😊 Make Friendlier" },
  { id: "formal", label: "📄 Make More Formal" },
  { id: "translate_email", label: "🌐 Translate" },
];

export const CIRCULAR_CHOICES = [
  { id: "summarize_circular", label: "📄 Summarize Circular", intent: "Summarize this circular" },
  { id: "key_changes", label: "📌 Key Changes", intent: "What are the key changes in this circular?" },
  { id: "show_deadlines", label: "⏰ Show Deadlines", intent: "What are the important deadlines in this circular?" },
  { id: "who_is_affected", label: "👥 Who Is Affected?", intent: "Who is affected by this circular?" },
];

export const MEETING_CHOICES = [
  { id: "meeting_agenda", label: "📝 Agenda" },
  { id: "action_items", label: "📋 Action Items" },
  { id: "draft_invitation", label: "📧 Draft Invitation" },
];

/**
 * Utility to match user input string against available choice options.
 * @param {string} userInput
 * @param {Array<{id: string, label: string}>} options
 * @returns {{id: string, label: string}|null}
 */
export function matchOptionSelection(userInput = "", options = []) {
  if (!userInput || !Array.isArray(options) || options.length === 0) return null;
  const inputLower = userInput.toLowerCase().trim();

  // 1. Direct number matching ("1", "2", "3", "4", "option 1")
  const numMatch = inputLower.match(/^(?:option\s*)?(\d+)$/);
  if (numMatch) {
    const idx = parseInt(numMatch[1], 10) - 1;
    if (idx >= 0 && idx < options.length) {
      return options[idx];
    }
  }

  // 2. Exact or substring match against id or label
  for (let i = 0; i < options.length; i++) {
    const opt = options[i];
    const idLower = (opt.id || "").toLowerCase();
    const labelLower = (opt.label || "").toLowerCase().replace(/[^\w\s]/gi, "").trim();
    const sanitizedInput = inputLower.replace(/[^\w\s]/gi, "").trim();

    if (
      inputLower === idLower ||
      sanitizedInput === idLower ||
      sanitizedInput === labelLower ||
      labelLower.includes(sanitizedInput) ||
      (sanitizedInput.length >= 3 && labelLower.includes(sanitizedInput))
    ) {
      return opt;
    }
  }

  return null;
}

/**
 * Short-term Conversation Memory & State Manager for Workplace AI Assistant.
 * Maintains context window, pending actions, active intent, and confirmation states per session.
 */
class ConversationMemory {
  constructor() {
    /**
     * @type {Map<string, { history: Array<{role: string, content: string}>, state: Object, lastUpdated: number }>}
     */
    this.sessions = new Map();
    this.TTL_MS = 30 * 60 * 1000; // 30 minutes TTL
    this.MAX_HISTORY = 10; // Keep last 10 messages (5 turns)
  }

  /**
   * Retrieves or initializes session data.
   * @param {string} sessionId
   * @returns {Object}
   */
  getSession(sessionId = "default-session") {
    this.cleanExpiredSessions();
    const key = sessionId || "default-session";
    if (!this.sessions.has(key)) {
      this.sessions.set(key, {
        history: [],
        state: {
          currentIntent: null,
          pendingAction: null,
          awaitingChoice: false,
          availableOptions: [],
          lastAssistantQuestion: null,
          awaitingConfirmation: false,
          circularId: null,
          language: "english",
        },
        lastUpdated: Date.now(),
      });
    }
    const session = this.sessions.get(key);
    session.lastUpdated = Date.now();
    return session;
  }

  /**
   * Appends a message to session history.
   * @param {string} sessionId
   * @param {"user"|"assistant"} role
   * @param {string} content
   */
  addMessage(sessionId = "default-session", role, content) {
    if (!content || typeof content !== "string") return;
    const session = this.getSession(sessionId);

    session.history.push({
      role: role === "user" ? "user" : "assistant",
      content: content.trim(),
    });

    if (session.history.length > this.MAX_HISTORY) {
      session.history = session.history.slice(-this.MAX_HISTORY);
    }
    session.lastUpdated = Date.now();
  }

  /**
   * Sets custom history directly (e.g. from frontend state).
   * @param {string} sessionId
   * @param {Array<{role: string, text?: string, content?: string}>} rawHistory
   */
  setHistory(sessionId = "default-session", rawHistory = []) {
    if (!Array.isArray(rawHistory) || rawHistory.length === 0) return;
    const session = this.getSession(sessionId);

    const formatted = rawHistory
      .filter((m) => m && (m.text || m.content))
      .map((m) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: (m.content || m.text || "").trim(),
      }))
      .slice(-this.MAX_HISTORY);

    if (formatted.length > 0) {
      session.history = formatted;
    }
  }

  /**
   * Updates conversation state parameters.
   * @param {string} sessionId
   * @param {Object} newState
   */
  updateState(sessionId = "default-session", newState = {}) {
    const session = this.getSession(sessionId);
    session.state = {
      ...session.state,
      ...newState,
    };
    session.lastUpdated = Date.now();
  }

  /**
   * Checks if user message is a short confirmation, affirmation, or continuation reply.
   * @param {string} text
   * @param {Object} session
   * @returns {boolean}
   */
  isConfirmationOrContinuation(text = "", session) {
    if (!text || typeof text !== "string") return false;
    const lower = text.toLowerCase().trim();

    const confirmationKeywords = [
      "yes", "yeah", "yep", "sure", "ok", "okay", "continue", "go ahead",
      "tell me more", "next", "explain", "why", "how", "formal", "informal",
      "please", "do it", "let's do it", "sounds good", "fine", "alright",
      "certainly", "go on", "explain more", "elaborate", "second point",
      "first point", "point 2", "point 1", "1", "2", "3", "4",
      "done", "completed", "finished", "feeling better", "still stressed", "better"
    ];

    const malayalamKeywords = [
      "അതെ", "ശരി", "തുടരൂ", "പറയൂ", "വേണം", "തീർച്ചയായും", "ചെയ്യാം", "ആകാം"
    ];

    const isMatch =
      confirmationKeywords.includes(lower) ||
      malayalamKeywords.some((k) => text.includes(k)) ||
      (lower.split(/\s+/).length <= 4 && confirmationKeywords.some((k) => lower.includes(k)));

    const state = session.state;
    const hasHistory = session.history.length > 0;

    return isMatch && (state.awaitingConfirmation || state.awaitingChoice || Boolean(state.pendingAction) || hasHistory);
  }

  /**
   * Analyzes assistant answer to infer pending actions, choices, or questions.
   * Enforces structured choices and single pending action rules.
   * @param {string} sessionId
   * @param {string} answer
   * @param {string} intent
   * @returns {{ type?: string, options?: Array }}
   */
  analyzeAssistantOutput(sessionId = "default-session", answer = "", intent = "") {
    if (!answer) return {};
    const lower = answer.toLowerCase();
    const session = this.getSession(sessionId);

    let pendingAction = null;
    let awaitingConfirmation = false;
    let awaitingChoice = false;
    let availableOptions = [];

    // Check if output presents multiple options (numbered choices)
    const optionsParsed = this.parseChoicesFromText(answer);
    if (optionsParsed.length > 1) {
      awaitingChoice = true;
      availableOptions = optionsParsed;
      this.updateState(sessionId, {
        currentIntent: intent || session.state.currentIntent,
        pendingAction: null,
        awaitingChoice: true,
        availableOptions,
        lastAssistantQuestion: answer,
        awaitingConfirmation: true,
      });
      return { type: "choice", options: availableOptions };
    }

    if (intent === INTENTS.WORKPLACE_WELLBEING) {
      // Default choices for wellbeing if multiple next steps implied
      if (lower.includes("1.") && lower.includes("2.")) {
        awaitingChoice = true;
        availableOptions = WELLBEING_CHOICES;
      } else if (
        lower.includes("breathing") ||
        lower.includes("exercise") ||
        lower.includes("one-minute") ||
        lower.includes("box breathing") ||
        lower.includes("4-7-8")
      ) {
        pendingAction = "BREATHING_EXERCISE";
        awaitingConfirmation = true;
      } else {
        awaitingChoice = true;
        availableOptions = WELLBEING_CHOICES;
      }
    } else if (intent === INTENTS.EMAIL_DRAFTING && (lower.includes("formal") || lower.includes("tone") || lower.includes("prefer"))) {
      awaitingChoice = true;
      availableOptions = EMAIL_CHOICES;
    } else if (intent === INTENTS.TASK_ASSISTANCE && (lower.includes("list") || lower.includes("tasks") || lower.includes("priorities"))) {
      pendingAction = "TASK_PLANNING_DETAILS";
      awaitingConfirmation = true;
    } else if (lower.trim().endsWith("?") || lower.includes("would you like") || lower.includes("shall i")) {
      awaitingConfirmation = true;
    }

    this.updateState(sessionId, {
      currentIntent: intent || session.state.currentIntent,
      pendingAction,
      awaitingChoice,
      availableOptions,
      lastAssistantQuestion: answer,
      awaitingConfirmation,
    });

    return { type: awaitingChoice ? "choice" : null, options: availableOptions };
  }

  /**
   * Helper to parse numbered option lists from text if present.
   * @param {string} text
   * @returns {Array<{id: string, label: string}>}
   */
  parseChoicesFromText(text = "") {
    if (!text) return [];
    const lines = text.split("\n");
    const options = [];

    const itemRegex = /^(?:[\d\.\-\*]+|\d+\.)\s*([^\n]+)/;
    for (const line of lines) {
      const match = line.trim().match(itemRegex);
      if (match) {
        const itemText = match[1].trim();
        if (itemText.length > 3 && itemText.length < 80) {
          let id = itemText.toLowerCase().replace(/[^\w\s]/g, "").trim().slice(0, 20).replace(/\s+/g, "_");
          if (!id) id = `option_${options.length + 1}`;
          options.push({ id, label: itemText });
        }
      }
    }

    return options.length >= 2 ? options.slice(0, 4) : [];
  }

  /**
   * Formats current session history as conversation context string for prompts.
   * @param {string} sessionId
   * @returns {string}
   */
  getFormattedHistory(sessionId = "default-session") {
    const session = this.getSession(sessionId);
    if (!session.history || session.history.length === 0) return "";

    return session.history
      .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
      .join("\n");
  }

  /**
   * Cleans up sessions older than TTL.
   */
  cleanExpiredSessions() {
    const now = Date.now();
    for (const [key, session] of this.sessions.entries()) {
      if (now - session.lastUpdated > this.TTL_MS) {
        this.sessions.delete(key);
      }
    }
  }
}

export const conversationMemory = new ConversationMemory();
export default conversationMemory;
