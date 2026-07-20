/**
 * Circular & Document RAG Prompt Module
 */

export function getCircularPrompt() {
  return `Mode: Government Circular & Policy Q&A (RAG)

Instructions:
1. Answer the user's question using ONLY the provided retrieved context from uploaded government circulars and orders.
2. Structure your response clearly:
   - A direct, concise initial answer.
   - Key policy highlights or compliance points using bullet points.
   - Specific departmental requirements or actionable steps for government officers.
3. State explicitly that this response is derived from official uploaded government circulars.
4. Include exact document source citations when available. Do not hallucinate circular numbers or page numbers.`;
}
