import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import client from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { useConfirm } from "../context/ConfirmContext.jsx";
import { 
  useTasks, 
  useMeetings, 
  useCircularsFeed,
  useCreateTaskMutation,
  useUpdateTaskStatusMutation,
  useDeleteTaskMutation,
  useCreateMeetingMutation,
  useDeleteMeetingMutation
} from "../hooks/useQueries.jsx";
import {
  Calendar,
  Clock,
  ListTodo,
  CheckCircle,
  AlertCircle,
  Plus,
  Trash2,
  Brain,
  Video,
  MapPin,
  Users,
  ChevronRight,
  ArrowLeft,
  Sparkles,
  CalendarCheck,
  Send,
  Loader2,
  FileText,
  Search,
  Sun,
  Bell,
  LogOut,
  Shield
} from "lucide-react";
import LanguageSelector from "../components/LanguageSelector.jsx";
import {
  formatTime12,
  time12To24,
  splitTimeTo12Components
} from "../utils/timeFormat.js";

const CATEGORIES = ["Official Work", "Government Circular", "Meeting", "Follow-up", "Personal Reminder", "Training", "Other"];
const PRIORITIES = ["High", "Medium", "Low"];

// Display-only Malayalam labels. The <select> value stays the canonical English string
// (that's what the backend/Task schema expects) - only the visible option text changes.
const CATEGORY_LABELS_ML = {
  "Official Work": "ഔദ്യോഗിക ജോലി",
  "Government Circular": "സർക്കാർ സർക്കുലർ",
  "Meeting": "യോഗം",
  "Follow-up": "ഫോളോ അപ്പ്",
  "Personal Reminder": "വ്യക്തിഗത ഓർമ്മപ്പെടുത്തൽ",
  "Training": "പരിശീലനം",
  "Other": "മറ്റുള്ളവ"
};
const PRIORITY_LABELS_ML = { "High": "ഉയർന്നത്", "Medium": "ഇടത്തരം", "Low": "കുറഞ്ഞത്" };
const MEETING_TYPE_LABELS_ML = { "Offline": "നേരിട്ട്", "Online": "ഓൺലൈൻ", "Hybrid": "സങ്കരം" };

// Resolves which language to show AI-generated dropdown labels in, mirroring the
// backend's resolveGenerationLanguage logic: explicit preference wins, otherwise
// follow the detected language of the extracted task's original input.
function resolveDisplayLanguage(preferredLanguage, detectedLanguage) {
  if (preferredLanguage === "english") return "English";
  if (preferredLanguage === "malayalam") return "Malayalam";
  return detectedLanguage;
}

function TimePicker12({ value, onChange }) {
  const { hour, minute, ampm } = splitTimeTo12Components(value);

  const handleComponentChange = (key, val) => {
    const comps = { hour, minute, ampm, [key]: val };
    const time24 = time12To24(comps.hour, comps.minute, comps.ampm);
    onChange(time24);
  };

  return (
    <div className="flex items-center gap-1">
      <select
        value={hour}
        onChange={(e) => handleComponentChange("hour", e.target.value)}
        className="bg-paper/50 border border-border px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-teal text-ink text-xs"
      >
        {["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"].map(h => (
          <option key={h} value={h}>{h}</option>
        ))}
      </select>
      <span className="text-ink text-xs">:</span>
      <select
        value={minute}
        onChange={(e) => handleComponentChange("minute", e.target.value)}
        className="bg-paper/50 border border-border px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-teal text-ink text-xs"
      >
        {Array.from({ length: 60 }, (_, i) => i < 10 ? `0${i}` : i.toString()).map(m => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>
      <select
        value={ampm}
        onChange={(e) => handleComponentChange("ampm", e.target.value)}
        className="bg-paper/50 border border-border px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-teal text-ink text-xs font-semibold"
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
}

export default function TaskPlannerPage() {
  const { user, logout } = useAuth();
  const { language, t, formatDate, formatTime } = useLanguage();
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("today"); // today, upcoming, overdue, all
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const { data: tasks = [], isLoading: tasksLoading } = useTasks(activeTab);
  const { data: meetings = [] } = useMeetings();
  const { data: circularsFeed = [] } = useCircularsFeed();
  const circulars = circularsFeed.slice(0, 5);

  const createTaskMutation = useCreateTaskMutation();
  const updateTaskStatusMutation = useUpdateTaskStatusMutation();
  const deleteTaskMutation = useDeleteTaskMutation();
  const createMeetingMutation = useCreateMeetingMutation();
  const deleteMeetingMutation = useDeleteMeetingMutation();

  // Quick NLP State
  const [quickNlpText, setQuickNlpText] = useState("");
  const [isNlpSubmitting, setIsNlpSubmitting] = useState(false);
  const [extractedTask, setExtractedTask] = useState(null);

  // Form Toggles
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showMeetingForm, setShowMeetingForm] = useState(false);
  const [taskFormMode, setTaskFormMode] = useState("manual"); // manual, nlp

  // Form Fields - Task
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskCategory, setTaskCategory] = useState("Official Work");
  const [taskPriority, setTaskPriority] = useState("Medium");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskDueTime, setTaskDueTime] = useState("");
  const [taskReminder, setTaskReminder] = useState(false);
  const [nlpPrompt, setNlpPrompt] = useState("");

  // Form Fields - Meeting
  const [meetTitle, setMeetTitle] = useState("");
  const [meetDesc, setMeetDesc] = useState("");
  const [meetStartDate, setMeetStartDate] = useState("");
  const [meetStartTime, setMeetStartTime] = useState("09:00");
  const [meetEndTime, setMeetEndTime] = useState("10:00");
  const [meetLocation, setMeetLocation] = useState("Online");
  const [meetLink, setMeetLink] = useState("");
  const [meetParticipants, setMeetParticipants] = useState("");
  const [meetNotes, setMeetNotes] = useState("");

  // Quick NLP Submission
  const handleQuickNlpSubmit = async (e) => {
    e.preventDefault();
    if (!quickNlpText.trim()) return;
    setIsNlpSubmitting(true);
    const nlpPromise = client.post("/tasks/nlp", { text: quickNlpText });
    toast.promise(
      nlpPromise,
      {
        loading: "toast.ai.creatingTask",
        success: "toast.task.created",
        error: "toast.error.generic",
      },
      { id: "quick-nlp" }
    );
    try {
      const res = await nlpPromise;
      setExtractedTask(res.data);
      setQuickNlpText("");
    } catch (err) {
      console.error(err);
    } finally {
      setIsNlpSubmitting(false);
    }
  };

  // Add Task
  const handleAddTask = async (e) => {
    e.preventDefault();
    if (taskFormMode === "nlp") {
      if (!nlpPrompt.trim()) return;
      setIsLoading(true);
      const nlpPromise = client.post("/tasks/nlp", { text: nlpPrompt });
      toast.promise(
        nlpPromise,
        {
          loading: "toast.ai.creatingTask",
          success: "toast.task.created",
          error: "toast.error.generic",
        },
        { id: "nlp-add" }
      );
      try {
        const res = await nlpPromise;
        setExtractedTask(res.data);
        setNlpPrompt("");
        setShowTaskForm(false);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    } else {
      setIsLoading(true);
      const payload = {
        title: taskTitle,
        description: taskDesc,
        category: taskCategory,
        priority: taskPriority,
        dueDate: taskDueDate || undefined,
        dueTime: taskDueTime || undefined,
        reminder: taskReminder,
        source: "Manual"
      };
      try {
        await createTaskMutation.mutateAsync(payload);
        resetTaskForm();
        setShowTaskForm(false);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleSaveExtractedTask = async () => {
    setIsLoading(true);
    try {
      const isMeeting = extractedTask.category === "Meeting" || extractedTask.category === "യോഗം" || extractedTask.category === "മീറ്റിംഗ്";
      const participantsArray = isMeeting && extractedTask.participants
        ? extractedTask.participants.split(",").map((p) => p.trim()).filter(Boolean)
        : undefined;

      await createTaskMutation.mutateAsync({
        title: extractedTask.title,
        description: extractedTask.description,
        category: extractedTask.category,
        priority: extractedTask.priority,
        dueDate: extractedTask.dueDate || undefined,
        dueTime: extractedTask.dueTime || undefined,
        language: extractedTask.language,
        source: "AI",
        ...(isMeeting && {
          meetingType: extractedTask.meetingType || undefined,
          location: extractedTask.location || undefined,
          meetingLink: extractedTask.meetingLink || undefined,
          participants: participantsArray,
          department: extractedTask.department || undefined,
          notes: extractedTask.notes || undefined
        })
      });
      setExtractedTask(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const resetTaskForm = () => {
    setTaskTitle("");
    setTaskDesc("");
    setTaskCategory("Official Work");
    setTaskPriority("Medium");
    setTaskDueDate("");
    setTaskDueTime("");
    setTaskReminder(false);
    setNlpPrompt("");
  };

  // Add Meeting
  const handleAddMeeting = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const parsedParticipants = meetParticipants
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);

      // Create start/end date objects
      const startDt = new Date(`${meetStartDate}T${meetStartTime || "00:00"}`);
      const endDt = new Date(`${meetStartDate}T${meetEndTime || "00:00"}`);

      const payload = {
        title: meetTitle,
        description: meetDesc,
        startDate: new Date(meetStartDate),
        startTime: startDt,
        endTime: endDt,
        startTimeStr: meetStartTime,
        endTimeStr: meetEndTime,
        location: meetLocation,
        onlineLink: meetLink,
        participants: parsedParticipants,
        notes: meetNotes
      };

      await createMeetingMutation.mutateAsync(payload);
      setShowMeetingForm(false);
      resetMeetingForm();
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const resetMeetingForm = () => {
    setMeetTitle("");
    setMeetDesc("");
    setMeetStartDate("");
    setMeetStartTime("09:00");
    setMeetEndTime("10:00");
    setMeetLocation("Online");
    setMeetLink("");
    setMeetParticipants("");
    setMeetNotes("");
  };

  // Toggle Task Status
  const handleToggleStatus = async (taskId, currentStatus) => {
    const nextStatus = currentStatus === "Completed" ? "Pending" : "Completed";
    try {
      await updateTaskStatusMutation.mutateAsync({ taskId, status: nextStatus });
    } catch (err) {
      console.error(err);
    }
  };

  // Delete Task
  const handleDeleteTask = async (taskId) => {
    const isConfirmed = await confirm({
      title: "toast.confirm.deleteTaskTitle",
      body: "toast.confirm.deleteTaskBody",
    });
    if (!isConfirmed) return;
    try {
      await deleteTaskMutation.mutateAsync(taskId);
    } catch (err) {
      console.error(err);
    }
  };

  // Delete Meeting
  const handleDeleteMeeting = async (meetId) => {
    const isConfirmed = await confirm({
      title: "toast.confirm.deleteMeetingTitle",
      body: "toast.confirm.deleteMeetingBody",
    });
    if (!isConfirmed) return;
    try {
      await deleteMeetingMutation.mutateAsync(meetId);
    } catch (err) {
      console.error(err);
    }
  };

  // Trigger Follow-up Task Suggestion from Circular
  const handleCircularFollowup = async (circularId) => {
    try {
      setIsLoading(true);
      const { data } = await client.get(`/circulars/${circularId}/task-suggestion`);

      // Prefill task form with suggestions and open
      setTaskTitle(data.title);
      setTaskCategory("Government Circular");
      setTaskPriority(data.priority || "Medium");
      setTaskDueDate(data.dueDate || "");
      setTaskFormMode("manual");
      setShowTaskForm(true);
    } catch (err) {
      console.error(err);
      toast.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const getPriorityStyle = (priority) => {
    switch (priority) {
      case "High":
        return "bg-alert-tint text-alert border-alert/20";
      case "Medium":
        return "bg-ochre-tint text-ochre border-ochre/20";
      case "Low":
        return "bg-teal-tint text-teal border-teal/20";
      default:
        return "bg-paper text-ink-soft border-border";
    }
  };

  // upcomingMeetings is already filtered + sorted by loadMeetings (which queries the
  // dedicated /tasks/meetings/upcoming endpoint with server-side date/time filtering).
  // We just do a lightweight client-side guard for legacy Meeting docs where endTime exists.
  const upcomingMeetings = meetings.filter((m) => {
    if (m._source === "task") return true; // already filtered by backend
    const endOrStart = m.endTime || m.startTime;
    return endOrStart && new Date(endOrStart) >= new Date();
  });

  return (
    <div className="min-h-screen bg-paper flex flex-col font-sans">
      {/* ── Sticky Top Navigation ── */}
      <nav className="sticky top-0 z-50 bg-white border-b border-border shadow-sm px-4 sm:px-6 lg:px-8 xl:px-10 py-3">
        <div className="max-w-[1760px] mx-auto flex items-center justify-between gap-4">

          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-teal-tint flex items-center justify-center text-teal font-display font-bold text-lg border border-teal/10 shrink-0">
              G
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-display font-medium text-base text-ink tracking-tight">K-SMART CARE</span>
                <span className="text-[9px] font-mono font-semibold text-ink-soft bg-paper border border-border px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">Official Portal</span>
              </div>
              <span className="hidden sm:block text-[9px] text-ink-soft font-mono uppercase tracking-wider">
                AI Human Capital Intelligence Platform
              </span>
            </div>
          </div>

          {/* Search bar */}
          <div className="hidden md:block relative w-64">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-ink-soft/70">
              <Search size={14} />
            </span>
            <input
              type="text"
              placeholder="Search circulars, files, tasks..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-border bg-paper/20 text-xs text-ink placeholder:text-ink-soft/60 focus:outline-none focus:ring-1 focus:ring-teal focus:border-teal font-sans"
            />
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/planner")}
              className="text-xs font-semibold text-teal bg-teal-tint px-3 py-1.5 rounded-xl border border-teal/20 transition-all active:scale-95 flex items-center gap-1.5 shrink-0"
            >
              <ListTodo size={13} />
              Task Planner
            </button>
            <button
              onClick={() => navigate("/repository")}
              className="text-xs font-semibold text-teal-dark hover:text-teal bg-teal-tint px-3 py-1.5 rounded-xl border border-teal/10 hover:border-teal/20 transition-all active:scale-95 flex items-center gap-1.5 shrink-0"
            >
              <FileText size={13} />
              Circular Repository
            </button>
            {user?.role === "Admin" && (
              <button
                onClick={() => navigate("/admin/circulars")}
                className="text-xs font-semibold text-amber-900 hover:text-amber-800 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-xl border border-amber-200/50 transition-all active:scale-95 flex items-center gap-1.5 shrink-0"
              >
                <Shield size={13} />
                Admin Console
              </button>
            )}
            {/* Language Selector */}
            <LanguageSelector />

            {/* Theme Toggle (Calm Light Mode default) */}
            <button className="p-2 rounded-lg text-ink-soft hover:bg-paper/50 transition cursor-pointer" title="Toggle Theme (Calm Mode)">
              <Sun size={18} />
            </button>

            {/* Notification Bell */}
            <div className="relative">
              <button className="p-2 rounded-lg text-ink-soft hover:bg-paper/50 transition cursor-pointer">
                <Bell size={18} />
              </button>
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-alert" />
            </div>

            {/* User Profile Info & Sign Out */}
            <div className="flex items-center gap-2 border-l border-border pl-3">
              <div className="w-8 h-8 rounded-full bg-teal text-white flex items-center justify-center font-semibold text-xs shrink-0 shadow-sm border border-teal-dark/15">
                {user?.name ? user.name.split(" ")[0][0] : "U"}
              </div>
              <div className="hidden lg:block text-left min-w-0">
                <p className="text-xs font-semibold text-ink truncate leading-tight">{user?.name}</p>
                <p className="text-[9px] text-ink-soft truncate font-mono uppercase tracking-wider">{user?.designation}</p>
              </div>
              <button
                onClick={logout}
                className="ml-2 bg-white border border-border hover:bg-alert-tint hover:text-alert hover:border-alert/30 px-3 py-1.5 rounded-xl text-xs font-semibold text-ink-soft transition flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <LogOut size={13} />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Sub-navigation bar for Planner actions */}
      <div className="bg-paper border-b border-border/80 px-4 sm:px-6 lg:px-8 xl:px-10 py-3.5">
        <div className="max-w-[1760px] mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/")}
              className="p-2 hover:bg-white border border-transparent hover:border-border rounded-xl text-ink-soft hover:text-ink transition-all"
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <h2 className="text-sm font-display font-semibold text-ink leading-tight">{t("taskPlanner.workspaceTitle", "Task & Meeting Workspace")}</h2>
              <p className="text-[12px] text-ink-soft">{t("taskPlanner.workspaceDesc", "Track milestones, schedule events, and organize circular workflows")}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                resetTaskForm();
                setTaskFormMode("manual");
                setShowTaskForm(true);
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-teal hover:bg-teal-dark text-white rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer active:scale-95"
            >
              <Plus size={14} />
              {t("taskPlanner.newTask", "New Task")}
            </button>
            <button
              onClick={() => {
                resetMeetingForm();
                setShowMeetingForm(true);
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-ochre hover:bg-ochre/90 text-white rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer active:scale-95"
            >
              <Plus size={14} />
              {t("taskPlanner.newMeeting", "New Meeting")}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Dashboard */}
      <main className="flex-1 max-w-[1760px] w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* Left Side: Tasks Feed & Filters (8 Columns) */}
        <div className="lg:col-span-8 space-y-6">

          {/* Quick NLP Task Entry Bar */}
          <div className="bg-white border border-border rounded-2xl shadow-custom p-5">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={16} className="text-teal" />
              <h3 className="text-sm font-display font-medium text-ink">{t("taskPlanner.quickAiCreator", "Quick AI Task Creator")}</h3>
            </div>
            <form onSubmit={handleQuickNlpSubmit} className="flex gap-2">
              <input
                type="text"
                value={quickNlpText}
                onChange={(e) => setQuickNlpText(e.target.value)}
                placeholder='e.g., "Submit report tomorrow by 4 PM" or "നാളെ വെള്ളിയാഴ്ച അടിയന്തിര റിപ്പോർട്ട് സമർപ്പിക്കുക"'
                className="flex-1 bg-paper/50 border border-border px-4 py-2.5 rounded-xl text-sm placeholder:text-ink-soft/60 focus:outline-none focus:border-teal"
              />
              <button
                type="submit"
                disabled={isNlpSubmitting || !quickNlpText.trim()}
                className="px-4 py-2.5 bg-teal text-white rounded-xl hover:bg-teal-dark font-semibold text-xs transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {isNlpSubmitting ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Send size={14} />
                )}
                {t("common.create", "Create")}
              </button>
            </form>
          </div>

          {/* Tasks Tabs Filter */}
          <div className="bg-white border border-border rounded-2xl shadow-custom overflow-hidden">
            <div className="flex border-b border-border bg-paper/10">
              {[
                { id: "today", label: t("taskPlanner.todayTasks", "Today's Tasks"), icon: <Calendar size={14} /> },
                { id: "upcoming", label: t("taskPlanner.upcoming", "Upcoming"), icon: <CalendarCheck size={14} /> },
                { id: "overdue", label: t("taskPlanner.overdue", "Overdue"), icon: <AlertCircle size={14} /> },
                { id: "all", label: t("taskPlanner.allTasks", "All Tasks"), icon: <ListTodo size={14} /> }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 py-3 px-4 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all border-b-2 ${activeTab === tab.id
                      ? "border-teal text-teal bg-white"
                      : "border-transparent text-ink-soft hover:text-ink hover:bg-paper/20"
                    }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Task list container */}
            <div className="p-6">
              {isLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 size={24} className="animate-spin text-teal" />
                </div>
              ) : tasks.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-border rounded-xl bg-paper/10">
                  <p className="text-sm text-ink-soft italic">{t("taskPlanner.noTasks", "No tasks found in this category.")}</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {tasks.map((task) => (
                    <div
                      key={task._id}
                      className={`py-3.5 flex items-start justify-between gap-4 transition-all ${task.status === "Completed" ? "opacity-60" : ""
                        }`}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <button
                          onClick={() => handleToggleStatus(task._id, task.status)}
                          className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${task.status === "Completed"
                              ? "bg-teal border-teal text-white"
                              : "border-border hover:border-teal bg-white"
                            }`}
                        >
                          {task.status === "Completed" && <CheckCircle size={13} className="fill-current" />}
                        </button>
                        <div className="space-y-1 min-w-0">
                          <p
                            className={`text-sm font-medium text-ink leading-snug break-words ${task.status === "Completed" ? "line-through text-ink-soft" : ""
                              }`}
                          >
                            {task.title}
                          </p>
                          {task.description && (
                            <p className="text-xs text-ink-soft leading-relaxed break-words">{task.description}</p>
                          )}
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-paper border border-border text-ink-soft uppercase">
                              {language === "ml" ? (CATEGORY_LABELS_ML[task.category] || task.category) : task.category}
                            </span>
                            {task.dueDate && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-mono text-ink-soft">
                                <Calendar size={10} />
                                {t("taskPlanner.due", "Due")} {formatDate(task.dueDate)} {task.dueTime ? formatTime12(task.dueTime) : ""}
                              </span>
                            )}
                            {task.source === "AI" && (
                              <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-teal bg-teal-tint px-1 py-0.5 rounded">
                                <Sparkles size={8} /> {t("taskPlanner.aiGenerated", "AI Generated")}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className={`text-[10px] uppercase font-mono font-semibold px-2 py-0.5 rounded border ${getPriorityStyle(task.priority)}`}>
                          {language === "ml" ? (PRIORITY_LABELS_ML[task.priority] || task.priority) : task.priority}
                        </span>
                        <button
                          onClick={() => handleDeleteTask(task._id)}
                          className="p-1.5 text-ink-soft hover:text-alert hover:bg-alert-tint rounded-lg transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Meetings & Circular Follow-ups (4 Columns) */}
        <div className="lg:col-span-4 space-y-6">

          {/* Today & Upcoming Meetings Card */}
          <div className="bg-white border border-border rounded-2xl shadow-custom p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 rounded-lg bg-ochre-tint text-ochre">
                <Calendar size={18} />
              </div>
              <h2 className="text-base font-display font-medium text-ink">{t("dashboard.scheduledMeetings", "Scheduled Meetings")}</h2>
            </div>

            {upcomingMeetings.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-border rounded-xl bg-paper/30">
                <p className="text-xs text-ink-soft italic">{t("dashboard.noMeetings", "No scheduled meetings.")}</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1 custom-scrollbar">
              {upcomingMeetings.map((m) => {
                  // Unified date source: task-meetings use dueDate, legacy use startTime
                  const meetingDate = new Date(m._source === "task" ? m.dueDate : m.startTime);
                  const isToday = meetingDate.toDateString() === new Date().toDateString();

                  // Countdown label
                  const diffMs = meetingDate.getTime() - Date.now();
                  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
                  let countdown = "";
                  if (isToday) {
                    const diffMins = Math.round(diffMs / (1000 * 60));
                    countdown = diffMins > 0
                      ? t("taskPlanner.startsIn", "Starts in {{count}} min", { count: diffMins })
                      : t("taskPlanner.ongoing", "Ongoing");
                  } else if (diffDays === 1) {
                    countdown = t("taskPlanner.tomorrow", "Tomorrow");
                  } else if (diffDays > 1) {
                    countdown = t("taskPlanner.inDays", "In {{count}} days", { count: diffDays });
                  }

                  // Delete handler: task-meetings delete from /tasks, legacy from /meetings
                  const handleDelete = async () => {
                    const noun = m._source === "task" ? "task" : "meeting";
                    const isConfirmed = await confirm({
                      title: noun === "task" ? "toast.confirm.deleteTaskTitle" : "toast.confirm.deleteMeetingTitle",
                      body: noun === "task" ? "toast.confirm.deleteTaskBody" : "toast.confirm.deleteMeetingBody",
                    });
                    if (!isConfirmed) return;
                    try {
                      if (m._source === "task") {
                        await deleteTaskMutation.mutateAsync(m._id);
                      } else {
                        await deleteMeetingMutation.mutateAsync(m._id);
                      }
                    } catch (err) {
                      console.error(err);
                    }
                  };

                  // Location/link display
                  const isOnline = m._source === "task"
                    ? (m.meetingType === "Online" || !!m.meetingLink)
                    : (m.location === "Online" || !!m.onlineLink);

                  const onlineLink = m._source === "task" ? m.meetingLink : m.onlineLink;
                  const offlineLocation = m._source === "task"
                    ? (m.location && m.location !== "Online" ? m.location : null)
                    : (m.location !== "Online" ? m.location : null);

                  return (
                    <div key={`${m._source}-${m._id}`} className="p-3 border border-border rounded-xl bg-paper/10 hover:bg-paper/20 transition-colors space-y-2">
                      {/* Header row */}
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                          {isToday && (
                            <span className="text-[9px] font-mono font-bold text-teal bg-teal-tint px-1.5 py-0.5 rounded-full border border-teal/10 uppercase tracking-wider shrink-0">
                              {t("common.today", "Today")}
                            </span>
                          )}
                          {m._source === "task" && (
                            <span className="text-[9px] font-mono font-semibold text-ochre bg-ochre-tint px-1.5 py-0.5 rounded-full border border-ochre/10 uppercase tracking-wider shrink-0">
                              {t("common.task", "Task")}
                            </span>
                          )}
                          <h4 className="text-xs font-semibold text-ink leading-snug truncate">{m.title}</h4>
                        </div>
                        <button onClick={handleDelete} className="text-ink-soft hover:text-alert p-1 shrink-0">
                          <Trash2 size={12} />
                        </button>
                      </div>

                      {m.description && <p className="text-[11px] text-ink-soft leading-relaxed">{m.description}</p>}

                      {/* Details */}
                      <div className="space-y-1 pt-1 border-t border-border/50 text-[10px] text-ink-soft font-mono">
                        <div className="flex items-center gap-1">
                          <Clock size={10} />
                          {formatDate(meetingDate)}
                          {" | "}
                          {m._source === "task"
                            ? formatTime12(m.dueTime)
                            : `${formatTime12(m.startTimeStr || m.startTime)} - ${formatTime12(m.endTimeStr || m.endTime)}`
                          }
                        </div>

                        <div className="flex items-center gap-1">
                          {isOnline ? (
                            <>
                              <Video size={10} />
                              {onlineLink
                                ? <a href={onlineLink} target="_blank" rel="noreferrer" className="text-teal hover:underline truncate">{onlineLink}</a>
                                : "Online"}
                            </>
                          ) : offlineLocation ? (
                            <>
                              <MapPin size={10} />
                              <span>{offlineLocation}</span>
                            </>
                          ) : null}
                        </div>

                        {m.participants && m.participants.length > 0 && (
                          <div className="flex items-center gap-1">
                            <Users size={10} />
                            <span className="truncate">{m.participants.join(", ")}</span>
                          </div>
                        )}

                        {/* Priority + countdown row */}
                        <div className="flex items-center justify-between pt-1">
                          {m.priority && (
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${getPriorityStyle(m.priority)}`}>
                              {t("taskPlanner.priorityLabel", "{{priority}} Priority", { priority: language === "ml" ? (PRIORITY_LABELS_ML[m.priority] || m.priority) : m.priority })}
                            </span>
                          )}
                          {countdown && (
                            <span className="text-[9px] font-mono text-ink-soft ml-auto">{countdown}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

              </div>
            )}
          </div>

          {/* AI Circular Follow-ups Recommendations Card */}
          <div className="bg-white border border-border rounded-2xl shadow-custom p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 rounded-lg bg-teal-tint text-teal">
                <Brain size={18} />
              </div>
              <h2 className="text-base font-display font-medium text-ink">{t("taskPlanner.circularFollowups", "Circular Follow-ups")}</h2>
            </div>
            <p className="text-xs text-ink-soft mb-3">{t("taskPlanner.circularFollowupsDesc", "AI detects circulars that need actionable follow-ups. Click to prefill task creation.")}</p>

            {circulars.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-border rounded-xl bg-paper/30">
                <p className="text-xs text-ink-soft italic">{t("taskPlanner.noCirculars", "No active circulars to monitor.")}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {circulars.map((c) => (
                  <div
                    key={c._id}
                    onClick={() => handleCircularFollowup(c._id)}
                    className="p-3 border border-border rounded-xl bg-teal-tint/10 hover:bg-teal-tint/40 transition-all cursor-pointer flex items-center justify-between gap-3 group"
                  >
                    <div className="min-w-0">
                      <h4 className="text-[11px] font-semibold text-teal-dark truncate group-hover:text-teal transition-colors">
                        {c.title}
                      </h4>
                      <p className="text-[10px] text-ink-soft truncate">
                        {c.summary || "Action needed"}
                      </p>
                    </div>
                    <ChevronRight size={14} className="text-ink-soft group-hover:text-teal transition-colors shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </main>

      {/* AI Task Confirmation Modal */}
      {extractedTask && (
        <div className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-border rounded-2xl max-w-lg w-full p-6 shadow-custom space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-display font-medium text-ink flex items-center gap-1.5">
                <Sparkles size={16} className="text-teal" />
                {t("taskPlanner.confirmAiTask", "Confirm AI Task")} ({extractedTask.language})
              </h3>
              <button onClick={() => setExtractedTask(null)} className="text-ink-soft hover:text-ink text-sm">{t("common.cancel", "Cancel")}</button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-ink">Task Title</label>
                <input
                  type="text"
                  required
                  value={extractedTask.title}
                  onChange={(e) => setExtractedTask({ ...extractedTask, title: e.target.value })}
                  className="w-full bg-paper/50 border border-border px-3 py-2 rounded-lg focus:outline-none focus:border-teal"
                />
                {extractedTask.titleTranslationSkipped && (
                  <p className="text-[10px] text-ochre">
                    Couldn't translate the title to your preferred language offline - edit it manually if needed.
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-ink">Description (Original Input)</label>
                <textarea
                  rows={2}
                  value={extractedTask.description}
                  onChange={(e) => setExtractedTask({ ...extractedTask, description: e.target.value })}
                  className="w-full bg-paper/50 border border-border px-3 py-2 rounded-lg focus:outline-none focus:border-teal"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-semibold text-ink">Category</label>
                  <select
                    value={extractedTask.category}
                    onChange={(e) => setExtractedTask({ ...extractedTask, category: e.target.value })}
                    className="w-full bg-paper/50 border border-border px-3 py-2 rounded-lg focus:outline-none focus:border-teal"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {resolveDisplayLanguage(user?.preferredLanguage, extractedTask.language) === "Malayalam"
                          ? (CATEGORY_LABELS_ML[c] || c)
                          : c}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-ink">Priority</label>
                  <select
                    value={extractedTask.priority}
                    onChange={(e) => setExtractedTask({ ...extractedTask, priority: e.target.value })}
                    className="w-full bg-paper/50 border border-border px-3 py-2 rounded-lg focus:outline-none focus:border-teal"
                  >
                    {["High", "Medium", "Low"].map((p) => (
                      <option key={p} value={p}>
                        {resolveDisplayLanguage(user?.preferredLanguage, extractedTask.language) === "Malayalam"
                          ? (PRIORITY_LABELS_ML[p] || p)
                          : p}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-semibold text-ink">Due Date</label>
                  <input
                    type="date"
                    value={extractedTask.dueDate ? extractedTask.dueDate.substring(0, 10) : ""}
                    onChange={(e) => setExtractedTask({ ...extractedTask, dueDate: e.target.value })}
                    className="w-full bg-paper/50 border border-border px-3 py-2 rounded-lg focus:outline-none focus:border-teal"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-ink">Due Time</label>
                  <TimePicker12
                    value={extractedTask.dueTime || ""}
                    onChange={(timeVal) => setExtractedTask({ ...extractedTask, dueTime: timeVal })}
                  />
                </div>
              </div>

              {/* Meeting-specific fields - only shown when the AI (or the employee, after
                  manually switching the Category dropdown above) has classified this as a
                  Meeting. Hidden entirely for every other category. */}
              {(extractedTask.category === "Meeting" || extractedTask.category === "യോഗം" || extractedTask.category === "മീറ്റിംഗ്") && (
                <div className="space-y-3 border-t border-border pt-3 mt-1">
                  <p className="font-semibold text-ink flex items-center gap-1.5">
                    <Users size={12} className="text-teal" />
                    Meeting Details
                  </p>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="font-semibold text-ink">Meeting Type</label>
                      <select
                        value={extractedTask.meetingType || ""}
                        onChange={(e) => setExtractedTask({ ...extractedTask, meetingType: e.target.value || null })}
                        className="w-full bg-paper/50 border border-border px-3 py-2 rounded-lg focus:outline-none focus:border-teal"
                      >
                        <option value="">Select type...</option>
                        {["Offline", "Online", "Hybrid"].map((mt) => (
                          <option key={mt} value={mt}>
                            {resolveDisplayLanguage(user?.preferredLanguage, extractedTask.language) === "Malayalam"
                              ? (MEETING_TYPE_LABELS_ML[mt] || mt)
                              : mt}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="font-semibold text-ink">Location</label>
                      <input
                        type="text"
                        placeholder="e.g. Town Hall"
                        value={extractedTask.location || ""}
                        onChange={(e) => setExtractedTask({ ...extractedTask, location: e.target.value })}
                        className="w-full bg-paper/50 border border-border px-3 py-2 rounded-lg placeholder:text-ink-soft focus:outline-none focus:border-teal"
                      />
                    </div>
                  </div>

                  {(extractedTask.meetingType === "Online" || extractedTask.meetingType === "Hybrid") && (
                    <div className="space-y-1">
                      <label className="font-semibold text-ink">Meeting Link</label>
                      <input
                        type="url"
                        placeholder="https://meet.google.com/..."
                        value={extractedTask.meetingLink || ""}
                        onChange={(e) => setExtractedTask({ ...extractedTask, meetingLink: e.target.value })}
                        className="w-full bg-paper/50 border border-border px-3 py-2 rounded-lg placeholder:text-ink-soft focus:outline-none focus:border-teal"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="font-semibold text-ink">Participants <span className="font-normal text-ink-soft">(optional)</span></label>
                      <input
                        type="text"
                        placeholder="e.g. Secretary, President, Kumar"
                        value={extractedTask.participants || ""}
                        onChange={(e) => setExtractedTask({ ...extractedTask, participants: e.target.value })}
                        className="w-full bg-paper/50 border border-border px-3 py-2 rounded-lg placeholder:text-ink-soft focus:outline-none focus:border-teal"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-semibold text-ink">Department <span className="font-normal text-ink-soft">(optional)</span></label>
                      <input
                        type="text"
                        placeholder="e.g. Health Department"
                        value={extractedTask.department || ""}
                        onChange={(e) => setExtractedTask({ ...extractedTask, department: e.target.value })}
                        className="w-full bg-paper/50 border border-border px-3 py-2 rounded-lg placeholder:text-ink-soft focus:outline-none focus:border-teal"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-ink">Notes <span className="font-normal text-ink-soft">(optional)</span></label>
                    <textarea
                      rows={2}
                      placeholder="Any additional notes about this meeting..."
                      value={extractedTask.notes || ""}
                      onChange={(e) => setExtractedTask({ ...extractedTask, notes: e.target.value })}
                      className="w-full bg-paper/50 border border-border px-3 py-2 rounded-lg placeholder:text-ink-soft focus:outline-none focus:border-teal"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleSaveExtractedTask}
                className="flex-1 py-2.5 bg-teal hover:bg-teal-dark text-white rounded-xl font-semibold shadow-sm transition-all flex items-center justify-center gap-1.5"
              >
                Save Task
              </button>
              <button
                type="button"
                onClick={() => setExtractedTask(null)}
                className="px-4 py-2.5 border border-border hover:bg-paper rounded-xl font-semibold text-ink-soft transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task Creation Modal */}
      {showTaskForm && (
        <div className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-border rounded-2xl max-w-lg w-full p-6 shadow-custom space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-display font-medium text-ink">Create New Task</h3>
              <button onClick={() => setShowTaskForm(false)} className="text-ink-soft hover:text-ink text-sm">Close</button>
            </div>

            <div className="flex border-b border-border">
              <button
                type="button"
                onClick={() => setTaskFormMode("manual")}
                className={`flex-1 pb-2 text-xs font-semibold ${taskFormMode === "manual" ? "border-b-2 border-teal text-teal" : "text-ink-soft"}`}
              >
                Manual Entry
              </button>
              <button
                type="button"
                onClick={() => setTaskFormMode("nlp")}
                className={`flex-1 pb-2 text-xs font-semibold ${taskFormMode === "nlp" ? "border-b-2 border-teal text-teal" : "text-ink-soft"}`}
              >
                AI Prompt Creator
              </button>
            </div>

            <form onSubmit={handleAddTask} className="space-y-3 text-xs">
              {taskFormMode === "nlp" ? (
                <div className="space-y-1">
                  <label className="font-semibold text-ink">AI Natural Language Prompt</label>
                  <textarea
                    rows={3}
                    value={nlpPrompt}
                    onChange={(e) => setNlpPrompt(e.target.value)}
                    placeholder='e.g., "Review circular by Friday" or "ശനിയാഴ്ച മുൻപ് സർക്കുലർ അവലോകനം ചെയ്യുക"'
                    className="w-full bg-paper/50 border border-border px-3 py-2 rounded-lg placeholder:text-ink-soft focus:outline-none focus:border-teal"
                  />
                </div>
              ) : (
                <>
                  <div className="space-y-1">
                    <label className="font-semibold text-ink">Title</label>
                    <input
                      type="text"
                      required
                      value={taskTitle}
                      onChange={(e) => setTaskTitle(e.target.value)}
                      className="w-full bg-paper/50 border border-border px-3 py-2 rounded-lg focus:outline-none focus:border-teal"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-ink">Description</label>
                    <textarea
                      rows={2}
                      value={taskDesc}
                      onChange={(e) => setTaskDesc(e.target.value)}
                      className="w-full bg-paper/50 border border-border px-3 py-2 rounded-lg focus:outline-none focus:border-teal"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="font-semibold text-ink">Category</label>
                      <select
                        value={taskCategory}
                        onChange={(e) => setTaskCategory(e.target.value)}
                        className="w-full bg-paper/50 border border-border px-3 py-2 rounded-lg focus:outline-none focus:border-teal"
                      >
                        {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="font-semibold text-ink">Priority</label>
                      <select
                        value={taskPriority}
                        onChange={(e) => setTaskPriority(e.target.value)}
                        className="w-full bg-paper/50 border border-border px-3 py-2 rounded-lg focus:outline-none focus:border-teal"
                      >
                        {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="font-semibold text-ink">Due Date</label>
                      <input
                        type="date"
                        value={taskDueDate}
                        onChange={(e) => setTaskDueDate(e.target.value)}
                        className="w-full bg-paper/50 border border-border px-3 py-2 rounded-lg focus:outline-none focus:border-teal"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-semibold text-ink">Due Time</label>
                      <TimePicker12
                        value={taskDueTime}
                        onChange={(timeVal) => setTaskDueTime(timeVal)}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="checkbox"
                      id="reminder"
                      checked={taskReminder}
                      onChange={(e) => setTaskReminder(e.target.checked)}
                      className="rounded border-border focus:ring-teal"
                    />
                    <label htmlFor="reminder" className="font-semibold text-ink cursor-pointer">Set AI Reminder</label>
                  </div>
                </>
              )}

              <button
                type="submit"
                className="w-full py-2.5 mt-2 bg-teal hover:bg-teal-dark text-white rounded-xl font-semibold shadow-sm transition-all"
              >
                Create Task
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Meeting Creation Modal */}
      {showMeetingForm && (
        <div className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-border rounded-2xl max-w-lg w-full p-6 shadow-custom space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-display font-medium text-ink">Schedule Meeting</h3>
              <button onClick={() => setShowMeetingForm(false)} className="text-ink-soft hover:text-ink text-sm">Close</button>
            </div>

            <form onSubmit={handleAddMeeting} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-ink">Title</label>
                <input
                  type="text"
                  required
                  value={meetTitle}
                  onChange={(e) => setMeetTitle(e.target.value)}
                  className="w-full bg-paper/50 border border-border px-3 py-2 rounded-lg focus:outline-none focus:border-teal"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-ink">Description</label>
                <textarea
                  rows={2}
                  value={meetDesc}
                  onChange={(e) => setMeetDesc(e.target.value)}
                  className="w-full bg-paper/50 border border-border px-3 py-2 rounded-lg focus:outline-none focus:border-teal"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="font-semibold text-ink">Date</label>
                  <input
                    type="date"
                    required
                    value={meetStartDate}
                    onChange={(e) => setMeetStartDate(e.target.value)}
                    className="w-full bg-paper/50 border border-border px-3 py-2 rounded-lg focus:outline-none focus:border-teal"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-ink">Start Time</label>
                  <TimePicker12
                    value={meetStartTime}
                    onChange={(timeVal) => setMeetStartTime(timeVal)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-ink">End Time</label>
                  <TimePicker12
                    value={meetEndTime}
                    onChange={(timeVal) => setMeetEndTime(timeVal)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-semibold text-ink">Location type</label>
                  <select
                    value={meetLocation}
                    onChange={(e) => setMeetLocation(e.target.value)}
                    className="w-full bg-paper/50 border border-border px-3 py-2 rounded-lg focus:outline-none focus:border-teal"
                  >
                    <option value="Online">Online</option>
                    <option value="Conference Hall 1">Conference Hall 1</option>
                    <option value="Conference Hall 2">Conference Hall 2</option>
                    <option value="Panchayat Office">Panchayat Office</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-ink">Online Link (if any)</label>
                  <input
                    type="url"
                    placeholder="https://meet.google.com/..."
                    value={meetLink}
                    onChange={(e) => setMeetLink(e.target.value)}
                    className="w-full bg-paper/50 border border-border px-3 py-2 rounded-lg focus:outline-none focus:border-teal"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-ink">Participants (comma separated)</label>
                <input
                  type="text"
                  placeholder="e.g. Secretary, President, S Kumar"
                  value={meetParticipants}
                  onChange={(e) => setMeetParticipants(e.target.value)}
                  className="w-full bg-paper/50 border border-border px-3 py-2 rounded-lg focus:outline-none focus:border-teal"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-ink">Notes</label>
                <textarea
                  rows={2}
                  value={meetNotes}
                  onChange={(e) => setMeetNotes(e.target.value)}
                  className="w-full bg-paper/50 border border-border px-3 py-2 rounded-lg focus:outline-none focus:border-teal"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 mt-2 bg-ochre hover:bg-ochre/90 text-white rounded-xl font-semibold shadow-sm transition-all"
              >
                Schedule Meeting
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}