import express from "express";
import { askQuestion, getSuggestions, getWelcomeGreeting } from "../controllers/assistant.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = express.Router();

/**
 * @route   POST /api/assistant/ask
 * @desc    Submit question to K-SMART CARE Workplace AI Assistant
 * @access  Private
 */
router.post("/ask", requireAuth, askQuestion);

/**
 * @route   POST /api/assistant/suggestions
 * @desc    Get AI-generated or default prompt suggestions
 * @access  Private
 */
router.post("/suggestions", requireAuth, getSuggestions);

/**
 * @route   GET / POST /api/assistant/welcome
 * @desc    Get dynamic time-sensitive and bilingual welcome message
 * @access  Private
 */
router.get("/welcome", requireAuth, getWelcomeGreeting);
router.post("/welcome", requireAuth, getWelcomeGreeting);

export default router;
