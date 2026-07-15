import { Chroma } from "@langchain/community/vectorstores/chroma";
import { getEmbeddings } from "./embeddings.service.js";
import dotenv from "dotenv";

dotenv.config();

const CHROMA_URL = process.env.CHROMA_URL || "http://localhost:8000";
const COLLECTION_NAME = process.env.CHROMA_COLLECTION || "ksmart_circulars";

// Connects to (or creates) a Chroma collection. LangChain's Chroma wrapper
// handles embedding + storing + similarity search for us — this is the
// "glue" LangChain provides instead of you writing raw HTTP calls to Chroma.
export async function getVectorStore() {
  const embeddings = getEmbeddings();

  return Chroma.fromExistingCollection(embeddings, {
    collectionName: COLLECTION_NAME,
    url: CHROMA_URL,
  });
}

// Used only by the ingestion script, since fromExistingCollection() expects
// the collection to already exist.
export async function createVectorStoreFromDocuments(documents) {
  const embeddings = getEmbeddings();

  return Chroma.fromDocuments(documents, embeddings, {
    collectionName: COLLECTION_NAME,
    url: CHROMA_URL,
  });
}
