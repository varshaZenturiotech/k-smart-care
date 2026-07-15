import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Circular from "../models/Circular.model.js";
import { getVectorStore } from "./vectorStore.service.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.join(__dirname, "../../uploads");

// Ensure upload directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/**
 * Save circular metadata after uploading
 */
export async function createCircular(data) {
  const circular = new Circular({
    title: data.title,
    filename: data.filename,
    filepath: data.filepath,
    mimeType: data.mimeType,
    size: data.size,
    uploadedBy: data.userId || data.uploadedBy,
    circularNumber: data.circularNumber || "",
    category: data.category || "",
    priority: data.priority || "",
    issueDate: data.issueDate || undefined,
    effectiveDate: data.effectiveDate || undefined,
    departments: data.departments || [],
    department: data.department || "",
    departmentConfirmed: data.departmentConfirmed || false,
    remarks: data.remarks || "",
    status: "uploaded",
  });
  return await circular.save();
}

/**
 * List all circulars
 */
export async function getAllCirculars() {
  return await Circular.find().populate("uploadedBy", "name email designation").sort({ createdAt: -1 });
}

/**
 * Find a circular by ID
 */
export async function getCircularById(id) {
  return await Circular.findById(id).populate("uploadedBy", "name email designation");
}

/**
 * Delete a circular by ID (removes database record, local file, and vectors)
 */
export async function deleteCircular(id) {
  const circular = await Circular.findById(id);
  if (!circular) {
    throw new Error("Circular not found");
  }

  // Delete vectors from ChromaDB
  if (circular.chromaDocumentIds && circular.chromaDocumentIds.length > 0) {
    try {
      const vectorStore = await getVectorStore();
      await vectorStore.delete({ ids: circular.chromaDocumentIds });
      console.log(`Deleted ${circular.chromaDocumentIds.length} vectors from ChromaDB.`);
    } catch (err) {
      console.error(`Failed to delete vectors from ChromaDB for circular ${id}:`, err);
    }
  }

  // Delete file from disk if it exists
  if (fs.existsSync(circular.filepath)) {
    try {
      fs.unlinkSync(circular.filepath);
    } catch (err) {
      console.error(`Failed to delete physical file at ${circular.filepath}:`, err);
    }
  }

  // Remove database record
  await Circular.findByIdAndDelete(id);
  return circular;
}
