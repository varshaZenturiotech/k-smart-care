import mongoose from "mongoose";
import { ALL_DISTRICTS } from "../config/departments.js";

const newsSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true, trim: true },
    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // Same targeting shape as Circular, but always human-set (no AI
    // suggestion step - these are short enough that admins just pick directly).
    departments: [{ type: String, required: true }],
    district: { type: String, default: ALL_DISTRICTS },
  },
  { timestamps: true }
);

export default mongoose.model("News", newsSchema);