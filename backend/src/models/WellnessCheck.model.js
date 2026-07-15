import mongoose from "mongoose";

const wellnessCheckSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Keep 'user' for backward compatibility
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    dateString: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "completed", "skipped"],
      required: true,
      default: "pending",
    },
    mood: {
      type: String,
      enum: ["great", "good", "okay", "tired", "overwhelmed"],
      required: true,
    },
    sleepHours: {
      type: String,
      enum: ["<4", "4-5", "6-7", "8+"],
    },
    energy: {
      type: String,
      enum: ["Very Low", "Low", "Moderate", "High", "Excellent"],
    },
    stress: {
      type: String,
      enum: ["Very Low", "Low", "Moderate", "High", "Very High"],
    },
    workload: {
      type: String,
      enum: ["Light", "Normal", "Heavy", "Very Heavy"],
    },
    note: {
      type: String,
      default: "",
    },
    wellnessScore: {
      type: Number,
      min: 0,
      max: 100,
    },
    focusScore: {
      type: Number,
      min: 0,
      max: 100,
    },
    burnoutRisk: {
      type: String,
      enum: ["Low", "Medium", "High"],
    },
    aiSummary: {
      type: String,
      default: "",
    },
    recommendations: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Pre-validate hook to synchronize 'user' and 'employeeId' and populate 'dateString'
wellnessCheckSchema.pre("validate", function (next) {
  if (!this.employeeId && this.user) {
    this.employeeId = this.user;
  }
  if (!this.user && this.employeeId) {
    this.user = this.employeeId;
  }
  if (!this.dateString) {
    const d = this.date || new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    this.dateString = `${year}-${month}-${day}`;
  }
  next();
});

// One check-in record per employee per calendar day
wellnessCheckSchema.index({ employeeId: 1, dateString: 1 }, { unique: true });

export default mongoose.models.WellnessCheck || mongoose.model("WellnessCheck", wellnessCheckSchema);
