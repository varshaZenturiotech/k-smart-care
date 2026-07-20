/**
 * Citation and Context Formatting Service
 */
class CitationService {
  /**
   * Formats document chunks into context string.
   * @param {Array} docs
   * @returns {string}
   */
  formatDocsAsContext(docs) {
    return docs
      .map((doc, i) => {
        const circNumStr = doc.metadata.circularNumber ? ` (No: ${doc.metadata.circularNumber})` : "";
        const label = doc.metadata.page
          ? `${doc.metadata.source}${circNumStr}, page ${doc.metadata.page}`
          : `${doc.metadata.source}${circNumStr}`;
        return `[Excerpt ${i + 1} — ${label}]\n${doc.pageContent}`;
      })
      .join("\n\n");
  }

  /**
   * Builds deduplicated citations.
   * @param {Array} docs
   * @returns {Array<{ title: string, circularNumber: string|null, page: number|null }>}
   */
  buildCitations(docs) {
    const seen = new Set();
    const citations = [];

    for (const doc of docs) {
      const key = `${doc.metadata.source}::${doc.metadata.page || ""}::${doc.metadata.circularNumber || ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      citations.push({
        title: doc.metadata.source,
        circularNumber: doc.metadata.circularNumber || null,
        page: doc.metadata.page || null,
      });
    }

    return citations;
  }
}

export const citationService = new CitationService();
export default citationService;
