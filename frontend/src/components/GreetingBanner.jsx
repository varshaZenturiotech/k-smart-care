import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Sparkles, Shield, UserCheck, Heart, X, ChevronRight,
  Target, Moon, Battery, AlertTriangle, BookOpen
} from "lucide-react";
import { useLanguage } from "../context/LanguageContext.jsx";

/* ============================================================
   Shared helpers
   ============================================================ */

function getMoodEmoji(mood, t) {
  switch (mood?.toLowerCase()) {
    case "great": return `${t("wellness.great", "Great")} 😀`;
    case "good": return `${t("wellness.good", "Good")} 🙂`;
    case "okay": return `${t("wellness.okay", "Okay")} 😐`;
    case "tired": return `${t("wellness.tired", "Tired")} 😔`;
    case "overwhelmed": return `${t("wellness.overwhelmed", "Overwhelmed")} 😣`;
    default: return mood || t("common.none", "None");
  }
}

function getBurnoutColor(risk) {
  switch (risk?.toLowerCase()) {
    case "high": return "text-alert bg-alert-tint border-alert/20";
    case "medium": return "text-ochre bg-ochre-tint border-ochre/20";
    case "low": return "text-teal bg-sage-tint border-sage/20";
    default: return "text-ink-soft bg-paper border-border";
  }
}

function renderPriority(priorityStr) {
  if (!priorityStr) return null;
  const lines = priorityStr.split(/\n|;|\* /).map(l => l.trim()).filter(Boolean);
  if (lines.length > 1) {
    return (
      <ul className="space-y-1.5 list-none font-medium">
        {lines.map((line, idx) => (
          <li key={idx} className="flex items-start gap-1.5">
            <span className="text-[10px] text-ochre shrink-0 mt-0.5">⚡</span>
            <span className="text-ink-soft leading-normal">{line.replace(/^-\s*|^⚡\s*/, "")}</span>
          </li>
        ))}
      </ul>
    );
  }
  return <p className="text-ink-soft leading-normal font-medium">{priorityStr}</p>;
}

// Dynamically switches AI recommendation prefixes based on the language toggle
function formatRecommendation(rec, language) {
  if (!rec) return "";
  const isMl = language === "ml";
  const prefixes = [
    { en: "Focus Suggestion: ", ml: "ശ്രദ്ധ നിർദ്ദേശം: " },
    { en: "Wellbeing Tip: ", ml: "വെൽബീയിംഗ് ടിപ്പ്: " },
    { en: "Motivation: ", ml: "പ്രചോദനം: " }
  ];
  for (const p of prefixes) {
    if (rec.startsWith(p.en)) {
      const rest = rec.substring(p.en.length);
      return isMl ? `${p.ml}${rest}` : `${p.en}${rest}`;
    }
    if (rec.startsWith(p.ml)) {
      const rest = rec.substring(p.ml.length);
      return isMl ? `${p.ml}${rest}` : `${p.en}${rest}`;
    }
  }
  return rec;
}

function formatSummaryStatement(summaryStr, language) {
  if (!summaryStr) return "";
  const isMl = language === "ml";
  const enPrefix = "Today's Wellbeing Tip: ";
  const mlPrefix = "ഇന്നത്തെ വെൽബീയിംഗ് കുറിപ്പ്: ";
  if (summaryStr.startsWith(enPrefix)) {
    const rest = summaryStr.substring(enPrefix.length);
    return isMl ? `${mlPrefix}${rest}` : `${enPrefix}${rest}`;
  }
  if (summaryStr.startsWith(mlPrefix)) {
    const rest = summaryStr.substring(mlPrefix.length);
    return isMl ? `${mlPrefix}${rest}` : `${enPrefix}${rest}`;
  }
  return summaryStr;
}

function getGreetingPrefix(date, user) {
  const tz = user?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
  let hour = date.getHours();
  try {
    const formatter = new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: tz });
    hour = parseInt(formatter.format(date), 10);
  } catch (e) {
    // fallback to local hour
  }
  if (hour >= 5 && hour < 12) return "Good Morning";
  if (hour >= 12 && hour < 17) return "Good Afternoon";
  if (hour >= 17 && hour < 21) return "Good Evening";
  return "Good Night";
}

/* ============================================================
   GreetingBanner — the compact on-photo overlay.
   Lives inside <Hero>, bottom-anchored. Sized to sit in roughly
   the lower half of the ~600px hero, not fill it, so the photo
   itself stays visible up top (see reference: TownPress banner).
   ============================================================ */

export default function GreetingBanner({
  greeting, wellnessScore, focusScore, user, moodData, onOpenCheckin,
  briefing
}) {
  const [showDetails, setShowDetails] = useState(false);
  const { language, t, formatDate, formatTime } = useLanguage();

  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const clockWeekday = formatDate(now, { weekday: "long" });
  const clockDate = formatDate(now, { day: "numeric", month: "short", year: "numeric" });
  const clockTime = formatTime(now).toUpperCase();

  const isCompleted = moodData?.checkedInToday;
  const data = moodData?.wellnessData;

  const greetingText = briefing?.greeting || greeting || "";
  const statusMessage = briefing?.statusMessage || t("greeting.allSystemsStable", "All systems stable. Keep track of your daily tasks.");
  const wellnessSummaryStatement = isCompleted && data?.aiSummary
    ? formatSummaryStatement(data.aiSummary, language)
    : statusMessage;

  const greetingParts = greetingText.split("\n\n");
  const greetingSuffix = greetingParts.slice(1).join("\n\n");

  const prefix = getGreetingPrefix(now, user);
  const employeeName = user?.name || "User";
  const mainGreeting = `${prefix}, ${employeeName} 👋`;

  const formatMainGreeting = (str) => {
    if (!str) return "";
    const parts = str.split(",");
    if (parts.length > 1) {
      return (
        <>
          {parts[0]}, <span className="text-teal-500">{parts.slice(1).join(",").trim()}</span>
        </>
      );
    }
    return str;
  };

  return (
    <>
      <div className="flex flex-col lg:flex-row gap-4 items-stretch w-full animate-slide-up-fade">

        {/* Greeting panel — solid dark overlay, on the photo */}
        <div
          className="w-full lg:w-[68%] rounded-2xl px-6 py-5 md:px-8 md:py-6 flex flex-col justify-center gap-2.5"
          style={{ background: "rgba(15,23,42,0.55)" }}
        >
          {/* Metadata & clock row */}
          <div className="hidden sm:flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-white/70 uppercase tracking-wider pb-2.5 border-b border-white/15">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1 text-white text-xs">
                <Shield size={11} className="text-white/70" />
                {t("departments." + user?.department, user?.department || t("greeting.lsgDept", "LSG Department"))}
              </span>
              <span className="text-white/40">•</span>
              <span className="flex items-center gap-1 text-white text-xs">
                <UserCheck size={11} className="text-white/70" />
                {t("designations." + user?.designation, user?.designation)}
              </span>
            </div>
            <div className="flex items-center gap-2 text-white/80">
              <span className="font-semibold text-white text-xs">{clockWeekday},</span>
              <span className="text-xs">{clockDate}</span>
              <span className="text-white/40">•</span>
              <span className="font-semibold text-white tabular-nums text-xs">{clockTime}</span>
            </div>
          </div>

          {/* Greeting headline */}
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-display font-medium text-white tracking-tight leading-tight">
            {formatMainGreeting(mainGreeting)}
          </h1>

          {greetingSuffix && (
            <p className="text-xs md:text-sm font-sans text-white/80 leading-relaxed max-w-2xl line-clamp-1">
              {greetingSuffix}
            </p>
          )}

          {/* AI Daily Briefing — condensed to one line */}
          <div className="flex items-start gap-1.5 text-xs md:text-sm text-white/85 leading-relaxed pt-1">
            <Sparkles size={13} className="text-white/80 shrink-0 mt-0.5" />
            <span className="line-clamp-1">
              {briefing?.briefing || t("greeting.analyzingBriefing", "Analyzing today's schedule and preparing your custom briefing...")}
            </span>
          </div>
        </div>

        {/* Wellness quick card — solid dark overlay, compact */}
        <div
          className="w-full lg:w-[32%] rounded-2xl px-5 py-5 flex flex-col justify-center gap-3"
          style={{ background: "rgba(15,23,42,0.55)" }}
        >
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-display font-semibold text-sm text-white">
              <Heart size={15} className="text-white" />
              {t("greeting.wellnessStatus", "Today's Wellness")}
            </span>
            {isCompleted && (
              <button
                onClick={() => setShowDetails(true)}
                className="text-[12px] font-semibold text-white/70 hover:text-white flex items-center gap-0.5 cursor-pointer"
              >
                {t("greeting.viewDetails", "Details")} 
              </button>
            )}
          </div>

          {!isCompleted ? (
            <button
              onClick={onOpenCheckin}
              className="w-full py-2 bg-teal hover:bg-teal-dark text-white rounded-xl font-semibold transition text-xs active:scale-95 cursor-pointer"
            >
              {t("greeting.checkinNow", "Check-in Now")}
            </button>
          ) : (
            <div className="flex items-center gap-4">
              {wellnessScore !== undefined && wellnessScore !== null && (
                <MiniGauge value={wellnessScore} label={t("greeting.wellnessIndexShort", "Wellness")} />
              )}
              {focusScore !== undefined && focusScore !== null && (
                <MiniGauge value={focusScore} label={t("greeting.focusCapacityShort", "Focus")} />
              )}
              <div className="flex-1 text-xs text-white/85 space-y-1">
                {data?.mood && (
                  <div className="flex gap-5">
                    <span className="text-white/60 ">{t("greeting.mood", "Mood")}:</span>
                    <span className="font-semibold">{getMoodEmoji(data.mood, t)}</span>
                  </div>
                )}
                {data?.burnoutRisk && (
                  <div className="flex gap-5 items-center">
                    <span className="text-white/60">{t("greeting.burnout", "Burnout")}</span>
                    <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full border ${getBurnoutColor(data.burnoutRisk)}`}>
                      {t("wellness." + data.burnoutRisk?.toLowerCase()?.replace(" ", ""), data.burnoutRisk)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Wellness Details Popup Dialog ── */}
      {showDetails && data && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm animate-fade-in font-sans">
          <div className="relative w-full max-w-xl bg-surface border border-border rounded-2xl shadow-custom overflow-hidden transition-all duration-300 transform scale-100 flex flex-col max-h-[85vh]">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-paper/20">
              <div className="flex items-center gap-2">
                <Heart size={18} className="text-teal" />
                <span className="font-display font-medium text-ink">
                  {t("greeting.modalTitle", "Today's Wellness Details & Diagnostics")}
                </span>
              </div>
              <button
                onClick={() => setShowDetails(false)}
                className="p-1 text-ink-soft hover:text-ink hover:bg-paper/40 rounded-lg transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">

              {/* Wellness Metrics Grid */}
              <div className="space-y-3 bg-paper/10 border border-border/60 rounded-xl p-4">
                <span className="text-[10px] font-mono text-ink-soft uppercase tracking-wider block font-semibold">{t("greeting.wellnessIndicators", "Wellness Indicators")}</span>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-border/40 shadow-sm">
                    <span className="text-lg">🎭</span>
                    <div>
                      <span className="text-[9px] font-mono text-ink-soft block uppercase">{t("greeting.mood", "Mood")}</span>
                      <span className="font-semibold text-ink">{getMoodEmoji(data.mood, t)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-border/40 shadow-sm">
                    <Moon size={15} className="text-indigo-400 shrink-0" />
                    <div>
                      <span className="text-[9px] font-mono text-ink-soft block uppercase">{t("greeting.sleep", "Sleep")}</span>
                      <span className="font-semibold text-ink">{data.sleepHours} {t("greeting.hours", "hrs")}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-border/40 shadow-sm">
                    <Battery size={15} className="text-green-500 shrink-0" />
                    <div>
                      <span className="text-[9px] font-mono text-ink-soft block uppercase">{t("greeting.energy", "Energy")}</span>
                      <span className="font-semibold text-ink">{t("wellness." + data.energy?.toLowerCase()?.replace(" ", ""), data.energy)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-border/40 shadow-sm">
                    <AlertTriangle size={15} className="text-amber-500 shrink-0" />
                    <div>
                      <span className="text-[9px] font-mono text-ink-soft block uppercase">{t("greeting.stress", "Stress")}</span>
                      <span className="font-semibold text-ink">{t("wellness." + data.stress?.toLowerCase()?.replace(" ", ""), data.stress)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-border/40 shadow-sm">
                    <BookOpen size={15} className="text-blue-500 shrink-0" />
                    <div>
                      <span className="text-[9px] font-mono text-ink-soft block uppercase">{t("greeting.workload", "Workload")}</span>
                      <span className="font-semibold text-ink">{t("wellness." + data.workload?.toLowerCase()?.replace(" ", ""), data.workload)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-border/40 shadow-sm">
                    <span className="text-sm">🔥</span>
                    <div>
                      <span className="text-[9px] font-mono text-ink-soft block uppercase">{t("greeting.burnout", "Burnout")}</span>
                      <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border inline-block ${getBurnoutColor(data.burnoutRisk)}`}>
                        {t("wellness." + data.burnoutRisk?.toLowerCase()?.replace(" ", ""), data.burnoutRisk)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* AI Recommendations */}
              {data.recommendations && data.recommendations.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[10px] font-mono text-ink-soft uppercase tracking-wider block font-semibold">{t("greeting.aiTips", "AI Recommendations & Tips")}</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {data.recommendations.map((rec, idx) => (
                      <div key={idx} className="p-3 bg-sage-tint/40 border border-sage/10 rounded-xl text-xs text-ink leading-relaxed">
                        {formatRecommendation(rec, language)}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Reflection Notes */}
              {data.note && (
                <div className="space-y-1.5 bg-paper/5 border border-border/60 rounded-xl p-3.5">
                  <span className="text-[10px] font-mono text-ink-soft uppercase tracking-wider block font-semibold">{t("greeting.reflectionNotes", "Reflection Notes")}</span>
                  <p className="text-xs text-ink-soft leading-relaxed italic">
                    "{data.note}"
                  </p>
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-border bg-paper/20">
              <button
                onClick={() => setShowDetails(false)}
                className="px-4 py-2 bg-teal hover:bg-teal-dark text-white rounded-xl text-xs font-semibold transition cursor-pointer active:scale-95"
              >
                {t("greeting.closeDetails", "Close Details")}
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}
    </>
  );
}

/* Detailed radial progress gauge used inside the detailed wellness popup modal */
function RadialProgress({ value, label, colorClass, trailColorClass, icon }) {
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (value / 100) * circumference;

  return (
    <div className="flex flex-col items-center bg-paper/30 border border-border/40 p-4 rounded-xl shadow-sm">
      <div className="relative w-16 h-16 flex items-center justify-center">
        <svg className="w-full h-full transform -rotate-90">
          <circle cx="32" cy="32" r={radius} className={`${trailColorClass || "text-border/20"} stroke-current`} strokeWidth="4" fill="transparent" />
          <circle
            cx="32" cy="32" r={radius}
            className={`${colorClass} stroke-current transition-all duration-500 ease-out`}
            strokeWidth="4" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
            strokeLinecap="round" fill="transparent"
          />
        </svg>
        <div className="absolute flex flex-col items-center justify-center">
          {icon && <div className="mb-0.5">{icon}</div>}
          <span className="text-[11px] font-semibold font-mono text-ink leading-none">{value}%</span>
        </div>
      </div>
      <span className="text-[10px] font-mono text-ink-soft uppercase tracking-wider mt-2 font-semibold text-center leading-tight">{label}</span>
    </div>
  );
}

/* Small radial gauge used inside the compact wellness quick card */
function MiniGauge({ value, label }) {
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (value / 100) * circumference;

  return (
    <div className="flex flex-col items-center shrink-0">
      <div className="relative w-12 h-12 flex items-center justify-center">
        <svg className="w-full h-full transform -rotate-90">
          <circle cx="24" cy="24" r={radius} className="text-white/20 stroke-current" strokeWidth="4" fill="transparent" />
          <circle
            cx="24" cy="24" r={radius}
            className="text-teal-500 stroke-current transition-all duration-500 ease-out"
            strokeWidth="4" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
            strokeLinecap="round" fill="transparent"
          />
        </svg>
        <span className="absolute text-[10px] font-semibold font-mono text-white">{value}%</span>
      </div>
      <span className="text-[8px] font-mono text-white/70 uppercase tracking-wider mt-1 font-semibold">{label}</span>
    </div>
  );
}

/* ============================================================
   TodayOverviewCards — Work Snapshot + Priority/Motivation.
   Flat, opaque cards (matches the rest of the app, e.g.
   "For Local Self Government" / "Task Planner" below). Rendered
   by DashboardPage just under <Hero>, not inside it.
   ============================================================ */

export function TodayOverviewCards({ briefing, newCircularsCount, pendingFilesCount, todayMeetingsCount }) {
  const { t } = useLanguage();

  const hasPriority = (briefing?.smartPriorities && briefing.smartPriorities.length > 0) || briefing?.priority;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

      {/* Today's Work Snapshot */}
      <div className="bg-white border border-border rounded-2xl shadow-custom p-4">
        <span className="text-[15px] font-mono text-ink-soft uppercase tracking-wider block font-semibold mb-3">
          {t("greeting.snapshot", "Today's Work Snapshot")}
        </span>
        <div className="grid grid-cols-3 gap-2.5">
          <div className="p-2.5 bg-paper/40 border border-border/60 rounded-xl flex items-center gap-2">
            <span className="text-base">📂</span>
            <div>
              <span className="text-xs font-mono text-ink-soft uppercase block">{t("greeting.pendingFiles", "Files")}</span>
              <span className="text-xs font-semibold text-ink">{pendingFilesCount}</span>
            </div>
          </div>
          <div className="p-2.5 bg-paper/40 border border-border/60 rounded-xl flex items-center gap-2">
            <span className="text-base">📅</span>
            <div>
              <span className="text-xs font-mono text-ink-soft uppercase block">{t("greeting.meetings", "Meetings")}</span>
              <span className="text-xs font-semibold text-ink">{todayMeetingsCount}</span>
            </div>
          </div>
          <div className="p-2.5 bg-paper/40 border border-border/60 rounded-xl flex items-center gap-2">
            <span className="text-base">📢</span>
            <div>
              <span className="text-xs font-mono text-ink-soft uppercase block">{t("greeting.newCirculars", "Circulars")}</span>
              <span className="text-xs font-semibold text-ink">{newCircularsCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Priority Ranking */}
      {hasPriority && (
        <div className="bg-white border border-border rounded-2xl shadow-custom p-4">
          <span className="text-[15px] font-mono text-ink-soft uppercase tracking-wider block font-semibold mb-3 flex items-center gap-1.5">
            <span className="text-sm leading-none">⚡</span>
            {t("greeting.priorityRanking", "Today's Priority Ranking")}
          </span>
          {briefing?.smartPriorities && briefing.smartPriorities.length > 0 ? (
            <ol className="list-decimal pl-4 space-y-1.5 font-medium text-ink-soft text-xs">
              {briefing.smartPriorities.map((item, idx) => (
                <li key={idx} className="pl-1">
                  <span className="text-ink font-semibold leading-normal">{item}</span>
                </li>
              ))}
            </ol>
          ) : renderPriority(briefing.priority)}
        </div>
      )}

      {/* Motivation */}
      {briefing?.motivation && (
        <div className="bg-white border border-border rounded-2xl shadow-custom p-4">
          <span className="text-[15px] font-mono text-ink-soft uppercase tracking-wider block font-semibold mb-3 flex items-center gap-1.5">
            <span className="text-sm leading-none">🌱</span>
            {t("greeting.motivation", "Daily Motivation")}
          </span>
          <p className="text-ink-soft leading-normal italic font-medium text-sm">"{briefing.motivation}"</p>
        </div>
      )}
    </div>
  );
}