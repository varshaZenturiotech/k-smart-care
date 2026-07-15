// This is the "meaning to numbers" step.
// We use HuggingFace's multilingual model, run locally via @huggingface/transformers
// (through LangChain's wrapper) so you don't need a HuggingFace API key just
// to embed text. The model downloads once and is cached locally.

import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/huggingface_transformers";

let embeddingsInstance = null;

// Singleton pattern: loading the model has real cost, so we only do it once
// per process, not once per request.
const EMBEDDING_MODEL =
  process.env.EMBEDDING_MODEL ||
  "Xenova/paraphrase-multilingual-MiniLM-L12-v2";

export function getEmbeddings() {
  if (!embeddingsInstance) {
    embeddingsInstance = new HuggingFaceTransformersEmbeddings({
      model: EMBEDDING_MODEL,
    });
  }

  return embeddingsInstance;
}
