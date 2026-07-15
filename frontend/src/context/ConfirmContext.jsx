import React, { createContext, useContext, useState, useRef, useEffect } from "react";
import { useLanguage } from "./LanguageContext.jsx";
import { X, AlertTriangle } from "lucide-react";

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const { t } = useLanguage();
  const [state, setState] = useState({
    isOpen: false,
    title: "",
    body: "",
    confirmText: "",
    cancelText: "",
    resolve: null,
  });

  const confirm = (options = {}) => {
    return new Promise((resolve) => {
      setState({
        isOpen: true,
        title: options.title || "toast.confirm.genericTitle",
        body: options.body || "",
        confirmText: options.confirmText || "common.delete",
        cancelText: options.cancelText || "common.cancel",
        resolve,
      });
    });
  };

  const handleConfirm = () => {
    if (state.resolve) state.resolve(true);
    setState((prev) => ({ ...prev, isOpen: false, resolve: null }));
  };

  const handleCancel = () => {
    if (state.resolve) state.resolve(false);
    setState((prev) => ({ ...prev, isOpen: false, resolve: null }));
  };

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && state.isOpen) {
        handleCancel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [state.isOpen]);

  const confirmRef = useRef(null);
  const cancelRef = useRef(null);

  // Focus management
  useEffect(() => {
    if (state.isOpen) {
      // Focus cancel button by default to prevent accidental destructive confirm
      cancelRef.current?.focus();
    }
  }, [state.isOpen]);

  // Resolve translations reactively
  const resolveText = (textKey) => {
    if (!textKey) return "";
    if (typeof textKey === "string" && (textKey.startsWith("toast.") || textKey.startsWith("common."))) {
      return t(textKey);
    }
    return textKey;
  };

  const displayTitle = resolveText(state.title);
  const displayBody = resolveText(state.body);
  const displayConfirmText = resolveText(state.confirmText);
  const displayCancelText = resolveText(state.cancelText);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state.isOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm animate-fade-in font-sans"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          aria-describedby="confirm-dialog-body"
        >
          <div className="relative w-full max-w-md bg-surface border border-border rounded-2xl shadow-custom overflow-hidden transition-all duration-300 transform scale-100 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-paper/20">
              <div className="flex items-center gap-2 text-alert">
                <AlertTriangle size={18} />
                <span id="confirm-dialog-title" className="font-display font-medium text-ink text-base">
                  {displayTitle}
                </span>
              </div>
              <button
                onClick={handleCancel}
                className="p-1 text-ink-soft hover:text-ink hover:bg-paper/40 rounded-lg transition cursor-pointer"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6">
              <p id="confirm-dialog-body" className="text-sm text-ink-soft leading-relaxed">
                {displayBody}
              </p>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-paper/20">
              <button
                ref={cancelRef}
                onClick={handleCancel}
                className="px-4 py-2 bg-white hover:bg-paper border border-border text-ink rounded-xl text-xs font-semibold transition cursor-pointer active:scale-95"
              >
                {displayCancelText}
              </button>
              <button
                ref={confirmRef}
                onClick={handleConfirm}
                className="px-4 py-2 bg-alert hover:bg-alert/90 text-white rounded-xl text-xs font-semibold transition cursor-pointer active:scale-95"
              >
                {displayConfirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within a ConfirmProvider");
  return ctx;
}
