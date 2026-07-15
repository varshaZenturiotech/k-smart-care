import express from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import User from "../models/User.model.js";

const router = express.Router();

// GET /api/profile
router.get("/", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("preferredLanguage");
    if (!user) {
      return res.status(404).json({ error: req.t("auth.not_found", "User not found.") });
    }
    return res.json({
      preferredLanguage: user.preferredLanguage || "auto"
    });
  } catch (err) {
    console.error("GET /api/profile error:", err);
    return res.status(500).json({ error: req.t("common.error", "Something went wrong.") });
  }
});

// PUT /api/profile
router.put("/", requireAuth, async (req, res) => {
  const { preferredLanguage } = req.body;
  const valid = ["auto", "malayalam", "english"];
  if (!preferredLanguage || !valid.includes(preferredLanguage.toLowerCase())) {
    return res.status(400).json({
      error: req.t("auth.lang_invalid", "preferredLanguage must be 'auto', 'malayalam', or 'english'.")
    });
  }

  try {
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { preferredLanguage: preferredLanguage.toLowerCase() },
      { new: true }
    );
    if (!user) {
      return res.status(404).json({ error: req.t("auth.not_found", "User not found.") });
    }
    return res.json({
      preferredLanguage: user.preferredLanguage
    });
  } catch (err) {
    console.error("PUT /api/profile error:", err);
    return res.status(500).json({ error: req.t("auth.lang_failed", "Failed to update preferred language.") });
  }
});

export default router;
