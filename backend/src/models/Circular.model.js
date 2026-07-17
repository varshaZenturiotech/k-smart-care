import mongoose from "mongoose";
import { ALL_DISTRICTS } from "../config/departments.js";

const circularSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    filename: { type: String, required: true, unique: true },
    filepath: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    
    // Improved fields as requested in Step 3
    circularNumber: { type: String, default: "" },
    department: { type: String, default: "" },
    category: { type: String, default: "" },
    priority: { type: String, default: "" },
    issueDate: { type: Date },
    effectiveDate: { type: Date },
    pdfUrl: { type: String, default: "" },
    vectorIndexed: { type: Boolean, default: false },

    summary: { type: String, default: "" },
    keyPoints: { type: String, default: "" },
    pageCount: { type: Number, default: 0 },
    remarks: { type: String, default: "" },
    keywords: [{ type: String }],

    // Department targeting: `departments` is what's actually used for
    // filtering; `aiSuggestedDepartments` is kept separately so the UI can
    // show "AI suggested: Health" even after a human overrides it.
    // `departmentConfirmed` flips to true the moment a human edits the tag,
    // so a later re-ingestion (e.g. reprocessing) won't silently overwrite
    // their correction with a new AI guess.
    departments: [{ type: String }],
    aiSuggestedDepartments: [{ type: String }],
    departmentConfirmed: { type: Boolean, default: false },
    district: { type: String, default: ALL_DISTRICTS },

    status: {
      type: String,
      enum: ["uploaded", "parsing", "chunking", "embedding", "saving", "ingested", "failed"],
      default: "uploaded",
    },
    errorDetails: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.model("Circular", circularSchema);