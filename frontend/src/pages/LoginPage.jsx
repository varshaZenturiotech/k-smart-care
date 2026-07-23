import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { Building2, ShieldCheck, Mail, Lock, LogIn, Award } from "lucide-react";

export default function LoginPage() {
  const { user, login } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [email, setEmail] = useState("anjali.secretary@lsgd.kerala.gov.in");
  const [password, setPassword] = useState("Demo@1234");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) {
      navigate("/", { replace: true });
    }
  }, [user, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email || !password) {
      setError(t("auth.enterBoth", "Please enter both email and password."));
      return;
    }
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/", { replace: true });
    } catch (err) {
      console.error("Login failed:", err);
      setError(
        err.response?.data?.error || t("auth.invalidCredentials", "Invalid credentials. Please try again.")
      );
    } finally {
      setLoading(false);
    }
  }

  const handleUseDemo = () => {
    setEmail("anjali.secretary@lsgd.kerala.gov.in");
    setPassword("Demo@1234");
    setError("");
  };

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md bg-white border border-border rounded-2xl shadow-custom p-8 md:p-10 relative overflow-hidden">
        {/* Subtle top decoration */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-teal" />
        
        {/* Header Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-teal-tint text-teal mb-4">
            {/* Government style symbol / emblem placeholder */}
            <Building2 size={32} />
          </div>
          <span className="block text-xs font-mono text-ink-soft tracking-widest uppercase mb-1">
            {t("auth.lsgd", "Local Self Government Department")}
          </span>
          <span className="block text-xs font-mono text-ink-soft font-semibold tracking-wider uppercase mb-2">
            {t("auth.keralaGov", "Government of Kerala")}
          </span>
          <h1 className="text-3xl font-display font-medium text-ink tracking-tight mt-1">
            K-SMART CARE
          </h1>
          <p className="text-sm text-ink-soft mt-1.5 font-sans">
            {t("auth.platformSubtitle", "AI Human Capital & Resilience Intelligence Platform")}
          </p>
        </div>

        {/* Form Section */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-alert-tint border border-alert text-alert text-sm px-4 py-3 rounded-lg flex items-center gap-2 animate-fadeIn">
              <span className="font-semibold">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-semibold text-ink uppercase tracking-wider block" htmlFor="email">
              {t("auth.officialEmail", "Official Email ID")}
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-ink-soft">
                <Mail size={16} />
              </span>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="anjali.secretary@lsgd.kerala.gov.in"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-border bg-white text-ink text-sm transition-all focus:outline-none focus:ring-2 focus:ring-teal focus:border-teal font-sans"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-ink uppercase tracking-wider block" htmlFor="password">
              {t("auth.password", "Password")}
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-ink-soft">
                <Lock size={16} />
              </span>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-border bg-white text-ink text-sm transition-all focus:outline-none focus:ring-2 focus:ring-teal focus:border-teal font-sans"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3.5 rounded-xl text-white font-semibold text-sm shadow-sm transition-all flex items-center justify-center gap-2
              ${loading 
                ? "bg-teal-dark cursor-not-allowed opacity-80" 
                : "bg-teal hover:bg-teal-dark cursor-pointer active:scale-[0.99]"
              }`}
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                {t("auth.verifying", "Verifying Credentials...")}
              </>
            ) : (
              <>
                <LogIn size={18} />
                {t("auth.signInPlatform", "Sign In to Platform")}
              </>
            )}
          </button>
        </form>

        {/* Divider & Demo Details */}
        <div className="mt-8 pt-6 border-t border-dashed border-border text-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-ochre-tint text-ochre rounded-full text-xs font-semibold mb-3">
            <ShieldCheck size={14} />
            {t("auth.securePortal", "Secure Portal Environment")}
          </div>
          <p className="text-xs font-semibold text-ink mb-1">{t("auth.demoCredentials", "Demonstration Credentials")}</p>
          <div className="bg-paper p-3 rounded-xl text-left border border-border mb-4 font-mono text-[11px] text-ink-soft space-y-1">
            <div><span className="font-semibold text-ink">{t("auth.userId", "User ID")}:</span> anjali.secretary@lsgd.kerala.gov.in</div>
            <div><span className="font-semibold text-ink">{t("auth.passphrase", "Passphrase")}:</span> Demo@1234</div>
          </div>
          <button
            type="button"
            onClick={handleUseDemo}
            className="text-xs font-semibold text-teal hover:text-teal-dark hover:underline focus:outline-none transition animate-pulse duration-1000"
          >
            {t("auth.resetDemo", "Reset to Demo Credentials")}
          </button>
        </div>
      </div>
    </div>
  );
}
