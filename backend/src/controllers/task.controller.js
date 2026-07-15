import * as taskService from "../services/task.service.js";

export async function getTasks(req, res) {
  try {
    const employeeId = req.user.id;
    const tasks = await taskService.getTasks(employeeId);
    return res.status(200).json(tasks);
  } catch (err) {
    console.error("Error in getTasks controller:", err);
    return res.status(500).json({ error: "Failed to retrieve tasks." });
  }
}

export async function getTodayTasks(req, res) {
  try {
    const employeeId = req.user.id;
    const tasks = await taskService.getTodayTasks(employeeId);
    return res.status(200).json(tasks);
  } catch (err) {
    console.error("Error in getTodayTasks controller:", err);
    return res.status(500).json({ error: "Failed to retrieve today's tasks." });
  }
}

export async function getUpcomingTasks(req, res) {
  try {
    const employeeId = req.user.id;
    const tasks = await taskService.getUpcomingTasks(employeeId);
    return res.status(200).json(tasks);
  } catch (err) {
    console.error("Error in getUpcomingTasks controller:", err);
    return res.status(500).json({ error: "Failed to retrieve upcoming tasks." });
  }
}

export async function getOverdueTasks(req, res) {
  try {
    const employeeId = req.user.id;
    const tasks = await taskService.getOverdueTasks(employeeId);
    return res.status(200).json(tasks);
  } catch (err) {
    console.error("Error in getOverdueTasks controller:", err);
    return res.status(500).json({ error: "Failed to retrieve overdue tasks." });
  }
}

export async function getScheduledMeetingTasks(req, res) {
  try {
    const employeeId = req.user.id;
    const tasks = await taskService.getScheduledMeetingTasks(employeeId);
    return res.status(200).json(tasks);
  } catch (err) {
    console.error("Error in getScheduledMeetingTasks controller:", err);
    return res.status(500).json({ error: "Failed to retrieve scheduled meeting tasks." });
  }
}

export async function createTask(req, res) {
  try {
    const employeeId = req.user.id;
    const task = await taskService.createTask(employeeId, req.body);
    return res.status(201).json(task);
  } catch (err) {
    console.error("Error in createTask controller:", err);
    return res.status(500).json({ error: "Failed to create task." });
  }
}

export async function updateTask(req, res) {
  try {
    const employeeId = req.user.id;
    const taskId = req.params.id;
    const task = await taskService.updateTask(employeeId, taskId, req.body);
    return res.status(200).json(task);
  } catch (err) {
    console.error("Error in updateTask controller:", err);
    return res.status(500).json({ error: err.message || "Failed to update task." });
  }
}

export async function updateTaskStatus(req, res) {
  try {
    const employeeId = req.user.id;
    const taskId = req.params.id;
    const { status } = req.body;
    const task = await taskService.updateTaskStatus(employeeId, taskId, status);
    return res.status(200).json(task);
  } catch (err) {
    console.error("Error in updateTaskStatus controller:", err);
    return res.status(500).json({ error: err.message || "Failed to update task status." });
  }
}

export async function deleteTask(req, res) {
  try {
    const employeeId = req.user.id;
    const taskId = req.params.id;
    const result = await taskService.deleteTask(employeeId, taskId);
    return res.status(200).json(result);
  } catch (err) {
    console.error("Error in deleteTask controller:", err);
    return res.status(500).json({ error: err.message || "Failed to delete task." });
  }
}

export async function createTaskFromNlp(req, res) {
  try {
    const employeeId = req.user.id;
    const { text } = req.body;
    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ error: "Missing or invalid 'text' in request body." });
    }
    // preferredLanguage ("auto" | "english" | "malayalam") lives on the employee profile.
    // req.user is expected to already carry it (populated by the auth middleware/JWT payload).
    // Falls back to "auto" if the profile hasn't set a preference yet.
    const preferredLanguage = req.user.preferredLanguage || "auto";
    const taskDetails = await taskService.createTaskFromNlp(employeeId, text, preferredLanguage);
    return res.status(200).json(taskDetails);
  } catch (err) {
    console.error("Error in createTaskFromNlp controller:", err);
    return res.status(500).json({ error: err.message || "Failed to create task from NLP." });
  }
}