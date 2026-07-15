import * as wellnessService from "../services/wellness.service.js";

/**
 * GET /api/wellness/today
 * Retrieve today's wellness check status for the logged-in employee
 */
export async function getToday(req, res) {
  try {
    const employeeId = req.user.id;
    const status = await wellnessService.getTodayStatus(employeeId);
    return res.status(200).json(status);
  } catch (err) {
    console.error("Error in getToday wellness controller:", err);
    return res.status(500).json({ error: "Failed to retrieve today's wellness status." });
  }
}

/**
 * POST /api/wellness/checkin
 * Submit today's wellness answers
 */
export async function submitCheckin(req, res) {
  try {
    const employeeId = req.user.id;
    const record = await wellnessService.submitCheckin(employeeId, req.body, req.language);
    return res.status(200).json({ success: true, data: record });
  } catch (err) {
    console.error("Error in submitCheckin wellness controller:", err);
    return res.status(500).json({ error: "Failed to submit today's wellness check-in." });
  }
}

/**
 * POST /api/wellness/skip
 * Skip today's wellness check-in
 */
export async function skipToday(req, res) {
  try {
    const employeeId = req.user.id;
    const result = await wellnessService.skipToday(employeeId);
    return res.status(200).json(result);
  } catch (err) {
    console.error("Error in skipToday wellness controller:", err);
    return res.status(500).json({ error: "Failed to skip today's wellness check-in." });
  }
}

/**
 * GET /api/wellness/history
 * Retrieve the wellness check history for the logged-in employee
 */
export async function getHistory(req, res) {
  try {
    const employeeId = req.user.id;
    const history = await wellnessService.getHistory(employeeId);
    return res.status(200).json({ success: true, history });
  } catch (err) {
    console.error("Error in getHistory wellness controller:", err);
    return res.status(500).json({ error: "Failed to retrieve wellness check history." });
  }
}
