import * as meetingService from "../services/meeting.service.js";

export async function getMeetings(req, res) {
  try {
    const employeeId = req.user.id;
    const categorized = await meetingService.getCategorizedMeetings(employeeId);
    return res.status(200).json(categorized);
  } catch (err) {
    console.error("Error in getMeetings controller:", err);
    return res.status(500).json({ error: "Failed to retrieve meetings." });
  }
}

export async function createMeeting(req, res) {
  try {
    const employeeId = req.user.id;
    const meeting = await meetingService.createMeeting(employeeId, req.body);
    return res.status(201).json(meeting);
  } catch (err) {
    console.error("Error in createMeeting controller:", err);
    return res.status(500).json({ error: "Failed to create meeting." });
  }
}

export async function updateMeeting(req, res) {
  try {
    const employeeId = req.user.id;
    const meetingId = req.params.id;
    const meeting = await meetingService.updateMeeting(employeeId, meetingId, req.body);
    return res.status(200).json(meeting);
  } catch (err) {
    console.error("Error in updateMeeting controller:", err);
    return res.status(500).json({ error: err.message || "Failed to update meeting." });
  }
}

export async function deleteMeeting(req, res) {
  try {
    const employeeId = req.user.id;
    const meetingId = req.params.id;
    const result = await meetingService.deleteMeeting(employeeId, meetingId);
    return res.status(200).json(result);
  } catch (err) {
    console.error("Error in deleteMeeting controller:", err);
    return res.status(500).json({ error: err.message || "Failed to delete meeting." });
  }
}
