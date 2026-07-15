/**
 * Validator for Task and Meeting inputs
 */
import { normalizeTaskDataToEnglish } from "../services/task.service.js";

const VALID_CATEGORIES = ["Official Work", "Government Circular", "Meeting", "Follow-up", "Personal Reminder", "Training", "Other"];
const VALID_PRIORITIES = ["High", "Medium", "Low", "high", "medium", "low"];
const VALID_STATUSES = ["Pending", "In Progress", "Completed", "Cancelled", "pending", "in_progress", "completed"];
const VALID_SOURCES = ["Manual", "AI", "Circular", "Meeting"];

export function validateTask(req, res, next) {
  if (req.body) {
    const normalized = normalizeTaskDataToEnglish(req.body);
    Object.assign(req.body, normalized);
  }
  const { title, category, priority, status, source, dueDate } = req.body;

  if (!title || typeof title !== "string" || !title.trim()) {
    return res.status(400).json({ error: "Missing or invalid 'title'. Must be a non-empty string." });
  }

  if (category && !VALID_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: `Invalid 'category'. Must be one of: ${VALID_CATEGORIES.join(", ")}` });
  }

  if (priority && !VALID_PRIORITIES.includes(priority)) {
    return res.status(400).json({ error: `Invalid 'priority'. Must be one of: ${VALID_PRIORITIES.join(", ")}` });
  }

  if (status && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Invalid 'status'. Must be one of: ${VALID_STATUSES.join(", ")}` });
  }

  if (source && !VALID_SOURCES.includes(source)) {
    return res.status(400).json({ error: `Invalid 'source'. Must be one of: ${VALID_SOURCES.join(", ")}` });
  }

  if (dueDate && isNaN(Date.parse(dueDate))) {
    return res.status(400).json({ error: "Invalid 'dueDate'. Must be a valid date string." });
  }

  next();
}

export function validateMeeting(req, res, next) {
  const { title, startTime, endTime } = req.body;

  if (!title || typeof title !== "string" || !title.trim()) {
    return res.status(400).json({ error: "Missing or invalid 'title'. Must be a non-empty string." });
  }

  if (!startTime || isNaN(Date.parse(startTime))) {
    return res.status(400).json({ error: "Missing or invalid 'startTime'. Must be a valid ISO date string." });
  }

  if (!endTime || isNaN(Date.parse(endTime))) {
    return res.status(400).json({ error: "Missing or invalid 'endTime'. Must be a valid ISO date string." });
  }

  next();
}
