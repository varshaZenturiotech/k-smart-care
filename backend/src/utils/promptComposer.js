/**
 * Prompt Composer Utility.
 * Dynamically composes modular prompts to keep token counts low and instructions focused.
 */

export function composePrompt({
  basePrompt,
  modulePrompt,
  languageDirective,
  context = "",
  extraInstructions = "",
  historyText = "",
  isOngoingConversation = false,
}) {
  const parts = [];

  if (basePrompt) parts.push(basePrompt);
  if (modulePrompt) parts.push(modulePrompt);
  if (languageDirective) parts.push(languageDirective);

  if (isOngoingConversation) {
    parts.push(
      "IMPORTANT CONTINUATION RULE: This is an ongoing conversation turn. Do NOT generate greetings such as 'Good morning', 'Hello', 'Hi', or introductory self-statements. Respond directly and continue the current context."
    );
  }

  if (historyText && historyText.trim()) {
    parts.push(`\nRecent Conversation History:\n${historyText.trim()}`);
  }

  if (context && context.trim()) {
    parts.push(`\nRetrieved Context:\n${context.trim()}`);
  }

  if (extraInstructions && extraInstructions.trim()) {
    parts.push(`\nAdditional Guidance:\n${extraInstructions.trim()}`);
  }

  parts.push(`\nCurrent User Input:\n{question}\n\nResponse:`);

  return parts.join("\n\n");
}

