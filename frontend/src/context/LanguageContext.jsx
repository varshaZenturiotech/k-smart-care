import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext.jsx";
import client from "../api/client.js";
import i18n from "../i18n.js";

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const { user } = useAuth();
  const [preference, setPreference] = useState("auto");
  const [language, setLanguage] = useState(() => {
    // Detect browser language initially or fallback to stored value
    const cached = localStorage.getItem("ksmart_language");
    if (cached) return cached;
    const browserLang = navigator.language || navigator.userLanguage || "";
    const isMl = browserLang.toLowerCase().includes("ml");
    return isMl ? "ml" : "en";
  });

  // Resolve language based on preferredLanguage setting
  const resolveLanguage = useCallback((pref) => {
    if (pref === "malayalam") return "ml";
    if (pref === "english") return "en";
    
    // Auto-detect based on browser language
    const browserLang = navigator.language || navigator.userLanguage || "";
    const isMl = browserLang.toLowerCase().includes("ml");
    return isMl ? "ml" : "en";
  }, []);

  // Sync preference whenever the authenticated user changes
  useEffect(() => {
    if (user) {
      // Load profile preference from backend to ensure alignment
      client.get("/profile")
        .then(({ data }) => {
          const pref = data.preferredLanguage || "auto";
          setPreference(pref);
          const resolved = resolveLanguage(pref);
          setLanguage(resolved);
          localStorage.setItem("ksmart_language", resolved);
        })
        .catch((err) => {
          console.error("Failed to load preferred language from profile API:", err);
          // Fallback to user object property if API fails
          const pref = user.preferredLanguage || "auto";
          setPreference(pref);
          const resolved = resolveLanguage(pref);
          setLanguage(resolved);
          localStorage.setItem("ksmart_language", resolved);
        });
    } else {
      setPreference("auto");
      const resolved = resolveLanguage("auto");
      setLanguage(resolved);
      localStorage.setItem("ksmart_language", resolved);
    }
  }, [user, resolveLanguage]);

  // Sync i18n language setting
  useEffect(() => {
    i18n.changeLanguage(language);
  }, [language]);

  // Handle manual preference change
  const changeLanguage = useCallback(async (pref) => {
    const valid = ["auto", "malayalam", "english"];
    if (!valid.includes(pref)) return;

    try {
      if (user) {
        // Persist setting to backend via PUT /api/profile
        await client.put("/profile", { preferredLanguage: pref });
      }
      setPreference(pref);
      const resolved = resolveLanguage(pref);
      setLanguage(resolved);
      localStorage.setItem("ksmart_language", resolved);
    } catch (err) {
      console.error("Failed to persist preferred language:", err);
      throw err;
    }
  }, [user, resolveLanguage]);

  // Translate helper using i18next
  const t = useCallback((key, defaultVal, options) => {
    if (typeof defaultVal === "object" && !options) {
      return i18n.t(key, defaultVal);
    }
    return i18n.t(key, defaultVal || key, options);
  }, [language]);

  // Date and Time formatting helper according to language guidelines
  const formatDate = useCallback((date, options = {}) => {
    const d = new Date(date);
    if (isNaN(d.getTime())) return "";

    const locale = language === "ml" ? "ml-IN" : "en-US";
    return new Intl.DateTimeFormat(locale, options).format(d);
  }, [language]);

  const formatTime = useCallback((date) => {
    const d = new Date(date);
    if (isNaN(d.getTime())) return "";

    // Keep 12-hour time format with AM/PM
    const locale = language === "ml" ? "ml-IN" : "en-US";
    return new Intl.DateTimeFormat(locale, {
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    }).format(d);
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, preference, changeLanguage, t, formatDate, formatTime }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
