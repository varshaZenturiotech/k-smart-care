import express from "express";
import * as meetingController from "../controllers/meeting.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { validateMeeting } from "../middleware/task.validator.js";

const router = express.Router();

router.get("/", requireAuth, meetingController.getMeetings);
router.post("/", requireAuth, validateMeeting, meetingController.createMeeting);
router.put("/:id", requireAuth, validateMeeting, meetingController.updateMeeting);
router.delete("/:id", requireAuth, meetingController.deleteMeeting);

export default router;
