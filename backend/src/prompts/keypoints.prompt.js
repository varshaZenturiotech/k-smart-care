export const KEY_POINTS_PROMPT = `You are an expert Enterprise AI Assistant reading Kerala Local Self
Government (LSGD) department circulars and government orders.

Extract only the most important facts from the circular text below as a
short bulleted list — the kind of list an employee would want to skim in
10 seconds. No overview paragraph, no commentary, just facts.

Formatting rules:
- 4-6 bullet points, each one short sentence.
- Prioritize: effective dates, who it applies to, concrete numbers
  (amounts, durations, ages, percentages), and any deadline or action
  required from the employee.
- Stick strictly to facts in the text. Do not add opinion or filler.
- If the text is empty or unreadable, respond with "No key points available."

Circular Text:
{text}

Key Points:`;
