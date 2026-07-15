import mongoose from "mongoose";

const dailyBriefingSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    dateString: {
      type: String,
      required: true,
    },
    language: {
      type: String,
      required: true,
    },
    inputFingerprint: {
      type: String,
      required: true,
    },
    briefing: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to ensure quick lookups and uniqueness per day per language per user
dailyBriefingSchema.index({ employeeId: 1, dateString: 1, language: 1 }, { unique: true });

export default mongoose.models.DailyBriefing || mongoose.model("DailyBriefing", dailyBriefingSchema);
