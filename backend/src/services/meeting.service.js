import Meeting from "../models/Meeting.model.js";
import Task from "../models/Task.model.js";

/**
 * Get all active meetings for an employee from start of today onwards
 */
export async function getMeetings(employeeId) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const meetings = await Meeting.find({
    participant: employeeId,
    status: { $ne: "Cancelled" },
    startTime: { $gte: startOfToday }
  }).sort({ startTime: 1 });

  return meetings.map(m => {
    const mObj = m.toObject();
    const mDate = m.startTime ? new Date(m.startTime) : null;
    const isToday = mDate && mDate >= startOfToday && mDate <= endOfToday;
    return {
      ...mObj,
      meetingType: isToday ? "today" : "upcoming"
    };
  });
}

/**
 * Get meetings strictly categorized into todayMeetings and upcomingMeetings
 */
export async function getCategorizedMeetings(employeeId) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const legacyMeetings = await Meeting.find({
    participant: employeeId,
    status: { $ne: "Cancelled" },
    startTime: { $gte: startOfToday }
  }).sort({ startTime: 1 });

  const taskMeetings = await Task.find({
    employee: employeeId,
    category: "Meeting",
    status: { $in: ["Pending", "In Progress"] },
    dueDate: { $gte: startOfToday }
  }).sort({ dueDate: 1, dueTime: 1 });

  const todayMeetings = [];
  const upcomingMeetings = [];

  for (const m of legacyMeetings) {
    const item = m.toObject();
    item._source = "meeting";
    item.id = item._id.toString();
    const mDate = new Date(m.startTime);
    if (mDate >= startOfToday && mDate <= endOfToday) {
      item.meetingType = "today";
      todayMeetings.push(item);
    } else if (mDate > endOfToday) {
      item.meetingType = "upcoming";
      upcomingMeetings.push(item);
    }
  }

  for (const t of taskMeetings) {
    const item = {
      ...t.toObject(),
      _source: "task",
      id: t._id.toString(),
      title: t.title,
      description: t.description,
      startTime: t.dueDate,
      startTimeStr: t.dueTime,
      endTimeStr: null,
      location: t.location || t.meetingType || "Offline",
      onlineLink: t.meetingLink || null,
      participants: t.participants || []
    };
    const tDate = new Date(t.dueDate);
    if (tDate >= startOfToday && tDate <= endOfToday) {
      item.meetingType = "today";
      todayMeetings.push(item);
    } else if (tDate > endOfToday) {
      item.meetingType = "upcoming";
      upcomingMeetings.push(item);
    }
  }

  return { todayMeetings, upcomingMeetings };
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
