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
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: "Text prompt is required." });
    }
    const taskData = await taskService.createTaskFromNlp(employeeId, text);
    return res.status(200).json(taskData);
  } catch (err) {
    console.error("Error in createTaskFromNlp controller:", err);
    return res.status(500).json({ error: err.message || "Failed to extract task from text." });
  }
}

export const createNlpTask = createTaskFromNlp;