import { useState } from "react";
import { useNavigate } from "react-router-dom";
import client from "../api/client.js";
import { useLanguage } from "../context/LanguageContext.jsx";
import { useCreateTaskMutation, useUpdateTaskStatusMutation } from "../hooks/useQueries.jsx";
import {
  formatTime12,
  time12To24,
  splitTimeTo12Components
} from "../utils/timeFormat.js";
import {
  ListTodo,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Plus,
  Send,
  Loader2,
  Sparkles,
  ArrowRight
} from "lucide-react";

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
        className="bg-white border border-border px-1 py-1 rounded-lg focus:outline-none focus:border-teal text-ink text-xs"
      >
        {["01","02","03","04","05","06","07","08","09","10","11","12"].map(h => (
          <option key={h} value={h}>{h}</option>
        ))}
      </select>
      <span className="text-ink text-xs">:</span>
      <select
        value={minute}
        onChange={(e) => handleComponentChange("minute", e.target.value)}
        className="bg-white border border-border px-1 py-1 rounded-lg focus:outline-none focus:border-teal text-ink text-xs"
      >
        {Array.from({ length: 60 }, (_, i) => i < 10 ? `0${i}` : i.toString()).map(m => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>
      <select
        value={ampm}
        onChange={(e) => handleComponentChange("ampm", e.target.value)}
        className="bg-white border border-border px-1 py-1 rounded-lg focus:outline-none focus:border-teal text-ink text-xs font-semibold"
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
}

export default function TaskPlannerWidget({
  todayTasks = [],
  completedToday = [],
  todayMeetings = [],
  upcomingMeetings = [],
  overdueTasks = [],
  onRefresh
}) {
  const displayMeetings = todayMeetings.length > 0 ? todayMeetings : upcomingMeetings;
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  const [nlpText, setNlpText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [extractedTask, setExtractedTask] = useState(null);

  const createTaskMutation = useCreateTaskMutation();
  const updateTaskStatusMutation = useUpdateTaskStatusMutation();

  const handleToggleComplete = async (taskId) => {
    try {
      setError("");
      await updateTaskStatusMutation.mutateAsync({ taskId, status: "Completed" });
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error("Failed to complete task:", err);
      setError("Failed to complete task");
    }
  };

  const handleQuickNlpSubmit = async (e) => {
    e.preventDefault();
    if (!nlpText.trim()) return;
    setIsSubmitting(true);
    setError("");
    try {
      const res = await client.post("/tasks/nlp", { text: nlpText });
      setExtractedTask(res.data);
    } catch (err) {
      console.error(err);
      setError("AI Task Creation failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveExtractedTask = async () => {
    setIsSubmitting(true);
    setError("");
    try {
      await createTaskMutation.mutateAsync({
        title: extractedTask.title,
        description: extractedTask.description,
        category: extractedTask.category,
        priority: extractedTask.priority,
        dueDate: extractedTask.dueDate || undefined,
        dueTime: extractedTask.dueTime || undefined,
        language: extractedTask.language,
        source: "AI"
      });
      setExtractedTask(null);
      setNlpText("");
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error(err);
      setError("Failed to save task");
    } finally {
      setIsSubmitting(false);
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

  return (
    <div className="bg-white border border-border rounded-2xl shadow-custom p-6 transition-all duration-300 hover:shadow-custom-sm space-y-6">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-teal-tint text-teal">
            <ListTodo size={18} />
          </div>
          <h2 className="text-base font-display font-medium text-ink">
            {t("taskPlanner.title", "Task Planner")}
          </h2>
        </div>
        <button
          onClick={() => navigate("/planner")}
          className="text-xs font-bold text-teal hover:text-teal-dark flex items-center gap-1 transition-all"
        >
          {t("taskPlanner.viewAll", "View All")}
          <ArrowRight size={14} />
        </button>
      </div>

      {/* Snapshot Stats Grid */}
      <div className="grid grid-cols-4 gap-2 text-center">
        <div className="bg-paper/40 p-2.5 rounded-xl border border-border/50">
          <div className="text-sm font-semibold font-mono text-ink">{todayTasks.length}</div>
          <div className="text-[9px] uppercase font-mono text-ink-soft tracking-wider mt-0.5">{t("common.today", "Today")}</div>
        </div>
        <div className="bg-teal-tint/20 p-2.5 rounded-xl border border-teal/15">
          <div className="text-sm font-semibold font-mono text-teal-dark">{completedToday.length}</div>
          <div className="text-[9px] uppercase font-mono text-teal-dark/75 tracking-wider mt-0.5">{t("taskPlanner.done", "Done")}</div>
        </div>
        <div className="bg-ochre-tint/25 p-2.5 rounded-xl border border-ochre/15">
          <div className="text-sm font-semibold font-mono text-ochre">{upcomingMeetings.length}</div>
          <div className="text-[9px] uppercase font-mono text-ochre/75 tracking-wider mt-0.5">{t("taskPlanner.meetings", "Meetings")}</div>
        </div>
        <div className={`p-2.5 rounded-xl border ${overdueTasks.length > 0 ? "bg-alert-tint/30 border-alert/20" : "bg-paper/40 border-border/50"}`}>
          <div className={`text-sm font-semibold font-mono ${overdueTasks.length > 0 ? "text-alert" : "text-ink"}`}>{overdueTasks.length}</div>
          <div className="text-[9px] uppercase font-mono text-ink-soft tracking-wider mt-0.5">{t("taskPlanner.overdue", "Overdue")}</div>
        </div>
      </div>

      {/* Quick AI Task Creator */}
      <div className="border border-border/60 rounded-xl p-3.5 bg-paper/20">
        <div className="flex items-center gap-1.5 mb-2">
          <Sparkles size={13} className="text-teal" />
          <span className="text-xs font-semibold text-ink">{t("taskPlanner.quickAiCreator", "Quick AI Task Creator")}</span>
        </div>
        <form onSubmit={handleQuickNlpSubmit} className="flex gap-1.5">
          <input
            type="text"
            value={nlpText}
            onChange={(e) => setNlpText(e.target.value)}
            placeholder={t("taskPlanner.quickAiPlaceholder", 'e.g., "Submit report by 10 AM" or "നാളെ റിപ്പോർട്ട് സമർപ്പിക്കുക"')}
            className="flex-1 text-xs bg-white border border-border px-3 py-2 rounded-lg focus:outline-none focus:border-teal"
          />
          <button
            type="submit"
            disabled={isSubmitting || !nlpText.trim()}
            className="px-3 bg-teal text-white rounded-lg hover:bg-teal-dark transition-all flex items-center justify-center disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Send size={13} />
            )}
          </button>
        </form>
        {error && <p className="text-[10px] text-alert mt-1">{error}</p>}
      </div>

      {/* AI Task Confirmation Card */}
      {extractedTask && (
        <div className="border border-teal/20 rounded-xl p-4 bg-teal-tint/10 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-teal-dark flex items-center gap-1">
              <Sparkles size={12} />
              {t("taskPlanner.confirmAiTask", "Confirm AI Task")} ({extractedTask.language})
            </span>
            <button
              onClick={() => setExtractedTask(null)}
              className="text-[10px] text-ink-soft hover:text-ink"
            >
              {t("common.cancel", "Cancel")}
            </button>
          </div>
          
          <div className="space-y-2 text-xs">
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-mono text-ink-soft">{t("common.title", "Task Title")}</label>
              <input
                type="text"
                value={extractedTask.title}
                onChange={(e) => setExtractedTask({ ...extractedTask, title: e.target.value })}
                className="w-full bg-white border border-border px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-teal text-ink"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-mono text-ink-soft">{t("circular.category", "Category")}</label>
                <select
                  value={extractedTask.category}
                  onChange={(e) => setExtractedTask({ ...extractedTask, category: e.target.value })}
                  className="w-full bg-white border border-border px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-teal text-ink"
                >
                  {["Official Work", "Government Circular", "Meeting", "Follow-up", "Personal Reminder", "Training", "Other"].map(c => (
                    <option key={c} value={c}>{t("categories." + c, c)}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-mono text-ink-soft">{t("common.priority", "Priority")}</label>
                <select
                  value={extractedTask.priority}
                  onChange={(e) => setExtractedTask({ ...extractedTask, priority: e.target.value })}
                  className="w-full bg-white border border-border px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-teal text-ink"
                >
                  {["High", "Medium", "Low"].map(p => (
                    <option key={p} value={p}>{t("taskPlanner.priority" + p, p)}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-mono text-ink-soft">{t("common.dueDate", "Due Date")}</label>
                <input
                  type="date"
                  value={extractedTask.dueDate ? extractedTask.dueDate.substring(0, 10) : ""}
                  onChange={(e) => setExtractedTask({ ...extractedTask, dueDate: e.target.value })}
                  className="w-full bg-white border border-border px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-teal text-ink"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-mono text-ink-soft">{t("taskPlanner.dueTime", "Due Time")}</label>
                <TimePicker12
                  value={extractedTask.dueTime || ""}
                  onChange={(timeVal) => setExtractedTask({ ...extractedTask, dueTime: timeVal })}
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-1.5">
            <button
              onClick={handleSaveExtractedTask}
              disabled={isSubmitting}
              className="flex-1 py-1.5 bg-teal hover:bg-teal-dark text-white rounded-lg text-xs font-semibold shadow-sm transition-all flex items-center justify-center gap-1"
            >
              {isSubmitting ? <Loader2 size={12} className="animate-spin" /> : t("taskPlanner.saveTask", "Save Task")}
            </button>
            <button
              onClick={() => setExtractedTask(null)}
              className="px-3 py-1.5 border border-border hover:bg-paper rounded-lg text-xs text-ink-soft font-semibold transition-all"
            >
              {t("common.cancel", "Cancel")}
            </button>
          </div>
        </div>
      )}

      {/* Preview Section */}
      <div className="space-y-4 pt-1">
        {/* Overdue Tasks Alert (if any) */}
        {overdueTasks.length > 0 && (
          <div className="p-3 border border-alert/25 rounded-xl bg-alert-tint/40 space-y-2">
            <div className="flex items-center gap-1.5 text-alert text-xs font-semibold">
              <AlertTriangle size={14} />
              <span>{t("taskPlanner.overdueTasks", "Overdue Tasks ({{count}})", { count: overdueTasks.length })}</span>
            </div>
            <div className="space-y-1.5 max-h-[85px] overflow-y-auto">
              {overdueTasks.slice(0, 2).map((tItem) => (
                <div key={tItem.id} className="flex justify-between items-center text-[11px] font-medium text-ink-soft bg-paper/20 p-2.5 rounded-xl border border-border/50">
                  <div className="flex items-center gap-2 min-w-0">
                    <input
                      type="checkbox"
                      className="w-3.5 h-3.5 rounded border-border text-teal focus:ring-teal cursor-pointer shrink-0"
                      onChange={() => handleToggleComplete(tItem.id || tItem._id)}
                    />
                    <span className="truncate pr-2">{tItem.title}</span>
                  </div>
                  <span className="text-[9px] uppercase font-mono font-semibold px-1.5 py-0.5 rounded border bg-alert-tint text-alert border-alert/20 shrink-0">
                    {t(`taskPlanner.priority${tItem.priority}`, tItem.priority)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Today's Tasks */}
        <div className="space-y-2.5">
          <h4 className="text-xs font-display font-medium text-ink flex items-center justify-between">
            <span>{t("taskPlanner.todaysPriorities", "Today's Priorities")}</span>
            <span className="text-[10px] font-mono text-ink-soft">{t("taskPlanner.pendingCount", "{{count}} pending", { count: todayTasks.length })}</span>
          </h4>

          {todayTasks.length === 0 ? (
            <p className="text-xs text-ink-soft italic py-2">{t("taskPlanner.noTasksToday", "No tasks due today.")}</p>
          ) : (
            <div className="space-y-2">
              {todayTasks.slice(0, 3).map((tItem) => (
                <div
                  key={tItem.id}
                  className="flex items-center justify-between gap-3 p-2.5 border border-border/50 rounded-xl bg-paper/10 hover:bg-paper/20 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <input
                      type="checkbox"
                      className="w-3.5 h-3.5 rounded border-border text-teal focus:ring-teal cursor-pointer shrink-0"
                      onChange={() => handleToggleComplete(tItem.id || tItem._id)}
                    />
                    <span className="text-xs font-medium text-ink truncate">{tItem.title}</span>
                  </div>
                  <span className={`text-[9px] uppercase font-mono font-semibold px-1.5 py-0.5 rounded border ${getPriorityStyle(tItem.priority)}`}>
                    {t(`taskPlanner.priority${tItem.priority}`, tItem.priority)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Today's Meetings */}
        <div className="space-y-2.5">
          <h4 className="text-xs font-display font-medium text-ink flex items-center justify-between">
            <span>{t("taskPlanner.todaysMeetings", "Today's Meetings")}</span>
            <span className="text-[10px] font-mono text-ink-soft">{t("taskPlanner.scheduledCount", "{{count}} scheduled", { count: displayMeetings.length })}</span>
          </h4>

          {displayMeetings.length === 0 ? (
            <p className="text-xs text-ink-soft italic py-2">{t("taskPlanner.noMeetingsToday", "No upcoming meetings today.")}</p>
          ) : (
            <div className="space-y-2">
              {displayMeetings.slice(0, 2).map((m) => (
                <div
                  key={m.id || m._id}
                  className="flex items-center justify-between gap-3 p-2.5 border border-border/50 rounded-xl bg-paper/10 hover:bg-paper/20 transition-colors"
                >
                  <span className="text-xs font-medium text-ink truncate">{m.title}</span>
                  <span className="text-[9px] font-mono font-semibold text-teal-dark bg-teal-tint px-1.5 py-0.5 rounded">
                    {formatTime12(m.startTimeStr || m.startTime)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
