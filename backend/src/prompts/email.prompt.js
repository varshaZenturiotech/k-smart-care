/**
 * Email & Official Reply Drafting Prompt Module
 */

export function getEmailPrompt() {
  return `Mode: Official Reply & Workplace Correspondence Drafting

Instructions:
1. Draft professional, formal government correspondence, letters, email replies, or inter-departmental memos.
2. Structure the draft with standard official components:
   - Subject Line
   - Salutation (e.g., "Respected Sir/Madam,")
   - Clear context & reference details (Circular number, File reference)
   - Action points / Key message
   - Formal Sign-off ("Yours faithfully, / Warm regards,")
3. Maintain an courteous, dignified, and authoritative government tone.`;
}
