import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { 
  Sparkles, Shield, UserCheck, Heart, Moon, Target,
  Battery, AlertTriangle, BookOpen, ClipboardList, X 
} from "lucide-react";
import { useAssistant } from "../context/AssistantContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";


export default function GreetingBanner({ 
  greeting, wellnessScore, focusScore, user, aiTip, moodData, onOpenCheckin,
  briefing, newCircularsCount, pendingFilesCount, todayMeetingsCount
}) {
  const [showDetails, setShowDetails] = useState(false);
  const { triggerAskAI } = useAssistant();
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

  const getMoodEmoji = (mood) => {
    switch (mood?.toLowerCase()) {
      case "great": return `${t("wellness.great", "Great")} 😀`;
      case "good": return `${t("wellness.good", "Good")} 🙂`;
      case "okay": return `${t("wellness.okay", "Okay")} 😐`;
      case "tired": return `${t("wellness.tired", "Tired")} 😔`;
      case "overwhelmed": return `${t("wellness.overwhelmed", "Overwhelmed")} 😣`;
      default: return mood || t("common.none", "None");
    }
  };

  const getBurnoutColor = (risk) => {
    switch (risk?.toLowerCase()) {
      case "high": return "text-alert bg-alert-tint border-alert/20";
      case "medium": return "text-ochre bg-ochre-tint border-ochre/20";
      case "low": return "text-teal bg-sage-tint border-sage/20";
      default: return "text-ink-soft bg-paper border-border";
    }
  };

  const renderPriority = (priorityStr) => {
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
  };

  // Helper to dynamically switch AI recommendation prefixes based on current language toggle
  const formatRecommendation = (rec) => {
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
  };

  // Helper to dynamically translate AI summary prefix
  const formatSummaryStatement = (summaryStr) => {
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
  };

  // Extract time-aware greeting message
  const greetingText = briefing?.greeting || greeting || "";
  const statusMessage = briefing?.statusMessage || t("greeting.allSystemsStable", "All systems stable. Keep track of your daily tasks.");
  
  // Use AI summary statement if completed, else the default fallback status message
  const wellnessSummaryStatement = isCompleted && data?.aiSummary 
    ? formatSummaryStatement(data.aiSummary) 
    : statusMessage;

  const greetingParts = greetingText.split("\n\n");
  const greetingSuffix = greetingParts.slice(1).join("\n\n");

  const getGreetingPrefix = (date) => {
    const tz = user?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
    let hour = date.getHours();
    try {
      const formatter = new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        hour12: false,
        timeZone: tz
      });
      hour = parseInt(formatter.format(date), 10);
    } catch (e) {
      // fallback
    }

    if (hour >= 5 && hour < 12) {
      return "Good Morning";
    } else if (hour >= 12 && hour < 17) {
      return "Good Afternoon";
    } else if (hour >= 17 && hour < 21) {
      return "Good Evening";
    } else {
      return "Good Night";
    }
  };

  const prefix = getGreetingPrefix(now);
  const employeeName = user?.name || "User";
  const mainGreeting = `${prefix}, ${employeeName} 👋`;

  const formatMainGreeting = (str) => {
    if (!str) return "";
    const parts = str.split(",");
    if (parts.length > 1) {
      return (
        <>
          {parts[0]}, <span className="text-teal">{parts.slice(1).join(",").trim()}</span>
        </>
      );
    }
    return str;
  };

  return (
    <div className="relative overflow-hidden bg-white border border-border rounded-2xl shadow-custom p-6 md:p-8 mb-6 transition-all duration-300 hover:shadow-custom-sm font-sans space-y-6">
      {/* Decorative background styling */}
      <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-teal-tint opacity-40 blur-3xl pointer-events-none" />
      <div className="absolute -right-8 -bottom-8 w-48 h-48 rounded-full bg-ochre-tint opacity-30 blur-2xl pointer-events-none" />

      {/* ── 1. GREETING & CONVERSATIONAL WORKLOAD CONTEXT ── */}
      <div className="space-y-6 w-full relative z-10">
        
        {/* Metadata Row */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] md:text-xs font-mono text-ink-soft uppercase tracking-wider">
          {/* Left: user identity */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1 font-semibold text-teal">
              <Shield size={12} className="text-teal" />
              {t("departments." + user?.department, user?.department || t("greeting.lsgDept", "LSG Department"))}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <UserCheck size={12} />
              {t("designations." + user?.designation, user?.designation)}
            </span>
            <span>•</span>
            <span>{t("districts." + user?.district, user?.district)} {t("greeting.district", "District")}</span>
          </div>

          {/* Right: live clock */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="font-semibold text-ink">{clockWeekday},</span>
            <span>{clockDate}</span>
            <span>•</span>
            <span className="font-semibold text-teal tabular-nums">{clockTime}</span>
          </div>
        </div>

        {/* Header Title Block */}
        <div className="space-y-2">
          <h1 className="text-2xl md:text-3xl font-display font-medium text-ink tracking-tight leading-tight animate-fade-in">
            {formatMainGreeting(mainGreeting)}
          </h1>
          {greetingSuffix && (
            <p className="text-xs md:text-sm font-sans text-ink-soft leading-relaxed max-w-4xl">
              {greetingSuffix}
            </p>
          )}
          
          {/* AI Wellness Status summary statement */}
          <div className="pt-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-teal-tint/30 border border-teal/10 rounded-xl text-xs text-teal-dark font-medium leading-relaxed max-w-xl">
              <Sparkles size={13} className="text-teal shrink-0 animate-pulse" />
              <span>{wellnessSummaryStatement}</span>
            </div>
          </div>
        </div>

        {/* AI Daily Briefing Text Block */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[10px] md:text-xs font-mono uppercase tracking-wider text-teal-dark font-semibold">
              <Sparkles size={14} className="text-teal" />
              {t("greeting.aiBriefing", "AI Daily Briefing")}
            </div>
          </div>
          <p className="text-xs md:text-sm text-ink-soft leading-relaxed max-w-4xl">
            {briefing?.briefing || t("greeting.analyzingBriefing", "Analyzing today's schedule and preparing your custom briefing...")}
          </p>
        </div>


        {/* Today's Work Snapshot Grid */}
        <div className="space-y-2.5">
          <span className="text-[10px] font-mono text-ink-soft uppercase tracking-wider block font-semibold">{t("greeting.snapshot", "Today's Work Snapshot")}</span>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="p-3 bg-paper/10 border border-border/80 rounded-xl shadow-sm">
              <span className="text-[9px] font-mono text-ink-soft uppercase block">📂 {t("greeting.pendingFiles", "Pending Files")}</span>
              <span className="text-sm font-semibold text-ink mt-0.5 block">{pendingFilesCount} {t("greeting.filesCount", "files")}</span>
            </div>
            <div className="p-3 bg-paper/10 border border-border/80 rounded-xl shadow-sm">
              <span className="text-[9px] font-mono text-ink-soft uppercase block">📅 {t("greeting.meetings", "Meetings")}</span>
              <span className="text-sm font-semibold text-ink mt-0.5 block">{todayMeetingsCount} {t("greeting.scheduledCount", "scheduled")}</span>
            </div>
            <div className="p-3 bg-paper/10 border border-border/80 rounded-xl shadow-sm">
              <span className="text-[9px] font-mono text-ink-soft uppercase block">📢 {t("greeting.newCirculars", "New Circulars")}</span>
              <span className="text-sm font-semibold text-ink mt-0.5 block">{newCircularsCount} {t("greeting.newCount", "new")}</span>
            </div>
          </div>
        </div>

        {/* Priority & Motivation Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          {(briefing?.smartPriorities && briefing.smartPriorities.length > 0) ? (
            <div className="p-4 bg-ochre-tint/30 border border-ochre/15 rounded-xl flex items-start gap-2">
              <span className="text-base leading-none">⚡</span>
              <div className="w-full">
                <span className="font-semibold text-ochre block mb-1.5 uppercase tracking-wider text-[9px] font-mono">{t("greeting.priorityRanking", "Today's Priority Ranking")}</span>
                <ul className="space-y-1 font-medium text-ink-soft">
                  {briefing.smartPriorities.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-1">
                      <span className="text-ink leading-normal font-semibold">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : briefing?.priority ? (
            <div className="p-4 bg-ochre-tint/30 border border-ochre/15 rounded-xl flex items-start gap-2">
              <span className="text-base leading-none">⚡</span>
              <div>
                <span className="font-semibold text-ochre block mb-1 uppercase tracking-wider text-[9px] font-mono">{t("greeting.priority", "Today's Priority")}</span>
                {renderPriority(briefing.priority)}
              </div>
            </div>
          ) : null}
          {briefing?.motivation && (
            <div className="p-4 bg-teal-tint/30 border border-teal/15 rounded-xl flex items-start gap-2">
              <span className="text-base leading-none">🌱</span>
              <div>
                <span className="font-semibold text-teal-dark block mb-1 uppercase tracking-wider text-[9px] font-mono">{t("greeting.motivation", "Daily Motivation")}</span>
                <p className="text-ink-soft leading-normal italic font-medium">"{briefing.motivation}"</p>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* ── 2. TODAY'S WELLNESS STATUS BAR (Triggering details popup modal) ── */}
      <div className="border-t border-border/60 pt-6 relative z-10 w-full">
        {isCompleted && data ? (
          <div className="w-full flex items-center justify-between p-4 bg-paper/15 border border-border/60 rounded-xl font-sans">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
              <Heart size={15} className="text-teal" />
              <span className="font-semibold text-ink">🌿 {t("greeting.wellnessCheckCompleted", "Today's Wellness Profile Completed")}</span>
              <span className="text-ink-soft hidden sm:inline">•</span>
              <span className="text-[11px] font-medium text-teal bg-sage-tint px-2 py-0.5 rounded-full border border-sage/20">
                {t("greeting.mood", "Mood")}: {getMoodEmoji(data.mood)}
              </span>
              <span className="text-[11px] font-medium text-ochre bg-ochre-tint px-2 py-0.5 rounded-full border border-ochre/20">
                {t("greeting.burnout", "Burnout")}: {t("wellness." + data.burnoutRisk?.toLowerCase()?.replace(" ", ""), data.burnoutRisk)}
              </span>
            </div>
            <button
              onClick={() => setShowDetails(true)}
              className="text-xs text-teal hover:text-teal-dark font-semibold transition hover:underline cursor-pointer whitespace-nowrap"
            >
              {t("greeting.viewDetails", "View Details & Diagnostics →")}
            </button>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 bg-sage-tint/30 border border-sage/10 rounded-2xl">
            <div className="space-y-1 text-center sm:text-left">
              <h3 className="text-sm font-semibold text-teal-dark flex items-center gap-1.5 justify-center sm:justify-start">
                <Sparkles size={16} className="text-teal" />
                {t("greeting.wellnessPending", "Today's Wellness Check is pending")}
              </h3>
              <p className="text-xs text-ink-soft max-w-xl leading-relaxed">
                {t("greeting.wellnessPendingDesc", "Log today's wellness check to populate score diagnostics, circular charts, and customized colleague tips.")}
              </p>
            </div>
            <button
              onClick={onOpenCheckin}
              className="px-5 py-2.5 bg-teal hover:bg-teal-dark text-white rounded-xl font-semibold transition text-xs active:scale-95 shadow-sm cursor-pointer whitespace-nowrap"
            >
              {t("greeting.wellnessCheckBtn", "Daily Wellness Check")}
            </button>
          </div>
        )}
      </div>

      {/* ── 3. WELLNESS DETAILS POPUP DIALOG (React Portal) ── */}
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
              
              {/* Score Diagnostics (Radial Gauges) */}
              <div className="grid grid-cols-2 gap-4">
                <RadialProgress 
                  value={wellnessScore} 
                  label={t("greeting.wellnessIndex", "Wellness Index")} 
                  colorClass="text-teal" 
                  trailColorClass="text-teal-tint/40"
                  icon={<Heart size={11} className="text-teal" />}
                />
                <RadialProgress 
                  value={focusScore} 
                  label={t("greeting.focusCapacity", "Focus Capacity")} 
                  colorClass="text-sage" 
                  trailColorClass="text-sage-tint/40"
                  icon={<Target size={11} className="text-sage" />}
                />
              </div>

              {/* Wellness Metrics Grid */}
              <div className="space-y-3 bg-paper/10 border border-border/60 rounded-xl p-4">
                <span className="text-[10px] font-mono text-ink-soft uppercase tracking-wider block font-semibold">{t("greeting.wellnessIndicators", "Wellness Indicators")}</span>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-border/40 shadow-sm">
                    <span className="text-lg">🎭</span>
                    <div>
                      <span className="text-[9px] font-mono text-ink-soft block uppercase">{t("greeting.mood", "Mood")}</span>
                      <span className="font-semibold text-ink">{getMoodEmoji(data.mood)}</span>
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
                        {formatRecommendation(rec)}
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

    </div>
  );
}

/**
 * Circular radial gauge component for diagnostics
 */
function RadialProgress({ value, label, colorClass, trailColorClass, icon }) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (value / 100) * circumference;

  return (
    <div className="flex flex-col items-center p-3 bg-white border border-border/60 rounded-xl shadow-sm hover:scale-[1.01] transition-all duration-200">
      <div className="relative w-16 h-16 flex items-center justify-center">
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="32"
            cy="32"
            r={radius}
            className={`${trailColorClass} stroke-current`}
            strokeWidth="5"
            fill="transparent"
          />
          <circle
            cx="32"
            cy="32"
            r={radius}
            className={`${colorClass} stroke-current transition-all duration-500 ease-out`}
            strokeWidth="5"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
          />
        </svg>
        <div className="absolute flex flex-col items-center justify-center">
          <span className="text-xs font-semibold font-mono text-ink leading-none">{value}%</span>
          <span className="mt-0.5">{icon}</span>
        </div>
      </div>
      <span className="text-[9px] font-mono text-ink-soft uppercase tracking-wider mt-2.5 block font-semibold text-center leading-none">
        {label}
      </span>
    </div>
  );
}
