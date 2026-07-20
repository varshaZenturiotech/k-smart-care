import vectorSearchService from "./vectorSearch.service.js";

/**
 * High Level Document Retrieval Service
 */
class RetrievalService {
  /**
   * Retrieves relevant document chunks for a question.
   * @param {string} question
   * @param {{ circularId?: string }} options
   * @returns {Promise<{ docs: Array, highestScore: number }>}
   */
  async retrieveContext(question, { circularId } = {}) {
    let docs = [];
    let highestScore = 0;

    const rawResults = await vectorSearchService.search(question, { circularId });

    docs = rawResults.map((r) => ({
      pageContent: r.text,
      score: r.score,
      metadata: {
        source: r.metadata?.source || r.metadata?.title || "",
        circularId: r.circularId?.toString(),
        circularNumber: r.metadata?.circularNumber || "",
        page: r.page,
      },
    }));

    if (docs.length > 0) {
      highestScore = Math.max(...docs.map((d) => d.score || 0));
    }

    return { docs, highestScore };
  }
}

export const retrievalService = new RetrievalService();
export default retrievalService;
