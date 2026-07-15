import React, { createContext, useContext, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import i18n from "../i18n.js";

const LanguageRefreshContext = createContext(null);

export function LanguageRefreshProvider({ children }) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleLanguageChange = () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["wellness"] });
      queryClient.invalidateQueries({ queryKey: ["dailyBriefing"] });
      queryClient.invalidateQueries({ queryKey: ["motivation"] });
      queryClient.invalidateQueries({ queryKey: ["assistant"] });
      queryClient.invalidateQueries({ queryKey: ["suggestedPrompts"] });
      queryClient.invalidateQueries({ queryKey: ["circularSummary"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
    };
    i18n.on("languageChanged", handleLanguageChange);
    return () => i18n.off("languageChanged", handleLanguageChange);
  }, [queryClient]);

  const refreshDashboard = () => {
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["dailyBriefing"] });
  };

  const refreshWellness = () => {
    queryClient.invalidateQueries({ queryKey: ["wellness"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["dailyBriefing"] });
    queryClient.invalidateQueries({ queryKey: ["motivation"] });
  };

  const refreshCirculars = () => {
    queryClient.invalidateQueries({ queryKey: ["circulars"] });
    queryClient.invalidateQueries({ queryKey: ["assistant"] });
    queryClient.invalidateQueries({ queryKey: ["suggestedPrompts"] });
  };

  const refreshTasks = () => {
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["dailyBriefing"] });
  };

  const refreshMeetings = () => {
    queryClient.invalidateQueries({ queryKey: ["meetings"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["dailyBriefing"] });
  };

  return (
    <LanguageRefreshContext.Provider
      value={{
        refreshDashboard,
        refreshWellness,
        refreshCirculars,
        refreshTasks,
        refreshMeetings,
      }}
    >
      {children}
    </LanguageRefreshContext.Provider>
  );
}

export function useLanguageRefresh() {
  const context = useContext(LanguageRefreshContext);
  if (!context) {
    throw new Error("useLanguageRefresh must be used within LanguageRefreshProvider");
  }
  return context;
}
