/**
 * Response Formatter Utility.
 * Formats assistant responses with typed payloads and dynamic contextual suggested actions.
 */

export const DOMAIN_SUGGESTED_ACTIONS = {
  DOCUMENT_QA: [
    { id: "summary", label: "📄 Summarize Circular", intent: "summary" },
    { id: "key_changes", label: "📌 Key Changes", intent: "key_changes" },
    { id: "deadlines", label: "⏰ Show Deadlines", intent: "deadlines" },
    { id: "who_is_affected", label: "👥 Who Is Affected?", intent: "who_is_affected" },
  ],
  DOCUMENT_SUMMARY: [
    { id: "key_points", label: "📌 Key Points", intent: "key_points" },
    { id: "executive_summary", label: "📋 Executive Summary", intent: "executive_summary" },
    { id: "important_actions", label: "⚠ Important Actions", intent: "important_actions" },
    { id: "important_dates", label: "📅 Important Dates", intent: "important_dates" },
  ],
  TASK_ASSISTANCE: [
    { id: "prioritize_tasks", label: "📋 Prioritize Today's Tasks", intent: "prioritize_tasks" },
    { id: "create_schedule", label: "⏰ Create Today's Schedule", intent: "create_schedule" },
    { id: "prepare_meeting", label: "📅 Prepare for Meeting", intent: "prepare_meeting" },
    { id: "draft_email", label: "📧 Draft an Email", intent: "draft_email" },
  ],
  PRODUCTIVITY_COACHING: [
    { id: "prioritize_tasks", label: "📋 Prioritize Today's Tasks", intent: "prioritize_tasks" },
    { id: "create_schedule", label: "⏰ Create Today's Schedule", intent: "create_schedule" },
    { id: "short_break", label: "☕ Suggest a Short Break", intent: "short_break" },
  ],
  WORKPLACE_WELLBEING: [
    { id: "stress_tips", label: "🌿 Stress Relief Tips", intent: "stress_tips" },
    { id: "breathing_exercise", label: "🌬 Start a Breathing Exercise", intent: "breathing_exercise" },
    { id: "short_break", label: "☕ Suggest a Short Break", intent: "short_break" },
    { id: "plan_workday", label: "📋 Help Plan My Workday", intent: "plan_workday" },
  ],
  TRANSLATION: [
    { id: "translate_to_malayalam", label: "English → Malayalam", intent: "translate_to_malayalam" },
    { id: "translate_to_english", label: "Malayalam → English", intent: "translate_to_english" },
    { id: "simplify_language", label: "Simplify Language", intent: "simplify_language" },
  ],
  MEETING_ASSISTANCE: [
    { id: "meeting_agenda", label: "📝 Meeting Agenda", intent: "meeting_agenda" },
    { id: "action_items", label: "📋 Action Items", intent: "action_items" },
    { id: "draft_invitation", label: "📧 Draft Invitation", intent: "draft_invitation" },
  ],
  EMAIL_DRAFTING: [
    { id: "improve_draft", label: "✏️ Improve Draft", intent: "improve_draft" },
    { id: "friendly", label: "😊 Make Friendlier", intent: "friendly" },
    { id: "formal", label: "📄 Make More Formal", intent: "formal" },
    { id: "translate", label: "🌐 Translate", intent: "translate" },
  ],
};

export function formatAssistantResponse(data = {}) {
  const {
    type = "general_answer",
    mode = "general_knowledge",
    answer = "",
    message = null,
    disclaimer = null,
    citations = [],
    sources = [],
    confidence = null,
    usedRAG = false,
    usedGeneralKnowledge = false,
    suggestions = [],
    options = null,
    suggestedActions = null,
    structuredData = null,
    intent = null,
  } = data;

  let rawActions = suggestedActions || options;
  
  // Auto-populate contextual suggested actions if none were provided explicitly
  if ((!rawActions || rawActions.length === 0) && intent && DOMAIN_SUGGESTED_ACTIONS[intent]) {
    rawActions = DOMAIN_SUGGESTED_ACTIONS[intent];
  }

  const normalizedActions = Array.isArray(rawActions)
    ? rawActions.map((opt, idx) => {
        if (typeof opt === "string") {
          return { id: `action-${idx}`, label: opt, intent: opt };
        }
        return {
          id: opt.id || `action-${idx}`,
          label: opt.label || opt.text || "Option",
          intent: opt.intent || opt.id || "general",
        };
      })
    : [];

  return {
    type,
    mode,
    answer,
    message,
    disclaimer,
    citations: Array.isArray(citations) ? citations : [],
    sources: Array.isArray(sources) ? sources : [],
    confidence: typeof confidence === "number" ? confidence : null,
    usedRAG: Boolean(usedRAG),
    usedGeneralKnowledge: Boolean(usedGeneralKnowledge),
    suggestions: Array.isArray(suggestions) ? suggestions : [],
    options: normalizedActions,
    suggestedActions: normalizedActions,
    structuredData,
  };
}
