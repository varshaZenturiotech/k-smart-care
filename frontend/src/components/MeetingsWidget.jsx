import { CalendarClock, MapPin } from "lucide-react";
import { formatTime12 } from "../utils/timeFormat.js";
import { useLanguage } from "../context/LanguageContext.jsx";

export default function MeetingsWidget({ meetings }) {
  const { t } = useLanguage();
  return (
    <div className="bg-white border border-border rounded-2xl shadow-custom p-6 transition-all duration-300 hover:shadow-custom-sm hover:-translate-y-0.5 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-teal-tint text-teal">
          <CalendarClock size={18} />
        </div>
        <h2 className="text-base font-display font-medium text-ink">
          {t("dashboard.todaysMeetings", "Today's Meetings")}
        </h2>
        {meetings.length > 0 && (
          <span className="ml-auto text-xs font-mono font-semibold bg-paper text-ink px-2 py-0.5 rounded-full border border-border">
            {meetings.length}
          </span>
        )}
      </div>

      {meetings.length === 0 ? (
        <div className="text-center py-6 border border-dashed border-border rounded-xl bg-paper/30 flex-1 flex items-center justify-center">
          <p className="text-sm text-ink-soft italic">{t("dashboard.noMeetingsToday", "No meetings scheduled for today.")}</p>
        </div>
      ) : (
        <div className="space-y-4 max-h-[250px] overflow-y-auto pr-1">
          {meetings.map((m) => (
            <div key={m._id} className="flex gap-4 items-start">
              <span className="font-mono text-xs font-semibold text-teal-dark bg-teal-tint/80 border border-teal/10 px-2 py-1 rounded shrink-0">
                {formatTime12(m.startTime)}
              </span>
              <div className="space-y-0.5 min-w-0">
                <p className="text-sm font-medium text-ink leading-tight break-words">
                  {m.title}
                </p>
                {m.location && (
                  <span className="flex items-center gap-1 text-[11px] text-ink-soft">
                    <MapPin size={12} className="shrink-0" />
                    {m.location}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
