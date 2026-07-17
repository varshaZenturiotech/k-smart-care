import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import client from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import GreetingBanner, { TodayOverviewCards } from "../components/GreetingBanner.jsx";
import Hero from "../components/Hero.jsx";
import i18n from "../i18n.js";
import TaskPlannerWidget from "../components/TaskPlannerWidget.jsx";
import WellnessModal from "../components/WellnessModal.jsx";
import { useAssistant } from "../context/AssistantContext.jsx";
import DepartmentFeedWidget from "../components/DepartmentFeedWidget.jsx";
import LanguageSelector from "../components/LanguageSelector.jsx";
import {
  Search,
  Sun,
  Bell,
  LogOut,
  ListTodo,
  FileText,
  Shield,
  Sparkles
} from "lucide-react";

import { useDashboard } from "../hooks/useQueries.jsx";

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const { language, t } = useLanguage();
  const toast = useToast();
  const navigate = useNavigate();

  const { data: summary, error: queryError, refetch } = useDashboard();
  const error = queryError ? t("dashboard.errorLoad", "Could not load your dashboard. Please try again.") : "";

  const [isWellnessModalOpen, setIsWellnessModalOpen] = useState(false);
  const [startWellnessImmediately, setStartWellnessImmediately] = useState(false);


  // Check login experience wellness popup once summary is loaded
  useEffect(() => {
    if (summary && summary.mood && user) {
      const { checkedInToday, skippedToday } = summary.mood;
      if (!checkedInToday && !skippedToday) {
        const remindUntil = localStorage.getItem(`wellness_remind_${user.id}`);
        if (!remindUntil || Date.now() > parseInt(remindUntil, 10)) {
          // Open the wellness check greeting
          setIsWellnessModalOpen(true);
          setStartWellnessImmediately(false);
        }
      }
    }
  }, [summary, user]);

  if (error) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center p-6 font-sans">
        <div className="w-full max-w-md bg-white border border-border rounded-2xl shadow-custom p-8 text-center space-y-6">
          <p className="text-base font-semibold text-alert">{error}</p>
          <p className="text-xs text-ink-soft">
            {t("dashboard.sessionReset", "This can happen if the database was reset or your session expired.")}
          </p>
          <button
            onClick={logout}
            className="w-full py-2.5 rounded-xl bg-teal hover:bg-teal-dark text-white font-semibold text-sm transition-all"
          >
            {t("dashboard.signOutReset", "Sign out & Reset Session")}
          </button>
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center font-sans">
        <div className="flex items-center gap-3 text-ink-soft">
          <svg className="animate-spin h-5 w-5 text-teal" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-sm font-semibold">{t("dashboard.loading", "Loading K-SMART CARE Portal...")}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper flex flex-col font-sans">

      {/* ── Sticky Top Navigation ── */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-border/40 shadow-sm px-4 sm:px-6 lg:px-8 xl:px-10 py-3 transition-all duration-300">
        <div className="max-w-[1760px] mx-auto flex items-center justify-between gap-4">

          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-teal-tint flex items-center justify-center text-teal font-display font-bold text-lg border border-teal/10 shrink-0">
              G
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-display font-medium text-base text-ink tracking-tight">K-SMART CARE</span>
                <span className="text-[9px] font-mono font-semibold text-ink-soft bg-paper border border-border px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">{t("dashboard.officialPortal", "Official Portal")}</span>
              </div>
              <span className="hidden sm:block text-[9px] text-ink-soft font-mono uppercase tracking-wider">
                {t("auth.platformSubtitle", "AI Human Capital & Circular Intelligence Platform")}
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
              placeholder={t("dashboard.searchPlaceholder", "Search circulars, files, tasks...")}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-border bg-paper/20 text-xs text-ink placeholder:text-ink-soft/60 focus:outline-none focus:ring-1 focus:ring-teal focus:border-teal font-sans"
            />
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/planner")}
              className="text-xs font-semibold text-teal-dark hover:text-teal bg-teal-tint px-3 py-1.5 rounded-xl border border-teal/10 hover:border-teal/20 transition-all active:scale-95 flex items-center gap-1.5 shrink-0"
            >
              <ListTodo size={13} />
              {t("taskPlanner.title", "Task Planner")}
            </button>
            <button
              onClick={() => navigate("/repository")}
              className="text-xs font-semibold text-teal-dark hover:text-teal bg-teal-tint px-3 py-1.5 rounded-xl border border-teal/10 hover:border-teal/20 transition-all active:scale-95 flex items-center gap-1.5 shrink-0"
            >
              <FileText size={13} />
              {t("circular.title", "Circular Repository")}
            </button>
            {user?.role === "Admin" && (
              <button
                onClick={() => navigate("/admin/circulars")}
                className="text-xs font-semibold text-amber-900 hover:text-amber-800 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-xl border border-amber-200/50 transition-all active:scale-95 flex items-center gap-1.5 shrink-0"
              >
                <Shield size={13} />
                {t("admin.title", "Admin Portal")}
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
                {user.name.split(" ")[0][0]}
              </div>
              <div className="hidden lg:block text-left min-w-0">
                <p className="text-xs font-semibold text-ink truncate leading-tight">{user.name}</p>
                <p className="text-[9px] text-ink-soft truncate font-mono uppercase tracking-wider">{user.designation}</p>
              </div>
              <button
                onClick={logout}
                className="ml-2 bg-white border border-border hover:bg-alert-tint hover:text-alert hover:border-alert/30 px-3 py-1.5 rounded-xl text-xs font-semibold text-ink-soft transition flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <LogOut size={13} />
                <span className="hidden sm:inline">{t("dashboard.signOut", "Sign Out")}</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* ── Homepage Hero Section ── */}
      <Hero>
        <div className="max-w-[1760px] w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 pb-6 md:pb-8">
          {/* ── Greeting Hero Banner ── */}
          <GreetingBanner
            greeting={summary.greeting}
            wellnessScore={summary.wellnessScore}
            focusScore={summary.focusScore}
            user={user}
            moodData={summary.mood}
            onOpenCheckin={() => {
              setStartWellnessImmediately(true);
              setIsWellnessModalOpen(true);
            }}
            briefing={summary.briefing}
          />
        </div>
      </Hero>

      {/* ── Main Layout ── */}
      <main className="flex-1 max-w-[1760px] w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-6 space-y-6">

        {/* ── Today's Work Snapshot / Priority / Motivation ── */}
        <TodayOverviewCards
          briefing={summary.briefing}
          newCircularsCount={summary.newCircularsCount}
          pendingFilesCount={summary.todayTasks?.length || 0}
          todayMeetingsCount={summary.upcomingMeetings?.length || 0}
        />

        {/* ── Main content ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <DepartmentFeedWidget />
          
          <TaskPlannerWidget
            todayTasks={summary.todayTasks}
            completedToday={summary.completedToday}
            upcomingMeetings={summary.upcomingMeetings}
            overdueTasks={summary.overdueTasks}
            onRefresh={refetch}
          />
        </div>

      </main>

      <WellnessModal
        isOpen={isWellnessModalOpen}
        onClose={() => setIsWellnessModalOpen(false)}
        onRefresh={refetch}
        userId={user?.id}
        startImmediately={startWellnessImmediately}
      />
    </div>
  );
}