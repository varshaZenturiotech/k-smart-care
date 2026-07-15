import React, { createContext, useContext, useEffect, useState } from "react";
import { Toaster, toast as hotToast, useToasterStore } from "react-hot-toast";
import { useLanguage } from "./LanguageContext.jsx";
import { CheckCircle2, AlertTriangle, AlertCircle, Info, Loader2, X } from "lucide-react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const { t } = useLanguage();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Limit visible toasts to 3
  const { toasts } = useToasterStore();
  useEffect(() => {
    toasts
      .filter((t) => t.visible)
      .slice(3)
      .forEach((t) => hotToast.dismiss(t.id));
  }, [toasts]);

  // Offline detection
  useEffect(() => {
    const handleOffline = () => {
      hotToast(t("toast.offline", "You are currently offline."), {
        id: "offline-toast",
        customType: "warning",
        duration: Infinity,
      });
    };

    const handleOnline = () => {
      hotToast.dismiss("offline-toast");
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    if (!navigator.onLine) {
      handleOffline();
    }

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [t]);

  const getErrorMessage = (err, fallbackKey = "toast.error.generic") => {
    if (!err) return t(fallbackKey);
    if (typeof err === "string") {
      return err.startsWith("toast.") ? t(err) : err;
    }
    const backendMsg = err.response?.data?.error || err.response?.data?.message || err.message;
    if (backendMsg && typeof backendMsg === "string") {
      return backendMsg.startsWith("toast.") ? t(backendMsg) : backendMsg;
    }
    return t(fallbackKey);
  };

  const showToast = (type, message, options = {}) => {
    const isKey = typeof message === "string" && (message.startsWith("toast.") || message.startsWith("common."));
    const duration = options.duration !== undefined
      ? options.duration
      : (type === "error" ? 7000 : (type === "warning" ? 5000 : 4000));

    return hotToast(isKey ? "" : message, {
      ...options,
      duration,
      customType: type,
      translationKey: isKey ? message : undefined,
      translationOptions: options.translationOptions,
    });
  };

  const toastAPI = {
    success: (msg, opts) => showToast("success", msg, opts),
    error: (err, opts) => {
      const msg = getErrorMessage(err);
      return showToast("error", msg, opts);
    },
    warning: (msg, opts) => showToast("warning", msg, opts),
    info: (msg, opts) => showToast("info", msg, opts),
    loading: (msg, opts) => showToast("loading", msg, opts),
    promise: (promise, msgs = {}, opts = {}) => {
      const loadingIsKey = typeof msgs.loading === "string" && (msgs.loading.startsWith("toast.") || msgs.loading.startsWith("common."));
      const loadingMsg = loadingIsKey ? t(msgs.loading) : (msgs.loading || t("common.loading", "Loading..."));

      const toastId = opts.id || hotToast.loading(loadingIsKey ? "" : loadingMsg, {
        ...opts,
        customType: "loading",
        translationKey: loadingIsKey ? msgs.loading : undefined,
        translationOptions: opts.translationOptions,
      });

      promise
        .then((res) => {
          let successMsg = msgs.success;
          if (typeof successMsg === "function") {
            successMsg = successMsg(res);
          }
          const backendSuccess = res?.data?.message || res?.message;
          const finalSuccessMsg = successMsg || backendSuccess || t("common.success", "Success");

          const isKey = typeof finalSuccessMsg === "string" && (finalSuccessMsg.startsWith("toast.") || finalSuccessMsg.startsWith("common."));

          hotToast.success(isKey ? "" : finalSuccessMsg, {
            id: toastId,
            duration: 4000,
            customType: "success",
            translationKey: isKey ? finalSuccessMsg : undefined,
            translationOptions: opts.translationOptions,
            ...opts,
          });
        })
        .catch((err) => {
          let errorMsg = msgs.error;
          if (typeof errorMsg === "function") {
            errorMsg = errorMsg(err);
          } else {
            errorMsg = getErrorMessage(err, msgs.error || "toast.error.generic");
          }

          const isKey = typeof errorMsg === "string" && (errorMsg.startsWith("toast.") || errorMsg.startsWith("common."));

          hotToast.error(isKey ? "" : errorMsg, {
            id: toastId,
            duration: 7000,
            customType: "error",
            translationKey: isKey ? errorMsg : undefined,
            translationOptions: opts.translationOptions,
            ...opts,
          });
        });

      return promise;
    },
    dismiss: (id) => hotToast.dismiss(id),
  };

  return (
    <ToastContext.Provider value={toastAPI}>
      {children}
      <Toaster
        position={isMobile ? "top-center" : "top-right"}
        containerStyle={{
          top: isMobile ? 16 : 24,
          right: isMobile ? 24 : 24,
          left: isMobile ? 16 : "auto",
          zIndex: 99999,
        }}
      >
        {(toastObj) => {
          const type = toastObj.customType || toastObj.type || "info";

          let borderClass = "border-l-sage";
          let icon = <Info className="text-sage w-5 h-5 shrink-0" />;

          if (type === "success") {
            borderClass = "border-l-teal";
            icon = <CheckCircle2 className="text-teal w-5 h-5 shrink-0" />;
          } else if (type === "error") {
            borderClass = "border-l-alert";
            icon = <AlertCircle className="text-alert w-5 h-5 shrink-0" />;
          } else if (type === "warning") {
            borderClass = "border-l-ochre";
            icon = <AlertTriangle className="text-ochre w-5 h-5 shrink-0" />;
          } else if (type === "loading") {
            borderClass = "border-l-ink-soft";
            icon = <Loader2 className="text-teal w-5 h-5 shrink-0 animate-spin" />;
          }

          // Resolve translation key dynamically to handle reactive language switches
          const displayMessage = toastObj.translationKey
            ? t(toastObj.translationKey, toastObj.translationOptions)
            : toastObj.message;

          return (
            <div
              className={`
                gov-card bg-surface border border-border shadow-custom rounded-xl p-4 max-w-[400px] w-full flex items-start gap-3 text-sm
                border-l-[6px] ${borderClass} text-ink
                transform transition-all duration-300 ease-out
                ${toastObj.visible ? "opacity-100 translate-y-0 scale-100" : "opacity-0 -translate-y-4 scale-95"}
              `}
              style={{
                transitionDuration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "0ms" : "250ms",
              }}
              role="alert"
              aria-live={type === "error" || type === "warning" ? "assertive" : "polite"}
            >
              {icon}
              <div className="flex-1 font-sans leading-relaxed break-words">
                {displayMessage}
              </div>
              {type !== "loading" && (
                <button
                  onClick={() => hotToast.dismiss(toastObj.id)}
                  className="p-0.5 text-ink-soft hover:text-ink hover:bg-paper/40 rounded transition shrink-0 cursor-pointer"
                  aria-label="Dismiss"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          );
        }}
      </Toaster>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
