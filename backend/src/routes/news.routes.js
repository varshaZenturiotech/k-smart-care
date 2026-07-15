import express from "express";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";
import * as newsController from "../controllers/news.controller.js";

const router = express.Router();

// Department/district-filtered feed for the dashboard - any logged-in employee
router.get("/feed", requireAuth, newsController.getNewsFeed);

// Unfiltered list, for admins managing announcements
router.get("/", requireAuth, requireRole("department_head", "district_admin", "state_admin"), newsController.listAllNews);

// Post a news item - restricted so regular employees can't broadcast to everyone
router.post("/", requireAuth, requireRole("department_head", "district_admin", "state_admin"), newsController.createNews);

router.delete("/:id", requireAuth, requireRole("department_head", "district_admin", "state_admin"), newsController.deleteNews);

export default router;