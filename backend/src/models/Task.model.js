import mongoose from "mongoose";

const taskSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // Alias for backward compatibility
    title: { type: String, required: true },
    description: { type: String },
    category: {
      type: String,
      enum: ["Official Work", "Government Circular", "Meeting", "Follow-up", "Personal Reminder", "Training", "Other"],
      default: "Official Work"
    },
    priority: {
      type: String,
      enum: ["High", "Medium", "Low", "high", "medium", "low"],
      default: "Medium"
    },
    dueDate: { type: Date },
    dueTime: { type: String },
    status: {
      type: String,
      enum: ["Pending", "In Progress", "Completed", "Cancelled", "pending", "in_progress", "completed"],
      default: "Pending"
    },
    reminder: { type: Boolean, default: false },
    source: {
      type: String,
      enum: ["Manual", "AI", "Circular", "Meeting"],
      default: "Manual"
    },
    circularId: { type: mongoose.Schema.Types.ObjectId, ref: "Circular" },
    meetingId: { type: mongoose.Schema.Types.ObjectId, ref: "Meeting" },
    // Meeting-specific structured fields. Only meaningful when category === "Meeting";
    // left undefined/null for all other categories rather than enforced as required,
    // since a Task document is shared across every category.
    meetingType: {
      type: String,
      enum: ["Offline", "Online", "Hybrid"]
    },
    location: { type: String },
    meetingLink: { type: String },
    participants: [{ type: String }],
    department: { type: String },
    notes: { type: String },
    completedAt: { type: Date },
    language: {
      type: String,
      enum: ["English", "Malayalam", "Mixed"],
      default: "English"
    }
  },
  { timestamps: true }
);

// Pre-save hook to map alias and normalize values to TitleCase
taskSchema.pre("save", function (next) {
  if (this.employee && !this.assignedTo) {
    this.assignedTo = this.employee;
  } else if (this.assignedTo && !this.employee) {
    this.employee = this.assignedTo;
  }

  // Normalize priority to TitleCase
  if (this.priority) {
    const p = this.priority.toLowerCase();
    this.priority = p.charAt(0).toUpperCase() + p.slice(1);
  }

  // Normalize status to TitleCase
  if (this.status) {
    let s = this.status.toLowerCase();
    if (s === "in_progress") {
      this.status = "In Progress";
    } else {
      this.status = s.charAt(0).toUpperCase() + s.slice(1);
    }
  }

  if (this.status === "Completed" && !this.completedAt) {
    this.completedAt = new Date();
  }

  next();
});

export default mongoose.model("Task", taskSchema);