import express from "express";
import { getDashboardSummary, submitMoodCheck, getDepartmentFeed } from "../controllers/dashboard.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(requireAuth);
router.get("/summary", getDashboardSummary);
router.post("/mood-check", submitMoodCheck);
router.get("/feed", getDepartmentFeed);

export default router;
