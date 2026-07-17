import dotenv from "dotenv";

dotenv.config();

const HF_API_KEY = process.env.HF_API_KEY;
const HF_EMBEDDING_MODEL = process.env.HF_EMBEDDING_MODEL || "BAAI/bge-m3";

/**
 * Generate embedding for a given text using Hugging Face Hosted Inference API.
 * Retries on temporary errors (like 503 or 429).
 * @param {string} text 
 * @returns {Promise<number[]>}
 */
export async function generateEmbedding(text) {
  if (!text || typeof text !== "string" || !text.trim()) {
    throw new Error("Text must be a non-empty string to generate embeddings.");
  }

  if (!HF_API_KEY || HF_API_KEY === "your_hf_api_key_here") {
    throw new Error("HF_API_KEY is not configured in environment variables.");
  }

  const endpoint = `https://router.huggingface.co/hf-inference/models/${HF_EMBEDDING_MODEL}/pipeline/feature-extraction`;
  const maxRetries = 5;
  let attempt = 0;
  let delay = 1000; // start with 1s delay

  while (attempt < maxRetries) {
    attempt++;
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${HF_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: text,
          options: {
            wait_for_model: true,
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        
        let embedding = data;
        
        // Unwrap nested array formats if necessary
        if (Array.isArray(embedding)) {
          // If it's a nested array (e.g., [[0.1, 0.2, ...]]), unwrap it.
          while (Array.isArray(embedding[0]) && typeof embedding[0][0] !== "object") {
            embedding = embedding[0];
          }
        }

        if (Array.isArray(embedding) && embedding.every(num => typeof num === "number")) {
          return embedding;
        }

        throw new Error(`Unexpected response format from Hugging Face Inference API: ${JSON.stringify(data)}`);
      }

      // Check for temporary HTTP errors (503 Service Unavailable / 429 Too Many Requests)
      if (response.status === 503 || response.status === 429 || response.status >= 500) {
        const errorData = await response.json().catch(() => ({}));
        const waitMs = response.status === 503 && errorData.estimated_time 
          ? Math.ceil(errorData.estimated_time) * 1000 
          : delay;

        console.warn(`Hugging Face API returned status ${response.status} (attempt ${attempt}/${maxRetries}). Waiting ${waitMs / 1000}s before retry. Error: ${errorData.error || response.statusText}`);
        
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        delay *= 2; // Exponential backoff
        continue;
      }

      // Non-retryable error
      const errText = await response.text();
      throw new Error(`Hugging Face Inference API failed with status ${response.status}: ${errText}`);

    } catch (err) {
      console.error("================================");
      console.error("Embedding Error");
      console.error("Message:", err.message);
      console.error("Cause:", err.cause);
      console.error("Stack:", err.stack);
      console.error("================================");

      if (attempt >= maxRetries) {
        throw new Error(
          `Failed to generate embedding after ${maxRetries} attempts. Last error: ${err.message}`
        );
      }
      console.warn(`Connection error during embedding generation (attempt ${attempt}/${maxRetries}): ${err.message}. Retrying in ${delay / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= 2;
    }
  }
}
