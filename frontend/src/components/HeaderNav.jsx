import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import {
  ListTodo,
  FileText,
  Shield,
  Search,
  Sun,
  Bell,
  LogOut,
  Menu,
  X,
  User,
  LayoutDashboard
} from "lucide-react";
import LanguageSelector from "./LanguageSelector.jsx";

export default function HeaderNav() {
  const { user, logout } = useAuth();
  const { language, t } = useLanguage();
  console.log("[Component Rerender] HeaderNav | language =", language, "| time =", new Date().toISOString());
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const isActive = (path) => location.pathname === path;

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/repository?q=${encodeURIComponent(searchQuery.trim())}`);
      setMobileMenuOpen(false);
    }
  };

  return (
    <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-border/60 shadow-sm px-3 sm:px-6 lg:px-8 xl:px-10 py-2.5 transition-all duration-300">
      <div className="max-w-[1760px] mx-auto flex items-center justify-between gap-2 sm:gap-4">
        
        {/* Logo & Portal Branding */}
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate("/")}>
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-teal-tint flex items-center justify-center text-teal font-display font-bold text-base sm:text-lg border border-teal/10 shrink-0 shadow-xs">
            G
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-display font-semibold text-sm sm:text-base text-ink tracking-tight truncate">K-SMART CARE</span>
              <span className="hidden xs:inline-block text-[8px] sm:text-[9px] font-mono font-semibold text-ink-soft bg-paper border border-border px-1.5 sm:px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                {t("dashboard.officialPortal", "Official Portal")}
              </span>
            </div>
            <span className="hidden md:block text-[9px] text-ink-soft font-mono uppercase tracking-wider truncate">
              {t("auth.platformSubtitle", "AI Human Capital & Resilience Intelligence Platform")}
            </span>
          </div>
        </div>

        {/* Desktop Search Bar */}
        <form onSubmit={handleSearchSubmit} className="hidden lg:block relative w-56 xl:w-72">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-ink-soft/70 pointer-events-none">
            <Search size={14} />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("dashboard.searchPlaceholder", "Search circulars, files, tasks...")}
            className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-border bg-paper/30 text-xs text-ink placeholder:text-ink-soft/60 focus:outline-none focus:ring-1 focus:ring-teal focus:border-teal font-sans transition-all"
          />
        </form>

        {/* Desktop Controls (xl screens) */}
        <div className="hidden xl:flex items-center gap-2.5">
          <button
            onClick={() => navigate("/")}
            className={`text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all active:scale-95 flex items-center gap-1.5 shrink-0 ${
              isActive("/")
                ? "bg-teal text-white border-teal shadow-xs"
                : "text-teal-dark hover:text-teal bg-teal-tint/50 hover:bg-teal-tint border-teal/10"
            }`}
          >
            <LayoutDashboard size={13} />
            {t("dashboard.title", "Dashboard")}
          </button>
          
          <button
            onClick={() => navigate("/planner")}
            className={`text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all active:scale-95 flex items-center gap-1.5 shrink-0 ${
              isActive("/planner")
                ? "bg-teal text-white border-teal shadow-xs"
                : "text-teal-dark hover:text-teal bg-teal-tint/50 hover:bg-teal-tint border-teal/10"
            }`}
          >
            <ListTodo size={13} />
            {t("taskPlanner.title", "Task Planner")}
          </button>

          <button
            onClick={() => navigate("/repository")}
            className={`text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all active:scale-95 flex items-center gap-1.5 shrink-0 ${
              isActive("/repository")
                ? "bg-teal text-white border-teal shadow-xs"
                : "text-teal-dark hover:text-teal bg-teal-tint/50 hover:bg-teal-tint border-teal/10"
            }`}
          >
            <FileText size={13} />
            {t("circular.title", "Circular Repository")}
          </button>

          {user?.role === "Admin" && (
            <button
              onClick={() => navigate("/admin/circulars")}
              className={`text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all active:scale-95 flex items-center gap-1.5 shrink-0 ${
                isActive("/admin/circulars")
                  ? "bg-amber-800 text-white border-amber-800 shadow-xs"
                  : "text-amber-900 bg-amber-100 hover:bg-amber-200 border-amber-200/60"
              }`}
            >
              <Shield size={13} />
              {t("admin.console", "Admin Console")}
            </button>
          )}

          <LanguageSelector />

          <button className="p-2 rounded-lg text-ink-soft hover:bg-paper/50 transition cursor-pointer" title={t("circular.toggleTheme", "Toggle Theme (Calm Mode)")}>
            <Sun size={17} />
          </button>

          <div className="relative">
            <button className="p-2 rounded-lg text-ink-soft hover:bg-paper/50 transition cursor-pointer">
              <Bell size={17} />
            </button>
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-alert" />
          </div>

          <div className="flex items-center gap-2 border-l border-border pl-3 ml-1">
            <div className="w-8 h-8 rounded-full bg-teal text-white flex items-center justify-center font-semibold text-xs shrink-0 shadow-xs border border-teal-dark/15">
              {user?.name ? user.name.split(" ")[0][0] : "U"}
            </div>
            <div className="text-left min-w-0 max-w-[120px]">
              <p className="text-xs font-semibold text-ink truncate leading-tight">{user?.name}</p>
              <p className="text-[9px] text-ink-soft truncate font-mono uppercase tracking-wider">{user?.designation}</p>
            </div>
            <button
              onClick={logout}
              className="ml-1 bg-white border border-border hover:bg-alert-tint hover:text-alert hover:border-alert/30 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-ink-soft transition flex items-center gap-1 cursor-pointer active:scale-95"
            >
              <LogOut size={13} />
              <span>{t("dashboard.signOut", "Sign Out")}</span>
            </button>
          </div>
        </div>

        {/* Mobile & Tablet Top Control Group (< xl screens) */}
        <div className="flex xl:hidden items-center gap-2">
          <LanguageSelector />
          
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-ink hover:bg-paper border border-border rounded-xl transition flex items-center justify-center min-w-[40px] min-h-[40px]"
            aria-label="Toggle Mobile Menu"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="xl:hidden fixed inset-x-0 top-[57px] bg-white border-b border-border shadow-xl z-50 p-4 animate-slide-up space-y-4 max-h-[calc(100vh-60px)] overflow-y-auto">
          {/* Mobile Search */}
          <form onSubmit={handleSearchSubmit} className="relative w-full">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-ink-soft/70">
              <Search size={14} />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("dashboard.searchPlaceholder", "Search circulars, files, tasks...")}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-border bg-paper/40 text-xs text-ink placeholder:text-ink-soft/60 focus:outline-none focus:ring-1 focus:ring-teal"
            />
          </form>

          {/* Navigation Links */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            <button
              onClick={() => { navigate("/"); setMobileMenuOpen(false); }}
              className={`p-3 rounded-xl border font-semibold text-xs flex items-center gap-2 transition ${
                isActive("/") ? "bg-teal text-white border-teal" : "bg-paper/40 border-border text-ink hover:bg-teal-tint"
              }`}
            >
              <LayoutDashboard size={16} />
              {t("dashboard.title", "Dashboard")}
            </button>

            <button
              onClick={() => { navigate("/planner"); setMobileMenuOpen(false); }}
              className={`p-3 rounded-xl border font-semibold text-xs flex items-center gap-2 transition ${
                isActive("/planner") ? "bg-teal text-white border-teal" : "bg-paper/40 border-border text-ink hover:bg-teal-tint"
              }`}
            >
              <ListTodo size={16} />
              {t("taskPlanner.title", "Task Planner")}
            </button>

            <button
              onClick={() => { navigate("/repository"); setMobileMenuOpen(false); }}
              className={`p-3 rounded-xl border font-semibold text-xs flex items-center gap-2 transition ${
                isActive("/repository") ? "bg-teal text-white border-teal" : "bg-paper/40 border-border text-ink hover:bg-teal-tint"
              }`}
            >
              <FileText size={16} />
              {t("circular.title", "Circular Repository")}
            </button>

            {user?.role === "Admin" && (
              <button
                onClick={() => { navigate("/admin/circulars"); setMobileMenuOpen(false); }}
                className={`p-3 rounded-xl border font-semibold text-xs flex items-center gap-2 transition ${
                  isActive("/admin/circulars") ? "bg-amber-800 text-white border-amber-800" : "bg-amber-50 border-amber-200 text-amber-900 hover:bg-amber-100"
                }`}
              >
                <Shield size={16} />
                {t("admin.console", "Admin Console")}
              </button>
            )}
          </div>

          {/* User Profile & Sign Out Box */}
          <div className="pt-3 border-t border-border flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-full bg-teal text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                {user?.name ? user.name.split(" ")[0][0] : "U"}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-ink truncate leading-tight">{user?.name}</p>
                <p className="text-[10px] text-ink-soft truncate font-mono uppercase tracking-wider">{user?.designation}</p>
              </div>
            </div>

            <button
              onClick={logout}
              className="bg-white border border-border hover:bg-alert-tint hover:text-alert px-3 py-2 rounded-xl text-xs font-semibold text-ink-soft transition flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <LogOut size={14} />
              <span>{t("dashboard.signOut", "Sign Out")}</span>
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
