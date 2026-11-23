/**
 * Frontend/src/app/pages/foundry/FoundryEmailHub.tsx
 * ──────────────────────────────────────────────────────────────────────────────
 * Phase 1 — Email Hub & Project Viewer (Foundry Department)
 *
 * Reuses the enterprise Email Hub architecture from Cost Estimation, styled for
 * Foundry department (Amber accent #F59E0B).
 *
 * All data flows from FastAPI → PostgreSQL via department-scoped endpoints.
 */

import { useState } from "react";
import { useOutletContext } from "react-router";
import {
  Mail, FileText, Download, RefreshCw, AlertCircle,
  Paperclip, Calendar, User, Hash, Inbox, Eye,
} from "lucide-react";
import type { FoundryLayoutContext } from "@/app/layouts/FoundryLayout";
import { useProjectList, useProjectDetail } from "@/app/hooks/useProjects";
import type { ProjectListItem } from "@/app/services/api";

const ACCENT = "#F59E0B";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBytes(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  DRAFT:     { bg: "rgba(100,116,139,0.12)", text: "#64748B" },
  ACTIVE:    { bg: "rgba(245,158,11,0.12)",  text: "#D97706" },
  ON_HOLD:   { bg: "rgba(249,115,22,0.12)",  text: "#F97316" },
  COMPLETED: { bg: "rgba(34,197,94,0.12)",   text: "#22C55E" },
  CANCELLED: { bg: "rgba(239,68,68,0.12)",   text: "#EF4444" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_COLOR[status] ?? STATUS_COLOR.DRAFT;
  return (
    <span
      className="text-[10px] font-bold px-2 py-0.5 rounded-full"
      style={{ backgroundColor: cfg.bg, color: cfg.text }}
    >
      {status}
    </span>
  );
}

// ── Project List Item ─────────────────────────────────────────────────────────

function ProjectListCard({
  project,
  isSelected,
  onClick,
}: {
  project: ProjectListItem;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-4 py-3 border-b border-border transition-all duration-150 hover:bg-accent/30 group"
      style={{
        backgroundColor: isSelected ? "rgba(245,158,11,0.08)" : undefined,
        borderLeftWidth: isSelected ? 3 : 0,
        borderLeftStyle: "solid",
        borderLeftColor: isSelected ? ACCENT : "transparent",
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-mono text-[10px] font-semibold text-muted-foreground flex-shrink-0">
            {project.job_number}
          </span>
          <StatusBadge status={project.status} />
        </div>
        {project.attachment_count > 0 && (
          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground flex-shrink-0">
            <Paperclip size={10} />
            {project.attachment_count}
          </span>
        )}
      </div>
      <p className="text-xs font-semibold text-foreground truncate leading-snug">
        {project.title || "Untitled RFQ"}
      </p>
      <p className="text-[10px] text-muted-foreground mt-0.5 truncate flex items-center gap-1">
        <User size={9} className="flex-shrink-0" />
        {project.sender_email || "Unknown sender"}
      </p>
      <p className="text-[10px] text-muted-foreground/70 mt-1">
        {formatDate(project.created_at)}
      </p>
    </button>
  );
}

// ── Skeleton Loader ───────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="px-4 py-3 border-b border-border animate-pulse">
      <div className="flex items-center gap-2 mb-1.5">
        <div className="h-3 w-20 bg-muted rounded" />
        <div className="h-3 w-12 bg-muted rounded-full" />
      </div>
      <div className="h-3.5 w-3/4 bg-muted rounded mb-1" />
      <div className="h-3 w-1/2 bg-muted rounded" />
    </div>
  );
}

// ── Drawing Preview Panel ─────────────────────────────────────────────────────

function DrawingPreview({ signedUrl, title }: { signedUrl: string | null; title: string | null }) {
  if (!signedUrl) {
    return (
      <div className="flex flex-col items-center justify-center h-40 border border-dashed border-border rounded-xl text-center">
        <FileText size={28} className="text-muted-foreground/30 mb-2" />
        <p className="text-xs text-muted-foreground">Drawing preview unavailable</p>
        <p className="text-[10px] text-muted-foreground/60 mt-0.5">No signed URL generated</p>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/20">
        <div className="flex items-center gap-2">
          <FileText size={13} style={{ color: ACCENT }} />
          <span className="text-xs font-semibold text-foreground truncate max-w-[200px]">
            {title || "Engineering Drawing"}
          </span>
        </div>
        <a
          href={signedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-[6px] border border-border hover:bg-accent transition-colors"
          style={{ color: ACCENT }}
        >
          <Download size={10} />
          Download
        </a>
      </div>
      <embed
        src={`${signedUrl}#toolbar=0&navpanes=0&scrollbar=0`}
        type="application/pdf"
        className="w-full h-72 bg-muted/10"
        title={title || "Engineering Drawing"}
      />
    </div>
  );
}

// ── Right Panel: Project Detail ───────────────────────────────────────────────

function ProjectDetailPanel({ projectId }: { projectId: string }) {
  const { data: project, loading, error } = useProjectDetail(projectId);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <RefreshCw size={20} className="animate-spin" style={{ color: ACCENT }} />
          <p className="text-sm">Loading project details…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <AlertCircle size={28} className="text-red-400 mx-auto mb-2" />
          <p className="text-sm font-semibold text-foreground mb-1">Failed to load project</p>
          <p className="text-xs text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (!project) return null;

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border bg-card sticky top-0 z-10">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-[11px] font-bold text-muted-foreground">
                {project.job_number}
              </span>
              <StatusBadge status={project.status} />
            </div>
            <h2 className="text-sm font-bold text-foreground leading-tight truncate">
              {project.title || "Untitled RFQ"}
            </h2>
          </div>
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5">
          {[
            { icon: User,     label: project.email?.sender_email ?? "—" },
            { icon: Calendar, label: formatDate(project.created_at) },
            { icon: Hash,     label: project.priority ?? "MEDIUM" },
          ].map(({ icon: Icon, label }) => (
            <span key={label} className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Icon size={10} className="flex-shrink-0" />
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Email Body */}
        {project.email && (
          <section>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-2.5">
              Email Content
            </p>
            <div className="border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-muted/20 border-b border-border">
                <p className="text-xs font-semibold text-foreground">
                  {project.email.subject || "(No subject)"}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  From: {project.email.sender_email} · {formatDate(project.email.received_at)}
                </p>
              </div>
              <div
                className="px-4 py-3 text-xs text-foreground leading-relaxed max-h-48 overflow-y-auto"
                style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
              >
                {project.email.body
                  ? project.email.body.replace(/<[^>]+>/g, "")
                  : project.email.body_preview || "(Empty body)"}
              </div>
            </div>
          </section>
        )}

        {/* Drawing Preview */}
        {project.drawing && (
          <section>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-2.5">
              Engineering Drawing
            </p>
            <DrawingPreview
              signedUrl={project.drawing.signed_url}
              title={project.drawing.drawing_title}
            />
            {project.drawing.drawing_number && (
              <p className="text-[10px] text-muted-foreground mt-1.5 font-mono">
                Drawing No: {project.drawing.drawing_number}
              </p>
            )}
          </section>
        )}

        {/* Attachments */}
        {project.files.length > 0 && (
          <section>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-2.5">
              Attachments ({project.files.length})
            </p>
            <div className="space-y-2">
              {project.files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center gap-3 p-3 border border-border rounded-[10px] hover:bg-accent/20 transition-colors"
                >
                  <div
                    className="w-8 h-8 rounded-[7px] flex items-center justify-center flex-shrink-0"
                    style={{
                      backgroundColor:
                        file.mime_type?.includes("pdf") ? "rgba(245,158,11,0.12)" : "rgba(100,116,139,0.1)",
                    }}
                  >
                    <FileText
                      size={14}
                      style={{ color: file.mime_type?.includes("pdf") ? ACCENT : "#64748B" }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">
                      {file.original_name || "Unknown file"}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {file.mime_type} · {formatBytes(file.file_size)} · v{file.current_version}
                    </p>
                  </div>
                  <span
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                    style={{
                      backgroundColor: file.status === "AVAILABLE" ? "rgba(34,197,94,0.1)" : "rgba(245,158,11,0.1)",
                      color: file.status === "AVAILABLE" ? "#22C55E" : ACCENT,
                    }}
                  >
                    {file.status}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Empty state */}
        {!project.email && !project.drawing && project.files.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Inbox size={32} className="text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No content available for this project</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function FoundryEmailHub() {
  const { dark } = useOutletContext<FoundryLayoutContext>();
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, loading, error, refetch } = useProjectList(page, 20);

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      {/* Page Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-5 h-14 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <div
            className="w-7 h-7 rounded-[8px] flex items-center justify-center"
            style={{ backgroundColor: "rgba(245,158,11,0.12)" }}
          >
            <Mail size={14} style={{ color: ACCENT }} />
          </div>
          <div>
            <h1 className="text-sm font-bold text-foreground leading-tight">Foundry Email Hub</h1>
            <p className="text-[10px] text-muted-foreground">
              {data ? `${data.total} RFQ project${data.total !== 1 ? "s" : ""} received` : "Loading…"}
            </p>
          </div>
        </div>
        <button
          onClick={refetch}
          disabled={loading}
          className="w-7 h-7 flex items-center justify-center rounded-[7px] border border-border text-muted-foreground hover:bg-accent transition-all"
          title="Refresh"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Body: Two-pane layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel — Project List */}
        <aside className="flex-shrink-0 w-72 border-r border-border overflow-y-auto flex flex-col">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
          ) : error ? (
            <div className="flex flex-col items-center justify-center flex-1 p-6 text-center">
              <AlertCircle size={24} className="text-red-400 mb-2" />
              <p className="text-xs text-muted-foreground">{error}</p>
              <button
                onClick={refetch}
                className="mt-3 text-xs font-medium px-3 py-1.5 rounded-[7px] border border-border hover:bg-accent"
                style={{ color: ACCENT }}
              >
                Retry
              </button>
            </div>
          ) : data?.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 p-6 text-center">
              <Inbox size={32} className="text-muted-foreground/30 mb-3" />
              <p className="text-sm font-semibold text-foreground mb-1">No projects yet</p>
              <p className="text-[11px] text-muted-foreground">
                Projects appear here when n8n ingests an Outlook email for Foundry
              </p>
            </div>
          ) : (
            <>
              {data?.items.map((project) => (
                <ProjectListCard
                  key={project.id}
                  project={project}
                  isSelected={project.id === selectedId}
                  onClick={() => setSelectedId(project.id)}
                />
              ))}

              {/* Pagination */}
              {data && (data.total > 20 || page > 1) && (
                <div className="flex items-center justify-between px-4 py-2.5 border-t border-border flex-shrink-0">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="text-[10px] font-medium px-2.5 py-1 rounded-[6px] border border-border disabled:opacity-40 hover:bg-accent transition-all"
                  >
                    Prev
                  </button>
                  <span className="text-[10px] text-muted-foreground">Page {page}</span>
                  <button
                    disabled={!data.has_next}
                    onClick={() => setPage((p) => p + 1)}
                    className="text-[10px] font-medium px-2.5 py-1 rounded-[6px] border border-border disabled:opacity-40 hover:bg-accent transition-all"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </aside>

        {/* Right Panel — Project Detail */}
        <div className="flex-1 flex flex-col overflow-hidden bg-background">
          {selectedId ? (
            <ProjectDetailPanel projectId={selectedId} />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                style={{ backgroundColor: "rgba(245,158,11,0.12)" }}
              >
                <Eye size={28} style={{ color: ACCENT }} />
              </div>
              <h3 className="text-sm font-semibold text-foreground mb-1">Select a Project</h3>
              <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
                Click any project from the list to view its email content,
                engineering drawing preview, and attachment details.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
