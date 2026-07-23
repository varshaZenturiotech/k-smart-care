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
import HeaderNav from "../components/HeaderNav.jsx";
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

      {/* ── Sticky Responsive Navigation Header ── */}
      <HeaderNav />

      {/* ── Homepage Hero Section ── */}
      <Hero>
        <div className="max-w-[1760px] w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 pb-6 md:pb-8 lg:pb-6 xl:pb-8 lg:pt-6 xl:pt-8 lg:h-full lg:flex lg:flex-col lg:justify-between lg:gap-6">
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
            todayTasksCount={summary.todayTasks?.length || 0}
            upcomingMeetingsCount={summary.upcomingMeetings?.length || 0}
          />

          {/* ── Today's Work Snapshot / Priority / Motivation — desktop only,
                sits in the lower part of the hero where the old bottom-anchored
                greeting/wellness row used to be ── */}
          <div className="hidden lg:block">
            <TodayOverviewCards
              briefing={summary.briefing}
              newCircularsCount={summary.newCircularsCount}
              pendingTasksCount={(summary.todayTasks?.length || 0) + (summary.overdueTasks?.length || 0)}
              totalTasksCount={(summary.todayTasks?.length || 0) + (summary.overdueTasks?.length || 0) + (summary.completedToday?.length || 0)}
              todayMeetingsCount={summary.upcomingMeetings?.length || 0}
              completedTasks={summary.completedToday}
            />
          </div>
        </div>
      </Hero>

      {/* ── Main Layout ── */}
      <main className="flex-1 max-w-[1760px] w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-6 space-y-6">

        {/* ── Today's Work Snapshot / Priority / Motivation — mobile only,
              since on desktop this now lives inside the hero itself ── */}
        <div className="lg:hidden">
          <TodayOverviewCards
            briefing={summary.briefing}
            newCircularsCount={summary.newCircularsCount}
            pendingTasksCount={(summary.todayTasks?.length || 0) + (summary.overdueTasks?.length || 0)}
            totalTasksCount={(summary.todayTasks?.length || 0) + (summary.overdueTasks?.length || 0) + (summary.completedToday?.length || 0)}
            todayMeetingsCount={summary.upcomingMeetings?.length || 0}
            completedTasks={summary.completedToday}
          />
        </div>

        {/* ── Main content ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <DepartmentFeedWidget />
          
          <TaskPlannerWidget
            todayTasks={summary.todayTasks}
            completedToday={summary.completedToday}
            todayMeetings={summary.todayMeetings}
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