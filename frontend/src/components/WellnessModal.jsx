import { useState, useEffect } from "react";
import client from "../api/client.js";
import { X, ArrowLeft, Heart, Moon, Battery, AlertCircle, Briefcase, MessageSquare, Sparkles, CheckCircle2 } from "lucide-react";
import { useLanguage } from "../context/LanguageContext.jsx";

const MOODS = [
  { key: "great", emoji: "😀", label: "Great" },
  { key: "good", emoji: "🙂", label: "Good" },
  { key: "okay", emoji: "😐", label: "Okay" },
  { key: "tired", emoji: "😔", label: "Tired" },
  { key: "overwhelmed", emoji: "😣", label: "Overwhelmed" },
];

const SLEEP_OPTIONS = ["<4", "4-5", "6-7", "8+"];

const ENERGY_OPTIONS = ["Very Low", "Low", "Moderate", "High", "Excellent"];

const STRESS_OPTIONS = ["Very Low", "Low", "Moderate", "High", "Very High"];

const WORKLOAD_OPTIONS = ["Light", "Normal", "Heavy", "Very Heavy"];

import { useWellnessCheckinMutation, useWellnessSkipMutation } from "../hooks/useQueries.jsx";

export default function WellnessModal({ isOpen, onClose, onRefresh, userId, startImmediately = false }) {
  const { t } = useLanguage();
  const [step, setStep] = useState(0); // 0: Invitation screen, 1-6: Questions
  const [error, setError] = useState("");

  const checkinMutation = useWellnessCheckinMutation();
  const skipMutation = useWellnessSkipMutation();
  const submitting = checkinMutation.isPending || skipMutation.isPending;

  // Questionnaire form state
  const [formData, setFormData] = useState({
    mood: "",
    sleepHours: "",
    energy: "",
    stress: "",
    workload: "",
    note: "",
  });

  useEffect(() => {
    if (isOpen) {
      if (startImmediately) {
        setStep(1);
      } else {
        setStep(0);
      }
      setError("");
    }
  }, [isOpen, startImmediately]);

  if (!isOpen) return null;

  const handleNext = () => {
    setStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setStep((prev) => prev - 1);
  };

  const handleSelectOption = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Automatically transition to the next step for button-based answers
    if (step < 5) {
      setTimeout(() => {
        setStep((prev) => prev + 1);
      }, 250);
    }
  };

  const handleSkip = async () => {
    setError("");
    try {
      await skipMutation.mutateAsync();
      // Mark as skipped today in localStorage to avoid popping up again
      localStorage.setItem(`wellness_skip_${userId}`, new Date().toDateString());
      onRefresh?.();
      onClose();
    } catch (err) {
      setError(t("wellness.skipFailed", "Failed to skip check-in. Please try again."));
    }
  };

  const handleRemindLater = () => {
    // Postpone for 2 hours in localStorage
    const delayUntil = Date.now() + 2 * 60 * 60 * 1000;
    localStorage.setItem(`wellness_remind_${userId}`, delayUntil.toString());
    onClose();
  };

  const handleSubmit = async () => {
    setError("");
    try {
      await checkinMutation.mutateAsync(formData);
      onRefresh?.();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || t("wellness.submitFailed", "Failed to submit check-in. Please try again."));
    }
  };

  const currentGreeting = () => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
    let hours = new Date().getHours();
    try {
      const formatter = new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        hour12: false,
        timeZone: tz
      });
      hours = parseInt(formatter.format(new Date()), 10);
    } catch (e) {
      // fallback
    }

    if (hours >= 5 && hours < 12) return t("wellness.greetingMorning", "Good Morning! 🌿");
    if (hours >= 12 && hours < 17) return t("wellness.greetingAfternoon", "Good Afternoon! 🌿");
    if (hours >= 17 && hours < 21) return t("wellness.greetingEvening", "Good Evening! 🌿");
    return t("wellness.greetingNight", "Good Night! 🌿");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm animate-fade-in font-sans">
      <div className="relative w-full max-w-lg bg-surface border border-border rounded-2xl shadow-custom overflow-hidden transition-all duration-300 transform scale-100 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-paper/20">
          <div className="flex items-center gap-2">
            <Heart size={18} className="text-teal" />
            <span className="font-display font-medium text-ink">
              {step === 0 ? t("wellness.modalTitle", "Daily Wellbeing") : t("wellness.stepOf", "Questionnaire · Step {{step}} of {{total}}", { step: step, total: 6 })}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-ink-soft hover:text-ink hover:bg-paper/40 rounded-lg transition cursor-pointer"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="px-6 py-3 bg-alert-tint border-b border-alert/20 text-xs font-semibold text-alert">
            {error}
          </div>
        )}

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* STEP 0: Invitation Screen */}
          {step === 0 && (
            <div className="text-center py-6 space-y-6">
              <div className="w-16 h-16 mx-auto rounded-full bg-sage-tint flex items-center justify-center text-teal-dark border border-sage/20 shadow-sm animate-bounce">
                <Heart size={32} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-display font-medium text-ink">
                  {currentGreeting()}
                </h3>
                <p className="text-sm text-ink-soft leading-relaxed max-w-sm mx-auto">
                  {t("wellness.inviteDesc", "Would you like to complete your Daily Wellness Check? It takes less than one minute and helps personalize your AI recommendations.")}
                </p>
              </div>

              <div className="pt-4 flex flex-col gap-2.5 max-w-xs mx-auto">
                <button
                  onClick={() => setStep(1)}
                  disabled={submitting}
                  className="w-full py-2.5 bg-teal hover:bg-teal-dark text-white rounded-xl text-sm font-semibold transition cursor-pointer active:scale-95 shadow-sm"
                >
                  {t("wellness.startCheckin", "Start Check-in")}
                </button>
                <button
                  onClick={handleRemindLater}
                  disabled={submitting}
                  className="w-full py-2.5 bg-white hover:bg-sage-tint/40 text-teal-dark border border-border hover:border-teal/30 rounded-xl text-sm font-semibold transition cursor-pointer active:scale-95"
                >
                  {t("wellness.remindLater", "Remind Me Later")}
                </button>
                <button
                  onClick={handleSkip}
                  disabled={submitting}
                  className="w-full py-2.5 bg-white hover:bg-alert-tint/30 text-ink-soft hover:text-alert border border-border hover:border-alert/20 rounded-xl text-sm font-semibold transition cursor-pointer active:scale-95"
                >
                  {submitting ? t("wellness.processing", "Processing...") : t("wellness.skipToday", "Skip for Today")}
                </button>
              </div>
            </div>
          )}

          {/* QUESTION Wizard step-by-step */}
          {step > 0 && (
            <div className="space-y-6">
              {/* Progress Bar */}
              <div className="w-full bg-paper h-2 rounded-full overflow-hidden">
                <div
                  className="bg-teal h-full rounded-full transition-all duration-300"
                  style={{ width: `${(step / 6) * 100}%` }}
                />
              </div>

              {/* STEP 1: Mood */}
              {step === 1 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-teal-dark">
                    <Heart size={20} className="shrink-0" />
                    <h4 className="text-base font-semibold">{t("wellness.howFeeling", "How are you feeling today?")}</h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5 pt-2">
                    {MOODS.map((m) => {
                      const isSelected = formData.mood === m.key;
                      return (
                        <button
                          key={m.key}
                          onClick={() => handleSelectOption("mood", m.key)}
                          className={`flex flex-col items-center gap-1.5 p-4 rounded-xl border text-center transition cursor-pointer hover:scale-[1.03] ${
                            isSelected
                              ? "bg-teal-tint border-teal text-teal-dark font-medium shadow-sm"
                              : "bg-white border-border hover:border-teal/40 hover:bg-paper/10 text-ink"
                          }`}
                        >
                          <span className="text-3xl">{m.emoji}</span>
                          <span className="text-xs">{t("wellness." + m.key, m.label)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* STEP 2: Sleep hours */}
              {step === 2 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-teal-dark">
                    <Moon size={20} className="shrink-0" />
                    <h4 className="text-base font-semibold">{t("wellness.howManyHours", "How many hours did you sleep?")}</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    {SLEEP_OPTIONS.map((opt) => {
                      const isSelected = formData.sleepHours === opt;
                      return (
                        <button
                          key={opt}
                          onClick={() => handleSelectOption("sleepHours", opt)}
                          className={`py-3.5 px-4 rounded-xl border text-center font-medium transition cursor-pointer ${
                            isSelected
                              ? "bg-teal-tint border-teal text-teal-dark shadow-sm"
                              : "bg-white border-border hover:border-teal/40 hover:bg-paper/10 text-ink"
                          }`}
                        >
                          {t("wellness.hoursLabel", "{{count}} hours", { count: opt })}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* STEP 3: Energy */}
              {step === 3 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-teal-dark">
                    <Battery size={20} className="shrink-0" />
                    <h4 className="text-base font-semibold">{t("wellness.energyLevel", "Energy Level")}</h4>
                  </div>
                  <div className="flex flex-col gap-2.5 pt-2">
                    {ENERGY_OPTIONS.map((opt) => {
                      const isSelected = formData.energy === opt;
                      return (
                        <button
                          key={opt}
                          onClick={() => handleSelectOption("energy", opt)}
                          className={`py-3 px-4 rounded-xl border text-left font-medium transition cursor-pointer flex justify-between items-center ${
                            isSelected
                              ? "bg-teal-tint border-teal text-teal-dark shadow-sm"
                              : "bg-white border-border hover:border-teal/40 hover:bg-paper/10 text-ink"
                          }`}
                        >
                          <span>{t("wellness." + opt.toLowerCase().replace(" ", ""), opt)}</span>
                          {isSelected && <CheckCircle2 size={16} className="text-teal" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* STEP 4: Stress */}
              {step === 4 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-teal-dark">
                    <AlertCircle size={20} className="shrink-0" />
                    <h4 className="text-base font-semibold">{t("wellness.stressLevel", "Stress Level")}</h4>
                  </div>
                  <div className="flex flex-col gap-2.5 pt-2">
                    {STRESS_OPTIONS.map((opt) => {
                      const isSelected = formData.stress === opt;
                      return (
                        <button
                          key={opt}
                          onClick={() => handleSelectOption("stress", opt)}
                          className={`py-3 px-4 rounded-xl border text-left font-medium transition cursor-pointer flex justify-between items-center ${
                            isSelected
                              ? "bg-teal-tint border-teal text-teal-dark shadow-sm"
                              : "bg-white border-border hover:border-teal/40 hover:bg-paper/10 text-ink"
                          }`}
                        >
                          <span>{t("wellness." + opt.toLowerCase().replace(" ", ""), opt)}</span>
                          {isSelected && <CheckCircle2 size={16} className="text-teal" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* STEP 5: Workload */}
              {step === 5 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-teal-dark">
                    <Briefcase size={20} className="shrink-0" />
                    <h4 className="text-base font-semibold">{t("wellness.todayWorkload", "Today's Workload")}</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    {WORKLOAD_OPTIONS.map((opt) => {
                      const isSelected = formData.workload === opt;
                      return (
                        <button
                          key={opt}
                          onClick={() => handleSelectOption("workload", opt)}
                          className={`py-3.5 px-4 rounded-xl border text-center font-medium transition cursor-pointer ${
                            isSelected
                              ? "bg-teal-tint border-teal text-teal-dark shadow-sm"
                              : "bg-white border-border hover:border-teal/40 hover:bg-paper/10 text-ink"
                          }`}
                        >
                          {t("wellness." + opt.toLowerCase().replace(" ", ""), opt)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* STEP 6: Optional Note */}
              {step === 6 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-teal-dark">
                    <MessageSquare size={20} className="shrink-0" />
                    <h4 className="text-base font-semibold">{t("wellness.optionalNote", "Optional Note")}</h4>
                  </div>
                  <div className="space-y-1.5 pt-2">
                    <label className="text-xs text-ink-soft font-mono uppercase tracking-wider block">
                      {t("wellness.noteLabel", "Anything you'd like to share today?")}
                    </label>
                    <textarea
                      value={formData.note}
                      onChange={(e) => setFormData((prev) => ({ ...prev, note: e.target.value }))}
                      rows={4}
                      placeholder={t("wellness.notePlaceholder", "Share your thoughts, challenges or context...")}
                      className="w-full p-3 rounded-xl border border-border text-sm text-ink placeholder:text-ink-soft/50 focus:outline-none focus:ring-1 focus:ring-teal focus:border-teal font-sans bg-white resize-none"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer controls for steps */}
        {step > 0 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-paper/20">
            <button
              onClick={handleBack}
              className="flex items-center gap-1.5 text-xs font-semibold text-ink-soft hover:text-ink transition cursor-pointer"
            >
              <ArrowLeft size={14} />
              {t("wellness.back", "Back")}
            </button>

            {step < 6 ? (
              <button
                onClick={handleNext}
                className="px-4 py-2 bg-teal hover:bg-teal-dark text-white rounded-xl text-xs font-semibold transition cursor-pointer active:scale-95"
              >
                {t("wellness.nextStep", "Next Step")}
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="px-5 py-2 bg-teal hover:bg-teal-dark text-white rounded-xl text-xs font-semibold transition cursor-pointer active:scale-95 flex items-center gap-1.5"
              >
                {submitting ? (
                  <>
                    <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    {t("wellness.generatingInsights", "Generating AI Insights...")}
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    {t("wellness.completeCheckin", "Complete Check-in")}
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
