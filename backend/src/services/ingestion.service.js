import fs from "fs";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { getVectorStore } from "./vectorStore.service.js";
import { generateMetadataFromText } from "./summary.service.js";
import Circular from "../models/Circular.model.js";

/**
 * Extract text from a PDF (page by page, so every chunk keeps its page
 * number), split into chunks, embed them, and save in ChromaDB.
 *
 * Using PDFLoader with splitPages:true instead of a single pdf-parse() call
 * is the key change here: it returns one Document per PDF page, each with
 * metadata.loc.pageNumber. When we later split those page-documents further,
 * LangChain's splitter carries that page number onto every resulting chunk —
 * which is exactly what lets us cite "Page 4" instead of just a filename.
 */
export async function ingestCircular(circularId) {
  const circular = await Circular.findById(circularId);
  if (!circular) {
    console.error(`Ingestion error: Circular not found with ID ${circularId}`);
    return;
  }

  try {
    circular.status = "parsing";
    circular.errorDetails = "";
    await circular.save();

    console.log(`Starting ingestion for: ${circular.title}`);

    if (!fs.existsSync(circular.filepath)) {
      throw new Error(`File not found at path: ${circular.filepath}`);
    }

    // splitPages:true => one Document per page, each with metadata.loc.pageNumber
    const loader = new PDFLoader(circular.filepath, { splitPages: true });
    const pageDocuments = await loader.load();

    const fullText = pageDocuments.map((d) => d.pageContent).join("\n\n");

    if (!fullText || !fullText.trim()) {
      throw new Error("No readable text could be extracted from this PDF. It might be scanned or empty.");
    }

    circular.status = "chunking";
    circular.pageCount = pageDocuments.length;
    await circular.save();

    console.log(`Generating AI summary and metadata for: ${circular.title}`);
    let metadata;
    try {
      metadata = await generateMetadataFromText(fullText);
    } catch (metaErr) {
      console.error("AI Metadata generation failed, using fallback:", metaErr);
      metadata = {
        title: circular.title,
        summary: "Summary generation failed.",
        departments: ["Local Self Government"],
        category: "Circular",
        priority: "Medium",
        keywords: ["Circular"],
      };
    }

    // Apply metadata to MongoDB document (respecting admin overrides)
    if (!circular.title || circular.title === circular.filename) {
      circular.title = metadata.title || circular.title;
    }
    circular.summary = metadata.summary;
    
    // AI suggests department tags
    circular.aiSuggestedDepartments = metadata.departments;
    if (circular.departments.length === 0 && !circular.departmentConfirmed) {
      circular.departments = metadata.departments;
      // Also update the single string 'department' field requested in Step 3
      circular.department = metadata.departments[0] || "Local Self Government";
    } else if (circular.departments.length > 0 && !circular.department) {
      circular.department = circular.departments[0];
    }

    if (!circular.category) {
      circular.category = metadata.category || "Circular";
    }
    if (!circular.priority) {
      circular.priority = metadata.priority || "Medium";
    }
    if (circular.keywords.length === 0) {
      circular.keywords = metadata.keywords || [];
    }

    // Parse/extract circularNumber if not set
    if (!circular.circularNumber) {
      const circularNumberMatch = fullText.match(/(?:circular|order|no|number)\.?\s*[:\/-]?\s*([A-Z0-9_\-\/]+)/i);
      circular.circularNumber = circularNumberMatch ? circularNumberMatch[1] : `CIR-${Date.now()}`;
    }

    // pdfUrl
    circular.pdfUrl = `/uploads/${circular.filename}`;

    // Dates
    if (!circular.issueDate) {
      const datePattern = /\b\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\b/;
      const dateMatch = fullText.match(datePattern);
      const extractedDate = dateMatch ? new Date(dateMatch[0]) : new Date();
      circular.issueDate = isNaN(extractedDate.getTime()) ? new Date() : extractedDate;
    }
    if (!circular.effectiveDate) {
      circular.effectiveDate = circular.issueDate;
    }

    await circular.save();

    // Tag every page-document with our own metadata BEFORE splitting
    for (const doc of pageDocuments) {
      const pageNumber = doc.metadata?.loc?.pageNumber ?? 0;
      doc.metadata = {
        source: circular.title, // human-readable name, used directly in citations
        circularId: circular._id.toString(),
        circularNumber: circular.circularNumber || "",
        page: pageNumber,
      };
    }

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 500,
      chunkOverlap: 75,
    });
    const chunks = await splitter.splitDocuments(pageDocuments);
    console.log(`Split circular into ${chunks.length} chunks across ${pageDocuments.length} pages.`);

    circular.status = "embedding";
    await circular.save();

    const vectorStore = await getVectorStore();

    circular.status = "saving";
    await circular.save();

    const documentIds = await vectorStore.addDocuments(chunks);

    circular.status = "ingested";
    circular.chromaDocumentIds = documentIds;
    circular.vectorIndexed = true; // Set vectorIndexed=true after successful indexing
    await circular.save();

    console.log(`Ingestion completed successfully for: ${circular.title}`);
  } catch (err) {
    console.error(`Ingestion failed for circular ${circularId}:`, err);
    circular.status = "failed";
    circular.errorDetails = err.message || "Unknown error during ingestion";
    circular.vectorIndexed = false;
    await circular.save();
    throw err;
  }
}

/**
 * Re-extract full page text on demand (used for "Key Points", which we
 * don't precompute at ingestion time the way we do the main summary).
 */
export async function extractFullText(circular) {
  const loader = new PDFLoader(circular.filepath, { splitPages: true });
  const pageDocuments = await loader.load();
  return pageDocuments.map((d) => d.pageContent).join("\n\n");
}
