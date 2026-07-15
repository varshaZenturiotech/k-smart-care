import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    employeeId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      default: "",
    },
    designation: {
      type: String,
      default: "",
    },
    department: {
      type: String,
      required: true,
      trim: true,
    },
    district: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ["Admin", "HR", "District Admin", "Department Head", "Employee"],
      default: "Employee",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
    },
    deviceId: {
      type: String,
      default: "",
    },
    preferredLanguage: {
      type: String,
      enum: ["auto", "malayalam", "english"],
      lowercase: true,
      default: "auto",
    },
  },
  { timestamps: true }
);

// Convert preferredLanguage to lowercase before validation runs
userSchema.pre("validate", function (next) {
  if (this.preferredLanguage) {
    this.preferredLanguage = this.preferredLanguage.toLowerCase();
  }
  next();
});

// Hash password before saving if it has been modified
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    return next();
  }
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model("User", userSchema);
