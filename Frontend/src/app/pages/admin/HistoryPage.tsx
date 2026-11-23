import { useState, useEffect, useMemo, useCallback } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Search, Download, Filter, Calendar, FolderPlus, Mail, FileUp, Sparkles,
  CheckCircle2, PenTool, FileSpreadsheet, ArrowRight, ClipboardList,
  MessageSquare, LogIn, UserPen, Clock, X, FileText, ExternalLink,
  ChevronDown, RefreshCw, Eye, AlertTriangle, Shield, Settings as SettingsIcon,
  ChevronLeft, ChevronRight, Building2,
} from "lucide-react";
import AdminDrawer from "@/app/components/admin/AdminDrawer";
import { adminApi, AdminHistoryItem, AdminHistoryResponse } from "@/app/services/admin";
import type { AdminDepartmentItem } from "@/app/services/admin";
import { getDeptColor, getUserAvatarColor } from "@/app/types/admin";

// ── Config ────────────────────────────────────────────────────────────────
const TYPE_CONFIG: Record<string, { icon: LucideIcon; label: string; color: string; bg: string }> = {
  "project_created":   { icon: FolderPlus,      label: "Project Created",    color: "#F5821F", bg: "rgba(245,130,31,0.12)"  },
  "project_updated":   { icon: FolderPlus,      label: "Project Updated",    color: "#3B82F6", bg: "rgba(59,130,246,0.12)"  },
  "email_received":    { icon: Mail,             label: "Email Received",     color: "#3B82F6", bg: "rgba(59,130,246,0.12)"  },
  "drawing_uploaded":  { icon: FileUp,           label: "Drawing Uploaded",   color: "#6366F1", bg: "rgba(99,102,241,0.12)"  },
  "ai_completed":      { icon: Sparkles,         label: "AI Completed",       color: "#8B5CF6", bg: "rgba(139,92,246,0.12)"  },
  "human_reviewed":    { icon: CheckCircle2,     label: "Human Review",       color: "#22C55E", bg: "rgba(34,197,94,0.12)"   },
  "workspace_updated": { icon: PenTool,          label: "Workspace Updated",  color: "#3B82F6", bg: "rgba(59,130,246,0.12)"  },
  "excel_generated":   { icon: FileSpreadsheet,  label: "Excel Generated",    color: "#10B981", bg: "rgba(16,185,129,0.12)"  },
  "dept_transfer":     { icon: ArrowRight,       label: "Dept. Transfer",     color: "#F59E0B", bg: "rgba(245,158,11,0.12)"  },
  "task_assigned":     { icon: ClipboardList,    label: "Task Assigned",      color: "#6366F1", bg: "rgba(99,102,241,0.12)"  },
  "task_completed":    { icon: CheckCircle2,     label: "Task Completed",     color: "#22C55E", bg: "rgba(34,197,94,0.12)"   },
  "comment_added":     { icon: MessageSquare,    label: "Comment Added",      color: "#8B5CF6", bg: "rgba(139,92,246,0.12)"  },
  "user_login":        { icon: LogIn,            label: "User Login",         color: "#6B7280", bg: "rgba(107,114,128,0.12)" },
  "security_event":    { icon: Shield,           label: "Security Event",     color: "#EF4444", bg: "rgba(239,68,68,0.12)"   },
  "setting_changed":   { icon: SettingsIcon,     label: "Setting Changed",    color: "#F5821F", bg: "rgba(245,130,31,0.12)"  },
};

const DEFAULT_TYPE_CONFIG = { icon: Clock, label: "Activity", color: "#6B7280", bg: "rgba(107,114,128,0.12)" };

const SEVERITY_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  INFO:     { label: "INFO",     color: "#3B82F6", bg: "rgba(59,130,246,0.12)" },
  WARNING:  { label: "WARNING",  color: "#F59E0B", bg: "rgba(245,158,11,0.12)"  },
  ERROR:    { label: "ERROR",    color: "#EF4444", bg: "rgba(239,68,68,0.12)"   },
  CRITICAL: { label: "CRITICAL", color: "#DC2626", bg: "rgba(220,38,38,0.16)"   },
};

const MODULE_OPTIONS = ["All Modules", "Projects", "Drawings", "AI Pipeline", "Reviews", "Kanban", "Security", "System"];
const SEVERITY_OPTIONS = ["All Severities", "INFO", "WARNING", "ERROR", "CRITICAL"];
const DATE_RANGES = ["All Dates", "Today", "Yesterday"];

// ── Activity Card ─────────────────────────────────────────────────────────
function ActivityCard({ activity, isLast, onSelect, selected }: {
  activity: AdminHistoryItem;
  isLast: boolean;
  onSelect: () => void;
  selected: boolean;
}) {
  const cfg  = TYPE_CONFIG[activity.event_type] || DEFAULT_TYPE_CONFIG;
  const sty  = SEVERITY_STYLE[activity.severity] || SEVERITY_STYLE.INFO;
  const Icon = cfg.icon;
  const userColor = getUserAvatarColor(activity.user_initials || "SY");

  return (
    <div className="flex gap-3">
      {/* Timeline spine */}
      <div className="flex flex-col items-center flex-shrink-0">
        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border-2 border-card shadow-sm"
          style={{ backgroundColor: cfg.bg, borderColor: cfg.color + "30" }}>
          <Icon size={14} style={{ color: cfg.color }} />
        </div>
        {!isLast && <div className="w-px flex-1 mt-1.5 mb-0 min-h-[1.5rem]" style={{ backgroundColor: "var(--border)" }} />}
      </div>

      {/* Card */}
      <div
        onClick={onSelect}
        className={`flex-1 mb-3 rounded-[10px] border p-3 cursor-pointer transition-all hover:shadow-sm group
          ${selected ? "border-primary/40 bg-primary/[0.03]" : "border-border bg-card hover:border-border/80 hover:bg-accent/10"}`}
        style={selected ? { borderColor: "#F5821F55" } : {}}
      >
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ color: cfg.color, backgroundColor: cfg.bg }}>{cfg.label}</span>
            <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full" style={{ color: sty.color, backgroundColor: sty.bg }}>{sty.label}</span>
            <span className="text-[9px] font-mono text-muted-foreground uppercase px-1.5 py-0.5 rounded bg-muted/30">{activity.module}</span>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Clock size={10} className="text-muted-foreground/60" />
            <span className="text-[10px] text-muted-foreground">{activity.timestamp}</span>
          </div>
        </div>

        <p className="text-xs font-semibold text-foreground mb-1 leading-snug">{activity.description}</p>

        <div className="flex items-center gap-3 flex-wrap mt-2">
          {/* User */}
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white" style={{ backgroundColor: userColor }}>{activity.user_initials}</div>
            <span className="text-[10px] font-medium text-muted-foreground">{activity.user}</span>
          </div>
          {/* Dept */}
          <span className="text-[10px] font-semibold" style={{ color: getDeptColor(activity.department) }}>{activity.department}</span>
          {/* Job # */}
          {activity.job_number && (
            <span className="font-mono text-[10px] text-muted-foreground/70">{activity.job_number}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Activity Drawer ───────────────────────────────────────────────────────
function ActivityDrawer({ activityId, onClose }: { activityId: string | null; onClose: () => void }) {
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!activityId) {
      setDetail(null);
      return;
    }
    setLoading(true);
    adminApi.getHistoryDetail(activityId)
      .then(res => setDetail(res))
      .catch(err => console.error("Failed to load activity detail:", err))
      .finally(() => setLoading(false));
  }, [activityId]);

  if (!activityId) return null;

  const cfg  = detail ? (TYPE_CONFIG[detail.event_type] || DEFAULT_TYPE_CONFIG) : DEFAULT_TYPE_CONFIG;
  const sty  = detail ? (SEVERITY_STYLE[detail.severity] || SEVERITY_STYLE.INFO) : SEVERITY_STYLE.INFO;
  const Icon = cfg.icon;
  const userColor = getUserAvatarColor("SY");

  const badge = detail ? (
    <>
      <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ color: cfg.color, backgroundColor: cfg.bg }}>{cfg.label}</span>
      <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full" style={{ color: sty.color, backgroundColor: sty.bg }}>{sty.label}</span>
    </>
  ) : null;

  return (
    <AdminDrawer
      open={!!activityId}
      onClose={onClose}
      width={460}
      title={detail ? detail.event_type : "Loading activity…"}
      subtitle={detail ? `${detail.module.toUpperCase()} · ${detail.created_at || ""}` : ""}
      badge={badge}
    >
      {loading ? (
        <div className="p-10 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
          <RefreshCw size={14} className="animate-spin" />Loading event payload…
        </div>
      ) : detail ? (
        <div className="p-5 space-y-5">
          {/* Header */}
          <div className="flex gap-3">
            <div className="w-9 h-9 rounded-[10px] flex items-center justify-center flex-shrink-0" style={{ backgroundColor: cfg.bg }}>
              <Icon size={18} style={{ color: cfg.color }} />
            </div>
            <div>
              <p className="text-xs font-bold text-foreground leading-snug">{detail.description}</p>
              <p className="text-[10px] font-mono text-muted-foreground mt-1">ID: {detail.id}</p>
            </div>
          </div>

          {/* User Details */}
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2.5">User & Dept Context</p>
            <div className="flex items-center gap-3 p-3 rounded-[10px] border border-border bg-muted/10">
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ backgroundColor: userColor }}>
                {detail.user ? detail.user.substring(0, 2).toUpperCase() : "SY"}
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">{detail.user}</p>
                <p className="text-[10px] font-medium mt-0.5" style={{ color: getDeptColor(detail.department) }}>{detail.department}</p>
              </div>
            </div>
          </div>

          {/* Entity Details */}
          {detail.entity_name && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2.5">Entity Affected</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 p-3 rounded-[10px] border border-border bg-card">
                <div>
                  <p className="text-[10px] text-muted-foreground">Entity Name</p>
                  <p className="text-xs font-semibold text-foreground mt-0.5">{detail.entity_name}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Entity ID</p>
                  <p className="text-xs font-mono text-foreground mt-0.5 truncate">{detail.entity_id || "—"}</p>
                </div>
                {detail.job_number && (
                  <div>
                    <p className="text-[10px] text-muted-foreground">Job Number</p>
                    <p className="text-xs font-mono font-semibold text-foreground mt-0.5">{detail.job_number}</p>
                  </div>
                )}
                {detail.project_title && (
                  <div>
                    <p className="text-[10px] text-muted-foreground">Project Title</p>
                    <p className="text-xs font-semibold text-foreground mt-0.5 truncate">{detail.project_title}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* JSON Diff Payload */}
          {(detail.old_data || detail.new_data) && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2.5">JSON Payload Diff</p>
              <div className="space-y-2">
                {detail.old_data && (
                  <div className="p-3 rounded-[8px] border border-red-200 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/10">
                    <p className="text-[9px] font-bold uppercase tracking-wide text-red-500 mb-1">Old Values</p>
                    <pre className="text-[10px] text-foreground font-mono leading-relaxed overflow-x-auto">{JSON.stringify(detail.old_data, null, 2)}</pre>
                  </div>
                )}
                {detail.new_data && (
                  <div className="p-3 rounded-[8px] border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/10">
                    <p className="text-[9px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400 mb-1">New Values</p>
                    <pre className="text-[10px] text-foreground font-mono leading-relaxed overflow-x-auto">{JSON.stringify(detail.new_data, null, 2)}</pre>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      ) : null}
    </AdminDrawer>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────
export default function HistoryPage() {
  const [search, setSearch]           = useState("");
  const [moduleFilter, setModule]     = useState("All Modules");
  const [severityFilter, setSev]      = useState("All Severities");
  const [dateRange, setDateRange]     = useState("All Dates");
  const [deptFilter, setDeptFilter]   = useState("");  // department_id UUID or ""
  const [page, setPage]               = useState(1);
  const PAGE_SIZE = 25;

  // Load departments for the filter dropdown
  const [depts, setDepts] = useState<AdminDepartmentItem[]>([]);
  useEffect(() => {
    adminApi.getDepartments({ page_size: 50 })
      .then(res => setDepts(res.items))
      .catch(() => {});
  }, []);

  const [response, setResponse]     = useState<AdminHistoryResponse | null>(null);
  const [loading, setLoading]       = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getHistory({
        search: search.trim() || undefined,
        module: moduleFilter !== "All Modules" ? moduleFilter : undefined,
        severity: severityFilter !== "All Severities" ? severityFilter : undefined,
        date_range: dateRange !== "All Dates" ? dateRange : undefined,
        department_id: deptFilter || undefined,
        page,
        page_size: PAGE_SIZE,
      });
      setResponse(res);
    } catch (err) {
      console.error("Failed to load history:", err);
    } finally {
      setLoading(false);
    }
  }, [search, moduleFilter, severityFilter, dateRange, deptFilter, page]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Reset to page 1 whenever any filter changes
  const handleFilterChange = useCallback((fn: () => void) => {
    setPage(1);
    fn();
  }, []);

  const stats    = response?.statistics;
  const items    = response?.items || [];
  const total    = response?.total ?? 0;
  const pages    = response?.pages ?? 1;

  const grouped = useMemo(() => {
    const map: Record<string, AdminHistoryItem[]> = {};
    items.forEach(a => {
      const g = a.date_group || "Earlier";
      if (!map[g]) map[g] = [];
      map[g].push(a);
    });
    return Object.entries(map).map(([date, groupItems]) => ({ date, items: groupItems }));
  }, [items]);

  const activeFilters = [
    moduleFilter !== "All Modules",
    severityFilter !== "All Severities",
    dateRange !== "All Dates",
    !!search.trim(),
    !!deptFilter,
  ].filter(Boolean).length;

  const exportUrl = adminApi.getExportHistoryUrl({
    search: search.trim() || undefined,
    module: moduleFilter !== "All Modules" ? moduleFilter : undefined,
    severity: severityFilter !== "All Severities" ? severityFilter : undefined,
    date_range: dateRange !== "All Dates" ? dateRange : undefined,
    department_id: deptFilter || undefined,
  });

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="p-4 space-y-4">

        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-foreground">Global Activity Audit Trail</h1>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {response?.total ?? 0} total events logged · {stats?.today_activities ?? 0} today
            </p>
          </div>
          <a
            href={exportUrl}
            download="activity_history.csv"
            className="h-8 px-4 rounded-[8px] text-xs font-semibold border border-border text-foreground hover:bg-accent flex items-center gap-1.5 transition-all"
          >
            <Download size={13} />Export CSV
          </a>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-5 gap-3">
          {[
            { label: "Today's Activities",  value: stats?.today_activities ?? 0,   color: "#3B82F6", bg: "rgba(59,130,246,0.1)" },
            { label: "Total Activities",    value: stats?.total_activities ?? 0,   color: "#F5821F", bg: "rgba(245,130,31,0.1)" },
            { label: "Active Users Today",  value: stats?.active_users_today ?? 0, color: "#22C55E", bg: "rgba(34,197,94,0.1)"  },
            { label: "AI Jobs Today",       value: stats?.ai_processing_jobs ?? 0, color: "#8B5CF6", bg: "rgba(139,92,246,0.1)" },
            { label: "Security Events",     value: stats?.security_events ?? 0,    color: "#EF4444", bg: "rgba(239,68,68,0.1)"  },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-[9px] flex items-center justify-center flex-shrink-0" style={{ backgroundColor: bg }}>
                <Clock size={15} style={{ color }} />
              </div>
              <div>
                <p className="text-[9px] text-muted-foreground uppercase tracking-wide font-medium">{label}</p>
                <p className="text-lg font-bold text-foreground leading-tight">{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="search" placeholder="Search events, users, job #…"
              value={search} onChange={e => handleFilterChange(() => setSearch(e.target.value))}
              className="w-full h-7 pl-7 pr-3 rounded-[7px] text-xs bg-input-background border border-border text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary/50 transition-all"
            />
          </div>

          {/* Department filter */}
          <select
            value={deptFilter}
            onChange={e => handleFilterChange(() => setDeptFilter(e.target.value))}
            className="h-7 px-2.5 rounded-[7px] text-xs border border-border bg-input-background text-foreground focus:outline-none cursor-pointer"
          >
            <option value="">All Departments</option>
            {depts.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>

          <select value={dateRange} onChange={e => handleFilterChange(() => setDateRange(e.target.value))}
            className="h-7 px-2.5 rounded-[7px] text-xs border border-border bg-input-background text-foreground focus:outline-none cursor-pointer">
            {DATE_RANGES.map(o => <option key={o}>{o}</option>)}
          </select>

          <select value={moduleFilter} onChange={e => handleFilterChange(() => setModule(e.target.value))}
            className="h-7 px-2.5 rounded-[7px] text-xs border border-border bg-input-background text-foreground focus:outline-none cursor-pointer">
            {MODULE_OPTIONS.map(o => <option key={o}>{o}</option>)}
          </select>

          <select value={severityFilter} onChange={e => handleFilterChange(() => setSev(e.target.value))}
            className="h-7 px-2.5 rounded-[7px] text-xs border border-border bg-input-background text-foreground focus:outline-none cursor-pointer">
            {SEVERITY_OPTIONS.map(o => <option key={o}>{o}</option>)}
          </select>

          {activeFilters > 0 && (
            <button onClick={() => { setSearch(""); setModule("All Modules"); setSev("All Severities"); setDateRange("All Dates"); setDeptFilter(""); setPage(1); }}
              className="h-7 px-2.5 rounded-[7px] text-xs font-medium text-red-500 border border-red-200 dark:border-red-900/40 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-1 transition-all">
              <X size={11} />Clear ({activeFilters})
            </button>
          )}

          <div className="ml-auto text-[11px] text-muted-foreground flex items-center gap-2">
            {loading && <RefreshCw size={12} className="animate-spin text-primary" />}
            {total} total events
          </div>
        </div>

        {/* Timeline */}
        {loading && items.length === 0 ? (
          <div className="bg-card border border-border rounded-xl py-16 flex flex-col items-center justify-center text-center">
            <RefreshCw size={24} className="animate-spin text-primary mb-3" />
            <p className="text-xs font-medium text-muted-foreground">Fetching activity feed from database…</p>
          </div>
        ) : grouped.length === 0 ? (
          <div className="bg-card border border-border rounded-xl py-16 flex flex-col items-center justify-center text-center">
            <Filter size={28} className="text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No activities match your criteria.</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Adjust filters or search string above.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {grouped.map(({ date, items: dayItems }) => (
              <div key={date}>
                {/* Date group header */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <Calendar size={12} className="text-muted-foreground" />
                    <span className="text-xs font-bold text-foreground">{date}</span>
                  </div>
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-[10px] font-medium text-muted-foreground px-2 py-0.5 rounded-full bg-muted">{dayItems.length} events</span>
                </div>

                {/* Activity cards */}
                <div className="pl-2">
                  {dayItems.map((activity, i) => (
                    <ActivityCard
                      key={activity.id}
                      activity={activity}
                      isLast={i === dayItems.length - 1}
                      onSelect={() => setSelectedId(activity.id)}
                      selected={selectedId === activity.id}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between py-3 px-1">
            <span className="text-[11px] text-muted-foreground">
              Page {page} of {pages} · {total} events
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="w-7 h-7 flex items-center justify-center rounded-[6px] border border-border text-muted-foreground hover:bg-accent disabled:opacity-40 transition-all"
              >
                <ChevronLeft size={13} />
              </button>
              {Array.from({ length: Math.min(pages, 7) }, (_, i) => {
                const p = pages <= 7 ? i + 1 : i < 3 ? i + 1 : i >= 4 ? pages - (6 - i) : page;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-7 h-7 flex items-center justify-center rounded-[6px] text-xs font-medium transition-all ${
                      p === page ? "text-white" : "border border-border text-muted-foreground hover:bg-accent"
                    }`}
                    style={p === page ? { backgroundColor: "#F5821F" } : {}}
                  >{p}</button>
                );
              })}
              <button
                onClick={() => setPage(p => Math.min(pages, p + 1))}
                disabled={page >= pages || loading}
                className="w-7 h-7 flex items-center justify-center rounded-[6px] border border-border text-muted-foreground hover:bg-accent disabled:opacity-40 transition-all"
              >
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        )}

      </div>

      <ActivityDrawer activityId={selectedId} onClose={() => setSelectedId(null)} />
    </main>
  );
}
