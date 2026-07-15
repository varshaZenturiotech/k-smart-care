import bcrypt from "bcryptjs";
import User from "../models/User.model.js";
import { signToken } from "../utils/jwt.util.js";

// NOTE: In production this endpoint gets replaced by K-SMART SSO token
// exchange (Module 1). This local register/login lets you build and demo
// every other module today without waiting on SSO integration.
export async function register(req, res) {
  try {
    const { name, email, password, district, department, designation, role, employeeId } = req.body;

    if (!name || !email || !password || !district || !department) {
      return res.status(400).json({ error: req.t("auth.required", "name, email, password, district, and department are required.") });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ error: req.t("auth.exists", "An account with this email already exists.") });
    }

    // Generate a temporary employeeId if not provided to satisfy validation constraints
    const finalEmployeeId = employeeId || `EMP${Math.floor(1000 + Math.random() * 9000)}`;

    const user = await User.create({
      employeeId: finalEmployeeId,
      name,
      email: email.toLowerCase(),
      password, // Automatically hashed by the pre-save hook in User.model.js
      district,
      department,
      designation,
      role: role || "Employee",
    });

    const token = signToken(user);
    return res.status(201).json({
      token,
      user: sanitizeUser(user),
    });
  } catch (err) {
    console.error("Register error:", err);
    return res.status(500).json({ error: req.t("auth.reg_failed", "Registration failed.") });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: req.t("auth.login_required", "email and password are required.") });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: req.t("auth.invalid", "Invalid email or password.") });
    }

    // Use our Phase 1 model comparePassword method
    const isValid = await user.comparePassword(password);
    if (!isValid) {
      return res.status(401).json({ error: req.t("auth.invalid", "Invalid email or password.") });
    }

    user.lastLogin = new Date();
    await user.save();

    const token = signToken(user);
    return res.json({
      token,
      user: sanitizeUser(user),
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: req.t("auth.login_failed", "Login failed.") });
  }
}

export async function getCurrentUser(req, res) {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ error: req.t("auth.not_found", "User not found.") });
  return res.json({ user: sanitizeUser(user) });
}

function sanitizeUser(user) {
  return {
    id: user._id,
    employeeId: user.employeeId,
    name: user.name,
    email: user.email,
    role: user.role,
    designation: user.designation,
    district: user.district,
    department: user.department,
    preferredLanguage: user.preferredLanguage || "auto",
  };
}

export async function updatePreferredLanguage(req, res) {
  const { preferredLanguage } = req.body;
  const valid = ["auto", "malayalam", "english"];
  if (!valid.includes(preferredLanguage)) {
    return res.status(400).json({ error: req.t("auth.lang_invalid", "preferredLanguage must be 'auto', 'malayalam', or 'english'.") });
  }
  try {
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { preferredLanguage },
      { new: true }
    );
    return res.json({ user: sanitizeUser(user) });
  } catch (err) {
    console.error("Update language error:", err);
    return res.status(500).json({ error: req.t("auth.lang_failed", "Failed to update preferred language.") });
  }
}

