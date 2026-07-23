import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import client from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { Megaphone, Newspaper, FileText, Loader2, Plus, X, Globe, MapPin, MessageSquare, ExternalLink, Sparkles } from "lucide-react";
import { useAssistant } from "../context/AssistantContext.jsx";

// Mirrors backend/src/config/departments.js — kept in sync manually since
// this is a small, rarely-changing list. If you add a department on the
// backend, add it here too.
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
const ALL_DEPARTMENTS = "All Departments";
const CAN_POST_ROLES = ["department_head", "district_admin", "state_admin"];

export default function DepartmentFeedWidget() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPostForm, setShowPostForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const canPost = CAN_POST_ROLES.includes(user?.role);

  const loadFeed = useCallback(async () => {
    try {
      const [circularsRes, newsRes] = await Promise.all([
        client.get("/circulars/feed"),
        client.get("/news/feed"),
      ]);

      const circularItems = circularsRes.data.map((c) => ({ ...c, _type: "circular" }));
      const newsItems = newsRes.data.map((n) => ({ ...n, _type: "news" }));

      const merged = [...circularItems, ...newsItems].sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );
      setItems(merged);
    } catch (err) {
      console.error("Failed to load department feed:", err);
      toast.error(err, { id: "load-feed-error" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  return (
    <div className="bg-white border border-border rounded-2xl shadow-custom p-6 transition-all duration-300 hover:shadow-custom-sm hover:-translate-y-0.5 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-teal-tint text-teal">
            <Megaphone size={18} />
          </div>
          <h2 className="text-base font-display font-medium text-ink">
            {t("feed.forDept", "For {{dept}}", { dept: t("departments." + user?.department, user?.department || t("feed.yourDept", "Your Department")) })}
          </h2>
        </div>
        {canPost && (
          <button
            onClick={() => setShowPostForm((s) => !s)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold font-sans cursor-pointer transition-all duration-200 flex items-center gap-1 ${showPostForm
                ? "bg-alert-tint text-alert border border-alert/20 hover:bg-alert hover:text-white"
                : "interactive-btn-secondary"
              }`}
          >
            {showPostForm ? (
              <>
                <X size={13} /> {t("common.cancel", "Cancel")}
              </>
            ) : (
              <>
                <Plus size={13} /> {t("feed.postNews", "Post News")}
              </>
            )}
          </button>
        )}
      </div>

      {showPostForm && (
        <PostNewsForm
          onPosted={() => {
            setShowPostForm(false);
            loadFeed();
          }}
        />
      )}

      {loading ? (
        <div className="flex justify-center items-center py-8">
          <Loader2 className="animate-spin text-teal" size={20} />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-border rounded-xl bg-paper/30">
          <p className="text-sm text-ink-soft italic">{t("feed.empty", "Nothing here yet for your department or district.")}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 max-h-[380px] overflow-y-auto pr-1">
          {items.slice(0, 2).map((item) =>
            item._type === "news" ? (
              <NewsCard key={`news-${item._id}`} item={item} />
            ) : (
              <CircularCard
                key={`circular-${item._id}`}
                item={item}
                canEdit={canPost}
                isEditing={editingId === item._id}
                onStartEdit={() => setEditingId(item._id)}
                onCancelEdit={() => setEditingId(null)}
                onSaved={() => {
                  setEditingId(null);
                  loadFeed();
                }}
                onRefresh={loadFeed}
              />
            )
          )}
          {items.length > 2 && (
            <button
              onClick={() => navigate("/repository")}
              className="w-full py-2.5 mt-1 rounded-xl border border-teal/20 bg-teal-tint/30 hover:bg-teal-tint/50 text-teal-dark font-semibold text-xs transition-all duration-200 cursor-pointer active:scale-98 flex items-center justify-center gap-1.5"
            >
              {t("feed.viewAll", "View All Circulars & News")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function NewsCard({ item }) {
  const { t, formatDate } = useLanguage();
  return (
    <div className="border border-border/80 rounded-xl p-4 bg-white/50 hover:bg-white transition-colors duration-200 flex flex-col gap-2">
      <div className="flex justify-between items-center gap-2">
        <span className="text-[10px] font-semibold bg-ochre-tint text-ochre border border-ochre/15 px-2 py-0.5 rounded-full flex items-center gap-1">
          <Newspaper size={11} />
          {t("feed.news", "News")}
        </span>
        <span className="text-[10px] font-mono text-ink-soft">{formatDate(item.createdAt)}</span>
      </div>
      <p className="text-xs font-bold text-ink leading-snug">{item.title}</p>
      <p className="text-xs text-ink-soft leading-relaxed break-words">{item.body}</p>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/20">
        <TagRow departments={item.departments} district={item.district} />
        {item.postedBy?.name && (
          <p className="text-[10px] text-ink-soft/80 italic font-medium leading-none">
            — {item.postedBy.name}, {item.postedBy.designation || "Staff"}
          </p>
        )}
      </div>
    </div>
  );
}

function CircularCard({ item, canEdit, isEditing, onStartEdit, onCancelEdit, onSaved, onRefresh }) {
  const { triggerAskAI } = useAssistant();
  const { t, formatDate } = useLanguage();
  const toast = useToast();
  const aiOnly = !item.aiSuggestedDepartments
    ? false
    : JSON.stringify(item.aiSuggestedDepartments) === JSON.stringify(item.departments);

  return (
    <div className="border border-border/80 rounded-xl p-4 bg-white/50 hover:bg-white transition-colors duration-200 flex flex-col gap-2">
      <div className="flex justify-between items-center gap-2">
        <span className="text-[10px] font-semibold bg-teal-tint text-teal-dark border border-teal/15 px-2 py-0.5 rounded-full flex items-center gap-1">
          <FileText size={11} />
          {t("feed.circular", "Circular")}
        </span>
        <span className="text-[10px] font-mono text-ink-soft">{formatDate(item.createdAt)}</span>
      </div>
      <p className="text-xs font-bold text-ink leading-snug">{item.title}</p>
      {item.summary && (
        <p className="text-[11px] text-ink-soft leading-relaxed bg-paper/40 p-2.5 rounded-lg border border-border/40 font-sans italic">
          {item.summary.slice(0, 180)}
          {item.summary.length > 180 ? "..." : ""}
        </p>
      )}

      {isEditing ? (
        <DepartmentEditor
          circularId={item._id}
          initialDepartments={item.departments}
          initialDistrict={item.district}
          onCancel={onCancelEdit}
          onSaved={onSaved}
        />
      ) : (
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/20 flex-wrap">
          <TagRow departments={item.departments} district={item.district} />
          <div className="flex items-center gap-2">
            {canEdit && (
              <button
                onClick={onStartEdit}
                className="text-[10px] font-semibold text-teal hover:text-teal-dark hover:underline bg-transparent border-0 p-0 cursor-pointer mr-1"
              >
                {t("feed.editTags", "Edit tags")}
              </button>
            )}
            <button
              onClick={() => {
                triggerAskAI(`Explain Circular No. ${item.circularNumber || item.title}`, item._id);
              }}
              className="text-[10px] font-bold text-teal hover:text-teal-dark bg-teal-tint/50 hover:bg-teal-tint px-2.5 py-1 rounded-lg border border-teal/10 hover:border-teal/20 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <MessageSquare size={11} />
              {t("feed.askAI", "Ask AI")}
            </button>
            {!item.addedToPlanner && (
              <button
                onClick={async () => {
                  const addSuggestionPromise = (async () => {
                    const { data: suggestion } = await client.get(`/circulars/${item._id}/task-suggestion`);
                    await client.post("/tasks", {
                      title: suggestion.title,
                      description: t("feed.aiSuggestedFollowUp", `AI Suggested follow-up for: "${item.title}"`, { title: item.title }),
                      category: "Government Circular",
                      priority: suggestion.priority || "Medium",
                      dueDate: suggestion.dueDate || undefined,
                      dueTime: suggestion.dueTime || undefined,
                      source: "AI",
                      circularId: item._id
                    });
                    return suggestion;
                  })();

                  toast.promise(
                    addSuggestionPromise,
                    {
                      loading: "toast.ai.creatingTask",
                      success: (suggestion) => t("feed.aiFollowUpAdded", `AI Follow-up task added: "${suggestion.title}"`, { title: suggestion.title }),
                      error: "feed.aiFollowUpFailed",
                    },
                    { id: `add-planner-${item._id}` }
                  );

                  try {
                    await addSuggestionPromise;
                    if (onRefresh) onRefresh();
                  } catch (err) {
                    console.error(err);
                  }
                }}
                className="text-[10px] font-bold bg-teal text-white hover:bg-teal-dark px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-sm"
              >
                <Sparkles size={11} />
                {t("feed.addToPlanner", "Add to Planner")}
              </button>
            )}
            {item.pdfUrl && (
              <a
                href={`${client.defaults.baseURL.replace("/api", "")}${item.pdfUrl}`}
                target="_blank"
                rel="noreferrer"
                className="text-[10px] font-bold text-ink hover:text-teal bg-paper hover:bg-border border border-border px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 active:scale-95"
              >
                <ExternalLink size={11} />
                {t("feed.viewPdf", "View PDF")}
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TagRow({ departments = [], district }) {
  const { t } = useLanguage();
  return (
    <div className="flex flex-wrap gap-1 items-center">
      {departments.map((d) => (
        <span
          key={d}
          className="text-[9px] font-mono bg-sage-tint text-teal-dark border border-sage/10 px-2 py-0.5 rounded-full flex items-center gap-0.5"
        >
          {t("departments." + d, d)}
        </span>
      ))}
      {district && district !== "All Districts" && (
        <span className="text-[9px] font-mono bg-paper text-ink-soft border border-border px-2 py-0.5 rounded-full flex items-center gap-0.5">
          <MapPin size={9} />
          {t("districts." + district, district)}
        </span>
      )}
    </div>
  );
}

function DepartmentEditor({ circularId, initialDepartments, initialDistrict, onCancel, onSaved }) {
  const [selected, setSelected] = useState(new Set(initialDepartments || []));
  const [district, setDistrict] = useState(initialDistrict || "All Districts");
  const [saving, setSaving] = useState(false);
  const { t } = useLanguage();

  function toggle(dep) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(dep)) {
        next.delete(dep);
      } else {
        next.add(dep);
      }
      return next;
    });
  }

  async function handleSave() {
    if (selected.size === 0) return;
    setSaving(true);
    try {
      await client.patch(`/circulars/${circularId}/department`, {
        departments: Array.from(selected),
        district,
      });
      onSaved();
    } catch (err) {
      console.error("Failed to update department tags:", err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full mt-2 p-3 bg-paper/40 border border-border rounded-xl flex flex-col gap-3 font-sans">
      <h4 className="text-[10px] font-bold text-ink-soft uppercase tracking-wider">{t("feed.editDistribution", "Edit Distribution")}</h4>
      <div>
        <label className="text-[9px] font-mono text-ink-soft/80 uppercase tracking-wider mb-1 block">{t("feed.departments", "Departments")}</label>
        <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto p-1 bg-white border border-border rounded-lg">
          {[...DEPARTMENTS, ALL_DEPARTMENTS].map((dep) => {
            const isSelected = selected.has(dep);
            return (
              <button
                key={dep}
                type="button"
                onClick={() => toggle(dep)}
                className={`text-[9px] px-2 py-0.5 rounded-full border transition-all cursor-pointer ${isSelected
                    ? "border-teal bg-teal-tint text-teal-dark font-medium"
                    : "border-border bg-white text-ink-soft hover:border-teal/40"
                  }`}
              >
                {dep}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <label className="text-[9px] font-mono text-ink-soft/80 uppercase tracking-wider mb-1 block">{t("greeting.district", "District")}</label>
        <input
          value={district}
          onChange={(e) => setDistrict(e.target.value)}
          placeholder={t("feed.districtPlaceholder", "District (or 'All Districts')")}
          className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-white text-xs text-ink placeholder:text-ink-soft/60 focus:outline-none focus:ring-1 focus:ring-teal focus:border-teal font-sans"
        />
      </div>
      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          type="button"
          className="px-3 py-1.5 rounded-xl border border-border text-[10px] font-semibold text-ink-soft hover:bg-paper/30 transition-colors cursor-pointer"
        >
          {t("common.cancel", "Cancel")}
        </button>
        <button
          onClick={handleSave}
          disabled={saving || selected.size === 0}
          type="button"
          className="interactive-btn-primary px-3 py-1.5 rounded-xl text-[10px] font-semibold cursor-pointer"
        >
          {saving ? t("common.saving", "Saving...") : t("common.saveChanges", "Save Changes")}
        </button>
      </div>
    </div>
  );
}

function PostNewsForm({ onPosted }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [district, setDistrict] = useState("All Districts");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");
  const { t } = useLanguage();

  function toggle(dep) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(dep)) {
        next.delete(dep);
      } else {
        next.add(dep);
      }
      return next;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim() || !body.trim() || selected.size === 0) {
      setError(t("feed.validationError", "Title, body, and at least one department are required."));
      return;
    }
    setError("");
    setPosting(true);
    try {
      await client.post("/news", {
        title: title.trim(),
        body: body.trim(),
        departments: Array.from(selected),
        district,
      });
      setTitle("");
      setBody("");
      setSelected(new Set());
      onPosted();
    } catch (err) {
      setError(err.response?.data?.error || t("feed.postFailed", "Failed to post news."));
    } finally {
      setPosting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 p-4 bg-paper/30 border border-border rounded-xl font-sans">
      <h3 className="text-xs font-semibold text-ink-soft uppercase tracking-wider">{t("feed.createNews", "Create News Announcement")}</h3>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t("feed.headline", "Headline")}
        className="w-full px-3 py-2 rounded-xl border border-border bg-white text-xs text-ink placeholder:text-ink-soft/60 focus:outline-none focus:ring-1 focus:ring-teal focus:border-teal font-sans"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={t("feed.shortAnnouncement", "Short announcement...")}
        rows={3}
        className="w-full px-3 py-2 rounded-xl border border-border bg-white text-xs text-ink placeholder:text-ink-soft/60 focus:outline-none focus:ring-1 focus:ring-teal focus:border-teal resize-y font-sans"
      />

      <div>
        <label className="text-[10px] font-mono text-ink-soft uppercase tracking-wider mb-1 block">{t("feed.targetDepartments", "Target Departments")}</label>
        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1 bg-white border border-border rounded-lg">
          {[...DEPARTMENTS, ALL_DEPARTMENTS].map((dep) => {
            const isSelected = selected.has(dep);
            return (
              <button
                key={dep}
                type="button"
                onClick={() => toggle(dep)}
                className={`text-[10px] px-2.5 py-1 rounded-full border transition-all cursor-pointer ${isSelected
                    ? "border-teal bg-teal-tint text-teal-dark font-medium"
                    : "border-border bg-white hover:border-teal/40 text-ink-soft"
                  }`}
              >
                {dep}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="text-[10px] font-mono text-ink-soft uppercase tracking-wider mb-1 block">{t("feed.targetDistrict", "Target District")}</label>
        <input
          value={district}
          onChange={(e) => setDistrict(e.target.value)}
          placeholder={t("feed.targetDistrictPlaceholder", "District (e.g. All Districts)")}
          className="w-full px-3 py-2 rounded-xl border border-border bg-white text-xs text-ink placeholder:text-ink-soft/60 focus:outline-none focus:ring-1 focus:ring-teal focus:border-teal font-sans"
        />
      </div>

      {error && <p className="text-[11px] text-alert font-medium">{error}</p>}

      <button
        type="submit"
        disabled={posting}
        className="interactive-btn-primary self-end px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer flex items-center gap-1.5"
      >
        {posting ? t("feed.posting", "Posting...") : t("feed.postAnnouncement", "Post Announcement")}
      </button>
    </form>
  );
}
