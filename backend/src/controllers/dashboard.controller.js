import Task from "../models/Task.model.js";
import Meeting from "../models/Meeting.model.js";
import WellnessCheck from "../models/WellnessCheck.model.js";
import User from "../models/User.model.js";
import Circular from "../models/Circular.model.js";
import translationService from "../translation/translationService.js";

function getHourInTimezone(date, timeZone) {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone
    });
    return parseInt(formatter.format(date), 10);
  } catch (err) {
    return date.getHours();
  }
}

// GET /api/dashboard/summary
export async function getDashboardSummary(req, res) {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found." });

    const employee = {
      name: user.name,
      department: user.department,
      district: user.district,
      role: user.role,
      designation: user.designation,
      email: user.email,
      phone: user.phone || "+91 9876543210",
    };

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const todayTasksDb = await Task.find({
      employee: user._id,
      status: { $in: ["Pending", "In Progress"] },
      dueDate: { $gte: startOfToday, $lte: endOfToday }
    });

    const overdueTasksDb = await Task.find({
      employee: user._id,
      status: { $in: ["Pending", "In Progress"] },
      dueDate: { $lt: startOfToday }
    });

    const completedTodayDb = await Task.find({
      employee: user._id,
      status: "Completed",
      completedAt: { $gte: startOfToday, $lte: endOfToday }
    });

    const legacyMeetingsDb = await Meeting.find({
      participant: user._id,
      status: { $ne: "Cancelled" },
      startTime: { $gte: startOfToday }
    }).sort({ startTime: 1 });

    const taskMeetingsDb = await Task.find({
      employee: user._id,
      category: "Meeting",
      status: { $in: ["Pending", "In Progress"] },
      dueDate: { $gte: startOfToday }
    }).sort({ dueDate: 1, dueTime: 1 });

    const todayTasks = todayTasksDb.map(t => ({
      id: t._id.toString(),
      _id: t._id.toString(),
      title: t.title,
      priority: t.priority,
      status: t.status,
      category: t.category,
      dueDate: t.dueDate ? t.dueDate.toISOString().split("T")[0] : "",
      dueTime: t.dueTime || ""
    }));

    const overdueTasks = overdueTasksDb.map(t => ({
      id: t._id.toString(),
      _id: t._id.toString(),
      title: t.title,
      priority: t.priority,
      status: t.status,
      category: t.category,
      dueDate: t.dueDate ? t.dueDate.toISOString().split("T")[0] : "",
      dueTime: t.dueTime || ""
    }));

    const completedToday = completedTodayDb.map(t => ({
      id: t._id.toString(),
      _id: t._id.toString(),
      title: t.title,
      priority: t.priority,
      status: t.status,
      category: t.category,
      dueDate: t.dueDate ? t.dueDate.toISOString().split("T")[0] : "",
      dueTime: t.dueTime || ""
    }));

    const todayMeetings = [];
    const upcomingMeetings = [];

    const formatMeetingItem = (item, source) => {
      const isTask = source === "task";
      return {
        id: item._id.toString(),
        _id: item._id.toString(),
        title: item.title,
        description: item.description || "",
        startTime: isTask ? (item.dueDate ? item.dueDate.toISOString() : "") : (item.startTime ? item.startTime.toISOString() : ""),
        endTime: isTask ? "" : (item.endTime ? item.endTime.toISOString() : ""),
        startTimeStr: isTask ? (item.dueTime || "") : (item.startTimeStr || ""),
        endTimeStr: isTask ? "" : (item.endTimeStr || ""),
        location: item.location || (isTask ? item.meetingType : "Online") || "Online",
        status: item.status,
        participants: item.participants || [],
        _source: source
      };
    };

    for (const m of legacyMeetingsDb) {
      const mDate = new Date(m.startTime);
      const formatted = formatMeetingItem(m, "meeting");
      if (mDate >= startOfToday && mDate <= endOfToday) {
        formatted.meetingType = "today";
        todayMeetings.push(formatted);
      } else if (mDate > endOfToday) {
        formatted.meetingType = "upcoming";
        upcomingMeetings.push(formatted);
      }
    }

    for (const t of taskMeetingsDb) {
      const tDate = new Date(t.dueDate);
      const formatted = formatMeetingItem(t, "task");
      if (tDate >= startOfToday && tDate <= endOfToday) {
        formatted.meetingType = "today";
        todayMeetings.push(formatted);
      } else if (tDate > endOfToday) {
        formatted.meetingType = "upcoming";
        upcomingMeetings.push(formatted);
      }
    }

    const pendingFiles = [...todayTasks, ...overdueTasks];

    const WellnessCheckModel = (await import("../models/WellnessCheck.model.js")).default;
    const { getTodayStatus } = await import("../services/wellness.service.js");
    const todayStatusResult = await getTodayStatus(user._id, req.language);
    const todayCheck = todayStatusResult.data;

    let wellnessScore = 80;
    let focusScore = 75;
    let burnoutRisk = "Low";
    let aiGreeting = `Good morning, ${user.name.split(" ")[0]}. Complete your Daily Wellness Check to personalize your K-SMART CARE recommendations!`;

    if (todayCheck && todayCheck.status === "completed") {
      wellnessScore = todayCheck.wellnessScore;
      focusScore = todayCheck.focusScore;
      burnoutRisk = todayCheck.burnoutRisk;
      if (todayCheck.aiSummary) {
        aiGreeting = `🌿 Today's Wellbeing Tip: ${todayCheck.aiSummary}`;
      } else {
        aiGreeting = `Good morning, ${user.name.split(" ")[0]}. Focus capacity is excellent today. A great time to tackle deep-reading of new circular documents.`;
      }
    } else {
      const recentChecks = await WellnessCheckModel.find({
        employeeId: user._id,
        status: "completed"
      }).sort({ dateString: -1 }).limit(5);

      if (recentChecks.length > 0) {
        wellnessScore = Math.round(recentChecks.reduce((sum, c) => sum + (c.wellnessScore || 80), 0) / recentChecks.length);
        focusScore = Math.round(recentChecks.reduce((sum, c) => sum + (c.focusScore || 75), 0) / recentChecks.length);
        burnoutRisk = recentChecks[0].burnoutRisk || "Low";
      }
    }

    const mood = {
      checkedInToday: todayCheck ? todayCheck.status === "completed" : false,
      todaysMood: (todayCheck && todayCheck.status === "completed") ? todayCheck.mood : "",
      skippedToday: todayCheck ? todayCheck.status === "skipped" : false,
      wellnessData: todayCheck && todayCheck.status === "completed" ? todayCheck : null,
      burnoutRisk,
    };

    const circulars = await Circular.find({
      status: "ingested",
      departments: { $in: [user.department, "All Departments"] }
    });

    const formatTimeTo12 = (timeStr) => {
      if (!timeStr) return "";
      const match = timeStr.match(/^(\d{2}):(\d{2})/);
      if (match) {
        let hours = parseInt(match[1], 10);
        const minutes = match[2];
        const ampm = hours >= 12 ? "PM" : "AM";
        hours = hours % 12;
        hours = hours ? hours : 12;
        const hoursStr = hours < 10 ? `0${hours}` : hours.toString();
        return `${hoursStr}:${minutes} ${ampm}`;
      }
      return timeStr;
    };

    const getMeeting12hTime = (m) => {
      if (m.startTimeStr) {
        return formatTimeTo12(m.startTimeStr);
      }
      if (m.startTime) {
        const dateObj = new Date(m.startTime);
        let hours = dateObj.getHours();
        const minutes = dateObj.getMinutes();
        const ampm = hours >= 12 ? "PM" : "AM";
        hours = hours % 12;
        hours = hours ? hours : 12;
        const hoursStr = hours < 10 ? `0${hours}` : hours.toString();
        const minutesStr = minutes < 10 ? `0${minutes}` : minutes.toString();
        return `${hoursStr}:${minutesStr} ${ampm}`;
      }
      return "";
    };

    const { generateDailyBriefing } = await import("../services/dailyBriefing.service.js");
    
    const preferredLang = user.preferredLanguage || "auto";
    let resolvedLang = "english";
    if (req.language === "ml" || req.language === "malayalam") {
      resolvedLang = "malayalam";
    } else if (req.language === "en" || req.language === "english") {
      resolvedLang = "english";
    } else {
      resolvedLang = preferredLang === "malayalam" ? "malayalam" : "english";
    }

    const briefingData = {
      employeeId: user._id.toString(),
      name: user.name,
      department: user.department,
      district: user.district,
      currentTime: new Date().toISOString(),
      localHour: getHourInTimezone(new Date(), req.headers["x-timezone"] || user.timezone || "Asia/Kolkata"),
      wellnessStatus: todayCheck ? todayCheck.status : "pending",
      wellnessScore,
      focusScore,
      burnoutRisk,
      todayTasksCount: todayTasks.length,
      todayTasksList: todayTasks.map(t => t.dueTime ? `${t.title} (due by ${formatTimeTo12(t.dueTime)})` : t.title),
      todayTasksObjects: todayTasksDb,
      overdueTasksCount: overdueTasks.length,
      overdueTasksList: overdueTasks.map(t => t.dueTime ? `${t.title} (was due by ${formatTimeTo12(t.dueTime)})` : t.title),
      overdueTasksObjects: overdueTasksDb,
      completedTaskTitles: completedTodayDb.map(t => t.title),
      upcomingMeetingsCount: todayMeetings.length,
      upcomingMeetingsList: todayMeetings.map(m => `${m.title} at ${getMeeting12hTime(m)}`),
      upcomingMeetingsObjects: todayMeetings,
      newCircularsCount: circulars.length,
      newCircularsList: circulars.map(c => c.title),
      preferredLanguage: preferredLang,
      resolvedLanguage: resolvedLang
    };

    const forceRefresh = req.query.refresh === "true";
    const briefing = await generateDailyBriefing(briefingData, forceRefresh);

    const responsePayload = {
      employee,
      pendingFiles,
      todayMeetings,
      wellnessScore,
      focusScore,
      burnoutRisk,
      mood,
      aiGreeting,

      briefing,
      newCircularsCount: circulars.length,

      todayTasks,
      completedToday,
      upcomingMeetings,
      overdueTasks,

      greeting: briefing?.greeting || (() => {
        const hour = new Date().getHours();
        let timeGreeting = "Good morning";
        if (hour >= 12 && hour < 17) timeGreeting = "Good afternoon";
        else if (hour >= 17) timeGreeting = "Good evening";
        return `${timeGreeting}, ${user.name.split(" ")[0]}`;
      })(),
      aiTip: todayCheck?.aiSummary || null,
      moodCheckedInToday: mood.checkedInToday,
      todaysMood: mood.todaysMood,
      pendingTasks: pendingFiles.map(f => ({ ...f, _id: f.id })),
      todaysMeetings: todayMeetings.map(m => ({ ...m, _id: m.id })),
    };

    let translated = responsePayload;
    try {
      translated = await translationService.translateResponse(responsePayload, req.language, "/api/dashboard/summary");
    } catch (transErr) {
      console.warn("[DashboardController] Localization fallback to English:", transErr.message);
      translated = responsePayload;
    }

    return res.json(translated);
  } catch (err) {
    console.error("Dashboard summary error:", err);
    res.status(500).json({ error: "Failed to load dashboard." });
  }
}

// POST /api/dashboard/mood-check
export async function submitMoodCheck(req, res) {
  try {
    const { mood, sleepHours, energyLevel, stressLevel } = req.body;
    const validMoods = ["great", "good", "okay", "tired", "overwhelmed"];

    if (!mood || !validMoods.includes(mood)) {
      return res.status(400).json({ error: `mood must be one of: ${validMoods.join(", ")}` });
    }

    const check = await WellnessCheck.create({
      user: req.user.id,
      mood,
      sleepHours,
      energyLevel,
      stressLevel,
    });

    const recommendations = {
      great: ["Keep the momentum — maybe mentor a colleague today."],
      good: ["A short walk between meetings will keep this going."],
      okay: ["Try a 5-minute breathing exercise before your next task."],
      tired: ["Consider a short break, and prioritize only your top 2 tasks today."],
      overwhelmed: [
        "Take a 10-minute guided breathing session.",
        "Consider talking to a counsellor through SereinSoul if this persists.",
      ],
    };

    const responsePayload = { check, recommendations: recommendations[mood] };
    const translated = await translationService.translateResponse(responsePayload, req.language, "/api/dashboard/mood-check");
    return res.status(201).json(translated);
  } catch (err) {
    console.error("Mood check error:", err);
    res.status(500).json({ error: "Failed to save mood check." });
  }
}

// GET /api/dashboard/feed
export async function getDepartmentFeed(req, res) {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found." });

    const priorityMap = { High: 3, medium: 2, Medium: 2, Low: 1, low: 1 };

    const circulars = await Circular.find({
      status: "ingested",
      departments: { $in: [user.department, "All Departments"] }
    });

    const sortedCirculars = circulars
      .sort((a, b) => {
        const priorityA = priorityMap[a.priority] || 2;
        const priorityB = priorityMap[b.priority] || 2;
        if (priorityB !== priorityA) {
          return priorityB - priorityA;
        }
        return new Date(b.issueDate || b.createdAt) - new Date(a.issueDate || a.createdAt);
      })
      .slice(0, 5);

    const result = sortedCirculars.map(c => ({
      title: c.title,
      summary: c.summary,
      department: c.departments.includes(user.department) ? user.department : (c.departments[0] || "All Departments"),
      priority: c.priority || "Medium",
      issueDate: c.issueDate || c.createdAt,
      pdfLink: c.pdfUrl || `/uploads/${c.filename}`,
      pdfUrl: c.pdfUrl || `/uploads/${c.filename}`,
    }));

    const translated = await translationService.translateResponse(result, req.language, "/api/dashboard/feed");
    return res.json(translated);
  } catch (err) {
    console.error("Error in getDepartmentFeed:", err);
    res.status(500).json({ error: "Failed to load department feed." });
  }
}
