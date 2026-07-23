import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import client from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useAssistant } from "../context/AssistantContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { 
  Search, 
  Filter, 
  Calendar, 
  FileText, 
  Sparkles, 
  ExternalLink, 
  MessageSquare, 
  Building, 
  Tag, 
  ArrowLeft,
  X,
  FileCheck,
  ChevronRight,
  Shield,
  Sun,
  Bell,
  LogOut,
  ListTodo
} from "lucide-react";
import HeaderNav from "../components/HeaderNav.jsx";
import LanguageSelector from "../components/LanguageSelector.jsx";

const DEPARTMENTS = [
  "Local Self Government",
  "Health",
  "Revenue",
  "Engineering & PWD",
  "Education",
  "Agriculture",
  "Disaster Management",
  "Finance",
  "General Administration",
];

const CATEGORIES = [
  "Government Order",
  "Circular",
  "Notification",
  "Policy",
  "Training",
  "Tender",
  "Recruitment",
  "Meeting",
];

const PRIORITIES = ["High", "Medium", "Low"];

import { useCirculars } from "../hooks/useQueries.jsx";

export default function CircularRepositoryPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { t, formatDate } = useLanguage();
  const toast = useToast();

  const { data: circulars = [], isLoading: loading } = useCirculars();
  const [selectedCircular, setSelectedCircular] = useState(null);

  // Filters
  const [search, setSearch] = useState("");
  const [selectedDept, setSelectedDept] = useState("All");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedPriority, setSelectedPriority] = useState("All");
  const [issueDateFrom, setIssueDateFrom] = useState("");

  // Set default selected circular once loaded
  useEffect(() => {
    if (circulars.length > 0 && !selectedCircular) {
      setSelectedCircular(circulars[0]);
    }
  }, [circulars, selectedCircular]);

  // Filter logic
  const filteredCirculars = circulars.filter((c) => {
    if (!c) return false;
    const q = (search || "").toLowerCase();

    // Search filter
    const matchesSearch = 
      !q ||
      Boolean(c.title && String(c.title).toLowerCase().includes(q)) ||
      Boolean(c.circularNumber && String(c.circularNumber).toLowerCase().includes(q)) ||
      Boolean(Array.isArray(c.keywords) && c.keywords.some((k) => k && String(k).toLowerCase().includes(q)));

    // Department filter
    const matchesDept = 
      selectedDept === "All" ||
      (Array.isArray(c.departments) && c.departments.includes(selectedDept)) ||
      c.department === selectedDept;

    // Category filter
    const matchesCategory = 
      selectedCategory === "All" || 
      c.category === selectedCategory;

    // Priority filter
    const matchesPriority = 
      selectedPriority === "All" || 
      (c.priority && String(c.priority).toLowerCase() === selectedPriority.toLowerCase());

    // Date filter
    let matchesDate = true;
    if (issueDateFrom) {
      const circDate = new Date(c.issueDate || c.createdAt);
      const filterDate = new Date(issueDateFrom);
      matchesDate = circDate >= filterDate;
    }

    return matchesSearch && matchesDept && matchesCategory && matchesPriority && matchesDate;
  });

  const { triggerAskAI } = useAssistant();

  const handleAskAI = (c) => {
    triggerAskAI(`Explain Circular No. ${c.circularNumber || c.title}`, c._id);
  };

  const getPriorityColor = (p = "") => {
    switch (p.toLowerCase()) {
      case "high":
        return "bg-alert-tint text-alert border-alert/20";
      case "medium":
        return "bg-ochre-tint text-ochre border-ochre/20";
      case "low":
        return "bg-sage-tint text-teal-dark border-teal/20";
      default:
        return "bg-paper text-ink-soft border-border";
    }
  };

  return (
    <div className="min-h-screen bg-paper flex flex-col font-sans">
      {/* ── Sticky Responsive Navigation Header ── */}
      <HeaderNav />

      {/* ── Sub-header bar ── */}
      <div className="bg-paper border-b border-border/80 px-4 sm:px-6 lg:px-8 xl:px-10 py-3.5">
        <div className="max-w-[1760px] mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/")}
              className="p-2 hover:bg-white border border-transparent hover:border-border rounded-xl text-ink-soft hover:text-ink transition-all"
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <h2 className="text-sm font-display font-semibold text-ink leading-tight">{t("circular.title", "Circular Repository")}</h2>
              <p className="text-[12px] text-ink-soft">{t("circular.subHeaderDescription", "Browse, search, and query Kerala Government circulars relevant to your department")}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-border rounded-xl text-xs font-semibold text-ink-soft shadow-sm">
              <FileCheck size={13} className="text-teal" />
              <span className="font-mono text-teal-dark">{circulars.length}</span>
              <span>{t("circular.circulars", "Circulars")}</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-border rounded-xl text-xs font-semibold text-ink-soft shadow-sm">
              <Filter size={13} className="text-ochre" />
              <span className="font-mono text-ochre">{filteredCirculars.length}</span>
              <span>{t("circular.filtered", "Filtered")}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Container ── */}
      <div className="max-w-[1760px] mx-auto w-full px-4 sm:px-6 lg:px-8 xl:px-10 py-6 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Filter Sidebar & List (8 cols) */}
        <div className="lg:col-span-8 space-y-6 flex flex-col h-full">
          {/* Filter Panel Card */}
          <div className="bg-white border border-border rounded-2xl p-6 shadow-custom space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-border">
              <Filter size={16} className="text-teal" />
              <h3 className="text-sm font-semibold text-ink uppercase tracking-wider font-mono">{t("circular.filterRepository", "Filter Repository")}</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
              {/* Search input */}
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-ink-soft/75">
                  <Search size={13} />
                </span>
                <input
                  type="text"
                  placeholder={t("circular.searchTitlePlaceholder", "Search title, No...")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-xl border border-border bg-paper/10 text-ink focus:outline-none focus:ring-1 focus:ring-teal"
                />
              </div>

              {/* Department Selector */}
              <div>
                <select
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs rounded-xl border border-border bg-white text-ink focus:outline-none focus:ring-1 focus:ring-teal"
                >
                  <option value="All">{t("circular.allDepartments", "All Departments")}</option>
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>{t(`departments.${dept}`, dept)}</option>
                  ))}
                </select>
              </div>

              {/* Category Selector */}
              <div>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs rounded-xl border border-border bg-white text-ink focus:outline-none focus:ring-1 focus:ring-teal"
                >
                  <option value="All">{t("circular.allCategories", "All Categories")}</option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{t(`categories.${cat}`, cat)}</option>
                  ))}
                </select>
              </div>

              {/* Priority Selector */}
              <div>
                <select
                  value={selectedPriority}
                  onChange={(e) => setSelectedPriority(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs rounded-xl border border-border bg-white text-ink focus:outline-none focus:ring-1 focus:ring-teal"
                >
                  <option value="All">{t("circular.allPriorities", "All Priorities")}</option>
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {t("circular.prioritySelector", "{{priority}} Priority").replace("{{priority}}", t(`taskPlanner.priority${p}`, p))}
                    </option>
                  ))}
                </select>
              </div>

              {/* Issue Date Filter */}
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-ink-soft/75 pointer-events-none">
                  <Calendar size={13} />
                </span>
                <input
                  type="date"
                  value={issueDateFrom}
                  onChange={(e) => setIssueDateFrom(e.target.value)}
                  className="w-full pl-8 pr-2 py-1.5 text-xs rounded-xl border border-border bg-white text-ink focus:outline-none focus:ring-1 focus:ring-teal"
                  title={t("circular.issuedDate", "Issued")}
                />
              </div>
            </div>
            
            {/* Clear filters shortcut */}
            {(search || selectedDept !== "All" || selectedCategory !== "All" || selectedPriority !== "All" || issueDateFrom) && (
              <div className="flex justify-end pt-1">
                <button
                  onClick={() => {
                    setSearch("");
                    setSelectedDept("All");
                    setSelectedCategory("All");
                    setSelectedPriority("All");
                    setIssueDateFrom("");
                  }}
                  className="text-[10px] font-semibold text-alert hover:underline flex items-center gap-1"
                >
                  <X size={10} /> {t("circular.clearAllFilters", "Clear All Filters")}
                </button>
              </div>
            )}
          </div>

          {/* List Card */}
          <div className="bg-white border border-border rounded-2xl shadow-custom p-6 flex-1 flex flex-col min-h-[450px]">
            <div className="flex items-center justify-between pb-4 border-b border-border mb-4">
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-ink-soft">
                {t("circular.circularDocuments", "Circular Documents")} ({filteredCirculars.length})
              </span>
            </div>

            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <svg className="animate-spin h-6 w-6 text-teal" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
            ) : filteredCirculars.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-12 text-center">
                <FileText size={40} className="text-ink-soft/40 mb-3" />
                <p className="text-sm font-medium text-ink">{t("circular.noMatches", "No circulars match current filters.")}</p>
                <p className="text-xs text-ink-soft mt-1">{t("circular.relaxParams", "Try relaxing search parameters or upload new documents on the dashboard.")}</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto pr-1 space-y-3 max-h-[500px]">
                {filteredCirculars.map((c) => {
                  const isSelected = selectedCircular?._id === c._id;
                  const isReady = c.status === "ingested";
                  const issueDate = c.issueDate ? formatDate(c.issueDate, {
                    month: "short",
                    day: "numeric",
                    year: "numeric"
                  }) : "N/A";

                  return (
                    <div
                      key={c._id}
                      onClick={() => setSelectedCircular(c)}
                      className={`border rounded-2xl p-4 transition-all duration-200 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4
                        ${isSelected 
                          ? "border-teal bg-teal-tint/15 shadow-sm" 
                          : "border-border bg-white hover:border-teal/50 hover:bg-paper/10"
                        }`}
                    >
                      <div className="space-y-2 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-paper border border-border text-ink">
                            {c.circularNumber || t("circular.noNumber", "No Number")}
                          </span>
                          <span className={`text-[10px] font-semibold border px-2 py-0.5 rounded-full ${getPriorityColor(c.priority)}`}>
                            {t("taskPlanner.priority" + (c.priority || "Medium"), c.priority || "Medium")}
                          </span>
                          <span className="text-[10px] font-semibold bg-teal-tint/30 text-teal-dark border border-teal/10 px-2 py-0.5 rounded-full">
                            {t("categories." + (c.category || "Circular"), c.category || "Circular")}
                          </span>
                        </div>
                        
                        <h4 className="text-sm font-semibold text-ink leading-snug truncate">
                          {c.title}
                        </h4>

                        <div className="flex items-center gap-4 text-[11px] text-ink-soft">
                          <span className="flex items-center gap-1">
                            <Building size={11} />
                            {t("departments." + (c.departments?.[0] || c.department || "General"), c.departments?.[0] || c.department || "General")}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar size={11} />
                            {t("circular.issuedDate", "Issued")}: {issueDate}
                          </span>
                        </div>
                      </div>

                      {/* Quick Actions */}
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        {isReady ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAskAI(c);
                            }}
                            className="bg-white hover:bg-teal-tint border border-teal/20 text-teal-dark hover:border-teal/40 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition active:scale-95"
                          >
                            <MessageSquare size={13} />
                            {t("circular.askAi", "Ask AI")}
                          </button>
                        ) : (
                          <span className="text-[10px] uppercase font-mono bg-ochre-tint text-ochre px-2.5 py-1 rounded-full border border-ochre/10">
                            {c.status}
                          </span>
                        )}
                        
                        {c.pdfUrl && (
                          <a
                            href={`${client.defaults.baseURL.replace("/api", "")}${c.pdfUrl}`}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="bg-paper hover:bg-border border border-border text-ink px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition active:scale-95"
                          >
                            <ExternalLink size={13} />
                            {t("circular.viewPdf", "View PDF")}
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Circular Detail / Summary Panel (4 cols) */}
        <div className="lg:col-span-4 h-full">
          {selectedCircular ? (
            <div className="bg-white border border-border rounded-2xl shadow-custom p-6 space-y-6 sticky top-20">
              <div className="flex items-start justify-between pb-4 border-b border-border">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-teal-tint text-teal">
                      <Sparkles size={16} />
                    </div>
                    <h3 className="text-sm font-semibold text-ink uppercase tracking-wider font-mono">{t("circular.documentProfile", "Document Profile")}</h3>
                  </div>
                  <p className="text-[11px] text-ink-soft">{t("circular.metadataSummary", "AI-extracted metadata summary profile.")}</p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Title and Doc No */}
                <div>
                  <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-ink-soft block mb-1">{t("circular.subject", "Subject")}</label>
                  <p className="text-xs font-semibold text-ink leading-relaxed">{selectedCircular.title}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-ink-soft block mb-1">{t("circular.number", "Circular Number")}</label>
                    <p className="text-xs font-mono font-semibold text-teal">{selectedCircular.circularNumber || t("circular.noNumber", "No Number")}</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-ink-soft block mb-1">{t("taskPlanner.priorityLabel", "Priority")}</label>
                    <span className={`inline-block text-[10px] font-bold border px-2 py-0.5 rounded-full ${getPriorityColor(selectedCircular.priority)}`}>
                      {t("taskPlanner.priority" + (selectedCircular.priority || "Medium"), selectedCircular.priority || "Medium")}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-ink-soft block mb-1">{t("circular.category", "Category")}</label>
                    <p className="text-xs font-semibold text-ink">{t("categories." + (selectedCircular.category || "Circular"), selectedCircular.category || "Circular")}</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-ink-soft block mb-1">{t("circular.releaseDate", "Issue Date")}</label>
                    <p className="text-xs font-semibold text-ink">
                      {selectedCircular.issueDate ? formatDate(selectedCircular.issueDate) : "N/A"}
                    </p>
                  </div>
                </div>

                {/* Targeted Departments */}
                <div>
                  <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-ink-soft block mb-1">{t("circular.targetDepartments", "Target Departments")}</label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedCircular.departments?.map((dept, idx) => (
                      <span key={`${dept}-${idx}`} className="text-[10px] bg-paper border border-border text-ink-soft px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Building size={9} />
                        {t("departments." + dept, dept)}
                      </span>
                    )) || <p className="text-xs text-ink-soft italic">{t("circular.noTargeting", "No targeting specified")}</p>}
                  </div>
                </div>

                {/* AI Summary */}
                <div>
                  <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-ink-soft block mb-1">{t("circular.aiIngestionSummary", "AI Ingestion Summary")}</label>
                  <div className="bg-paper/40 border-l-2 border-teal rounded-r-xl p-3 text-xs text-ink-soft leading-relaxed max-h-[180px] overflow-y-auto">
                    {selectedCircular.summary || <p className="italic text-center text-ink-soft/60">{t("circular.noAiSummary", "No AI Summary available yet.")}</p>}
                  </div>
                </div>

                {/* Keywords */}
                {selectedCircular.keywords && selectedCircular.keywords.length > 0 && (
                  <div>
                    <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-ink-soft block mb-1">{t("circular.extractedKeywords", "Extracted Keywords")}</label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedCircular.keywords.map((k, idx) => (
                        <span key={`${k}-${idx}`} className="text-[9px] font-mono bg-teal-tint/10 text-teal border border-teal/10 px-1.5 py-0.5 rounded">
                          #{k}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Panel Actions */}
                <div className="pt-4 border-t border-border/60 flex items-center gap-2">
                  {selectedCircular.status === "ingested" && (
                    <button
                      onClick={() => handleAskAI(selectedCircular)}
                      className="flex-1 bg-teal hover:bg-teal-dark text-white py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-sm active:scale-95"
                    >
                      <MessageSquare size={13} />
                      {t("circular.consultAssistant", "Consult Assistant")}
                    </button>
                  )}
                  {selectedCircular.pdfUrl && (
                    <a
                      href={`${client.defaults.baseURL.replace("/api", "")}${selectedCircular.pdfUrl}`}
                      target="_blank"
                      rel="noreferrer"
                      className="bg-paper border border-border hover:bg-border text-ink px-4 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                    >
                      <ExternalLink size={13} />
                      {t("circular.pdfUrl", "PDF URL")}
                    </a>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-border rounded-2xl shadow-custom p-6 text-center py-16 text-ink-soft/60 font-sans italic text-xs">
              {t("circular.selectToInspect", "Select a circular document to inspect its profile and AI insights.")}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
