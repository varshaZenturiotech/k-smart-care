// Run with: npm run ingest
//
// What happens here, conceptually:
// 1. Read every .txt file in /data (in production: PDFs, DOCX circulars, GOs)
// 2. Split each document into overlapping chunks (~500 tokens each). We chunk
//    because embedding models have a limited context window, and because
//    retrieval is more precise when it can pull "just the relevant paragraph"
//    rather than a whole 10-page circular.
// 3. Embed each chunk into a vector using MiniLM.
// 4. Store the vector + original text + metadata (source file, circular no.)
//    in ChromaDB, so we can search it later.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { Document } from "@langchain/core/documents";
import { createVectorStoreFromDocuments } from "../services/vectorStore.service.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "../../data");

async function loadRawDocuments() {
  const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith(".txt"));

  return files.map((filename) => {
    const content = fs.readFileSync(path.join(DATA_DIR, filename), "utf-8");
    return new Document({
      pageContent: content,
      metadata: { source: filename },
    });
  });
}

async function main() {
  console.log("Loading raw documents from /data ...");
  const rawDocs = await loadRawDocuments();
  console.log(`Loaded ${rawDocs.length} document(s).`);

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500,
    chunkOverlap: 75, // overlap avoids cutting a sentence in half between chunks
  });

  const chunks = await splitter.splitDocuments(rawDocs);
  console.log(`Split into ${chunks.length} chunk(s).`);

  console.log("Embedding chunks and storing in ChromaDB ...");
  await createVectorStoreFromDocuments(chunks);

  console.log("Done. Your circulars are now searchable.");
}

main().catch((err) => {
  console.error("Ingestion failed:", err);
  process.exit(1);
});
