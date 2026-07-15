import express from "express";
import * as taskController from "../controllers/task.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { validateTask } from "../middleware/task.validator.js";

const router = express.Router();

router.get("/", requireAuth, taskController.getTasks);
router.get("/today", requireAuth, taskController.getTodayTasks);
router.get("/upcoming", requireAuth, taskController.getUpcomingTasks);
router.get("/overdue", requireAuth, taskController.getOverdueTasks);
router.get("/meetings/upcoming", requireAuth, taskController.getScheduledMeetingTasks);
router.post("/", requireAuth, validateTask, taskController.createTask);
router.post("/nlp", requireAuth, taskController.createTaskFromNlp);
router.put("/:id", requireAuth, validateTask, taskController.updateTask);
router.patch("/:id/status", requireAuth, taskController.updateTaskStatus);
router.delete("/:id", requireAuth, taskController.deleteTask);

export default router;
