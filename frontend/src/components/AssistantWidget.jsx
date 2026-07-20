import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import client from "../api/client.js";
import { 
  Plus, 
  Trash2, 
  BookOpen, 
  Send, 
  Sparkles, 
  Search, 
  FileText, 
  Info, 
  Loader2, 
  CheckCircle, 
  AlertCircle, 
  HelpCircle,
  FileCheck,
  X,
  MessageCircle
} from "lucide-react";
import { useAssistant } from "../context/AssistantContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { useConfirm } from "../context/ConfirmContext.jsx";
import { useQueryClient } from "@tanstack/react-query";
import { useCirculars, useSuggestedPrompts, useDeleteCircularMutation } from "../hooks/useQueries.jsx";


const STATUS_LABEL = {
  uploaded: "Uploading...",
  parsing: "Reading PDF...",
  chunking: "Splitting into chunks...",
  embedding: "Generating embeddings...",
  saving: "Saving...",
  ingested: "Ready",
  failed: "Failed",
};

const IN_PROGRESS_STATUSES = ["uploaded", "parsing", "chunking", "embedding", "saving"];

const SUGGESTED_QUESTIONS = [
  { label: "Summarize Document", kind: "insight", insightType: "summary" },
  { label: "Key Points", kind: "insight", insightType: "keypoints" },
];

export default function AssistantWidget() {
  const location = useLocation();
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();

  const [preferredLanguage, setPreferredLanguage] = useState(
    () => user?.preferredLanguage || "auto"
  );
  const [messages, setMessages] = useState([
    { role: "assistant", text: "Good day! How can I assist you with your work today?" },
  ]);

  // Fetch dynamic, time-sensitive and language-aware welcome greeting
  useEffect(() => {
    let isMounted = true;
    async function loadGreeting() {
      try {
        const { data } = await client.post("/assistant/welcome", {
          language: preferredLanguage,
        });
        if (isMounted && data?.text) {
          setMessages((prev) => {
            if (prev.length <= 1 && (prev.length === 0 || prev[0].role === "assistant")) {
              return [{ role: "assistant", text: data.text }];
            }
            return prev;
          });
        }
      } catch (err) {
        console.error("Failed to load dynamic welcome greeting:", err);
      }
    }
    loadGreeting();
    return () => {
      isMounted = false;
    };
  }, [preferredLanguage]);
  const { 
    input, 
    setInput, 
    selectedCircularId: selectedId, 
    setSelectedCircularId: setSelectedId,
    closeAssistant,
    minimizeAssistant
  } = useAssistant();
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: circulars = [] } = useCirculars();
  const { data: aiSuggestions = [], isLoading: suggestionsLoading } = useSuggestedPrompts(selectedId);
  const deleteCircularMutation = useDeleteCircularMutation();

  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  
  // Auto-select focused circular if passed from navigation state
  useEffect(() => {
    if (location.state?.focusCircularId) {
      setSelectedId(location.state.focusCircularId);
      // Clear location state so reload or re-routing doesn't force re-selection
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Handle cross-widget focus events dispatched from DepartmentFeedWidget
  // (both widgets live on the dashboard simultaneously)
  useEffect(() => {
    function handleFocusCircular(e) {
      if (e.detail?.circularId) {
        setSelectedId(e.detail.circularId);
      }
    }
    window.addEventListener("focus-circular", handleFocusCircular);
    return () => window.removeEventListener("focus-circular", handleFocusCircular);
  }, []);

  const fileInputRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const selectedCircular = circulars.find((c) => c._id === selectedId) || null;

  async function toggleSelect(circular) {
    if (circular.status !== "ingested") return;
    const isSelecting = selectedId !== circular._id;
    setSelectedId(isSelecting ? circular._id : null);

    if (isSelecting) {
      let dynamicActions = [];
      try {
        const { data: sugRes } = await client.post("/assistant/suggestions", {
          circularId: circular._id,
          preferredLanguage,
        });
        if (sugRes?.suggestions || sugRes?.options) {
          dynamicActions = sugRes.suggestions || sugRes.options;
        }
      } catch (err) {
        console.error("Failed to fetch circular suggestions:", err);
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: `📄 Selected document: **${circular.title}**`,
          suggestedActions: dynamicActions,
          options: dynamicActions,
        },
      ]);
    }
  }

  const detectLanguage = (circular) => {
    const malayalamRegex = /[\u0D00-\u0D7F]/;
    if (malayalamRegex.test(circular.summary || "") || malayalamRegex.test(circular.title || "")) {
      return "Malayalam";
    }
    return "English";
  };

  const pollCircularIngestion = (circularId, messageId) => {
    let attempts = 0;
    const maxAttempts = 60; // 3 minutes
    const interval = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts) {
        clearInterval(interval);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId
              ? { ...msg, status: "failed", error: "Processing timed out." }
              : msg
          )
        );
        return;
      }

      try {
        const { data: circularsList } = await client.get("/circulars");
        const circular = circularsList.find((c) => c._id === circularId);
        
        if (!circular) {
          clearInterval(interval);
          return;
        }

        // Map status to progress percent
        let mappedProgress = 40;
        if (circular.status === "parsing") mappedProgress = 55;
        else if (circular.status === "chunking") mappedProgress = 70;
        else if (circular.status === "embedding") mappedProgress = 85;
        else if (circular.status === "saving") mappedProgress = 95;
        else if (circular.status === "ingested") mappedProgress = 100;
        else if (circular.status === "failed") mappedProgress = 0;

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId
              ? {
                  ...msg,
                  status: circular.status,
                  progress: mappedProgress,
                  department: circular.department || circular.departments?.[0] || "General",
                  language: detectLanguage(circular),
                  circularId: circular._id,
                  isToday: true,
                }
              : msg
          )
        );

        if (circular.status === "ingested") {
          clearInterval(interval);
          setSelectedId(circularId);

          let dynamicActions = [];
          try {
            const { data: sugRes } = await client.post("/assistant/suggestions", {
              circularId,
              preferredLanguage,
            });
            if (sugRes?.suggestions || sugRes?.options) {
              dynamicActions = sugRes.suggestions || sugRes.options;
            }
          } catch (sugErr) {
            console.error("Failed to fetch suggestions for ingested circular:", sugErr);
          }

          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              text: `✅ Government Circular processed successfully.\n\nHere are some relevant actions you can take:`,
              suggestedActions: dynamicActions,
              options: dynamicActions,
            },
          ]);
          queryClient.invalidateQueries({ queryKey: ["circulars"] });
        } else if (circular.status === "failed") {
          clearInterval(interval);
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              text: `❌ Failed to process the circular. Please ensure the document is not password-protected and is under the size limit.`,
            },
          ]);
          queryClient.invalidateQueries({ queryKey: ["circulars"] });
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 3000);
  };

  async function uploadSingleFile(file) {
    if (file.type !== "application/pdf") {
      toast.error("toast.upload.pdfOnly");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("toast.upload.sizeLimitExceeded");
      return;
    }

    const uploadMessageId = `upload-${Date.now()}`;
    const initialUploadMsg = {
      id: uploadMessageId,
      role: "upload",
      fileName: file.name,
      status: "uploaded",
      progress: 20,
    };
    setMessages((prev) => [...prev, initialUploadMsg]);

    const formData = new FormData();
    formData.append("file", file);
    try {
      const response = await client.post("/circulars/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          const mappedProgress = Math.round(percentCompleted * 0.4);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === uploadMessageId
                ? { ...msg, progress: mappedProgress, status: "uploaded" }
                : msg
            )
          );
        }
      });
      
      const createdCircular = response.data?.circular || response.data?.circulars?.[0] || response.data;
      if (createdCircular?._id) {
        pollCircularIngestion(createdCircular._id, uploadMessageId);
      } else {
        const { data: circularsList } = await client.get("/circulars");
        const found = circularsList.find((c) => c.title === file.name || c.filename === file.name);
        if (found) {
          pollCircularIngestion(found._id, uploadMessageId);
        } else {
          throw new Error("Uploaded record not found.");
        }
      }
    } catch (err) {
      console.error("Upload error:", err);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === uploadMessageId
            ? { ...msg, status: "failed", error: "Upload failed." }
            : msg
        )
      );
    }
  }

  async function handleFileUpload(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    await uploadSingleFile(files[0]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  useEffect(() => {
    if (!showAttachmentMenu) return;
    const handleOutsideClick = () => {
      setShowAttachmentMenu(false);
    };
    const timer = setTimeout(() => {
      window.addEventListener("click", handleOutsideClick);
    }, 10);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("click", handleOutsideClick);
    };
  }, [showAttachmentMenu]);

  async function handleDeleteCircular(id) {
    const isConfirmed = await confirm({
      title: "toast.confirm.deleteCircularTitle",
      body: "toast.confirm.deleteCircularBody",
    });
    if (!isConfirmed) return;
    try {
      await deleteCircularMutation.mutateAsync(id);
      if (selectedId === id) setSelectedId(null);
    } catch (err) {
      console.error("Failed to delete circular:", err);
    }
  }

  async function askQuestion(question) {
    setMessages((prev) => [...prev, { role: "user", text: question }]);
    setLoading(true);
    try {
      const qLower = question.toLowerCase();
      const explicitGk = qLower.includes("use general knowledge") || 
                         qLower.includes("answer using ai") || 
                         qLower.includes("not from circulars") || 
                         qLower.includes("ignore uploaded documents");

      const chatHistory = messages
        .slice(-10)
        .map((m) => ({ role: m.role, text: m.text || "" }));

      const { data } = await client.post("/assistant/ask", {
        question,
        circularId: selectedId || undefined,
        preferredLanguage,
        allowGeneralKnowledge: explicitGk,
        history: chatHistory,
      });
      setMessages((prev) => [
        ...prev,
        { 
          role: "assistant", 
          text: data.answer, 
          type: data.type,
          citations: data.citations,
          mode: data.mode,
          message: data.message,
          suggestions: data.suggestions,
          options: data.options,
          disclaimer: data.disclaimer,
          usedRAG: data.usedRAG,
          usedGeneralKnowledge: data.usedGeneralKnowledge,
          sources: data.sources,
          confidence: data.confidence,
          structuredData: data.structuredData,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "I encountered an issue generating a response. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function requestInsight(insightType, label) {
    let targetCircular = selectedCircular;

    if (!targetCircular) {
      const readyCirculars = circulars.filter((c) => c.status === "ingested");
      if (readyCirculars.length === 1) {
        targetCircular = readyCirculars[0];
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "user", text: label },
          {
            role: "assistant",
            text:
              readyCirculars.length === 0
                ? "Please upload a government circular PDF first."
                : "Please select a specific circular from the list below to focus this action.",
          },
        ]);
        return;
      }
    }

    setMessages((prev) => [...prev, { role: "user", text: `${label} — ${targetCircular.title}` }]);
    setLoading(true);
    try {
      const { data } = await client.get(`/circulars/${targetCircular._id}/insight`, {
        params: { type: insightType },
      });
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: data.content, citations: [{ title: data.title, page: null }] },
      ]);
    } catch (err) {
      const msg = err.response?.data?.error || "Unable to extract that insight currently.";
      setMessages((prev) => [...prev, { role: "assistant", text: msg }]);
    } finally {
      setLoading(false);
    }
  }

  function handleSuggested(item) {
    if (loading) return;
    if (item.kind === "insight") requestInsight(item.insightType, item.label);
    else askQuestion(item.question);
  }

  function handleSend(e) {
    e.preventDefault();
    const question = input.trim();
    if (!question || loading) return;
    setInput("");
    askQuestion(question);
  }

  const formatSize = (bytes) => {
    if (!bytes) return "0 KB";
    return `${(bytes / 1024).toFixed(0)} KB`;
  };

  const toggleSummary = (id) => {
    setExpandedSummaries((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredCirculars = circulars.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Markdown bullet lists and headers custom formatter
  function formatMessage(text) {
    if (!text) return "";
    const lines = text.split("\n");
    return lines.map((line, idx) => {
      if (line.startsWith("### ")) {
        return <h4 key={idx} className="text-sm font-semibold text-teal-dark mt-2 mb-1">{line.replace("### ", "")}</h4>;
      }
      if (line.startsWith("## ")) {
        return <h3 key={idx} className="text-base font-semibold text-teal-dark mt-3 mb-1.5 font-display">{line.replace("## ", "")}</h3>;
      }
      if (line.startsWith("# ")) {
        return <h2 key={idx} className="text-lg font-bold text-teal-dark mt-3 mb-1.5 font-display">{line.replace("# ", "")}</h2>;
      }
      if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
        const content = line.trim().replace(/^[-*]\s+/, "");
        return (
          <li key={idx} className="ml-5 list-disc text-sm text-ink mb-1 font-sans">
            {renderInlineFormatting(content)}
          </li>
        );
      }
      if (line.trim() === "") {
        return <div key={idx} className="h-1.5" />;
      }
      return <p key={idx} className="text-sm text-ink mb-1 leading-relaxed font-sans">{renderInlineFormatting(line)}</p>;
    });
  }

  function renderInlineFormatting(str) {
    const parts = str.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i} className="font-semibold text-teal-dark">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  }



  return (
    <div className="bg-white p-4 md:p-5 space-y-4 flex flex-col h-full min-h-0">
      {/* Header Info */}
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-base leading-none">✨</span>
            <h2 className="text-base font-display font-semibold text-ink">
              K-SMART CARE AI
            </h2>
          </div>
          <p className="text-[11px] text-ink-soft font-sans font-medium">
            Your Government Work Companion
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Minimize button */}
          <button
            onClick={minimizeAssistant}
            title="Minimize"
            className="p-1 text-ink-soft hover:text-ink hover:bg-paper/50 rounded-lg transition cursor-pointer flex items-center justify-center w-6 h-6"
          >
            <span className="text-xs font-bold leading-none translate-y-[-2px]">_</span>
          </button>

          {/* Close button */}
          <button
            onClick={closeAssistant}
            title="Close"
            className="p-1 text-ink-soft hover:text-ink hover:bg-paper/50 rounded-lg transition cursor-pointer flex items-center justify-center w-6 h-6"
          >
            <X size={14} />
          </button>
        </div>
      </div>


      {/* ── Active Focus Chip Alert ── */}
      {selectedCircular && (
        <div className="bg-teal-tint/30 border border-teal/20 rounded-xl p-3 flex flex-col gap-2 font-sans animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-teal-dark">
              <FileCheck size={16} className="text-teal shrink-0" />
              <span>
                <span className="font-semibold">Focused Query Mode:</span> AI search is focused strictly on <span className="font-semibold truncate max-w-[200px] inline-block align-middle">{selectedCircular.title}</span>.
              </span>
            </div>
            <button 
              onClick={() => setSelectedId(null)}
              className="text-[10px] font-bold text-teal hover:underline hover:text-teal-dark shrink-0 cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* ── Chat Thread + Suggestions (single shared scroll region) ── */}
      <div 
        ref={scrollRef} 
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden border border-border rounded-xl bg-paper/10 p-4 space-y-4 font-sans custom-scrollbar"
      >
        {messages.map((m, i) => {
          if (m.role === "upload") {
            const isDone = m.status === "ingested";
            const isFailed = m.status === "failed";
            
            return (
              <div key={i} className="flex flex-col items-start max-w-[85%] w-full">
                <div className="border border-border bg-white rounded-2xl shadow-sm p-4 w-full space-y-3 font-sans animate-in fade-in duration-200">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-teal-tint/50 text-teal shrink-0 text-sm">
                      {isDone ? "✅" : isFailed ? "❌" : "📄"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-ink truncate" title={m.fileName}>
                        {m.fileName}
                      </p>
                      
                      {!isDone && !isFailed && (
                        <p className="text-[11px] text-ochre font-medium mt-0.5 animate-pulse">
                          {m.status === "uploaded" ? "Uploading..." : 
                           m.status === "parsing" ? "Reading PDF..." :
                           m.status === "chunking" ? "Splitting into chunks..." :
                           m.status === "embedding" ? "Generating embeddings..." :
                           m.status === "saving" ? "Saving & indexing..." : "Processing..."}
                        </p>
                      )}

                      {isDone && (
                        <div className="space-y-1 mt-1 text-[11px] text-ink-soft">
                          <p className="font-semibold text-teal-dark">Processed successfully</p>
                          <p>Language: <span className="font-medium text-ink">{m.language || "English"}</span></p>
                          <p>Department: <span className="font-medium text-ink">{m.department || "General"}</span></p>
                          <p className="text-[9px] font-mono uppercase tracking-wider text-ink-soft/80 mt-1.5">
                            {m.isToday ? "Uploaded Today" : "Uploaded"}
                          </p>
                        </div>
                      )}

                      {isFailed && (
                        <div className="text-[11px] text-alert mt-1 font-medium">
                          Failed to process circular. {m.error || ""}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar (if in progress) */}
                  {!isDone && !isFailed && (
                    <div className="space-y-1.5">
                      <div className="w-full bg-paper border border-border h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-teal h-full rounded-full transition-all duration-300 ease-out" 
                          style={{ width: `${m.progress || 10}%` }}
                        />
                      </div>
                      <div className="flex justify-between items-center text-[10px] font-mono text-ink-soft">
                        <span className="tracking-tight text-[9px] font-semibold text-teal/40">
                          {m.progress >= 95 ? "██████████" :
                           m.progress >= 85 ? "█████████░" :
                           m.progress >= 70 ? "████████░░" :
                           m.progress >= 55 ? "██████░░░░" :
                           m.progress >= 40 ? "████░░░░░░" : "██░░░░░░░░"}
                        </span>
                        <span className="font-bold text-teal-dark">{m.progress || 10}%</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          }

          const isUser = m.role === "user";
          const isNoDoc = !isUser && m.mode === "no_document_found";
          const isCrisis = !isUser && m.type === "crisis_support";
          const isBreathing = !isUser && m.type === "breathing_exercise";

          if (isCrisis) {
            return (
              <div key={i} className="flex flex-col items-start space-y-1 w-full animate-in fade-in duration-200">
                <div className="flex flex-col gap-3 p-4 bg-rose-50 border border-rose-200 rounded-2xl max-w-[90%] font-sans shadow-sm">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-rose-700 bg-rose-100 border border-rose-300 px-2.5 py-0.5 rounded-full w-fit">
                    <AlertCircle size={14} className="text-rose-600 shrink-0" />
                    Mental Health & Emotional Support
                  </div>
                  <p className="text-sm font-medium text-rose-900 leading-relaxed whitespace-pre-line">
                    {m.text}
                  </p>
                  {m.structuredData?.helplines && (
                    <div className="space-y-1.5 pt-2 border-t border-rose-200/60">
                      <p className="text-[10px] font-bold text-rose-700 uppercase tracking-wider">Direct Helplines</p>
                      <div className="grid grid-cols-1 gap-1.5">
                        {m.structuredData.helplines.map((h, idx) => (
                          <div key={idx} className="bg-white/80 border border-rose-200 rounded-xl p-2 flex items-center justify-between">
                            <div>
                              <p className="text-xs font-bold text-rose-900">{h.name}</p>
                              <p className="text-[10px] text-rose-600">{h.desc}</p>
                            </div>
                            <a 
                              href={`tel:${h.number.replace(/[^0-9]/g, "")}`}
                              className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-2.5 py-1 rounded-lg transition"
                            >
                              Call {h.number}
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          }

          if (isBreathing) {
            return (
              <div key={i} className="flex flex-col items-start space-y-1 w-full animate-in fade-in duration-200">
                <div className="flex flex-col gap-3 p-4 bg-teal-tint/30 border border-teal/30 rounded-2xl max-w-[85%] font-sans shadow-sm">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-teal-dark bg-teal-tint border border-teal/20 px-2.5 py-0.5 rounded-full w-fit">
                    <Sparkles size={12} className="text-teal shrink-0" />
                    🫁 Breathing & Grounding Exercise
                  </div>
                  <div className="text-xs text-ink space-y-2 leading-relaxed whitespace-pre-line">
                    {formatMessage(m.text)}
                  </div>
                </div>
              </div>
            );
          }

          if (isNoDoc) {
            return (
              <div key={i} className="flex flex-col items-start space-y-1 w-full animate-in fade-in duration-200">
                <div className="flex flex-col gap-3 p-4 bg-blue-50/50 border border-blue-200/50 rounded-2xl max-w-[85%] font-sans shadow-sm">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full w-fit">
                    <Info size={12} className="text-blue-700 shrink-0" />
                    ℹ No Relevant Circular Found
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-blue-900 leading-relaxed animate-in fade-in duration-200">
                      {m.text}
                    </p>
                    {m.message && (
                      <p className="text-xs text-blue-700/80 leading-relaxed">
                        {m.message}
                      </p>
                    )}
                  </div>
                  {m.suggestions && m.suggestions.length > 0 && (
                    <div className="space-y-2 pt-2.5 border-t border-blue-100">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600/80">
                        Suggestions
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {m.suggestions.map((suggestion, idx) => (
                          <button
                            key={idx}
                            onClick={() => !loading && askQuestion(suggestion)}
                            disabled={loading}
                            className="bg-white hover:bg-blue-50 border border-blue-100 hover:border-blue-300 text-xs text-blue-800 font-medium px-3 py-1.5 rounded-xl transition duration-150 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
                          >
                            <span className="text-blue-500 font-bold">•</span>
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          }

          const lastAssistantIdx = messages.reduce((acc, msg, idx) => (msg.role === "assistant" ? idx : acc), -1);

          return (
            <div key={i} className={`flex flex-col ${isUser ? "items-end" : "items-start"} space-y-1.5`}>
              <div
                className={`px-4 py-3 rounded-2xl text-sm leading-relaxed max-w-[85%] shadow-sm
                  ${isUser 
                    ? "bg-teal text-white rounded-tr-none font-medium" 
                    : "bg-white border border-border text-ink rounded-tl-none"
                  }`}
              >
                {isUser ? m.text : formatMessage(m.text)}

                {/* ── Contextual Suggested Actions rendered inside assistant message card ── */}
                {!isUser && i === lastAssistantIdx && (() => {
                  const actionsToRender = (m.suggestedActions?.length > 0 || m.options?.length > 0)
                    ? (m.suggestedActions || m.options)
                    : (selectedId && aiSuggestions?.length > 0 ? aiSuggestions : []);

                  if (!actionsToRender || actionsToRender.length === 0) return null;

                  const isDocRelated = Boolean(
                    selectedId ||
                    m.type === "document_answer" ||
                    m.mode === "official_circular" ||
                    (m.citations && m.citations.length > 0) ||
                    (m.sources && m.sources.length > 0)
                  );

                  return (
                    <div className="mt-3 pt-3 border-t border-slate-100 font-sans space-y-2 animate-in fade-in duration-200">
                      <span className="text-[11px] font-semibold text-teal-dark/80 flex items-center gap-1">
                        {isDocRelated ? "💡 Suggested questions for this document:" : "What would you like to do next?"}
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {actionsToRender.map((action, idx) => {
                          const label = typeof action === "string" ? action : (action.label || action.text || "Option");
                          const actionVal = typeof action === "string" ? action : (action.intent || action.label || action.id);
                          return (
                            <button
                              key={action.id || actionVal || idx}
                              onClick={() => !loading && askQuestion(actionVal || label)}
                              disabled={loading}
                              className="bg-white hover:bg-teal-50 border border-teal/30 hover:border-teal text-teal-dark font-medium text-xs px-3 py-1.5 rounded-xl shadow-xs transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
                            >
                              <span>{label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
              
              {!isUser && (m.citations?.length > 0 || m.sources?.length > 0) && (
                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 max-w-[85%] space-y-1 font-sans text-[11px] text-slate-700 animate-in fade-in duration-200">
                  <span className="font-semibold flex items-center gap-1 text-slate-800">
                    📄 Sources
                  </span>
                  {m.citations && m.citations.length > 0 ? (
                    m.citations.map((c, ci) => (
                      <div key={ci} className="text-slate-600 leading-normal">
                        • <span className="font-medium text-slate-800">{c.title || c.circularNumber || "Official Document"}</span>
                        {c.circularNumber ? ` (${c.circularNumber})` : ""}
                        {c.page ? ` · Page ${c.page}` : ""}
                      </div>
                    ))
                  ) : (
                    m.sources.map((s, si) => (
                      <div key={si} className="text-slate-600 font-medium">
                        • {s}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}

        {loading && (
          <div className="flex items-center gap-2 bg-white border border-border px-4 py-3 rounded-2xl rounded-tl-none text-xs text-ink-soft w-fit">
            <Loader2 size={14} className="animate-spin text-teal" />
            <span>Consulting intelligence pipeline...</span>
          </div>
        )}
      </div>

      {/* ── Chat Input Box ── */}
      <form onSubmit={handleSend} className="relative flex gap-2 items-center font-sans border-t border-border/60 pt-4">
        {/* Dropdown Menu */}
        {showAttachmentMenu && (
          <div className="absolute bottom-14 left-0 w-64 bg-white border border-border rounded-2xl shadow-xl p-2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="text-[10px] font-mono font-bold text-ink-soft uppercase tracking-wider px-3 py-1.5 border-b border-border/50">
              Attach Document
            </div>
            <div className="py-1">
              <button
                type="button"
                onClick={() => {
                  setShowAttachmentMenu(false);
                  fileInputRef.current?.click();
                }}
                className="w-full text-left px-3 py-2 text-xs font-semibold text-ink hover:bg-teal-tint/40 hover:text-teal rounded-lg transition-all flex items-center gap-2 cursor-pointer"
              >
                <span className="text-teal">📄</span>
                Upload Government Circular PDF
              </button>
              <button
                type="button"
                disabled
                className="w-full text-left px-3 py-2 text-xs font-medium text-ink-soft/50 rounded-lg flex items-center gap-2 opacity-60 cursor-not-allowed"
              >
                <span>🖼️</span>
                Upload Image (future)
              </button>
              <button
                type="button"
                disabled
                className="w-full text-left px-3 py-2 text-xs font-medium text-ink-soft/50 rounded-lg flex items-center gap-2 opacity-60 cursor-not-allowed"
              >
                <span>📝</span>
                Upload Word Document (future)
              </button>
              <button
                type="button"
                disabled
                className="w-full text-left px-3 py-2 text-xs font-medium text-ink-soft/50 rounded-lg flex items-center gap-2 opacity-60 cursor-not-allowed"
              >
                <span>📊</span>
                Upload Excel Sheet (future)
              </button>
            </div>
          </div>
        )}

        {/* Attachment Button */}
        <button
          type="button"
          onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
          className={`w-11 h-11 rounded-xl border flex items-center justify-center transition-all cursor-pointer active:scale-95 shrink-0
            ${showAttachmentMenu 
              ? "bg-teal-tint border-teal text-teal" 
              : "bg-white border-border text-ink-soft hover:border-teal hover:text-teal"
            }`}
          title="Add attachment"
        >
          <Plus size={20} className={showAttachmentMenu ? "rotate-45 transition-transform duration-200" : "transition-transform duration-200"} />
        </button>

        {/* Native File Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept="application/pdf"
          style={{ display: "none" }}
        />

        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={selectedCircular ? `Ask about ${selectedCircular.title}...` : "e.g. How many leaves are LSGD employees entitled to?"}
          className="flex-1 h-11 px-4 rounded-xl border border-border bg-white text-sm text-ink placeholder:text-ink-soft/60 focus:outline-none focus:ring-2 focus:ring-teal focus:border-teal"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="h-11 px-5 rounded-xl bg-teal hover:bg-teal-dark text-white font-semibold text-sm transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send size={14} />
          <span>Ask</span>
        </button>
      </form>
    </div>
  );
}