import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "./AuthContext.jsx";
import client from "../api/client.js";
import i18n from "../i18n.js";

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const { user } = useAuth();
  const [preference, setPreference] = useState(() => {
    // Derive initial preference from localStorage so the toggle button
    // immediately shows the correct language without waiting for /profile GET.
    const cached = localStorage.getItem("ksmart_language");
    if (cached === "ml") return "malayalam";
    if (cached === "en") return "english";
    return "auto";
  });
  const manualOverrideRef = useRef(false);
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
    const controller = new AbortController();

    if (user) {
      // If user manually changed language during session, ignore profile fetches
      if (manualOverrideRef.current) return;

      client.get("/profile", { signal: controller.signal })
        .then(({ data }) => {
          if (manualOverrideRef.current) return;
          const pref = data.preferredLanguage || "auto";
          setPreference(pref);
          const resolved = resolveLanguage(pref);
          setLanguage(resolved);
          localStorage.setItem("ksmart_language", resolved);
        })
        .catch((err) => {
          if (err.name === "CanceledError" || err.name === "AbortError") return;
          if (manualOverrideRef.current) return;
          console.error("Failed to load preferred language from profile API:", err);
          const pref = user.preferredLanguage || "auto";
          setPreference(pref);
          const resolved = resolveLanguage(pref);
          setLanguage(resolved);
          localStorage.setItem("ksmart_language", resolved);
        });
    } else {
      manualOverrideRef.current = false;
      setPreference("auto");
      const resolved = resolveLanguage("auto");
      setLanguage(resolved);
      localStorage.setItem("ksmart_language", resolved);
    }

    return () => {
      controller.abort();
    };
  }, [user, resolveLanguage]);

  // Handle manual preference change
  const changeLanguage = useCallback(async (pref) => {
    const valid = ["auto", "malayalam", "english"];
    if (!valid.includes(pref)) return;

    // Mark manual override active so no GET /profile can ever revert state
    manualOverrideRef.current = true;

    const resolved = resolveLanguage(pref);
    
    // Synchronously/Awaiting change i18n language first
    await i18n.changeLanguage(resolved);

    setPreference(pref);
    setLanguage(resolved);
    localStorage.setItem("ksmart_language", resolved);

    try {
      if (user) {
        // Persist setting to backend via PUT /api/profile
        await client.put("/profile", { preferredLanguage: pref });
      }
    } catch (err) {
      console.error("Failed to persist preferred language:", err);
    }
  }, [user, resolveLanguage]);

  // Single authority effect for async i18n & DOM document synchronization
  useEffect(() => {
    const handleLanguageChanged = (lng) => {
      document.documentElement.lang = lng;
      document.documentElement.setAttribute("data-lang", lng);
      if (lng === "ml") {
        document.documentElement.classList.add("lang-ml");
      } else {
        document.documentElement.classList.remove("lang-ml");
      }
    };

    i18n.changeLanguage(language);
    handleLanguageChanged(language);

    i18n.on("languageChanged", handleLanguageChanged);
    return () => {
      i18n.off("languageChanged", handleLanguageChanged);
    };
  }, [language]);

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
