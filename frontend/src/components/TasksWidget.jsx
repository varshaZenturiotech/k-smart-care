import { FileText, Calendar, AlertCircle } from "lucide-react";
import client from "../api/client.js";
import { useLanguage } from "../context/LanguageContext.jsx";

const PRIORITY_THEME = {
  high: { bg: "bg-alert-tint", text: "text-alert border-alert/20" },
  medium: { bg: "bg-ochre-tint", text: "text-ochre border-ochre/20" },
  low: { bg: "bg-teal-tint", text: "text-teal border-teal/20" },
};

export default function TasksWidget({ tasks, onRefresh }) {
  const { t, formatDate } = useLanguage();
  const handleToggleComplete = async (taskId) => {
    try {
      await client.patch(`/tasks/${taskId}/status`, { status: "Completed" });
      if (onRefresh) onRefresh();
      else window.location.reload();
    } catch (err) {
      console.error("Failed to complete task:", err);
    }
  };
  return (
    <div className="bg-white border border-border rounded-2xl shadow-custom p-6 transition-all duration-300 hover:shadow-custom-sm hover:-translate-y-0.5 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-teal-tint text-teal">
          <FileText size={18} />
        </div>
        <h2 className="text-base font-display font-medium text-ink">
          {t("dashboard.pendingFilesTasks", "Pending Files & Tasks")}
        </h2>
        {tasks.length > 0 && (
          <span className="ml-auto text-xs font-mono font-semibold bg-paper text-ink px-2 py-0.5 rounded-full border border-border">
            {tasks.length}
          </span>
        )}
      </div>

      {tasks.length === 0 ? (
        <div className="text-center py-6 border border-dashed border-border rounded-xl bg-paper/30 flex-1 flex items-center justify-center">
          <p className="text-sm text-ink-soft italic">{t("dashboard.noFilesPending", "No files currently pending approval.")}</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
          {tasks.map((task) => {
            const theme = PRIORITY_THEME[task.priority] || PRIORITY_THEME.medium;
            const priorityKey = "priority" + (task.priority ? task.priority.charAt(0).toUpperCase() + task.priority.slice(1).toLowerCase() : "Medium");
            return (
              <div
                key={task._id}
                className="flex items-start justify-between gap-4 p-3 border border-border rounded-xl bg-paper/20 hover:bg-paper/40 transition-colors"
              >
                <div className="flex gap-2.5 items-start min-w-0">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-border text-teal focus:ring-teal cursor-pointer shrink-0 mt-0.5"
                    onChange={() => handleToggleComplete(task.id || task._id)}
                  />
                  <div className="space-y-1 min-w-0">
                    <p className="text-sm font-medium text-ink leading-snug break-words">
                      {task.title}
                    </p>
                    {task.dueDate && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono text-ink-soft">
                        <Calendar size={12} className="shrink-0" />
                        {t("taskPlanner.due", "Due")} {formatDate(task.dueDate)}
                      </span>
                    )}
                  </div>
                </div>
                <span className={`text-[10px] uppercase font-mono font-semibold px-2 py-0.5 rounded border ${theme.bg} ${theme.text} shrink-0`}>
                  {t(`taskPlanner.${priorityKey}`, task.priority)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
