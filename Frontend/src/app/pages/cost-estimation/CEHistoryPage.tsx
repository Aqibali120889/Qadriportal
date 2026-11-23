import { useState, useMemo } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Search, Download, Calendar, FolderPlus, Mail, FileUp, Sparkles,
  CheckCircle2, PenTool, FileSpreadsheet, ArrowRight, ClipboardList,
  MessageSquare, LogIn, UserPen, Clock, X, FileText, ExternalLink,
  RefreshCw, Eye, Sun, Moon, Bell, ChevronDown, User, Settings, LogOut,
  AlertCircle, Inbox,
} from "lucide-react";
import { useOutletContext } from "react-router";
import AdminDrawer from "@/app/components/admin/AdminDrawer";
import type { CELayoutContext } from "@/app/layouts/CELayout";
import { useHistory } from "@/app/hooks/useHistory";
import type { HistoryItem } from "@/app/services/api";

// ── Types ─────────────────────────────────────────────────────────────────
type ActivityType =
  | "project-created" | "email-received"   | "drawing-uploaded"
  | "ai-completed"    | "ai-reviewed"      | "workspace-updated"
  | "excel-generated" | "excel-downloaded" | "dept-transfer"
  | "task-assigned"   | "task-completed"   | "comment-added"
  | "user-login"      | "profile-updated";

type ActivityStatus = "completed" | "pending" | "failed" | "info";

interface HistoryActivity {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  user: string;
  userInitials: string;
  userColor: string;
  department: string;
  jobNumber?: string;
  componentName?: string;
  customer?: string;
  timestamp: string;
  dateGroup: string;
  status: ActivityStatus;
  prevValue?: string;
  newValue?: string;
  attachments?: string[];
}

// ── Config ────────────────────────────────────────────────────────────────
const TYPE_CONFIG: Record<ActivityType, { icon: LucideIcon; label: string; color: string; bg: string }> = {
  "project-created":   { icon: FolderPlus,     label: "Project Created",   color: "#F5821F", bg: "rgba(245,130,31,0.12)"   },
  "email-received":    { icon: Mail,            label: "Email Received",    color: "#3B82F6", bg: "rgba(59,130,246,0.12)"   },
  "drawing-uploaded":  { icon: FileUp,          label: "Drawing Uploaded",  color: "#6366F1", bg: "rgba(99,102,241,0.12)"   },
  "ai-completed":      { icon: Sparkles,        label: "AI Completed",      color: "#8B5CF6", bg: "rgba(139,92,246,0.12)"   },
  "ai-reviewed":       { icon: CheckCircle2,    label: "AI Reviewed",       color: "#22C55E", bg: "rgba(34,197,94,0.12)"    },
  "workspace-updated": { icon: PenTool,         label: "Workspace Updated", color: "#3B82F6", bg: "rgba(59,130,246,0.12)"   },
  "excel-generated":   { icon: FileSpreadsheet, label: "Excel Generated",   color: "#10B981", bg: "rgba(16,185,129,0.12)"   },
  "excel-downloaded":  { icon: Download,        label: "Excel Downloaded",  color: "#0EA5E9", bg: "rgba(14,165,233,0.12)"   },
  "dept-transfer":     { icon: ArrowRight,      label: "Dept. Transfer",    color: "#F59E0B", bg: "rgba(245,158,11,0.12)"   },
  "task-assigned":     { icon: ClipboardList,   label: "Task Assigned",     color: "#6366F1", bg: "rgba(99,102,241,0.12)"   },
  "task-completed":    { icon: CheckCircle2,    label: "Task Completed",    color: "#22C55E", bg: "rgba(34,197,94,0.12)"    },
  "comment-added":     { icon: MessageSquare,   label: "Comment Added",     color: "#8B5CF6", bg: "rgba(139,92,246,0.12)"   },
  "user-login":        { icon: LogIn,           label: "User Login",        color: "#6B7280", bg: "rgba(107,114,128,0.12)"  },
  "profile-updated":   { icon: UserPen,         label: "Profile Updated",   color: "#F5821F", bg: "rgba(245,130,31,0.12)"   },
};

const STATUS_STYLE: Record<ActivityStatus, { label: string; color: string; bg: string }> = {
  completed: { label: "Completed", color: "#22C55E", bg: "rgba(34,197,94,0.12)"  },
  pending:   { label: "Pending",   color: "#F59E0B", bg: "rgba(245,158,11,0.12)" },
  failed:    { label: "Failed",    color: "#EF4444", bg: "rgba(239,68,68,0.12)"  },
  info:      { label: "Info",      color: "#3B82F6", bg: "rgba(59,130,246,0.12)" },
};

// ── Map API HistoryItem → local HistoryActivity ───────────────────────────
function apiItemToActivity(item: HistoryItem): HistoryActivity {
  const NOTIF_TYPE_MAP: Record<string, { type: ActivityType; status: ActivityStatus }> = {
    SUCCESS: { type: "task-completed",  status: "completed" },
    WARNING: { type: "task-assigned",   status: "pending"   },
    ERROR:   { type: "ai-completed",    status: "failed"    },
    TASK:    { type: "task-assigned",   status: "pending"   },
    INFO:    { type: "workspace-updated",status: "info"     },
  };
  const EVENT_MAP: Record<string, { type: ActivityType; status: ActivityStatus }> = {
    project_created:        { type: "project-created",   status: "completed" },
    project_updated:        { type: "workspace-updated", status: "info"      },
    project_status_changed: { type: "workspace-updated", status: "info"      },
    project_transferred:    { type: "dept-transfer",     status: "info"      },
    dept_transfer:          { type: "dept-transfer",     status: "info"      },
    ai_completed:           { type: "ai-completed",      status: "completed" },
    ai_cached:              { type: "ai-completed",      status: "info"      },
    human_review_completed: { type: "ai-reviewed",       status: "completed" },
    rfq_synchronized:       { type: "excel-generated",   status: "completed" },
    email_received:         { type: "email-received",    status: "info"      },
    drawing_uploaded:       { type: "drawing-uploaded",  status: "info"      },
    task_assigned:          { type: "task-assigned",     status: "pending"   },
    task_completed:         { type: "task-completed",    status: "completed" },
  };

  const key = item.event_type === "notification"
    ? (item.notification_type ?? "INFO")
    : item.event_type;
  const mapped = item.event_type === "notification"
    ? (NOTIF_TYPE_MAP[key] ?? { type: "workspace-updated" as ActivityType, status: "info" as ActivityStatus })
    : (EVENT_MAP[key]      ?? { type: "project-created"  as ActivityType, status: "completed" as ActivityStatus });

  const date = new Date(item.created_at);
  const today    = new Date(); today.setHours(0,0,0,0);
  const yest     = new Date(today); yest.setDate(yest.getDate() - 1);
  const itemDay  = new Date(date); itemDay.setHours(0,0,0,0);
  const dateGroup = itemDay.getTime() === today.getTime()   ? `Today · ${date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`
                  : itemDay.getTime() === yest.getTime()    ? `Yesterday · ${date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`
                  : date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  return {
    id:           item.id,
    type:         mapped.type,
    title:        item.title,
    description:  item.message ?? item.title,
    user:         "System",
    userInitials: "SY",
    userColor:    "#8B5CF6",
    department:   "Cost Estimation",
    jobNumber:    item.job_number ?? undefined,
    timestamp:    date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
    dateGroup,
    status:       mapped.status,
    newValue:     item.status ? `Status: ${item.status}` : undefined,
  };
}

const ALL_TYPES   = ["All Types", ...Array.from(new Set(Object.values(TYPE_CONFIG).map(v => v.label)))];
const DATE_RANGES = ["All Dates", "Today", "Yesterday", "Last 7 Days"];


// ── Activity Card ─────────────────────────────────────────────────────────
function ActivityCard({ activity, isLast, onSelect, selected }: {
  activity: HistoryActivity; isLast: boolean; onSelect: () => void; selected: boolean;
}) {
  const cfg  = TYPE_CONFIG[activity.type];
  const sty  = STATUS_STYLE[activity.status];
  const Icon = cfg.icon;
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center flex-shrink-0">
        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border-2 border-card shadow-sm"
          style={{ backgroundColor: cfg.bg, borderColor: cfg.color + "30" }}>
          <Icon size={14} style={{ color: cfg.color }} />
        </div>
        {!isLast && <div className="w-px flex-1 mt-1.5 min-h-[1.5rem]" style={{ backgroundColor: "var(--border)" }} />}
      </div>
      <div
        onClick={onSelect}
        className={`flex-1 mb-3 rounded-[10px] border p-3 cursor-pointer transition-all hover:shadow-sm ${selected ? "border-primary/40 bg-primary/[0.03]" : "border-border bg-card hover:bg-accent/10"}`}
        style={selected ? { borderColor: "#F5821F55" } : {}}
      >
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ color: cfg.color, backgroundColor: cfg.bg }}>{cfg.label}</span>
            <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full" style={{ color: sty.color, backgroundColor: sty.bg }}>{sty.label}</span>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Clock size={10} className="text-muted-foreground/60" />
            <span className="text-[10px] text-muted-foreground">{activity.timestamp}</span>
          </div>
        </div>
        <p className="text-xs font-semibold text-foreground mb-1 leading-snug">{activity.title}</p>
        <p className="text-[11px] text-muted-foreground leading-relaxed mb-2 line-clamp-2">{activity.description}</p>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white" style={{ backgroundColor: activity.userColor }}>{activity.userInitials}</div>
            <span className="text-[10px] font-medium text-muted-foreground">{activity.user}</span>
          </div>
          <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">{activity.department}</span>
          {activity.jobNumber && <span className="font-mono text-[10px] text-muted-foreground/70">{activity.jobNumber}</span>}
          {activity.attachments && activity.attachments.length > 0 && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 ml-auto"><FileText size={9} />{activity.attachments.length}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Activity Drawer ───────────────────────────────────────────────────────
function ActivityDrawer({ activity, onClose }: { activity: HistoryActivity | null; onClose: () => void }) {
  if (!activity) return null;
  const cfg  = TYPE_CONFIG[activity.type];
  const sty  = STATUS_STYLE[activity.status];
  const Icon = cfg.icon;

  return (
    <AdminDrawer
      open={!!activity} onClose={onClose} width={440}
      title={activity.title}
      subtitle={`${activity.dateGroup.split(" · ")[0]} · ${activity.timestamp}`}
      badge={
        <>
          <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ color: cfg.color, backgroundColor: cfg.bg }}>{cfg.label}</span>
          <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full" style={{ color: sty.color, backgroundColor: sty.bg }}>{sty.label}</span>
        </>
      }
      footer={
        activity.jobNumber ? (
          <div className="flex gap-2">
            <button className="flex-1 h-8 rounded-[8px] text-xs font-semibold text-white flex items-center justify-center gap-1.5" style={{ backgroundColor: "#F5821F" }}>
              <ExternalLink size={12} />Open Workspace
            </button>
            <button className="h-8 px-3 rounded-[8px] text-xs font-medium border border-border text-foreground hover:bg-accent flex items-center gap-1.5">
              <Eye size={12} />View Project
            </button>
          </div>
        ) : null
      }
    >
      <div className="p-5 space-y-5">
        <div className="flex gap-3">
          <div className="w-9 h-9 rounded-[10px] flex items-center justify-center flex-shrink-0" style={{ backgroundColor: cfg.bg }}>
            <Icon size={18} style={{ color: cfg.color }} />
          </div>
          <div>
            <p className="text-xs font-bold text-foreground leading-snug">{activity.title}</p>
            <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{activity.description}</p>
          </div>
        </div>

        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2.5">User Details</p>
          <div className="flex items-center gap-3 p-3 rounded-[10px] border border-border bg-muted/10">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ backgroundColor: activity.userColor }}>{activity.userInitials}</div>
            <div>
              <p className="text-xs font-semibold text-foreground">{activity.user}</p>
              <p className="text-[10px] text-blue-600 dark:text-blue-400 font-medium mt-0.5">{activity.department}</p>
            </div>
          </div>
        </div>

        {activity.jobNumber && (
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2.5">Project Details</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
              {[
                { label: "Job Number",  value: activity.jobNumber,     mono: true },
                { label: "Customer",    value: activity.customer ?? "—"           },
                { label: "Component",   value: activity.componentName ?? "—"      },
                { label: "Time",        value: `${activity.dateGroup.split(" · ")[1] ?? ""} ${activity.timestamp}` },
              ].map(({ label, value, mono }) => (
                <div key={label}>
                  <p className="text-[10px] text-muted-foreground">{label}</p>
                  <p className={`text-xs font-semibold text-foreground mt-0.5 ${mono ? "font-mono" : ""}`}>{value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {(activity.prevValue || activity.newValue) && (
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2.5">Change Details</p>
            <div className="space-y-2">
              {activity.prevValue && (
                <div className="p-3 rounded-[8px] border border-red-200 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/10">
                  <p className="text-[9px] font-bold uppercase tracking-wide text-red-500 mb-1">Before</p>
                  <p className="text-[11px] text-foreground font-mono leading-relaxed">{activity.prevValue}</p>
                </div>
              )}
              {activity.newValue && (
                <div className="p-3 rounded-[8px] border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/10">
                  <p className="text-[9px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400 mb-1">After</p>
                  <p className="text-[11px] text-foreground font-mono leading-relaxed">{activity.newValue}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activity.attachments && activity.attachments.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2.5">Attachments ({activity.attachments.length})</p>
            <div className="space-y-1.5">
              {activity.attachments.map((file, i) => {
                const color = file.endsWith(".pdf") ? "#EF4444" : "#22C55E";
                return (
                  <div key={i} className="flex items-center gap-3 p-2.5 rounded-[8px] border border-border hover:bg-accent/30 transition-colors cursor-pointer">
                    <div className="w-7 h-7 rounded-[6px] flex items-center justify-center flex-shrink-0" style={{ backgroundColor: color + "18" }}>
                      <FileText size={13} style={{ color }} />
                    </div>
                    <span className="text-xs font-medium text-foreground font-mono flex-1 truncate">{file}</span>
                    <Download size={12} className="text-muted-foreground flex-shrink-0" />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2.5">Related Actions</p>
          <div className="flex flex-wrap gap-2">
            {[{ label: "Copy Activity ID", icon: RefreshCw }, { label: "Export as PDF", icon: Download }].map(({ label, icon: Icon2 }) => (
              <button key={label} className="h-7 px-3 rounded-[7px] text-[11px] font-medium border border-border text-muted-foreground hover:bg-accent hover:text-foreground transition-all flex items-center gap-1.5">
                <Icon2 size={11} />{label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </AdminDrawer>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────
export default function CEHistoryPage() {
  const { dark, toggleDark } = useOutletContext<CELayoutContext>();

  // ── Live data ─────────────────────────────────────────────────────────
  const [page] = useState(1);
  const { data: historyData, loading, error, refetch } = useHistory(page, 50);

  const ACTIVITIES: HistoryActivity[] = useMemo(
    () => (historyData?.items ?? []).map(apiItemToActivity),
    [historyData]
  );

  const [search, setSearch]         = useState("");
  const [typeFilter, setType]       = useState("All Types");
  const [projectFilter, setProj]    = useState("All Projects");
  const [dateRange, setDateRange]   = useState("All Dates");
  const [selected, setSelected]     = useState<HistoryActivity | null>(null);
  const [userMenuOpen, setUserMenu] = useState(false);

  // Derive project filter options from live data
  const ALL_PROJECTS = useMemo(
    () => ["All Projects", ...Array.from(new Set(ACTIVITIES.filter(a => a.jobNumber).map(a => a.jobNumber!)))],
    [ACTIVITIES]
  );

  const DATE_GROUPS = useMemo(
    () => Array.from(new Set(ACTIVITIES.map(a => a.dateGroup))),
    [ACTIVITIES]
  );

  const filtered = useMemo(() => ACTIVITIES.filter(a => {
    const q = search.toLowerCase();
    if (q && !a.title.toLowerCase().includes(q) && !a.description.toLowerCase().includes(q) && !(a.jobNumber ?? "").toLowerCase().includes(q)) return false;
    if (typeFilter !== "All Types"       && TYPE_CONFIG[a.type].label !== typeFilter) return false;
    if (projectFilter !== "All Projects" && a.jobNumber !== projectFilter)            return false;
    if (dateRange === "Today"     && !a.dateGroup.startsWith("Today"))     return false;
    if (dateRange === "Yesterday" && !a.dateGroup.startsWith("Yesterday")) return false;
    return true;
  }), [search, typeFilter, projectFilter, dateRange, ACTIVITIES]);

  const grouped = useMemo(() => {
    const map: Record<string, HistoryActivity[]> = {};
    DATE_GROUPS.forEach(g => { map[g] = []; });
    filtered.forEach(a => { if (map[a.dateGroup]) map[a.dateGroup].push(a); });
    return DATE_GROUPS.map(g => ({ date: g, items: map[g] })).filter(g => g.items.length > 0);
  }, [filtered, DATE_GROUPS]);

  const total   = ACTIVITIES.length;
  const today   = ACTIVITIES.filter(a => a.dateGroup.startsWith("Today")).length;
  const pending = ACTIVITIES.filter(a => a.status === "pending").length;
  const done    = ACTIVITIES.filter(a => a.status === "completed").length;

  const activeFilters = [typeFilter, projectFilter, dateRange].filter(f => !f.startsWith("All")).length;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <RefreshCw size={22} className="animate-spin" style={{ color: "#F5821F" }} />
          <p className="text-sm">Loading activity history…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <AlertCircle size={28} className="text-red-400 mx-auto mb-3" />
          <p className="text-sm font-semibold text-foreground mb-1">Failed to load history</p>
          <p className="text-xs text-muted-foreground mb-4">{error}</p>
          <button onClick={refetch} className="text-xs font-medium px-4 py-2 rounded-[8px] border border-border hover:bg-accent" style={{ color: "#F5821F" }}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      {/* Top nav */}
      <header className="h-12 flex-shrink-0 border-b border-border bg-card flex items-center gap-3 px-4 z-20">
        <span className="text-sm font-semibold text-foreground flex-shrink-0">Activity History</span>
        <div className="w-px h-5 bg-border mx-0.5 flex-shrink-0" />
        <div className="relative flex-1 max-w-sm">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input type="search" placeholder="Search activities, job #…" value={search} onChange={e => setSearch(e.target.value)}
            className="w-full h-7 pl-7 pr-3 rounded-[7px] text-xs bg-input-background border border-border text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/30 transition-all" />
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button onClick={toggleDark} className="w-7 h-7 flex items-center justify-center rounded-[7px] text-muted-foreground hover:bg-accent transition-all">
            {dark ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          <button className="w-7 h-7 flex items-center justify-center rounded-[7px] text-muted-foreground hover:bg-accent relative transition-all">
            <Bell size={14} />
          </button>
          <div className="relative">
            <button onClick={() => setUserMenu(v => !v)} className="flex items-center gap-1.5 h-7 pl-1 pr-2 rounded-[7px] hover:bg-accent transition-all">
              <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white" style={{ backgroundColor: "#3B82F6" }}>AA</div>
              <ChevronDown size={11} className="text-muted-foreground" />
            </button>
            {userMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setUserMenu(false)} />
                <div className="absolute right-0 top-9 w-44 bg-card border border-border rounded-[10px] shadow-[0_8px_24px_rgba(0,0,0,0.12)] overflow-hidden z-50 py-1">
                  <div className="px-3 py-2 border-b border-border">
                    <p className="text-xs font-semibold text-foreground">Aqib Ali</p>
                    <p className="text-[10px] text-muted-foreground">Cost Estimation</p>
                  </div>
                  {[{ icon: User, label: "Profile" }, { icon: Settings, label: "Settings" }].map(({ icon: Icon, label }) => (
                    <button key={label} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-foreground hover:bg-accent transition-colors">
                      <Icon size={13} className="text-muted-foreground" />{label}
                    </button>
                  ))}
                  <div className="h-px bg-border my-1" />
                  <button className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
                    <LogOut size={13} />Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-4">

          {/* Page heading */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-base font-bold text-foreground">Activity History</h1>
              <p className="text-[11px] text-muted-foreground mt-0.5">Cost Estimation Department · {total} {total === 1 ? "activity" : "activities"}</p>
            </div>
            <button className="h-8 px-4 rounded-[8px] text-xs font-semibold border border-border text-foreground hover:bg-accent flex items-center gap-1.5 transition-all">
              <Download size={13} />Export
            </button>
          </div>

          {/* KPI row */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Total Activities",   value: total,   color: "#F5821F", bg: "rgba(245,130,31,0.1)"  },
              { label: "Today's Activities", value: today,   color: "#3B82F6", bg: "rgba(59,130,246,0.1)"  },
              { label: "Pending Reviews",    value: pending, color: "#F59E0B", bg: "rgba(245,158,11,0.1)"  },
              { label: "Completed Actions",  value: done,    color: "#22C55E", bg: "rgba(34,197,94,0.1)"   },
            ].map(({ label, value, color, bg }) => (
              <div key={label} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-[8px] flex items-center justify-center flex-shrink-0" style={{ backgroundColor: bg }}>
                  <Clock size={14} style={{ color }} />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">{label}</p>
                  <p className="text-lg font-bold text-foreground leading-tight">{value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Toolbar */}
          <div className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-2 flex-wrap">
            {[
              { value: dateRange,     onChange: setDateRange, options: DATE_RANGES  },
              { value: typeFilter,    onChange: setType,      options: ALL_TYPES    },
              { value: projectFilter, onChange: setProj,      options: ALL_PROJECTS },
            ].map(({ value, onChange, options }, i) => (
              <select key={i} value={value} onChange={e => onChange(e.target.value)}
                className="h-7 px-2.5 rounded-[7px] text-xs border border-border bg-input-background text-foreground focus:outline-none cursor-pointer">
                {options.map(o => <option key={o}>{o}</option>)}
              </select>
            ))}
            {activeFilters > 0 && (
              <button onClick={() => { setType("All Types"); setProj("All Projects"); setDateRange("All Dates"); }}
                className="h-7 px-2.5 rounded-[7px] text-xs font-medium text-red-500 border border-red-200 dark:border-red-900/40 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-1 transition-all">
                <X size={11} />Clear ({activeFilters})
              </button>
            )}
            <button onClick={refetch} className="h-7 px-2.5 rounded-[7px] text-xs font-medium border border-border text-muted-foreground hover:bg-accent flex items-center gap-1 transition-all">
              <RefreshCw size={11} />Refresh
            </button>
            <div className="ml-auto text-[11px] text-muted-foreground">{filtered.length} results</div>
          </div>

          {/* Timeline */}
          {grouped.length === 0 ? (
            <div className="bg-card border border-border rounded-xl py-16 flex flex-col items-center justify-center text-center gap-2">
              <Inbox size={32} className="text-muted-foreground/30" />
              <p className="text-sm font-medium text-muted-foreground">
                {ACTIVITIES.length === 0 ? "No activity recorded yet for this department." : "No activities match your filters."}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {grouped.map(({ date, items }) => (
                <div key={date}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <Calendar size={12} className="text-muted-foreground" />
                      <span className="text-xs font-bold text-foreground">{date.split(" · ")[0]}</span>
                      {date.includes(" · ") && <span className="text-[10px] text-muted-foreground">· {date.split(" · ")[1]}</span>}
                    </div>
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-[10px] font-medium text-muted-foreground px-2 py-0.5 rounded-full bg-muted">{items.length} {items.length === 1 ? "activity" : "activities"}</span>
                  </div>
                  <div className="pl-2">
                    {items.map((activity, i) => (
                      <ActivityCard key={activity.id} activity={activity} isLast={i === items.length - 1}
                        onSelect={() => setSelected(activity)} selected={selected?.id === activity.id} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <ActivityDrawer activity={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
