import { useState, useEffect } from "react";
import client from "../api/client.js";
import { useLanguage } from "../context/LanguageContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { useConfirm } from "../context/ConfirmContext.jsx";

export default function CircularsWidget() {
  const [circulars, setCirculars] = useState([]);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [expandedSummaries, setExpandedSummaries] = useState({});
  const { t, formatDate } = useLanguage();
  const toast = useToast();
  const confirm = useConfirm();

  const toggleSummary = (id) => {
    setExpandedSummaries((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Fetch all circulars on mount
  const fetchCirculars = async () => {
    try {
      const { data } = await client.get("/circulars");
      setCirculars(data);
    } catch (err) {
      console.error("Failed to fetch circulars:", err);
    }
  };

  useEffect(() => {
    fetchCirculars();
  }, []);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
 
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === "application/pdf") {
        setFile(droppedFile);
      } else {
        toast.error("toast.upload.pdfOnly");
      }
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      toast.error("Please select a PDF file first.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setUploading(true);
    setUploadProgress(20); // Simulated start

    const uploadPromise = client.post("/circulars/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    toast.promise(
      uploadPromise,
      {
        loading: "toast.circular.uploadStarted",
        success: () => t("toast.circular.uploadCompleted", { name: file.name }),
        error: "toast.error.generic",
      },
      { id: "circular-upload" }
    );

    try {
      const interval = setInterval(() => {
        setUploadProgress((prev) => (prev < 90 ? prev + 10 : prev));
      }, 200);

      await uploadPromise;

      clearInterval(interval);
      setUploadProgress(100);
      setFile(null);
      fetchCirculars(); // Reload list
    } catch (err) {
      console.error("Upload error:", err);
    } finally {
      setTimeout(() => {
        setUploading(false);
        setUploadProgress(0);
      }, 1000);
    }
  };

  const handleDelete = async (id) => {
    const isConfirmed = await confirm({
      title: "toast.confirm.deleteCircularTitle",
      body: "toast.confirm.deleteCircularBody",
    });
    if (!isConfirmed) return;

    const deletePromise = client.delete(`/circulars/${id}`);
    toast.promise(
      deletePromise,
      {
        loading: "common.loading",
        success: "toast.circular.deleted",
        error: "toast.error.circularDeleteFailed",
      },
      { id: `delete-circular-${id}` }
    );

    try {
      await deletePromise;
      fetchCirculars();
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  const formatSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="card" style={styles.container}>
      <div style={styles.listSection}>
        <h4 style={styles.listHeader}>{t("circular.recentCirculars", "Recent Circulars")} ({circulars.length})</h4>
        {circulars.length === 0 ? (
          <p style={styles.emptyText}>{t("circular.noCircularsUploaded", "No circulars uploaded yet.")}</p>
        ) : (
          <div style={styles.list}>
            {circulars.map((circ) => (
              <div key={circ._id} style={styles.itemContainer}>
                <div style={styles.item}>
                  <div style={styles.itemInfo}>
                    <span style={styles.itemIcon}>📄</span>
                    <div style={styles.itemDetails}>
                      <a
                        href={`${client.defaults.baseURL.replace("/api", "")}/uploads/${circ.filename}`}
                        target="_blank"
                        rel="noreferrer"
                        style={styles.itemTitle}
                      >
                        {circ.title}
                      </a>
                      <div style={styles.itemMetaRow}>
                        <span style={styles.itemMeta}>
                          {formatSize(circ.size)} • {formatDate(circ.createdAt)}
                        </span>
                        {circ.status === "ingested" && circ.summary && (
                          <button
                            type="button"
                            onClick={() => toggleSummary(circ._id)}
                            style={styles.summaryToggleBtn}
                          >
                            {expandedSummaries[circ._id] ? t("circular.hideSummary", "▲ Hide Summary") : t("circular.viewAiSummary", "✨ View AI Summary")}
                          </button>
                        )}
                      </div>
                      <span
                        style={{
                          ...styles.statusBadge,
                          backgroundColor:
                            circ.status === "ingested"
                              ? "var(--sage-tint)"
                              : circ.status === "failed"
                              ? "var(--alert-tint)"
                              : "var(--ochre-tint)",
                          color:
                            circ.status === "ingested"
                              ? "var(--teal-dark)"
                              : circ.status === "failed"
                              ? "var(--alert)"
                              : "var(--ochre)",
                        }}
                      >
                        {circ.status}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(circ._id)}
                    style={styles.deleteBtn}
                    title="Delete circular"
                  >
                    🗑️
                  </button>
                </div>
                {expandedSummaries[circ._id] && circ.summary && (
                  <div style={styles.summaryBox}>
                    <div style={styles.summaryText}>{circ.summary}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  title: {
    fontSize: "18px",
    color: "var(--ink)",
  },
  subtitle: {
    fontSize: "13px",
    color: "var(--ink-soft)",
    marginTop: "-10px",
    lineHeight: "1.4",
  },
  alert: {
    padding: "10px 14px",
    borderRadius: "var(--radius-sm)",
    border: "1px solid",
    fontSize: "13px",
    transition: "all 0.3s ease",
  },
  dropZone: {
    border: "2px dashed var(--border)",
    borderRadius: "var(--radius)",
    padding: "24px",
    textAlign: "center",
    cursor: "pointer",
    transition: "all 0.2s ease-in-out",
  },
  fileInput: {
    display: "none",
  },
  label: {
    display: "block",
    cursor: "pointer",
  },
  dropText: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "4px",
    fontSize: "14px",
    color: "var(--ink-soft)",
  },
  icon: {
    fontSize: "28px",
    marginBottom: "4px",
  },
  hint: {
    fontSize: "12px",
    color: "var(--ink-soft)",
    opacity: 0.8,
  },
  selectedContainer: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  fileName: {
    fontSize: "14px",
    fontWeight: "600",
    color: "var(--teal)",
    wordBreak: "break-all",
  },
  fileSize: {
    fontSize: "12px",
    color: "var(--ink-soft)",
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
    marginTop: "8px",
  },
  cancelBtn: {
    background: "transparent",
    border: "1px solid var(--border)",
    padding: "8px 16px",
    fontSize: "13px",
    color: "var(--ink-soft)",
    borderRadius: "var(--radius-sm)",
  },
  uploadBtn: {
    background: "var(--teal)",
    color: "var(--surface)",
    padding: "8px 16px",
    fontSize: "13px",
    borderRadius: "var(--radius-sm)",
    fontWeight: "600",
    transition: "background 0.2s",
  },
  listSection: {
    marginTop: "4px",
    paddingTop: "4px",
  },
  listHeader: {
    fontSize: "14px",
    fontWeight: "600",
    color: "var(--ink)",
    marginBottom: "12px",
  },
  emptyText: {
    fontSize: "13px",
    color: "var(--ink-soft)",
    fontStyle: "italic",
    textAlign: "center",
    padding: "12px 0",
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    maxHeight: "220px",
    overflowY: "auto",
    paddingRight: "4px",
  },
  itemContainer: {
    display: "flex",
    flexDirection: "column",
    padding: "10px 12px",
    background: "var(--paper)",
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--border)",
    transition: "transform 0.2s, box-shadow 0.2s",
    gap: "6px",
  },
  item: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  itemInfo: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  itemIcon: {
    fontSize: "20px",
  },
  itemDetails: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  itemTitle: {
    fontSize: "13px",
    fontWeight: "600",
    color: "var(--teal)",
    wordBreak: "break-all",
    textDecoration: "none",
  },
  itemMetaRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginTop: "2px",
  },
  itemMeta: {
    fontSize: "11px",
    color: "var(--ink-soft)",
  },
  summaryToggleBtn: {
    background: "transparent",
    border: "none",
    padding: "0",
    color: "var(--teal)",
    fontSize: "11px",
    fontWeight: "600",
    cursor: "pointer",
  },
  summaryBox: {
    marginTop: "4px",
    padding: "8px 12px",
    background: "var(--surface)",
    borderRadius: "var(--radius-sm)",
    borderLeft: "3px solid var(--teal)",
  },
  summaryText: {
    fontSize: "12px",
    color: "var(--ink-soft)",
    whiteSpace: "pre-wrap",
    lineHeight: "1.4",
    textAlign: "left",
  },
  statusBadge: {
    display: "inline-block",
    alignSelf: "flex-start",
    fontSize: "10px",
    fontWeight: "600",
    padding: "2px 6px",
    borderRadius: "10px",
    textTransform: "uppercase",
    marginTop: "2px",
  },
  deleteBtn: {
    background: "transparent",
    border: "none",
    fontSize: "14px",
    padding: "4px 8px",
    borderRadius: "4px",
    transition: "background 0.2s",
  },
};
