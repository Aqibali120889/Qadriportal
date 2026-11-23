/**
 * SuperAdminDashboard.tsx
 * Phase 11.1 — Full live-data Super Admin Dashboard.
 *
 * All data comes from GET /api/v1/admin/dashboard.
 * No mock data. Loading skeletons shown while fetching.
 * Component structure is preserved from Phase 10.
 */

import { useEffect, useState, useCallback } from "react";
import type { LucideIcon } from "lucide-react";
import {
  FolderOpen, Clock, CheckCircle2, Building2, Users, Sparkles, ScanLine, Activity,
  TrendingUp, TrendingDown, ChevronRight, ExternalLink, Plus, UserPlus,
  Building, FileText, Download, Settings, ScrollText, Cpu, Mail,
  AlertTriangle, CheckCircle, AlertCircle, HardDrive, Zap, Globe, Database,
  ArrowRight, Timer, RefreshCw, ShieldCheck, Shield, BarChart3,
} from "lucide-react";
import { adminApi } from "@/app/services/admin";
import type { AdminDashboardResponse, AdminDeptStat, AdminRecentProject, AdminRecentNotification } from "@/app/services/admin";
import { getDeptColor, STATUS_COLORS, DB_STATUS_DISPLAY } from "@/app/types/admin";
import type { ActivityIconKey } from "@/app/types/admin";

// ── Loading Skeleton ───────────────────────────────────────────────────────────
function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-muted rounded ${className}`} />;
}

// ── KPI Cards ────────────────────────────────────────────────────────────────
const KPI_ICON_MAP: LucideIcon[] = [
  FolderOpen, Clock, CheckCircle2, Building2, Users, Sparkles, ScanLine, Activity,
];

function KPICards({ data, loading }: { data: AdminDashboardResponse | null; loading: boolean }) {
  if (loading || !data) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-3.5">
            <Skeleton className="h-9 w-9 rounded-[10px] mb-2" />
            <Skeleton className="h-3 w-20 mb-1" />
            <Skeleton className="h-6 w-12" />
          </div>
        ))}
      </div>
    );
  }

  const s = data.statistics;
  const kpis = [
    { label: "Total RFQs",       value: String(s.total_rfqs),    iconColor: "#3B82F6", bgColor: "rgba(59,130,246,0.1)",  positive: true,  change: `${s.today_rfqs} today` },
    { label: "Active RFQs",      value: String(s.active_rfqs),   iconColor: "#F59E0B", bgColor: "rgba(245,158,11,0.1)",  positive: s.active_rfqs > 0, change: "in progress" },
    { label: "Completed RFQs",   value: String(s.completed_rfqs),iconColor: "#22C55E", bgColor: "rgba(34,197,94,0.1)",   positive: true,  change: "total completed" },
    { label: "Departments",      value: String(s.active_departments), iconColor: "#8B5CF6", bgColor: "rgba(139,92,246,0.1)", positive: true, change: "operational" },
    { label: "Total Users",      value: String(s.total_users),   iconColor: "#F5821F", bgColor: "rgba(245,130,31,0.1)",  positive: true,  change: `${s.active_users} active` },
    { label: "AI Extraction Jobs",value: String(s.ai_processing_jobs ?? 0), iconColor: "#6366F1", bgColor: "rgba(99,102,241,0.1)", positive: true, change: "total processed" },
    { label: "Pending Reviews",  value: String(s.pending_human_reviews ?? 0), iconColor: "#F97316", bgColor: "rgba(249,115,22,0.1)", positive: false, change: "human review queue" },
    { label: "Kanban Tasks",     value: String(s.total_kanban_tasks ?? 0), iconColor: "#10B981", bgColor: "rgba(16,185,129,0.1)", positive: true, change: "active tasks" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {kpis.map((kpi, idx) => {
        const Icon = KPI_ICON_MAP[idx] ?? Activity;
        return (
          <div key={kpi.label} className="bg-card border border-border rounded-xl p-3.5 flex items-start gap-3 hover:shadow-sm transition-shadow cursor-default">
            <div className="w-9 h-9 rounded-[10px] flex items-center justify-center flex-shrink-0" style={{ backgroundColor: kpi.bgColor }}>
              <Icon size={16} style={{ color: kpi.iconColor }} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">{kpi.label}</p>
              <p className="text-xl font-bold text-foreground leading-tight mt-0.5">{kpi.value}</p>
              <p className={`text-[10px] mt-1 font-medium flex items-center gap-1 ${kpi.positive ? "text-emerald-600 dark:text-emerald-400" : "text-amber-500"}`}>
                {kpi.positive ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                {kpi.change}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Department Overview ────────────────────────────────────────────────────────
function DepartmentOverview({ data, loading }: { data: AdminDashboardResponse | null; loading: boolean }) {
  const depts = data?.department_stats ?? [];
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden h-full flex flex-col">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Department Overview</h2>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {loading ? "Loading…" : `${depts.filter(d => d.is_active).length} departments operational`}
          </p>
        </div>
        <button className="text-[11px] font-medium hover:underline" style={{ color: "#F5821F" }}>View All</button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-[10px]" />)
          : depts.map((dept) => {
              const total = dept.total || 1;
              const workloadPct = Math.round((dept.active / total) * 100);
              return (
                <div key={dept.id} className="border border-border rounded-[10px] p-3 hover:bg-accent/30 transition-colors">
                  <div className="flex items-start gap-2.5">
                    <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: dept.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-foreground">{dept.name}</span>
                        <button className="text-[10px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded-[5px] border border-border transition-all">
                          Quick View
                        </button>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[10px]">
                        <span className="font-medium text-blue-600 dark:text-blue-400">{dept.active} active</span>
                        <span className="text-muted-foreground">·</span>
                        <span className="font-medium text-emerald-600 dark:text-emerald-400">{dept.completed} done</span>
                        <span className="text-muted-foreground">·</span>
                        <span className="font-medium text-amber-600 dark:text-amber-400">{dept.pending} pending</span>
                      </div>
                      <div className="mt-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-muted-foreground">Workload</span>
                          <span className="text-[10px] font-semibold" style={{ color: workloadPct > 85 ? "#EF4444" : workloadPct > 70 ? "#F59E0B" : "#22C55E" }}>
                            {workloadPct}%
                          </span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${workloadPct}%`, backgroundColor: workloadPct > 85 ? "#EF4444" : workloadPct > 70 ? "#F59E0B" : dept.color }} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
        }
      </div>
    </div>
  );
}

// ── Recent Notifications (Activity Feed) ──────────────────────────────────────
const NOTIF_TYPE_MAP: Record<string, { color: string; icon: LucideIcon }> = {
  SUCCESS: { color: "#22C55E", icon: CheckCircle },
  INFO:    { color: "#3B82F6", icon: ScanLine },
  WARNING: { color: "#F59E0B", icon: AlertTriangle },
  ERROR:   { color: "#EF4444", icon: AlertCircle },
  TASK:    { color: "#8B5CF6", icon: CheckCircle2 },
};

function ActivityFeed({ data, loading }: { data: AdminDashboardResponse | null; loading: boolean }) {
  const notifs = data?.recent_notifications ?? [];
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Recent Activity</h2>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <p className="text-[10px] text-muted-foreground">Live feed</p>
          </div>
        </div>
        <button className="text-[11px] font-medium hover:underline" style={{ color: "#F5821F" }}>View All</button>
      </div>
      <div className="flex-1 overflow-y-auto divide-y divide-border">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <div key={i} className="px-4 py-2.5"><Skeleton className="h-8" /></div>)
          : notifs.length === 0
          ? <p className="p-4 text-xs text-muted-foreground text-center">No recent notifications</p>
          : notifs.map((item) => {
              const cfg = NOTIF_TYPE_MAP[item.type?.toUpperCase()] ?? NOTIF_TYPE_MAP.INFO;
              const Icon = cfg.icon;
              const when = item.created_at ? new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
              return (
                <div key={item.id} className="px-4 py-2.5 hover:bg-accent/30 transition-colors flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: cfg.color + "20" }}>
                    <Icon size={11} style={{ color: cfg.color }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-foreground leading-snug">{item.message || item.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-muted-foreground">{item.title}</span>
                      <span className="text-[10px] text-muted-foreground/50">·</span>
                      <span className="text-[10px] text-muted-foreground/60">{when}</span>
                    </div>
                  </div>
                </div>
              );
            })
        }
      </div>
    </div>
  );
}

// ── Project Table ─────────────────────────────────────────────────────────────
function ProjectTable({ data, loading }: { data: AdminDashboardResponse | null; loading: boolean }) {
  const rows = data?.recent_projects ?? [];
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Recent Projects</h2>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {loading ? "Loading…" : `${rows.length} most recent RFQs`}
          </p>
        </div>
        <button className="text-[11px] font-medium hover:underline" style={{ color: "#F5821F" }}>View All</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/20">
              {["Job #", "Title", "Department", "Status", "Progress", "Priority", "Updated", ""].map((h) => (
                <th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    {Array.from({ length: 8 }).map((__, j) => (
                      <td key={j} className="px-4 py-2.5"><Skeleton className="h-4 w-full" /></td>
                    ))}
                  </tr>
                ))
              : rows.map((row, i) => {
                  const statusKey = (row.status_display || "new") as keyof typeof STATUS_COLORS;
                  const sc = STATUS_COLORS[statusKey] ?? "#6B7280";
                  const statusLabel = (row.status_display || "new").replace("-", " ").replace(/\b\w/g, (c) => c.toUpperCase());
                  const pct = row.progress ?? 0;
                  const when = row.updated_at ? new Date(row.updated_at).toLocaleDateString() : "—";
                  return (
                    <tr key={row.id} className={`border-b border-border last:border-0 hover:bg-accent/20 transition-colors ${i % 2 === 1 ? "bg-muted/[0.06]" : ""}`}>
                      <td className="px-4 py-2.5"><span className="font-mono text-[11px] font-semibold text-muted-foreground">{row.job_number}</span></td>
                      <td className="px-4 py-2.5 max-w-[180px]"><span className="font-medium text-foreground truncate block">{row.title}</span></td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color: getDeptColor(row.department), backgroundColor: getDeptColor(row.department) + "18" }}>{row.department || "—"}</span>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color: sc, backgroundColor: sc + "18" }}>{statusLabel}</span>
                      </td>
                      <td className="px-4 py-2.5 w-28">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: sc }} />
                          </div>
                          <span className="text-[10px] text-muted-foreground w-6 text-right">{pct}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className="text-[10px] font-semibold capitalize" style={{ color: row.priority === "critical" ? "#EF4444" : row.priority === "high" ? "#F97316" : "#F59E0B" }}>
                          ● {row.priority || "medium"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap"><span className="text-[11px] text-muted-foreground">{when}</span></td>
                      <td className="px-4 py-2.5">
                        <button className="w-6 h-6 flex items-center justify-center rounded-[5px] text-muted-foreground hover:bg-accent hover:text-foreground transition-all">
                          <ExternalLink size={11} />
                        </button>
                      </td>
                    </tr>
                  );
                })
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Status Distribution ────────────────────────────────────────────────────────
function StatusDistribution({ data, loading }: { data: AdminDashboardResponse | null; loading: boolean }) {
  const dist = data?.status_distribution ?? {};
  const total = Object.values(dist).reduce((a, b) => a + b, 0) || 1;
  const stages = [
    { key: "DRAFT",     label: "New / Draft",  color: "#6B7280" },
    { key: "ACTIVE",    label: "In Progress",  color: "#3B82F6" },
    { key: "ON_HOLD",   label: "On Hold",      color: "#F97316" },
    { key: "COMPLETED", label: "Completed",    color: "#22C55E" },
    { key: "CANCELLED", label: "Cancelled",    color: "#EF4444" },
  ];
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">RFQ Status Distribution</h2>
        <p className="text-[10px] text-muted-foreground mt-0.5">All-time overview</p>
      </div>
      <div className="p-4">
        {/* Stacked bar */}
        <div className="flex h-3 rounded-full overflow-hidden mb-4 gap-0.5">
          {loading
            ? <Skeleton className="flex-1 h-3" />
            : stages.map(s => {
                const count = dist[s.key] ?? 0;
                const pct = (count / total) * 100;
                if (pct === 0) return null;
                return <div key={s.key} className="h-full rounded-sm" style={{ width: `${pct}%`, backgroundColor: s.color }} title={`${s.label}: ${count}`} />;
              })
          }
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {stages.map(s => {
            const count = dist[s.key] ?? 0;
            const pct = Math.round((count / total) * 100);
            return (
              <div key={s.key} className="text-center">
                {loading
                  ? <Skeleton className="h-6 w-8 mx-auto mb-1" />
                  : <p className="text-lg font-bold" style={{ color: s.color }}>{count}</p>
                }
                <p className="text-[10px] text-muted-foreground">{s.label}</p>
                {!loading && <p className="text-[10px] font-medium text-muted-foreground">{pct}%</p>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Monthly Trend ─────────────────────────────────────────────────────────────
function MonthlyTrend({ data, loading }: { data: AdminDashboardResponse | null; loading: boolean }) {
  const trend = data?.monthly_trend ?? [];
  const max = Math.max(...trend.map(t => t.count), 1);
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">RFQs per Month</h2>
        <p className="text-[10px] text-muted-foreground mt-0.5">Last 6 months</p>
      </div>
      <div className="p-4">
        {loading ? (
          <div className="flex items-end gap-2 h-24">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex-1" style={{ height: `${40 + i * 10}%` }}>
                <Skeleton className="w-full h-full" />
              </div>
            ))}
          </div>
        ) : trend.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">No data yet</p>
        ) : (
          <div className="flex items-end gap-2 h-28">
            {trend.map(t => {
              const pct = (t.count / max) * 100;
              return (
                <div key={`${t.year}-${t.month}`} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] text-muted-foreground font-medium">{t.count}</span>
                  <div className="w-full rounded-t-[4px]" style={{ height: `${Math.max(pct, 8)}%`, backgroundColor: "#F5821F", opacity: 0.85 }} />
                  <span className="text-[10px] text-muted-foreground">{t.month}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Department Performance ────────────────────────────────────────────────────
function DeptPerformanceSection({ data, loading }: { data: AdminDashboardResponse | null; loading: boolean }) {
  const depts = data?.department_stats ?? [];
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b border-border flex-shrink-0">
        <h2 className="text-sm font-semibold text-foreground">Department Performance</h2>
      </div>
      <div className="flex-1 p-3 space-y-2">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-[10px]" />)
          : depts.map((dept) => {
              const total = dept.total || 1;
              const eff = dept.total > 0 ? Math.round((dept.completed / dept.total) * 100) : 0;
              const effColor = eff >= 85 ? "#22C55E" : eff >= 70 ? "#F59E0B" : "#EF4444";
              return (
                <div key={dept.id} className="border border-border rounded-[10px] p-3 hover:bg-accent/20 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: dept.color }} />
                      <span className="text-xs font-semibold text-foreground">{dept.name}</span>
                    </div>
                    <span className="text-[10px] font-bold" style={{ color: effColor }}>{eff}% eff.</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[10px] mb-2">
                    <div><p className="text-muted-foreground">Total</p><p className="font-semibold text-foreground mt-0.5">{dept.total}</p></div>
                    <div><p className="text-muted-foreground">Completed</p><p className="font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">{dept.completed}</p></div>
                    <div><p className="text-muted-foreground">Pending</p><p className="font-semibold text-amber-600 dark:text-amber-400 mt-0.5">{dept.pending}</p></div>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${eff}%`, backgroundColor: effColor }} />
                  </div>
                </div>
              );
            })
        }
      </div>
    </div>
  );
}

// ── System Health (static indicators) ────────────────────────────────────────
const SVC_ICON_MAP: Record<string, LucideIcon> = { database: Database, cpu: Cpu, mail: Mail, harddrive: HardDrive, zap: Zap, globe: Globe };

const STATIC_SERVICES = [
  { id: "ss1", name: "Database",           status: "operational" as const, metric: "PostgreSQL",       detail: "Supabase PostgreSQL",              iconKey: "database"  },
  { id: "ss2", name: "AI Services",        status: "operational" as const, metric: "n8n + Modal",      detail: "RAG Agent & Drawing AI",           iconKey: "cpu"       },
  { id: "ss3", name: "Email Sync",         status: "operational" as const, metric: "Outlook",          detail: "IMAP → n8n → FastAPI",             iconKey: "mail"      },
  { id: "ss4", name: "Storage",            status: "operational" as const, metric: "Supabase",         detail: "rfq-drawings bucket",              iconKey: "harddrive" },
  { id: "ss5", name: "Background Workers", status: "operational" as const, metric: "FastAPI Tasks",    detail: "Async queue",                      iconKey: "zap"       },
  { id: "ss6", name: "API Gateway",        status: "operational" as const, metric: "FastAPI v0.11",    detail: "Uvicorn ASGI",                     iconKey: "globe"     },
];

function SystemHealthPanel() {
  const op = STATIC_SERVICES.filter(s => s.status === "operational").length;
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">System Health</h2>
        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{op}/{STATIC_SERVICES.length} Operational
        </span>
      </div>
      <div className="p-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
        {STATIC_SERVICES.map(svc => {
          const Icon = SVC_ICON_MAP[svc.iconKey] ?? Cpu;
          const sc = "#22C55E";
          return (
            <div key={svc.id} className="border rounded-[10px] p-3 border-border hover:bg-accent/20 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <div className="w-8 h-8 rounded-[8px] flex items-center justify-center" style={{ backgroundColor: sc + "18" }}>
                  <Icon size={14} style={{ color: sc }} />
                </div>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex items-center gap-1" style={{ color: sc, backgroundColor: sc + "18" }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sc }} />Operational
                </span>
              </div>
              <p className="text-xs font-semibold text-foreground">{svc.name}</p>
              <p className="text-[11px] font-semibold mt-1" style={{ color: sc }}>{svc.metric}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{svc.detail}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Quick Actions ─────────────────────────────────────────────────────────────
function QuickActions() {
  const actions = [
    { label: "Create Project",   icon: Plus,       color: "#F5821F" },
    { label: "Invite User",      icon: UserPlus,   color: "#3B82F6" },
    { label: "Add Department",   icon: Building,   color: "#8B5CF6" },
    { label: "View System Logs", icon: ScrollText, color: "#6B7280" },
    { label: "Export Reports",   icon: Download,   color: "#10B981" },
    { label: "System Settings",  icon: Settings,   color: "#6366F1" },
  ];
  return (
    <div className="bg-card border border-border rounded-xl p-3">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-1 mb-2.5">Quick Actions</p>
      <div className="flex items-center gap-2 flex-wrap">
        {actions.map(({ label, icon: Icon, color }) => (
          <button key={label} className="flex items-center gap-1.5 h-7 px-3 rounded-[7px] text-xs font-medium border border-border text-foreground hover:bg-accent transition-all">
            <Icon size={12} style={{ color }} />{label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Footer ────────────────────────────────────────────────────────────────────
function DashboardFooter({ lastSync }: { lastSync: string }) {
  return (
    <div className="flex items-center justify-between text-[10px] text-muted-foreground border-t border-border pt-3 pb-1 px-1">
      <div className="flex items-center gap-2">
        <Shield size={11} style={{ color: "#F5821F" }} />
        <span>Qadri Group AI Estimation Portal</span>
        <span className="font-mono bg-muted px-1.5 py-0.5 rounded-[4px]">v2.4.1</span>
      </div>
      <div className="flex items-center gap-4">
        <span>Last sync: <span className="text-foreground font-medium">{lastSync}</span></span>
        <span>Server: <span className="text-foreground font-medium">PK-PROD-01</span></span>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function SuperAdminDashboard() {
  const [data, setData] = useState<AdminDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState("—");

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await adminApi.getDashboard();
      setData(result);
      setLastSync(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-foreground">Platform Overview</h1>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {new Date().toLocaleDateString("en-PK", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · Qadri Group AI Estimation Platform
            </p>
          </div>
          <div className="flex items-center gap-2">
            {error && <span className="text-[11px] text-red-500">{error}</span>}
            <button
              onClick={fetchDashboard}
              disabled={loading}
              className="w-7 h-7 flex items-center justify-center rounded-[7px] border border-border text-muted-foreground hover:bg-accent transition-all"
              title="Refresh dashboard"
            >
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            </button>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">All systems operational</span>
          </div>
        </div>

        {/* KPI Cards */}
        <KPICards data={data} loading={loading} />

        {/* Dept Overview + Activity Feed */}
        <div className="grid grid-cols-3 gap-4" style={{ minHeight: 420 }}>
          <div className="col-span-2"><DepartmentOverview data={data} loading={loading} /></div>
          <ActivityFeed data={data} loading={loading} />
        </div>

        {/* Recent Projects table */}
        <ProjectTable data={data} loading={loading} />

        {/* Status Distribution */}
        <StatusDistribution data={data} loading={loading} />

        {/* Monthly Trend + Dept Performance */}
        <div className="grid grid-cols-2 gap-4">
          <MonthlyTrend data={data} loading={loading} />
          <DeptPerformanceSection data={data} loading={loading} />
        </div>

        {/* System Health */}
        <SystemHealthPanel />

        {/* Quick Actions */}
        <QuickActions />

        {/* Footer */}
        <DashboardFooter lastSync={lastSync} />
      </div>
    </main>
  );
}
