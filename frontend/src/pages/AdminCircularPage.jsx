import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import client from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { useConfirm } from "../context/ConfirmContext.jsx";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useCirculars, 
  useUploadCircularMutation, 
  useDeleteCircularMutation, 
  useReprocessCircularMutation, 
  useEditCircularMetadataMutation 
} from "../hooks/useQueries.jsx";
import {
  FileText,
  Loader2,
  Plus,
  X,
  Search,
  Shield,
  Upload,
  RefreshCw,
  Edit,
  Trash,
  Eye,
  CheckCircle,
  AlertTriangle,
  ArrowLeft,
  Download,
  Building,
  Calendar,
  Layers,
  FileCheck,
  Sun,
  Bell,
  ListTodo,
  LogOut
} from "lucide-react";

const DEPARTMENTS = [
  "Local Self Government",
  "Health",
  "Revenue",
  "Finance",
  "Engineering",
  "Planning",
  "Agriculture",
  "Education",
  "IT",
  "Administration",
  "Sanitation"
];

const CATEGORIES = [
  "Government Order",
  "Circular",
  "Notification",
  "Policy",
  "Meeting",
  "Tender",
  "Training",
  "Recruitment"
];

const PRIORITIES = ["High", "Medium", "Low"];

export default function AdminCircularPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();

  const { data: circulars = [], isLoading: loading } = useCirculars();

  const uploadCircularMutation = useUploadCircularMutation();
  const deleteCircularMutation = useDeleteCircularMutation();
  const reprocessCircularMutation = useReprocessCircularMutation();
  const editCircularMetadataMutation = useEditCircularMetadataMutation();

  // Search/Filters
  const [searchQuery, setSearchQuery] = useState("");
  
  // Modals
  const [viewingCircular, setViewingCircular] = useState(null);
  const [editingCircular, setEditingCircular] = useState(null);

  // Form inputs
  const [uploadFiles, setUploadFiles] = useState([]);
  const [circularNumber, setCircularNumber] = useState("");
  const [title, setTitle] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [selectedDepts, setSelectedDepts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedPriority, setSelectedPriority] = useState("");
  const [remarks, setRemarks] = useState("");
  
  // Upload and processing states
  const [uploading, setUploading] = useState(false);
  const [activeTrackingIds, setActiveTrackingIds] = useState([]);
  const fileInputRef = useRef(null);

  // Track processing circulars from loaded list
  useEffect(() => {
    if (circulars.length > 0) {
      const processingIds = circulars
        .filter(c => c.status !== "ingested" && c.status !== "failed")
        .map(c => c._id);
      if (processingIds.length > 0) {
        setActiveTrackingIds(prev => [...new Set([...prev, ...processingIds])]);
      }
    }
  }, [circulars]);

  // Poll status for active circulars that are processing
  useEffect(() => {
    if (activeTrackingIds.length === 0) return;

    const interval = setInterval(async () => {
      let stillTracking = [...activeTrackingIds];
      
      for (const id of activeTrackingIds) {
        try {
          const { data } = await client.get(`/circulars/${id}`);
          
          // Invalidate cache to trigger refetch
          queryClient.invalidateQueries({ queryKey: ["circulars"] });

          // If finished (ingested or failed), remove from tracking
          if (data.status === "ingested" || data.status === "failed") {
            stillTracking = stillTracking.filter(tid => tid !== id);
            
            if (data.status === "ingested") {
              toast.success(`Document "${data.title}" parsed and indexed successfully.`, { id: `poll-success-${id}` });
            } else {
              toast.error(`Indexing failed for "${data.title}": ${data.errorDetails || "Unknown error"}`, { id: `poll-error-${id}` });
            }
          }
        } catch (err) {
          console.error("Error polling circular status:", err);
        }
      }

      setActiveTrackingIds(stillTracking);
    }, 2500);

    return () => clearInterval(interval);
  }, [activeTrackingIds, toast, queryClient]);

  const handleFileChange = (e) => {
    setUploadFiles(Array.from(e.target.files));
  };

  const toggleDept = (dept) => {
    setSelectedDepts(prev =>
      prev.includes(dept) ? prev.filter(d => d !== dept) : [...prev, dept]
    );
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    toast.error("toast.error.demoWarning");
    return;
  };

  const handleDelete = async (id) => {
    const isConfirmed = await confirm({
      title: "toast.confirm.deleteCircularTitle",
      body: "toast.confirm.deleteCircularBody",
    });
    if (!isConfirmed) return;
    try {
      await deleteCircularMutation.mutateAsync(id);
      setActiveTrackingIds(prev => prev.filter(tid => tid !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const handleReprocess = async (id) => {
    try {
      await reprocessCircularMutation.mutateAsync(id);
      setActiveTrackingIds(prev => [...new Set([...prev, id])]);
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      await editCircularMetadataMutation.mutateAsync({
        id: editingCircular._id,
        payload: {
          title: editingCircular.title,
          circularNumber: editingCircular.circularNumber,
          category: editingCircular.category,
          priority: editingCircular.priority,
          issueDate: editingCircular.issueDate,
          effectiveDate: editingCircular.effectiveDate,
          remarks: editingCircular.remarks,
          departments: editingCircular.departments
        }
      });
      setEditingCircular(null);
    } catch (err) {
      console.error(err);
    }
  };

  // Metrics computation
  const totalCirculars = circulars.length;
  
  const startOfToday = new Date();
  startOfToday.setHours(0,0,0,0);
  const todayUploads = circulars.filter(c => new Date(c.createdAt) >= startOfToday).length;
  
  const processed = circulars.filter(c => c.status === "ingested").length;
  const pending = circulars.filter(c => c.status !== "ingested" && c.status !== "failed").length;
  const failed = circulars.filter(c => c.status === "failed").length;

  const distinctDeps = new Set();
  circulars.forEach(c => {
    if (c.departments) c.departments.forEach(d => distinctDeps.add(d));
    if (c.department) distinctDeps.add(c.department);
  });
  const departmentsCovered = distinctDeps.size;

  const filteredCirculars = circulars.filter(c => {
    const q = searchQuery.toLowerCase();
    return (
      c.title.toLowerCase().includes(q) ||
      (c.circularNumber && c.circularNumber.toLowerCase().includes(q)) ||
      (c.category && c.category.toLowerCase().includes(q)) ||
      (c.departments && c.departments.some(d => d.toLowerCase().includes(q)))
    );
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case "ingested":
        return <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">Ready</span>;
      case "failed":
        return <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">Failed</span>;
      case "uploaded":
        return <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200 animate-pulse">Uploaded</span>;
      default:
        return <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 animate-pulse">{status}</span>;
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 text-slate-900 font-sans flex flex-col">
      {/* ── Sticky Top Navigation ── */}
      <nav className="sticky top-0 z-50 bg-white border-b border-border shadow-sm px-4 sm:px-6 lg:px-8 xl:px-10 py-3">
        <div className="max-w-[1760px] mx-auto flex items-center justify-between gap-4">

          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-teal-tint flex items-center justify-center text-teal font-display font-bold text-lg border border-teal/10 shrink-0">
              G
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-display font-medium text-base text-ink tracking-tight">K-SMART CARE</span>
                <span className="text-[9px] font-mono font-semibold text-ink-soft bg-paper border border-border px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">Official Portal</span>
              </div>
              <span className="hidden sm:block text-[9px] text-ink-soft font-mono uppercase tracking-wider">
                AI Human Capital Intelligence Platform
              </span>
            </div>
          </div>

          {/* Search bar */}
          <div className="hidden md:block relative w-64">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-ink-soft/70">
              <Search size={14} />
            </span>
            <input
              type="text"
              onClick={() => toast.error("toast.error.demoWarning")}
              placeholder="Search circulars, files, tasks..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-border bg-paper/20 text-xs text-ink placeholder:text-ink-soft/60 focus:outline-none focus:ring-1 focus:ring-teal focus:border-teal font-sans"
            />
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/planner")}
              className="text-xs font-semibold text-teal-dark hover:text-teal bg-teal-tint px-3 py-1.5 rounded-xl border border-teal/10 hover:border-teal/20 transition-all active:scale-95 flex items-center gap-1.5 shrink-0"
            >
              <ListTodo size={13} />
              Task Planner
            </button>
            <button
              onClick={() => navigate("/repository")}
              className="text-xs font-semibold text-teal-dark hover:text-teal bg-teal-tint px-3 py-1.5 rounded-xl border border-teal/10 hover:border-teal/20 transition-all active:scale-95 flex items-center gap-1.5 shrink-0"
            >
              <FileText size={13} />
              Circular Repository
            </button>
            {user?.role === "Admin" && (
              <button
                onClick={() => navigate("/admin/circulars")}
                className="text-xs font-semibold text-amber-900 bg-amber-100 px-3 py-1.5 rounded-xl border border-amber-200/50 transition-all active:scale-95 flex items-center gap-1.5 shrink-0"
              >
                <Shield size={13} />
                Admin Console
              </button>
            )}
            {/* Theme Toggle (Calm Light Mode default) */}
            <button className="p-2 rounded-lg text-ink-soft hover:bg-paper/50 transition cursor-pointer" title="Toggle Theme (Calm Mode)">
              <Sun size={18} />
            </button>

            {/* Notification Bell */}
            <div className="relative">
              <button className="p-2 rounded-lg text-ink-soft hover:bg-paper/50 transition cursor-pointer">
                <Bell size={18} />
              </button>
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-alert" />
            </div>

            {/* User Profile Info & Sign Out */}
            <div className="flex items-center gap-2 border-l border-border pl-3">
              <div className="w-8 h-8 rounded-full bg-teal text-white flex items-center justify-center font-semibold text-xs shrink-0 shadow-sm border border-teal-dark/15">
                {user?.name ? user.name.split(" ")[0][0] : "U"}
              </div>
              <div className="hidden lg:block text-left min-w-0">
                <p className="text-xs font-semibold text-ink truncate leading-tight">{user?.name}</p>
                <p className="text-[9px] text-ink-soft truncate font-mono uppercase tracking-wider">{user?.designation}</p>
              </div>
              <button
                onClick={logout}
                className="ml-2 bg-white border border-border hover:bg-alert-tint hover:text-alert hover:border-alert/30 px-3 py-1.5 rounded-xl text-xs font-semibold text-ink-soft transition flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <LogOut size={13} />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Sub-navigation bar for Admin Actions */}
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
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-display font-semibold text-ink leading-tight">Admin Circular Console</h2>
                <span className="bg-amber-100 border border-amber-200 text-amber-800 text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide">Workspace</span>
              </div>
              <p className="text-[10px] text-ink-soft">Upload circular orders, audit AI extraction pipeline, and index vectors</p>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-[1760px] mx-auto w-full px-4 sm:px-6 lg:px-8 xl:px-10 py-6 flex-1 flex flex-col gap-8">
        {/* ── Dashboard Stats ── */}
        <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm flex flex-col gap-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Total Circulars</span>
            <span className="text-2xl font-bold font-mono text-[#0B355A]">{totalCirculars}</span>
          </div>
          <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm flex flex-col gap-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Today's Uploads</span>
            <span className="text-2xl font-bold font-mono text-[#0B355A]">{todayUploads}</span>
          </div>
          <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm flex flex-col gap-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Processed</span>
            <span className="text-2xl font-bold font-mono text-emerald-700">{processed}</span>
          </div>
          <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm flex flex-col gap-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Pending</span>
            <span className="text-2xl font-bold font-mono text-amber-700">{pending}</span>
          </div>
          <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm flex flex-col gap-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Failed</span>
            <span className="text-2xl font-bold font-mono text-rose-700">{failed}</span>
          </div>
          <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm flex flex-col gap-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Departments</span>
            <span className="text-2xl font-bold font-mono text-[#0B355A]">{departmentsCovered}</span>
          </div>
        </section>

        {/* ── Two Column Workspace ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Upload Form (4 cols) */}
          <section className="lg:col-span-4 bg-white border border-stone-200 rounded-xl p-6 shadow-sm flex flex-col gap-6">
            <div className="flex items-center gap-2 pb-3 border-b border-stone-100">
              <Upload className="text-[#0B355A]" size={18} />
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 font-mono">Upload Circulars</h2>
            </div>

            <form onSubmit={handleUploadSubmit} className="flex flex-col gap-4 text-xs">
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-slate-700">PDF Document(s) <span className="text-rose-500">*</span></label>
                <input
                  type="file"
                  accept="application/pdf"
                  multiple
                  onChange={handleFileChange}
                  ref={fileInputRef}
                  required
                  className="w-full file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-stone-100 file:text-slate-800 hover:file:bg-stone-200 cursor-pointer border border-stone-200 rounded p-1"
                />
                <span className="text-[10px] text-slate-500">Select one or more official circular PDF files.</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-slate-700">Circular Number</label>
                  <input
                    type="text"
                    placeholder="e.g. GO (MS) 24/2026"
                    value={circularNumber}
                    onChange={(e) => setCircularNumber(e.target.value)}
                    className="border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#0B355A]"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-slate-700">Title (Optional)</label>
                  <input
                    type="text"
                    placeholder="Auto-extracted if blank"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#0B355A]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-slate-700">Issue Date</label>
                  <input
                    type="date"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    className="border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#0B355A]"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-slate-700">Effective Date</label>
                  <input
                    type="date"
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                    className="border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#0B355A]"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-slate-700">Department Overrides (Optional)</label>
                <div className="border border-stone-200 rounded p-2.5 max-h-36 overflow-y-auto bg-stone-50/50 flex flex-col gap-1.5">
                  {DEPARTMENTS.map(dept => {
                    const isChecked = selectedDepts.includes(dept);
                    return (
                      <label key={dept} className="flex items-center gap-2 cursor-pointer font-medium hover:text-[#0B355A]">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleDept(dept)}
                          className="rounded border-stone-300 text-[#0B355A] focus:ring-[#0B355A]"
                        />
                        {dept}
                      </label>
                    );
                  })}
                </div>
                <span className="text-[10px] text-slate-500">Select departments to target. Left blank, the AI will classify them.</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-slate-700">Category Override</label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#0B355A] bg-white"
                  >
                    <option value="">AI Detect</option>
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-slate-700">Priority Override</label>
                  <select
                    value={selectedPriority}
                    onChange={(e) => setSelectedPriority(e.target.value)}
                    className="border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#0B355A] bg-white"
                  >
                    <option value="">AI Detect</option>
                    {PRIORITIES.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-slate-700">Remarks / Internal Notes</label>
                <textarea
                  placeholder="Leave internal remarks..."
                  rows={2}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#0B355A] resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={uploading}
                className="w-full py-2.5 bg-[#0B355A] hover:bg-[#154670] disabled:bg-stone-300 disabled:text-stone-500 text-white rounded font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
              >
                {uploading ? (
                  <>
                    <Loader2 className="animate-spin" size={14} />
                    Ingesting PDF files...
                  </>
                ) : (
                  <>
                    <Upload size={14} />
                    Ingest Circulars
                  </>
                )}
              </button>
            </form>
          </section>

          {/* Right Column: Repository Table (8 cols) */}
          <section className="lg:col-span-8 bg-white border border-stone-200 rounded-xl p-6 shadow-sm flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <FileText className="text-[#0B355A]" size={18} />
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 font-mono">Circular Documents</h2>
              </div>

              {/* Search Bar */}
              <div className="relative w-full sm:w-64">
                <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-slate-400">
                  <Search size={13} />
                </span>
                <input
                  type="text"
                  onClick={() => toast.error("toast.error.demoWarning")}
                  placeholder="Search title, No, category..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded border border-stone-200 bg-stone-50/50 text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#0B355A]"
                />
              </div>
            </div>

            {loading ? (
              <div className="py-16 flex items-center justify-center text-slate-400">
                <Loader2 className="animate-spin text-[#0B355A]" size={24} />
              </div>
            ) : filteredCirculars.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-xs italic">
                No circulars match current parameters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-stone-200 bg-stone-50 text-[#0B355A] font-bold">
                      <th className="p-3">Title / Number</th>
                      <th className="p-3">Department(s)</th>
                      <th className="p-3">Category</th>
                      <th className="p-3">Priority</th>
                      <th className="p-3">Issue Date</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCirculars.map(c => {
                      const issued = c.issueDate ? new Date(c.issueDate).toLocaleDateString() : "N/A";
                      return (
                        <tr key={c._id} className="border-b border-stone-100 hover:bg-stone-50/50 transition-colors">
                          <td className="p-3 max-w-xs">
                            <div className="font-semibold text-slate-900 leading-snug">{c.title}</div>
                            {c.circularNumber && (
                              <div className="text-[10px] font-mono text-slate-500 mt-0.5">{c.circularNumber}</div>
                            )}
                          </td>
                          <td className="p-3">
                            <div className="flex flex-wrap gap-1">
                              {c.departments && c.departments.map((d, idx) => (
                                <span key={`${d}-${idx}`} className="text-[9px] bg-stone-100 border border-stone-200 px-1.5 py-0.5 rounded text-slate-700">
                                  {d}
                                </span>
                              ))}
                              {(!c.departments || c.departments.length === 0) && (
                                <span className="text-[10px] italic text-slate-400">None</span>
                              )}
                            </div>
                          </td>
                          <td className="p-3 font-medium text-slate-600">{c.category || "Circular"}</td>
                          <td className="p-3">
                            <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded ${
                              c.priority?.toLowerCase() === "high" ? "bg-red-50 text-red-700" :
                              c.priority?.toLowerCase() === "low" ? "bg-stone-100 text-stone-700" :
                              "bg-amber-50 text-amber-700"
                            }`}>
                              {c.priority || "Medium"}
                            </span>
                          </td>
                          <td className="p-3 font-mono text-slate-500">{issued}</td>
                          <td className="p-3">{getStatusBadge(c.status)}</td>
                          <td className="p-3 text-right whitespace-nowrap space-x-1.5">
                            <button
                              onClick={() => setViewingCircular(c)}
                              title="View Profile & PDF"
                              className="p-1 hover:bg-[#0B355A]/10 text-[#0B355A] rounded transition"
                            >
                              <Eye size={14} />
                            </button>
                            <button
                              onClick={() => setEditingCircular(c)}
                              title="Edit Metadata"
                              className="p-1 hover:bg-amber-100 text-amber-700 rounded transition"
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              onClick={() => handleReprocess(c._id)}
                              title="Reprocess AI Pipeline"
                              className="p-1 hover:bg-emerald-100 text-emerald-700 rounded transition"
                            >
                              <RefreshCw size={14} />
                            </button>
                            <button
                              onClick={() => handleDelete(c._id)}
                              title="Delete"
                              className="p-1 hover:bg-red-100 text-red-600 rounded transition"
                            >
                              <Trash size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </main>

      {/* ── Modal: View Profile & PDF ── */}
      {viewingCircular && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-xl shadow-xl w-full max-w-6xl h-[85vh] flex flex-col overflow-hidden text-xs">
            <div className="bg-[#0B355A] text-white p-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <FileText size={16} />
                <h3 className="font-bold uppercase tracking-wider font-mono">View Circular Ingestion Profile</h3>
              </div>
              <button onClick={() => setViewingCircular(null)} className="text-white hover:text-amber-400 font-bold">✕</button>
            </div>

            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              {/* PDF Preview Frame (Left) */}
              <div className="flex-1 bg-stone-100 border-r border-stone-200 p-2 flex flex-col gap-2 h-1/2 md:h-full">
                <div className="flex items-center justify-between px-2 shrink-0">
                  <span className="font-mono text-slate-500">Document URL: {viewingCircular.pdfUrl || "Not yet uploaded"}</span>
                  {viewingCircular.pdfUrl && (
                    <a
                      href={`${client.defaults.baseURL.replace("/api", "")}${viewingCircular.pdfUrl}`}
                      download
                      target="_blank"
                      rel="noreferrer"
                      className="bg-[#0B355A] text-white px-3 py-1 rounded flex items-center gap-1 font-semibold hover:bg-[#154670]"
                    >
                      <Download size={12} /> Download PDF
                    </a>
                  )}
                </div>
                {viewingCircular.pdfUrl ? (
                  <iframe
                    src={`${client.defaults.baseURL.replace("/api", "")}${viewingCircular.pdfUrl}`}
                    className="w-full flex-1 border border-stone-300 rounded"
                    title="PDF Viewer"
                  />
                ) : (
                  <div className="flex-1 border border-dashed border-stone-300 rounded bg-stone-50 flex items-center justify-center text-slate-400 italic">
                    PDF file preview not available.
                  </div>
                )}
              </div>

              {/* Ingestion & AI Details Profile (Right) */}
              <div className="w-full md:w-96 p-6 overflow-y-auto flex flex-col gap-5 h-1/2 md:h-full">
                <div className="pb-3 border-b border-stone-200">
                  <h4 className="text-sm font-bold text-[#0B355A]">{viewingCircular.title}</h4>
                  {viewingCircular.circularNumber && (
                    <span className="font-mono text-[10px] text-slate-500 mt-1 block">Number: {viewingCircular.circularNumber}</span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="font-bold text-slate-500 block uppercase tracking-wider text-[9px] mb-0.5">Category</span>
                    <span className="font-semibold text-slate-900">{viewingCircular.category || "Circular"}</span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-500 block uppercase tracking-wider text-[9px] mb-0.5">Priority</span>
                    <span className="font-semibold text-slate-900">{viewingCircular.priority || "Medium"}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="font-bold text-slate-500 block uppercase tracking-wider text-[9px] mb-0.5">Issue Date</span>
                    <span className="font-mono text-slate-800">{viewingCircular.issueDate ? new Date(viewingCircular.issueDate).toLocaleDateString() : "N/A"}</span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-500 block uppercase tracking-wider text-[9px] mb-0.5">Effective Date</span>
                    <span className="font-mono text-slate-800">{viewingCircular.effectiveDate ? new Date(viewingCircular.effectiveDate).toLocaleDateString() : "N/A"}</span>
                  </div>
                </div>

                <div>
                  <span className="font-bold text-slate-500 block uppercase tracking-wider text-[9px] mb-1">Target Departments</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {viewingCircular.departments?.map((d, idx) => (
                      <span key={`${d}-${idx}`} className="bg-stone-100 border border-stone-200 px-2 py-0.5 rounded text-slate-700 font-semibold">{d}</span>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="font-bold text-slate-500 block uppercase tracking-wider text-[9px] mb-1">AI Ingestion Summary</span>
                  <div className="bg-stone-50 border border-stone-200 p-3 rounded-lg leading-relaxed text-slate-600 whitespace-pre-wrap max-h-40 overflow-y-auto">
                    {viewingCircular.summary || "No AI summary available."}
                  </div>
                </div>

                <div>
                  <span className="font-bold text-slate-500 block uppercase tracking-wider text-[9px] mb-1">Keywords</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {viewingCircular.keywords?.map((k, idx) => (
                      <span key={`${k}-${idx}`} className="bg-blue-50 text-blue-800 font-mono text-[10px] px-1.5 py-0.5 rounded">#{k}</span>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-stone-200 grid grid-cols-2 gap-4 text-[10px] font-mono text-slate-500">
                  <div>
                    <span>Embedding Status:</span>
                    <span className="block font-bold text-slate-800 uppercase">{viewingCircular.status}</span>
                  </div>
                  <div>
                    <span>Vector DB Status:</span>
                    <span className="block font-bold text-slate-800 uppercase">{viewingCircular.vectorIndexed ? "Indexed (Chroma)" : "Not Indexed"}</span>
                  </div>
                </div>

                {viewingCircular.remarks && (
                  <div className="bg-amber-50/50 border border-amber-100 p-3 rounded-lg mt-2">
                    <span className="font-bold text-amber-800 block uppercase tracking-wider text-[9px] mb-0.5">Remarks / Admin Notes</span>
                    <p className="text-slate-600 leading-normal italic">{viewingCircular.remarks}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Edit Metadata ── */}
      {editingCircular && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-xl shadow-xl w-full max-w-lg overflow-hidden text-xs">
            <div className="bg-[#0B355A] text-white p-4 flex items-center justify-between shrink-0">
              <h3 className="font-bold uppercase tracking-wider font-mono">Edit Circular Metadata</h3>
              <button onClick={() => setEditingCircular(null)} className="text-white hover:text-amber-400 font-bold">✕</button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-slate-700">Document Title</label>
                <input
                  type="text"
                  required
                  value={editingCircular.title || ""}
                  onChange={(e) => setEditingCircular(prev => ({ ...prev, title: e.target.value }))}
                  className="border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#0B355A]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-slate-700">Circular Number</label>
                  <input
                    type="text"
                    value={editingCircular.circularNumber || ""}
                    onChange={(e) => setEditingCircular(prev => ({ ...prev, circularNumber: e.target.value }))}
                    className="border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#0B355A]"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-slate-700">Category</label>
                  <select
                    value={editingCircular.category || ""}
                    onChange={(e) => setEditingCircular(prev => ({ ...prev, category: e.target.value }))}
                    className="border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#0B355A] bg-white"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-slate-700">Priority</label>
                  <select
                    value={editingCircular.priority || ""}
                    onChange={(e) => setEditingCircular(prev => ({ ...prev, priority: e.target.value }))}
                    className="border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#0B355A] bg-white"
                  >
                    {PRIORITIES.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-slate-700">Issue Date</label>
                  <input
                    type="date"
                    value={editingCircular.issueDate ? new Date(editingCircular.issueDate).toISOString().split("T")[0] : ""}
                    onChange={(e) => setEditingCircular(prev => ({ ...prev, issueDate: e.target.value }))}
                    className="border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#0B355A]"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-slate-700">Target Departments</label>
                <div className="border border-stone-200 rounded p-2.5 max-h-32 overflow-y-auto bg-stone-50/50 flex flex-col gap-1.5">
                  {DEPARTMENTS.map(dept => {
                    const isChecked = editingCircular.departments?.includes(dept);
                    return (
                      <label key={dept} className="flex items-center gap-2 cursor-pointer font-medium hover:text-[#0B355A]">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            const newDeps = isChecked
                              ? editingCircular.departments.filter(d => d !== dept)
                              : [...(editingCircular.departments || []), dept];
                            setEditingCircular(prev => ({ ...prev, departments: newDeps }));
                          }}
                          className="rounded border-stone-300 text-[#0B355A] focus:ring-[#0B355A]"
                        />
                        {dept}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-slate-700">Remarks</label>
                <textarea
                  rows={2}
                  value={editingCircular.remarks || ""}
                  onChange={(e) => setEditingCircular(prev => ({ ...prev, remarks: e.target.value }))}
                  className="border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#0B355A]"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setEditingCircular(null)}
                  className="px-4 py-2 border border-stone-200 hover:bg-stone-50 rounded font-semibold text-slate-700 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#0B355A] hover:bg-[#154670] text-white rounded font-bold transition cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
