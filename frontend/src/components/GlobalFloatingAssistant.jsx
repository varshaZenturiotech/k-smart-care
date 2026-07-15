import { useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { useAssistant } from "../context/AssistantContext.jsx";
import AssistantWidget from "./AssistantWidget.jsx";
import { MessageSquare, Sparkles } from "lucide-react";

export default function GlobalFloatingAssistant() {
  const { user } = useAuth();
  const { 
    isOpen, 
    isMinimized, 
    closeAssistant, 
    restoreAssistant, 
    hasNewAlerts,
    setHasNewAlerts
  } = useAssistant();

  const containerRef = useRef(null);

  // Close assistant on ESC key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        closeAssistant();
      }
    };
    if (isOpen && !isMinimized) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isMinimized, closeAssistant]);

  // Click outside to minimize on mobile or general click management
  useEffect(() => {
    const handleClickOutside = (e) => {
      // If click is outside container and assistant is open/not minimized, we do nothing for now
      // since the user might click "Ask AI" buttons elsewhere.
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, isMinimized]);

  // If user is not logged in, do not render the floating assistant
  if (!user) return null;

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-4 font-sans select-none sm:select-text">
      
      {/* ── 1. CHAT PANEL WINDOW ── */}
      <div 
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label="K-SMART CARE AI Companion Chat Panel"
        className={`fixed z-[9999] transition-all duration-300 ease-in-out origin-bottom-right
          /* Positions & Mobile Fullscreen styles */
          bottom-0 right-0 w-full h-full
          sm:bottom-24 sm:right-6 sm:w-[90vw] sm:max-w-[550px] sm:h-[580px] sm:max-h-[calc(100vh-130px)]
          /* Borders & Shadows */
          bg-white sm:rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col
          /* Animations & Visibility State */
          ${(isOpen && !isMinimized) 
            ? "opacity-100 translate-y-0 scale-100 pointer-events-auto" 
            : "opacity-0 translate-y-12 scale-90 pointer-events-none"}`}
      >
        <AssistantWidget />
      </div>

      {/* ── 2. COMPACT FLOATING TOGGLE BUTTON ── */}
      <button
        onClick={() => {
          if (isOpen && !isMinimized) {
            closeAssistant();
          } else {
            restoreAssistant();
            setHasNewAlerts(false); // clear pulse notification on open
          }
        }}
        aria-label="Toggle K-SMART CARE AI Assistant"
        className="group relative flex items-center justify-center w-14 h-14 rounded-full bg-teal text-white shadow-lg hover:bg-teal-dark transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer z-[9999]"
      >
        <div className="relative">
          <MessageSquare size={22} className="text-white" />
        </div>

        {/* Subtle, non-distracting pulse indicator (future ready) */}
        {/* {hasNewAlerts && (
          <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-alert opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-alert"></span>
          </span>
        )} */}
        
        {/* Government UI Tooltip */}
        <span className="absolute right-16 top-1/2 -translate-y-1/2 bg-ink text-white text-[11px] font-medium px-2.5 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap shadow-md border border-border/10">
          Ask K-SMART CARE AI
        </span>
      </button>

    </div>
  );
}
