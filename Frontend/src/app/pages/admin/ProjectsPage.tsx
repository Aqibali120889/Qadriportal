/**
 * admin/ProjectsPage.tsx
 * Phase 11.1 — Live-data Projects Management page.
 *
 * All data from GET /api/v1/admin/projects.
 * Supports: search (debounced), status/dept filter, sort, pagination.
 * Project detail drawer shows real project data.
 * No mock data.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  FolderOpen, Plus, Search, SortAsc, MoreHorizontal,
  ExternalLink, Archive, Eye, GitBranch, CheckCircle2, Clock,
  AlertCircle, FileText, ChevronLeft, ChevronRight, Download, Pencil,
  RefreshCw, X,
} from "lucide-react";
import AdminDrawer from "@/app/components/admin/AdminDrawer";
import { STATUS_COLORS, getDeptColor } from "@/app/types/admin";
import type { ProjectStatus } from "@/app/types/admin";
import { adminApi } from "@/app/services/admin";
import type { AdminProjectItem, AdminProjectsParams } from "@/app/services/admin";

// ── Helpers ───────────────────────────────────────────────────────────────────
function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-muted rounded ${className}`} />;
}

function toFrontendStatus(s: string): ProjectStatus {
  const map: Record<string, ProjectStatus> = {
    DRAFT: "new", ACTIVE: "in-progress", ON_HOLD: "pending",
    COMPLETED: "completed", CANCELLED: "delayed",
  };
  return map[s?.toUpperCase()] ?? "new";
}

// ── Small helpers ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const fs = toFrontendStatus(status);
  const c = STATUS_COLORS[fs] ?? "#6B7280";
  const label = (fs).replace("-", " ").replace(/\b\w/g, s => s.toUpperCase());
  return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color: c, backgroundColor: c + "18" }}>{label}</span>;
}

function PriorityBadge({ priority }: { priority: string }) {
  const colors: Record<string, string> = { critical: "#EF4444", high: "#F97316", medium: "#F59E0B", low: "#6B7280" };
  const c = colors[priority?.toLowerCase()] ?? "#6B7280";
  return <span className="text-[10px] font-semibold capitalize" style={{ color: c }}>● {priority || "medium"}</span>;
}

function ProgressBar({ pct, status }: { pct: number; status: string }) {
  const fs = toFrontendStatus(status);
  const c = STATUS_COLORS[fs] ?? "#6B7280";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: c }} />
      </div>
      <span className="text-[10px] text-muted-foreground w-6 text-right">{pct}%</span>
    </div>
  );
}

// ── KPI Row ───────────────────────────────────────────────────────────────────
function KPIRow({ total, active, pending, completed, cancelled, loading }: {
  total: number; active: number; pending: number; completed: number; cancelled: number; loading: boolean;
}) {
  const cards = [
    { label: "Total Projects",   value: total,     icon: FolderOpen,   color: "#F5821F", bg: "rgba(245,130,31,0.1)"  },
    { label: "In Progress",      value: active,    icon: Clock,        color: "#3B82F6", bg: "rgba(59,130,246,0.1)"  },
    { label: "Pending / Review", value: pending,   icon: AlertCircle,  color: "#F59E0B", bg: "rgba(245,158,11,0.1)"  },
    { label: "Completed",        value: completed, icon: CheckCircle2, color: "#22C55E", bg: "rgba(34,197,94,0.1)"   },
    { label: "Cancelled",        value: cancelled, icon: AlertCircle,  color: "#EF4444", bg: "rgba(239,68,68,0.1)"   },
  ];
  return (
    <div className="grid grid-cols-5 gap-3">
      {cards.map(({ label, value, icon: Icon, color, bg }) => (
        <div key={label} className="bg-card border border-border rounded-xl p-3.5 flex items-center gap-3">
          <div className="w-8 h-8 rounded-[8px] flex items-center justify-center flex-shrink-0" style={{ backgroundColor: bg }}>
            <Icon size={14} style={{ color }} />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">{label}</p>
            {loading ? <Skeleton className="h-5 w-8 mt-0.5" /> : <p className="text-lg font-bold text-foreground leading-tight">{value}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Project Drawer ────────────────────────────────────────────────────────────
function ProjectDrawer({ project, onClose }: { project: AdminProjectItem | null; onClose: () => void }) {
  const [tab, setTab] = useState<"info" | "activity">("info");
  const [timeline, setTimeline] = useState<any[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

  useEffect(() => {
    if (tab === "activity" && project) {
      setTimelineLoading(true);
      adminApi.getProjectHistory(project.id)
        .then(res => setTimeline(res.items || []))
        .catch(err => console.error("Failed to load project timeline:", err))
        .finally(() => setTimelineLoading(false));
    }
  }, [tab, project]);

  if (!project) return null;

  const sc = STATUS_COLORS[toFrontendStatus(project.status)] ?? "#6B7280";
  const badge = (
    <>
      <StatusBadge status={project.status} />
      <PriorityBadge priority={project.priority} />
      <span className="font-mono text-[10px] text-muted-foreground">{project.job_number}</span>
    </>
  );

  const tabs = [
    { id: "info"     as const, label: "Info"     },
    { id: "activity" as const, label: "Timeline"  },
  ];

  const customerDisplay = project.customer_name || project.contact_person || project.customer_email || "Unknown customer";

  const fields = [
    { label: "Job Number",     value: project.job_number,     mono: true },
    { label: "RFQ Number",     value: project.rfq_number || "—" },
    { label: "Company",        value: project.customer_name || "—" },
    { label: "Contact Person", value: project.contact_person || "—" },
    { label: "Department",     value: project.department || "—", isDept: true },
    { label: "Priority",       value: project.priority || "medium" },
    { label: "Created",        value: project.created_at ? new Date(project.created_at).toLocaleDateString() : "—" },
    { label: "Last Updated",   value: project.updated_at ? new Date(project.updated_at).toLocaleDateString() : "—" },
  ];

  const MODULE_COLORS: Record<string, string> = {
    "AI Pipeline": "#8B5CF6",
    "Reviews":     "#22C55E",
    "Projects":    "#F5821F",
    "Drawings":    "#6366F1",
    "Kanban":      "#3B82F6",
    "System":      "#6B7280",
  };

  return (
    <AdminDrawer
      open={!!project}
      onClose={onClose}
      width={460}
      title={project.title}
      subtitle={`${customerDisplay} · ${project.department || "No department"}`}
      badge={badge}
      footer={
        <div className="flex items-center gap-2">
          <button className="flex-1 h-8 rounded-[8px] text-xs font-semibold text-white flex items-center justify-center gap-1.5" style={{ backgroundColor: "#F5821F" }}>
            <ExternalLink size={12} />Open Workspace
          </button>
          <button className="h-8 px-3 rounded-[8px] text-xs font-medium border border-border text-foreground hover:bg-accent flex items-center gap-1.5">
            <Download size={12} />Export
          </button>
        </div>
      }
    >
      <div className="flex border-b border-border px-5 gap-0">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors ${tab === t.id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            style={tab === t.id ? { borderBottomColor: "#F5821F" } : {}}
          >{t.label}</button>
        ))}
      </div>

      <div className="p-5 space-y-5">
        {tab === "info" && (
          <>
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2.5">Project Information</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                {fields.map(({ label, value, mono, isDept }) => (
                  <div key={label}>
                    <p className="text-[10px] text-muted-foreground">{label}</p>
                    {isDept
                      ? <p className="text-xs font-semibold mt-0.5" style={{ color: getDeptColor(value) }}>{value}</p>
                      : mono
                      ? <p className="text-xs font-mono font-semibold text-foreground mt-0.5">{value}</p>
                      : <p className="text-xs font-semibold text-foreground mt-0.5 capitalize">{value}</p>
                    }
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Overall Progress</p>
                <span className="text-xs font-bold" style={{ color: sc }}>{project.progress}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${project.progress}%`, backgroundColor: sc }} />
              </div>
            </div>
          </>
        )}

        {tab === "activity" && (
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-3">Project Lifecycle Timeline</p>
            {timelineLoading ? (
              <div className="flex flex-col gap-2">
                {[1,2,3,4].map(i => <Skeleton key={i} className="h-12 rounded-[10px]" />)}
              </div>
            ) : timeline.length === 0 ? (
              <div className="py-10 text-center">
                <FileText size={24} className="mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-xs text-muted-foreground">No timeline events found for this project.</p>
                <p className="text-[10px] text-muted-foreground/60 mt-1">
                  Created: {project.created_at ? new Date(project.created_at).toLocaleString() : "—"}
                </p>
              </div>
            ) : (
              <div className="relative pl-5">
                <div className="absolute left-2 top-0 bottom-0 w-px bg-border" />
                {timeline.map((event, i) => {
                  const dotColor = MODULE_COLORS[event.module] ?? "#6B7280";
                  const when = event.created_at
                    ? new Date(event.created_at).toLocaleString("en-PK", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                    : "—";
                  return (
                    <div key={event.id} className="relative mb-4 last:mb-0">
                      <div
                        className="absolute -left-5 top-1 w-2 h-2 rounded-full border-2 border-card"
                        style={{ backgroundColor: dotColor }}
                      />
                      <div className="bg-card border border-border rounded-[9px] p-3">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span
                            className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full"
                            style={{ color: dotColor, backgroundColor: dotColor + "18" }}
                          >
                            {event.module}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">{when}</span>
                        </div>
                        <p className="text-xs font-medium text-foreground leading-snug">{event.description}</p>
                        {event.user && event.user !== "System" && (
                          <p className="text-[10px] text-muted-foreground mt-1">by {event.user}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </AdminDrawer>
  );
}

// ── Row Actions ───────────────────────────────────────────────────────────────
function RowActions({ project, onView }: { project: AdminProjectItem; onView: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative flex items-center gap-1">
      <button onClick={onView} className="w-6 h-6 flex items-center justify-center rounded-[5px] text-muted-foreground hover:bg-accent hover:text-foreground transition-all" title="View Details">
        <Eye size={11} />
      </button>
      <button className="w-6 h-6 flex items-center justify-center rounded-[5px] text-muted-foreground hover:bg-accent hover:text-foreground transition-all" title="Open Workspace">
        <ExternalLink size={11} />
      </button>
      <button onClick={() => setOpen(v => !v)} className="w-6 h-6 flex items-center justify-center rounded-[5px] text-muted-foreground hover:bg-accent hover:text-foreground transition-all">
        <MoreHorizontal size={11} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-7 z-40 w-40 bg-card border border-border rounded-[10px] shadow-[0_8px_24px_rgba(0,0,0,0.12)] py-1 overflow-hidden">
            {[
              { icon: GitBranch, label: "View Timeline" },
              { icon: Pencil,    label: "Edit Project" },
              { icon: Archive,   label: "Archive Project", danger: true },
            ].map(({ icon: Icon, label, danger }) => (
              <button key={label} onClick={() => setOpen(false)} className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors ${danger ? "text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30" : "text-foreground hover:bg-accent"}`}>
                <Icon size={12} className={danger ? "" : "text-muted-foreground"} />{label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Pagination ────────────────────────────────────────────────────────────────
function Pagination({ page, pages, total, pageSize, onPage }: {
  page: number; pages: number; total: number; pageSize: number; onPage: (p: number) => void;
}) {
  if (pages <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to   = Math.min(page * pageSize, total);
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-border text-[11px]">
      <span className="text-muted-foreground">Showing {from}–{to} of {total}</span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          className="w-7 h-7 flex items-center justify-center rounded-[6px] border border-border text-muted-foreground hover:bg-accent disabled:opacity-40 transition-all"
        >
          <ChevronLeft size={13} />
        </button>
        {Array.from({ length: Math.min(pages, 7) }, (_, i) => {
          const p = pages <= 7 ? i + 1 : i < 3 ? i + 1 : i >= 4 ? pages - (6 - i) : page;
          return (
            <button
              key={p}
              onClick={() => onPage(p)}
              className={`w-7 h-7 flex items-center justify-center rounded-[6px] text-xs font-medium transition-all ${p === page ? "text-white" : "border border-border text-muted-foreground hover:bg-accent"}`}
              style={p === page ? { backgroundColor: "#F5821F" } : {}}
            >{p}</button>
          );
        })}
        <button
          onClick={() => onPage(page + 1)}
          disabled={page >= pages}
          className="w-7 h-7 flex items-center justify-center rounded-[6px] border border-border text-muted-foreground hover:bg-accent disabled:opacity-40 transition-all"
        >
          <ChevronRight size={13} />
        </button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
const ALL_STATUSES = ["All Status", "DRAFT", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"];
const ALL_SORTS    = [
  { value: "created_at_desc", label: "Newest First" },
  { value: "created_at_asc",  label: "Oldest First" },
  { value: "updated_at_desc", label: "Recently Updated" },
  { value: "job_number_asc",  label: "Job Number A→Z" },
];

export default function ProjectsPage() {
  const [items,      setItems]      = useState<AdminProjectItem[]>([]);
  const [total,      setTotal]      = useState(0);
  const [pages,      setPages]      = useState(1);
  const [page,       setPage]       = useState(1);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [search,     setSearch]     = useState("");
  const [status,     setStatus]     = useState("All Status");
  const [sort,       setSort]       = useState("created_at_desc");
  const [selected,   setSelected]   = useState<AdminProjectItem | null>(null);

  // Stats aggregated from loaded data
  const active    = items.filter(p => p.status === "ACTIVE").length;
  const pending   = items.filter(p => p.status === "DRAFT" || p.status === "ON_HOLD").length;
  const completed = items.filter(p => p.status === "COMPLETED").length;
  const cancelled = items.filter(p => p.status === "CANCELLED").length;

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchProjects = useCallback(async (params: AdminProjectsParams) => {
    try {
      setLoading(true);
      setError(null);
      const res = await adminApi.getProjects(params);
      setItems(res.items);
      setTotal(res.total);
      setPages(res.pages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load projects");
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search + filter fetch
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchProjects({
        page,
        page_size: 20,
        search:  search || undefined,
        status:  status !== "All Status" ? status : undefined,
        sort,
      });
    }, search ? 350 : 0);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [page, search, status, sort, fetchProjects]);

  const handleSearchChange = (v: string) => { setSearch(v); setPage(1); };
  const handleStatusChange = (v: string) => { setStatus(v); setPage(1); };
  const handleSortChange   = (v: string) => { setSort(v);   setPage(1); };

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-foreground">Projects Management</h1>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {loading ? "Loading…" : `${total} total RFQs across all departments`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {error && <span className="text-[11px] text-red-500">{error}</span>}
            <button
              onClick={() => fetchProjects({ page, page_size: 20, search: search || undefined, status: status !== "All Status" ? status : undefined, sort })}
              className="w-7 h-7 flex items-center justify-center rounded-[7px] border border-border text-muted-foreground hover:bg-accent transition-all"
            >
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            </button>
            <button
              className="h-8 px-4 rounded-[8px] text-xs font-semibold text-white flex items-center gap-1.5 transition-all"
              style={{ backgroundColor: "#F5821F" }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#D9710E")}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = "#F5821F")}
            >
              <Plus size={13} />Create New Project
            </button>
          </div>
        </div>

        {/* KPI Row */}
        <KPIRow
          total={total}
          active={active}
          pending={pending}
          completed={completed}
          cancelled={cancelled}
          loading={loading}
        />

        {/* Toolbar */}
        <div className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="search"
              placeholder="Search job #, title, RFQ…"
              value={search}
              onChange={e => handleSearchChange(e.target.value)}
              className="w-full h-7 pl-7 pr-3 rounded-[7px] text-xs bg-input-background border border-border text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary/50 transition-all"
            />
            {search && (
              <button onClick={() => handleSearchChange("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X size={11} />
              </button>
            )}
          </div>

          <select
            value={status}
            onChange={e => handleStatusChange(e.target.value)}
            className="h-7 px-2.5 rounded-[7px] text-xs border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 cursor-pointer"
          >
            {ALL_STATUSES.map(o => <option key={o}>{o}</option>)}
          </select>

          <select
            value={sort}
            onChange={e => handleSortChange(e.target.value)}
            className="h-7 px-2.5 rounded-[7px] text-xs border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 cursor-pointer"
          >
            {ALL_SORTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          <div className="ml-auto flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span>{total} results</span>
          </div>
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  {["Job #", "Title", "Customer", "Department", "Status", "Progress", "Priority", "Updated", "Actions"].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i} className="border-b border-border">
                        {Array.from({ length: 9 }).map((__, j) => (
                          <td key={j} className="px-4 py-2.5"><div className="animate-pulse bg-muted rounded h-4 w-full" /></td>
                        ))}
                      </tr>
                    ))
                  : items.map((row, i) => (
                      <tr
                        key={row.id}
                        className={`border-b border-border last:border-0 hover:bg-accent/20 transition-colors cursor-pointer ${i % 2 === 1 ? "bg-muted/[0.06]" : ""} ${selected?.id === row.id ? "bg-primary/[0.04]" : ""}`}
                        onClick={() => setSelected(row)}
                      >
                        <td className="px-4 py-2.5"><span className="font-mono text-[11px] font-semibold text-muted-foreground whitespace-nowrap">{row.job_number}</span></td>
                        <td className="px-4 py-2.5 max-w-[200px]"><span className="font-medium text-foreground truncate block">{row.title}</span></td>
                        <td className="px-4 py-2.5 max-w-[140px]"><span className="text-[11px] text-muted-foreground truncate block">{row.customer_name || row.customer_email || "—"}</span></td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          {row.department
                            ? <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color: getDeptColor(row.department), backgroundColor: getDeptColor(row.department) + "18" }}>{row.department}</span>
                            : <span className="text-[10px] text-muted-foreground">—</span>
                          }
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap"><StatusBadge status={row.status} /></td>
                        <td className="px-4 py-2.5 w-28"><ProgressBar pct={row.progress} status={row.status} /></td>
                        <td className="px-4 py-2.5 whitespace-nowrap"><PriorityBadge priority={row.priority} /></td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <span className="text-[11px] text-muted-foreground">
                            {row.updated_at ? new Date(row.updated_at).toLocaleDateString() : "—"}
                          </span>
                        </td>
                        <td className="px-4 py-2.5" onClick={e => e.stopPropagation()}>
                          <RowActions project={row} onView={() => setSelected(row)} />
                        </td>
                      </tr>
                    ))
                }
                {!loading && items.length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-muted-foreground">No projects match your filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pages={pages} total={total} pageSize={20} onPage={setPage} />
        </div>
      </div>

      {selected && <ProjectDrawer project={selected} onClose={() => setSelected(null)} />}
    </main>
  );
}
