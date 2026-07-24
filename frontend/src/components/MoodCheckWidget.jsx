import { useState } from "react";
import client from "../api/client.js";
import { Heart, Sparkles, CheckCircle2, Loader2 } from "lucide-react";
import { useLanguage } from "../context/LanguageContext.jsx";

const MOODS = [
  { key: "great", emoji: "😀", label: "Great" },
  { key: "good", emoji: "🙂", label: "Good" },
  { key: "okay", emoji: "😐", label: "Okay" },
  { key: "tired", emoji: "😔", label: "Tired" },
  { key: "overwhelmed", emoji: "😣", label: "Overwhelmed" },
];

export default function MoodCheckWidget({ checkedInToday, todaysMood, onCheckedIn }) {
  const [submitting, setSubmitting] = useState(false);
  const [recommendations, setRecommendations] = useState(null);
  const [selected, setSelected] = useState(todaysMood);
  const { language, t } = useLanguage();
  console.log("[Component Rerender] MoodCheckWidget | language =", language, "| time =", new Date().toISOString());

  async function handleSelect(moodKey) {
    if (checkedInToday || submitting) return;
    setSelected(moodKey);
    setSubmitting(true);
    try {
      const { data } = await client.post("/dashboard/mood-check", { mood: moodKey });
      setRecommendations(data.recommendations);
      onCheckedIn?.(moodKey);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-white border border-border rounded-2xl shadow-custom p-6 transition-all duration-300 hover:shadow-custom-sm hover:-translate-y-0.5">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-1.5 rounded-lg bg-sage-tint text-sage">
          <Heart size={18} />
        </div>
        <h2 className="text-base font-display font-medium text-ink">
          {t("dashboard.moodCheck", "How are you feeling today?")}
        </h2>
        {checkedInToday && (
          <span className="ml-auto text-xs font-mono font-semibold bg-sage-tint text-teal-dark border border-sage/20 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
            <CheckCircle2 size={12} />
            {t("wellness.checkedIn", "Checked In")}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {MOODS.map((m) => {
          const isSelected = selected === m.key;
          const isDisabled = checkedInToday || submitting;
          return (
            <button
              key={m.key}
              onClick={() => handleSelect(m.key)}
              disabled={isDisabled}
              className={`
                flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl border transition-all flex-1 text-center font-sans
                ${isSelected
                  ? "border-teal bg-teal-tint text-teal-dark"
                  : "border-border bg-white hover:border-teal hover:bg-paper/10 text-ink"
                }
                ${isDisabled && !isSelected ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                ${isDisabled && isSelected ? "cursor-default" : ""}
              `}
            >
              <span className="text-2xl">{m.emoji}</span>
              <span className="text-[10px] font-mono uppercase tracking-wider text-ink-soft">{t(`wellness.${m.key}`, m.label)}</span>
              {isSelected && submitting && <Loader2 size={12} className="animate-spin text-teal mt-0.5" />}
            </button>
          );
        })}
      </div>

      {checkedInToday && !recommendations && (
        <p className="text-xs text-ink-soft mt-3 flex items-center gap-1.5 font-sans">
          <span className="text-teal font-bold">✓</span> {t("wellness.moodCompleted", "Mood check completed for today.")}
        </p>
      )}

      {recommendations && (
        <div className="mt-4 bg-sage-tint/40 border border-sage/10 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-teal-dark font-semibold">
            <Sparkles size={14} className="text-teal" />
            {t("wellness.aiRecommendations", "AI Wellness Recommendations")}
          </div>
          <ul className="mt-2 space-y-1.5">
            {recommendations.map((r, i) => (
              <li key={i} className="text-xs text-ink font-sans flex items-start gap-1.5 leading-relaxed">
                <span className="text-teal shrink-0 mt-1">•</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}