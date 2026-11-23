import { useState, useEffect, useCallback, useRef } from "react";
import { useOutletContext, useSearchParams } from "react-router";
import { Cpu, RefreshCw, AlertCircle, CheckCircle2, Loader2, FolderKanban } from "lucide-react";
import WorkspaceTopNav from "@/app/components/workspace/WorkspaceTopNav";
import WorkspaceHeader from "@/app/components/workspace/WorkspaceHeader";
import DrawingViewer from "@/app/components/workspace/DrawingViewer";
import AIExtractionPanel from "@/app/components/workspace/AIExtractionPanel";
import RFQSheetEmbed from "@/app/components/workspace/RFQSheetEmbed";
import ShareModal from "@/app/components/workspace/ShareModal";
import BottomActionBar from "@/app/components/workspace/BottomActionBar";
import type { FieldSection } from "@/app/types/workspace";
import type { CELayoutContext } from "@/app/layouts/CELayout";
import { drawingApi, type ProcessingStatus, type ExtractionSection } from "@/app/services/drawing";
import { useKanbanBoard } from "@/app/hooks/useProjects";

const AI_STATUS_LABEL: Record<string, string> = {
  NONE: "Not processed", QUEUED: "Queued", PROCESSING: "Processing…",
  COMPLETED: "AI ready", FAILED: "AI failed",
};

// ── Project Selector ─────────────────────────────────────────────────────────

function ProjectSelector({
  projectId, onSelect,
}: {
  projectId: string | null;
  onSelect: (projectId: string, rfqNumber: string | null) => void;
}) {
  const { data, loading } = useKanbanBoard();
  const tasks = data?.tasks ?? [];

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card">
      <FolderKanban size={14} className="text-muted-foreground flex-shrink-0" />
      <label className="text-xs font-semibold text-muted-foreground flex-shrink-0">Project:</label>
      <select
        value={projectId ?? ""}
        onChange={(e) => {
          const task = tasks.find((t) => t.id === e.target.value);
          if (task) onSelect(task.id, task.rfq_number ?? task.job_number);
        }}
        disabled={loading}
        className="h-7 px-2 text-xs font-medium rounded-md border border-border bg-background text-foreground max-w-md flex-1 outline-none focus:border-primary/50"
      >
        <option value="" disabled>
          {loading ? "Loading projects…" : "Select a project…"}
        </option>
        {tasks.map((t) => (
          <option key={t.id} value={t.id}>
            {(t.rfq_number ?? t.job_number)} — {t.title ?? "Untitled"} ({AI_STATUS_LABEL[t.ai_status] ?? t.ai_status})
          </option>
        ))}
      </select>
    </div>
  );
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface DrawingMeta {
  signed_url?: string;
  drawing_number?: string;
  drawing_title?: string;
  revision?: string;
  original_name?: string;
  total_pages?: number;
}

// ── Status Banner ─────────────────────────────────────────────────────────────

function ProcessingBanner({
  status, onProcess, onReprocess, projectId,
}: {
  status: ProcessingStatus | null;
  onProcess: () => void;
  onReprocess: () => void;
  projectId: string;
}) {
  const s = status?.status ?? "NONE";

  if (s === "COMPLETED") {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg mb-2"
        style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
        <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />
        <span className="text-xs text-emerald-700 dark:text-emerald-400 flex-1">
          AI extraction complete — review extracted fields below
        </span>
        <button
          onClick={onReprocess}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          title="Force reprocess"
        >
          <RefreshCw size={11} /> Reprocess Drawing
        </button>
      </div>
    );
  }

  if (s === "PROCESSING" || s === "QUEUED") {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg mb-2"
        style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
        <Loader2 size={14} className="text-amber-500 animate-spin flex-shrink-0" />
        <span className="text-xs text-amber-700 dark:text-amber-400">
          {s === "QUEUED" ? "Processing queued…" : "Sending drawing to DataLift AI…"}
        </span>
      </div>
    );
  }

  if (s === "FAILED") {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg mb-2"
        style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
        <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
        <span className="text-xs text-red-600 dark:text-red-400 flex-1">
          Processing failed: {status?.error_message || "Unknown error"}
        </span>
        <button onClick={onProcess} className="text-xs font-semibold text-red-600 hover:text-red-700 transition-colors">
          Reprocess Drawing
        </button>
      </div>
    );
  }

  // NONE — AI processing normally starts automatically at ingestion; this is
  // the fallback for legacy projects or cases where that didn't fire.
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg mb-2"
      style={{ background: "rgba(245,130,31,0.08)", border: "1px solid rgba(245,130,31,0.2)" }}>
      <Cpu size={14} style={{ color: "#F5821F" }} className="flex-shrink-0" />
      <span className="text-xs text-muted-foreground flex-1">
        No AI extraction on file for this drawing
      </span>
      <button
        onClick={onProcess}
        className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md transition-all"
        style={{ backgroundColor: "#F5821F", color: "#fff" }}
        onMouseEnter={(e) => { (e.currentTarget.style.backgroundColor = "#D9710E"); }}
        onMouseLeave={(e) => { (e.currentTarget.style.backgroundColor = "#F5821F"); }}
      >
        <Cpu size={12} /> Reprocess Drawing
      </button>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function DrawingWorkspace() {
  const { dark, toggleDark } = useOutletContext<CELayoutContext>();
  const [searchParams, setSearchParams] = useSearchParams();
  const rfqId = searchParams.get("rfqId");

  // Project selection — seeded from the URL (e.g. arriving from a Dashboard
  // card), but switchable in-page via the ProjectSelector dropdown. Kept in
  // sync with the URL so the page stays bookmarkable/shareable either way.
  const [projectId, setProjectId] = useState<string | null>(searchParams.get("projectId"));
  const [rfqNumber, setRfqNumber] = useState<string | null>(searchParams.get("rfqNumber"));

  const handleSelectProject = useCallback((newProjectId: string, newRfqNumber: string | null) => {
    setProjectId(newProjectId);
    setRfqNumber(newRfqNumber);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("projectId", newProjectId);
      if (newRfqNumber) next.set("rfqNumber", newRfqNumber);
      else next.delete("rfqNumber");
      next.delete("rfqId"); // superseded by the freshly selected project's rfq_number
      return next;
    });
  }, [setSearchParams]);

  // Drawing viewer state
  const [drawingMeta, setDrawingMeta] = useState<DrawingMeta | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | undefined>(undefined);

  // AI processing state
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus | null>(null);
  const [sections, setSections] = useState<FieldSection[]>([]);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [processing, setProcessing] = useState(false);

  // UI state
  const [shareOpen, setShareOpen] = useState(false);
  const [savedDraft, setSavedDraft] = useState(false);
  const [reviewComplete, setReviewComplete] = useState(false);
  const [autoSaved, setAutoSaved] = useState(true);

  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Reset project-scoped state on switch ──────────────────────────────────
  // Without this, switching projects via the dropdown would briefly show the
  // previous project's drawing/extraction until the new fetches resolve (or
  // indefinitely, if the new project has no drawing/extraction at all yet).
  useEffect(() => {
    if (pollRef.current) clearTimeout(pollRef.current);
    setDrawingMeta(null);
    setPdfUrl(undefined);
    setProcessingStatus(null);
    setSections([]);
    setReviewedCount(0);
    setTotalCount(0);
  }, [projectId]);

  // ── Load drawing metadata + signed URL ──────────────────────────────────────
  useEffect(() => {
    if (!projectId) return;
    const BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

    async function loadDrawing() {
      try {
        const { supabase } = await import("@/app/lib/supabase");
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;

        const headers: Record<string, string> = {
          "ngrok-skip-browser-warning": "true",
        };
        if (token) headers["Authorization"] = `Bearer ${token}`;
        // No dev bypass — unauthenticated requests return 401

        const res = await fetch(`${BASE}/api/v1/projects/${projectId}/drawing`, { headers });
        if (res.ok) {
          const meta = await res.json();
          setDrawingMeta(meta);
          setPdfUrl(meta.signed_url || meta.url || undefined);
        }
      } catch {
        // Drawing fetch failed — viewer will show placeholder
      }
    }

    loadDrawing();
  }, [projectId]);

  // ── Load processing status + extraction data ─────────────────────────────
  useEffect(() => {
    if (!projectId) return;
    loadStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function loadStatus() {
    if (!projectId) return;
    try {
      const status = await drawingApi.getStatus(projectId);
      setProcessingStatus(status);

      if (status.status === "COMPLETED") {
        loadExtraction();
      } else if (status.status === "PROCESSING" || status.status === "QUEUED") {
        schedulePoll();
      }
    } catch {
      // Status fetch failed silently
    }
  }

  async function loadExtraction() {
    if (!projectId) return;
    try {
      const ext = await drawingApi.getExtraction(projectId);
      if (ext.has_extraction) {
        setSections(ext.sections as unknown as FieldSection[]);
        setTotalCount(ext.total_fields);
        setReviewedCount(ext.reviewed_count);
      }
    } catch {
      // Extraction fetch failed silently
    }
  }

  function schedulePoll() {
    if (pollRef.current) clearTimeout(pollRef.current);
    pollRef.current = setTimeout(() => {
      loadStatus();
    }, 3000); // Poll every 3 seconds while processing
  }

  useEffect(() => {
    return () => { if (pollRef.current) clearTimeout(pollRef.current); };
  }, []);

  // ── Process drawing ──────────────────────────────────────────────────────────
  async function handleProcess() {
    if (!projectId || processing) return;
    setProcessing(true);
    setProcessingStatus({ ...processingStatus!, status: "PROCESSING", project_id: projectId, job_id: null, extraction_id: null, started_at: null, completed_at: null, error_message: null });
    try {
      const result = await drawingApi.processDrawing(projectId);
      if (result.status === "COMPLETED" || result.status === "CACHED") {
        await loadExtraction();
        setProcessingStatus({ project_id: projectId, status: "COMPLETED", job_id: result.job_id, extraction_id: result.extraction_id, started_at: null, completed_at: new Date().toISOString(), error_message: null });
      } else if (result.status === "FAILED") {
        setProcessingStatus({ project_id: projectId, status: "FAILED", job_id: result.job_id, extraction_id: null, started_at: null, completed_at: null, error_message: result.error });
      }
    } catch (e: unknown) {
      setProcessingStatus({ project_id: projectId, status: "FAILED", job_id: null, extraction_id: null, started_at: null, completed_at: null, error_message: e instanceof Error ? e.message : "Unknown error" });
    } finally {
      setProcessing(false);
    }
  }

  async function handleReprocess() {
    if (!projectId || processing) return;
    setProcessing(true);
    setProcessingStatus({ project_id: projectId, status: "PROCESSING", job_id: null, extraction_id: null, started_at: null, completed_at: null, error_message: null });
    try {
      const result = await drawingApi.reprocessDrawing(projectId);
      if (result.status === "COMPLETED") {
        await loadExtraction();
        setProcessingStatus({ project_id: projectId, status: "COMPLETED", job_id: result.job_id, extraction_id: result.extraction_id, started_at: null, completed_at: new Date().toISOString(), error_message: null });
      } else {
        setProcessingStatus({ project_id: projectId, status: "FAILED", job_id: result.job_id, extraction_id: null, started_at: null, completed_at: null, error_message: result.error });
      }
    } catch (e: unknown) {
      setProcessingStatus({ project_id: projectId, status: "FAILED", job_id: null, extraction_id: null, started_at: null, completed_at: null, error_message: e instanceof Error ? e.message : "Unknown error" });
    } finally {
      setProcessing(false);
    }
  }

  // ── Field review handlers (persisted to DB via API) ──────────────────────
  const handleFieldChange = useCallback((fieldId: string, value: string) => {
    setSections((prev: FieldSection[]) =>
      prev.map((sec: FieldSection) => ({
        ...sec,
        fields: sec.fields.map((f: any) =>
          f.id === fieldId ? { ...f, value, isEdited: value !== f.originalValue } : f
        ),
      }))
    );
    setAutoSaved(false);
    // Persist to backend
    if (projectId) {
      drawingApi.reviewField(projectId, fieldId, "pending", value).catch(() => {});
    }
  }, [projectId]);

  const handleApprove = useCallback((fieldId: string) => {
    setSections((prev: FieldSection[]) =>
      prev.map((sec: FieldSection) => ({
        ...sec,
        fields: sec.fields.map((f: any) => f.id === fieldId ? { ...f, reviewStatus: "approved" } : f),
      }))
    );
    setReviewedCount((c) => c + 1);
    if (projectId) {
      drawingApi.reviewField(projectId, fieldId, "approved")
        .then((res) => {
          if (res.rfq_synced) {
            window.dispatchEvent(new CustomEvent("rfq:refresh", { detail: { projectId } }));
          }
        })
        .catch(() => {});
    }
  }, [projectId]);

  const handleReject = useCallback((fieldId: string) => {
    setSections((prev: FieldSection[]) =>
      prev.map((sec: FieldSection) => ({
        ...sec,
        fields: sec.fields.map((f: any) => f.id === fieldId ? { ...f, reviewStatus: "rejected" } : f),
      }))
    );
    setReviewedCount((c) => c + 1);
    if (projectId) {
      drawingApi.reviewField(projectId, fieldId, "rejected").catch(() => {});
    }
  }, [projectId]);

  const handleRestore = useCallback((fieldId: string) => {
    setSections((prev: FieldSection[]) =>
      prev.map((sec: FieldSection) => ({
        ...sec,
        fields: sec.fields.map((f: any) =>
          f.id === fieldId ? { ...f, value: f.originalValue, isEdited: false, reviewStatus: "pending" } : f
        ),
      }))
    );
    setReviewedCount((c) => Math.max(0, c - 1));
    if (projectId) {
      drawingApi.reviewField(projectId, fieldId, "pending").catch(() => {});
    }
  }, [projectId]);

  useEffect(() => {
    const t = setTimeout(() => setAutoSaved(true), 3000);
    return () => clearTimeout(t);
  }, [sections]);

  function handleSaveDraft() { setSavedDraft(true); setTimeout(() => setSavedDraft(false), 2500); }

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      <WorkspaceTopNav
        dark={dark}
        onToggleDark={toggleDark}
        rfqId={rfqNumber || rfqId || "—"}
      />

      <ProjectSelector projectId={projectId} onSelect={handleSelectProject} />

      <WorkspaceHeader
        onSaveDraft={handleSaveDraft}
        onDownloadExcel={() => {}}
        onShare={() => setShareOpen(true)}
        onSubmit={() => {}}
        saved={autoSaved}
      />

      <div className="flex-1 overflow-y-auto">
        {/* Processing status banner */}
        {projectId && (
          <div className="px-3 pt-3">
            <ProcessingBanner
              status={processingStatus}
              onProcess={handleProcess}
              onReprocess={handleReprocess}
              projectId={projectId}
            />
          </div>
        )}

        <div className="flex gap-3 px-3 pb-3" style={{ height: "62vh", minHeight: 480 }}>
          {/* Drawing Viewer — real PDF if available */}
          <div className="flex-1 min-w-0">
            <DrawingViewer
              isDark={dark}
              pdfUrl={pdfUrl}
              drawingMeta={drawingMeta ? {
                fileName: drawingMeta.original_name || drawingMeta.drawing_number || "Drawing",
                pages: drawingMeta.total_pages || 1,
                drawingNumber: drawingMeta.drawing_number,
                revision: drawingMeta.revision,
                title: drawingMeta.drawing_title,
              } : undefined}
            />
          </div>

          {/* AI Extraction Panel — real data if processed */}
          <div className="flex-1 min-w-0">
            <AIExtractionPanel
              sections={sections}
              isDark={dark}
              onFieldChange={handleFieldChange}
              onApprove={handleApprove}
              onReject={handleReject}
              onRestore={handleRestore}
              onMarkComplete={() => setReviewComplete(true)}
              reviewedCount={reviewedCount}
              totalCount={totalCount}
              processingStatus={processingStatus?.status ?? "NONE"}
              onProcess={handleProcess}
            />
          </div>
        </div>

        <div className="px-3 pb-4">
          <RFQSheetEmbed
            projectId={projectId}
            rfqId={rfqId}
            rfqNumber={rfqNumber}
          />
        </div>
      </div>

      <BottomActionBar
        onSaveDraft={handleSaveDraft}
        onSaveToExcel={() => {}}
        onDownload={() => {}}
        onShare={() => setShareOpen(true)}
        onSubmit={() => {}}
        savedDraft={savedDraft}
        isComplete={reviewComplete}
      />

      <ShareModal open={shareOpen} onClose={() => setShareOpen(false)} />
    </div>
  );
}
