import { useState } from "react";
import { Languages } from "lucide-react";
import { useLanguage } from "../context/LanguageContext.jsx";

const LANGUAGES = [
  { value: "auto", label: "Auto" },
  { value: "english", label: "English" },
  { value: "malayalam", label: "മലയാളം" },
];

export default function LanguageSelector() {
  const { preference, changeLanguage } = useLanguage();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const current = LANGUAGES.find((l) => l.value === preference) || LANGUAGES[0];

  const handleSelect = async (lang) => {
    if (lang === current.value) { setOpen(false); return; }
    setSaving(true);
    try {
      await changeLanguage(lang);
    } finally {
      setSaving(false);
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title="Language Preference"
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer active:scale-95 ${
          open
            ? "bg-teal-tint text-teal border-teal/20"
            : "bg-white text-ink-soft border-border hover:bg-paper/50 hover:text-ink"
        }`}
      >
        <Languages size={13} />
        <span className="hidden sm:inline">{current.flag} {current.label}</span>
        <span className="sm:hidden">{current.flag}</span>
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-1.5 z-50 bg-white border border-border rounded-xl shadow-custom overflow-hidden w-36 font-sans">
            <div className="px-3 py-2 border-b border-border/50">
              <p className="text-[9px] font-mono uppercase tracking-wider text-ink-soft">Language</p>
            </div>
            {LANGUAGES.map((lang) => (
              <button
                key={lang.value}
                disabled={saving}
                onClick={() => handleSelect(lang.value)}
                className={`w-full text-left flex items-center gap-2 px-3 py-2 text-xs transition-colors cursor-pointer ${
                  current.value === lang.value
                    ? "bg-teal-tint text-teal font-semibold"
                    : "text-ink hover:bg-paper/60"
                }`}
              >
                <span>{lang.label}</span>
                {current.value === lang.value && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-teal" />
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
