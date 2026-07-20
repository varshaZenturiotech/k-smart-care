import CircularEmbedding from "../../models/CircularEmbedding.js";
import { generateEmbedding } from "./embedding.service.js";
import mongoose from "mongoose";

/**
 * MongoDB Atlas Vector Search Service.
 * Preserves exact vector search pipeline configuration.
 */
class VectorSearchService {
  /**
   * Executes vector similarity search on circular embeddings.
   * @param {string} query
   * @param {{ circularId?: string }} options
   * @returns {Promise<Array>}
   */
  async search(query, { circularId } = {}) {
    try {
      const queryVector = await generateEmbedding(query);

      const vectorSearchStage = {
        index: "circular_vector_index",
        path: "embedding",
        queryVector: queryVector,
        numCandidates: 100,
        limit: circularId ? 50 : 4,
      };

      const pipeline = [{ $vectorSearch: vectorSearchStage }];

      if (circularId) {
        pipeline.push({
          $match: {
            circularId: new mongoose.Types.ObjectId(circularId),
          },
        });
      }

      pipeline.push({
        $project: {
          _id: 1,
          circularId: 1,
          chunkIndex: 1,
          page: 1,
          text: 1,
          metadata: 1,
          score: { $meta: "vectorSearchScore" },
        },
      });

      if (circularId) {
        pipeline.push({ $limit: 4 });
      }

      return await CircularEmbedding.aggregate(pipeline);
    } catch (err) {
      console.error("[VectorSearchService] Vector search error:", err.message);
      return [];
    }
  }
}

export const vectorSearchService = new VectorSearchService();
export default vectorSearchService;
