import retrievalService from "./retrieval.service.js";
import citationService from "./citation.service.js";

/**
 * Dedicated RAG Chain Service.
 */
class RAGChainService {
  /**
   * Retrieves relevant context for a question.
   * @param {string} question
   * @param {{ circularId?: string }} options
   * @returns {Promise<{ docs: Array, highestScore: number }>}
   */
  async retrieveContext(question, options = {}) {
    return retrievalService.retrieveContext(question, options);
  }

  /**
   * Formats retrieved docs into context string.
   */
  formatDocsAsContext(docs) {
    return citationService.formatDocsAsContext(docs);
  }

  /**
   * Constructs deduplicated citations array.
   */
  buildCitations(docs) {
    return citationService.buildCitations(docs);
  }

  /**
   * Generates a local fallback response when offline or missing LLM key.
   */
  generateLocalRagFallback(docs, citations) {
    const top = docs[0];
    const label = top.metadata.page ? `${top.metadata.source}, page ${top.metadata.page}` : top.metadata.source;

    return {
      answer: `[Development fallback — no GROQ_API_KEY configured]\n\nBased on the most relevant excerpt found in ${label}:\n\n"${top.pageContent.trim()}"\n\nAdd a valid GROQ_API_KEY in backend/.env for a synthesized answer.`,
      citations,
    };
  }
}

export const ragChainService = new RAGChainService();
export default ragChainService;

/**
 * Backward compatibility helper
 */
export async function answerQuestion(question, options = {}) {
  const { assistantService } = await import("../assistant/assistant.service.js");
  return assistantService.askQuestion(question, options);
}
