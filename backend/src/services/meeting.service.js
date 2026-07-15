import Meeting from "../models/Meeting.model.js";

/**
 * Get all meetings for an employee
 */
export async function getMeetings(employeeId) {
  return await Meeting.find({ participant: employeeId }).sort({ startTime: 1 });
}

/**
 * Create a meeting
 */
export async function createMeeting(employeeId, meetingData) {
  let { startTime, endTime, startDate, startTimeStr, endTimeStr } = meetingData;

  // If Date objects are not parsed yet, parse them
  const startDt = new Date(startTime);
  const endDt = new Date(endTime);

  const meeting = new Meeting({
    ...meetingData,
    participant: employeeId,
    startTime: startDt,
    endTime: endDt,
    startDate: startDate ? new Date(startDate) : new Date(startDt.getFullYear(), startDt.getMonth(), startDt.getDate())
  });

  return await meeting.save();
}

/**
 * Update a meeting
 */
export async function updateMeeting(employeeId, meetingId, meetingData) {
  const meeting = await Meeting.findOne({ _id: meetingId, participant: employeeId });
  if (!meeting) throw new Error("Meeting not found or access denied");

  if (meetingData.startTime) {
    meetingData.startTime = new Date(meetingData.startTime);
  }
  if (meetingData.endTime) {
    meetingData.endTime = new Date(meetingData.endTime);
  }
  if (meetingData.startDate) {
    meetingData.startDate = new Date(meetingData.startDate);
  }

  Object.assign(meeting, meetingData);
  return await meeting.save();
}

/**
 * Delete a meeting
 */
export async function deleteMeeting(employeeId, meetingId) {
  const result = await Meeting.deleteOne({ _id: meetingId, participant: employeeId });
  if (result.deletedCount === 0) throw new Error("Meeting not found or access denied");
  return { success: true };
}
