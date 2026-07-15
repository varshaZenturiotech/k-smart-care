import express from "express";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";
import { uploadCircular } from "../middleware/upload.middleware.js";
import * as circularController from "../controllers/circular.controller.js";

const router = express.Router();

// Upload a new circular PDF (Admin only)
router.post(
  "/upload",
  requireAuth,
  requireRole("Admin"),
  uploadCircular.any(),
  circularController.uploadCircularFile
);

// List all circulars (used by the AI Assistant panel - unfiltered by department)
router.get("/", requireAuth, circularController.listCirculars);

// Department/district-filtered feed for the employee's dashboard.
// Must be declared BEFORE /:id, or Express will match "feed" as an :id.
router.get("/feed", requireAuth, circularController.getCircularFeed);

// Semantic search
router.post("/search", requireAuth, circularController.searchCirculars);

// Get AI task suggestion for circular
router.get("/:id/task-suggestion", requireAuth, circularController.getCircularTaskSuggestion);

// Get a single circular status
router.get("/:id", requireAuth, circularController.getCircularStatus);

// Get an on-demand insight: ?type=summary (default) or ?type=keypoints
router.get("/:id/insight", requireAuth, circularController.getCircularInsight);

// Override the AI-suggested department tag(s) (Admin only)
router.patch("/:id/department", requireAuth, requireRole("Admin"), circularController.updateCircularDepartments);

// Reprocess a circular (Admin only)
router.post("/:id/reprocess", requireAuth, requireRole("Admin"), circularController.reprocessCircular);

// Update general metadata details (Admin only)
router.patch("/:id/metadata", requireAuth, requireRole("Admin"), circularController.updateCircularMetadata);

// Delete a circular (Admin only)
router.delete("/:id", requireAuth, requireRole("Admin"), circularController.deleteCircular);

export default router;
