import express from "express";
import * as wellnessController from "../controllers/wellness.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { validateCheckin } from "../middleware/wellness.validator.js";

const router = express.Router();

// GET today's status
router.get("/today", requireAuth, wellnessController.getToday);

// POST submit checkin
router.post("/checkin", requireAuth, validateCheckin, wellnessController.submitCheckin);

// POST skip today's checkin
router.post("/skip", requireAuth, wellnessController.skipToday);

// GET history of checkins
router.get("/history", requireAuth, wellnessController.getHistory);

export default router;
