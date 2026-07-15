import mongoose from "mongoose";

const meetingSchema = new mongoose.Schema(
  {
    participant: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    description: { type: String },
    startDate: { type: Date },
    startTime: { type: Date, required: true }, // Keeping Date type for backward compatibility
    endTime: { type: Date, required: true }, // Keeping Date type for backward compatibility
    startTimeStr: { type: String }, // e.g. "10:00 AM"
    endTimeStr: { type: String }, // e.g. "11:00 AM"
    location: { type: String, default: "Online" },
    onlineLink: { type: String },
    participants: [{ type: String }],
    notes: { type: String },
    status: {
      type: String,
      enum: ["Scheduled", "Completed", "Cancelled"],
      default: "Scheduled"
    }
  },
  { timestamps: true }
);

// Pre-save hook to populate startDate and strings if missing
meetingSchema.pre("save", function (next) {
  if (this.startTime && !this.startDate) {
    this.startDate = new Date(this.startTime.getFullYear(), this.startTime.getMonth(), this.startTime.getDate());
  }
  next();
});

export default mongoose.model("Meeting", meetingSchema);
