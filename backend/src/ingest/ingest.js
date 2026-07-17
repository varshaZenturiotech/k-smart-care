// Run with: npm run ingest
//
// Concepts:
// 1. Read every .txt file in /data
// 2. Create a Circular metadata record if it doesn't exist
// 3. Split each document into overlapping chunks (~500 chars each)
// 4. Generate embeddings via Hugging Face Hosted Inference API
// 5. Store them in CircularEmbedding collection
// 6. Mark Circular as ingested

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { Document } from "@langchain/core/documents";
import { connectDB } from "../config/db.js";
import Circular from "../models/Circular.model.js";
import CircularEmbedding from "../models/CircularEmbedding.js";
import { generateEmbedding } from "../services/embedding.service.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "../../data");

async function loadRawDocuments() {
  if (!fs.existsSync(DATA_DIR)) {
    console.log(`Data directory ${DATA_DIR} does not exist. Skipping manual ingestion.`);
    return [];
  }
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
  // Connect to MongoDB
  await connectDB();

  console.log("Loading raw documents from /data ...");
  const rawDocs = await loadRawDocuments();
  if (rawDocs.length === 0) {
    console.log("No documents found to ingest.");
    process.exit(0);
  }
  console.log(`Loaded ${rawDocs.length} document(s).`);

  // Find a user to assign as uploader
  const User = (await import("../models/User.model.js")).default;
  let adminUser = await User.findOne({ role: "Admin" });
  if (!adminUser) {
    adminUser = await User.findOne();
  }
  const uploadedById = adminUser ? adminUser._id : new mongoose.Types.ObjectId();

  for (const doc of rawDocs) {
    const filename = doc.metadata.source;
    const title = filename.replace(/\.[^/.]+$/, "");

    console.log(`Processing document: ${title}...`);

    let circular = await Circular.findOne({ filename });
    if (!circular) {
      circular = new Circular({
        title,
        filename,
        filepath: path.join(DATA_DIR, filename),
        mimeType: "text/plain",
        size: fs.statSync(path.join(DATA_DIR, filename)).size,
        uploadedBy: uploadedById,
        status: "uploaded",
      });
      await circular.save();
    }

    circular.status = "parsing";
    await circular.save();

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 500,
      chunkOverlap: 75,
    });

    const chunks = await splitter.splitDocuments([doc]);
    console.log(`Split ${title} into ${chunks.length} chunk(s).`);

    circular.status = "embedding";
    await circular.save();

    // Clean up any existing embeddings for this file
    await CircularEmbedding.deleteMany({ circularId: circular._id });

    // Generate embeddings sequentially to respect rate limits
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`Generating embedding for chunk ${i + 1}/${chunks.length} of ${title}...`);
      const embedding = await generateEmbedding(chunk.pageContent);

      await CircularEmbedding.create({
        circularId: circular._id,
        chunkIndex: i,
        page: 0,
        text: chunk.pageContent,
        embedding: embedding,
        metadata: {
          source: filename,
          circularNumber: "",
          title: title,
        },
      });
    }

    circular.status = "ingested";
    circular.vectorIndexed = true;
    await circular.save();
    console.log(`Successfully ingested: ${title}`);
  }

  console.log("Ingestion process completed successfully.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Ingestion failed:", err);
  process.exit(1);
});
