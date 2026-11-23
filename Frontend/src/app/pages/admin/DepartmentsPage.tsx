import { useState, useEffect } from "react";
import {
  Building2, Plus, Search, Users, FolderOpen,
  CheckCircle2, Pencil, Eye, Trash2, X, RefreshCw,
  BarChart2, FileText, CheckSquare, Clock, Cpu, UserCheck, Bell
} from "lucide-react";
import AdminDrawer from "@/app/components/admin/AdminDrawer";
import {
  adminApi,
  AdminDepartmentItem,
  AdminDepartmentDetail
} from "@/app/services/admin";

// ── KPI Row ───────────────────────────────────────────────────────────────
function KPIRow({ departments }: { departments: AdminDepartmentItem[] }) {
  const total        = departments.length;
  const active       = departments.filter(d => d.is_active).length;
  const totalProj    = departments.reduce((s, d) => s + (d.total_projects || 0), 0);
  const pendingProj  = departments.reduce((s, d) => s + (d.pending_projects || 0), 0);
  const completedProj = departments.reduce((s, d) => s + (d.completed_projects || 0), 0);
  const members      = departments.reduce((s, d) => s + (d.user_count || 0), 0);

  const cards = [
    { label: "Total Depts",      value: total,        color: "#F5821F" },
    { label: "Active Depts",     value: active,       color: "#22C55E" },
    { label: "Total Members",    value: members,      color: "#8B5CF6" },
    { label: "Total Projects",   value: totalProj,    color: "#3B82F6" },
    { label: "Pending RFQs",     value: pendingProj,  color: "#F59E0B" },
    { label: "Completed RFQs",   value: completedProj,color: "#10B981" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
      {cards.map(({ label, value, color }) => (
        <div key={label} className="bg-card border border-border rounded-xl p-3 text-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">{label}</p>
          <p className="text-xl font-bold leading-tight mt-1" style={{ color }}>{value}</p>
        </div>
      ))}
    </div>
  );
}

// ── Dept Details & Analytics Drawer ───────────────────────────────────────
function DeptDrawer({ deptId, onClose }: { deptId: string | null; onClose: () => void }) {
  const [detail, setDetail]       = useState<AdminDepartmentDetail | null>(null);
  const [analytics, setAnalytics] = useState<any | null>(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [tab, setTab]             = useState<"overview" | "members" | "projects" | "analytics">("overview");

  useEffect(() => {
    if (!deptId) return;
    setLoading(true);
    setError(null);

    adminApi.getDepartmentDetail(deptId)
      .then(setDetail)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));

    adminApi.getDepartmentAnalytics(deptId)
      .then(setAnalytics)
      .catch(() => {});
  }, [deptId]);

  if (!deptId) return null;

  const badge = detail ? (
    <>
      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: detail.color }}>
        {detail.code}
      </span>
      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${detail.is_active ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40" : "text-muted-foreground bg-muted"}`}>
        {detail.is_active ? "● Active" : "○ Archived"}
      </span>
    </>
  ) : null;

  return (
    <AdminDrawer
      open={!!deptId}
      onClose={onClose}
      width={480}
      title={detail ? `${detail.name} Department` : "Department Details"}
      subtitle={detail?.description || "Loading live department detail..."}
      badge={badge}
    >
      <div className="flex border-b border-border px-5 gap-0">
        {[
          { id: "overview",  label: "Overview" },
          { id: "members",   label: "Members" },
          { id: "projects",  label: "Projects" },
          { id: "analytics", label: "Analytics" },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className={`px-3 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors ${tab === t.id ? "border-primary text-foreground font-bold" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-5 space-y-5">
        {loading ? (
          <div className="space-y-4 py-8">
            <div className="h-4 bg-muted rounded w-1/3 animate-pulse" />
            <div className="h-12 bg-muted rounded animate-pulse" />
            <div className="h-20 bg-muted rounded animate-pulse" />
          </div>
        ) : error ? (
          <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-700 text-xs">
            Failed to load detail: {error}
          </div>
        ) : detail ? (
          <>
            {tab === "overview" && (
              <>
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2.5">Department Information</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                    {[
                      { label: "Department Head", value: detail.manager_name || "Unassigned" },
                      { label: "Total Members",   value: String(detail.members.length) },
                      { label: "Department Code",  value: detail.code },
                      { label: "Status",          value: detail.is_active ? "Active" : "Archived" },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <p className="text-[10px] text-muted-foreground">{label}</p>
                        <p className="text-xs font-semibold text-foreground mt-0.5">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2.5">Kanban Task Breakdown</p>
                  <div className="grid grid-cols-3 gap-2 text-[10px]">
                    <div className="border border-border rounded-[8px] p-2 text-center">
                      <p className="text-blue-600 font-bold text-sm">{detail.task_stats["todo"] || 0}</p>
                      <p className="text-muted-foreground mt-0.5">To Do</p>
                    </div>
                    <div className="border border-border rounded-[8px] p-2 text-center">
                      <p className="text-amber-600 font-bold text-sm">{detail.task_stats["in_progress"] || 0}</p>
                      <p className="text-muted-foreground mt-0.5">In Progress</p>
                    </div>
                    <div className="border border-border rounded-[8px] p-2 text-center">
                      <p className="text-emerald-600 font-bold text-sm">{detail.task_stats["completed"] || 0}</p>
                      <p className="text-muted-foreground mt-0.5">Completed</p>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2.5">Recent Notifications ({detail.notifications.length})</p>
                  <div className="space-y-1.5">
                    {detail.notifications.map((n) => (
                      <div key={n.id} className="p-2.5 rounded-[8px] border border-border flex items-start gap-2 text-xs">
                        <Bell size={12} className="text-muted-foreground flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-foreground">{n.title}</p>
                          <p className="text-[10px] text-muted-foreground">{n.message}</p>
                        </div>
                      </div>
                    ))}
                    {detail.notifications.length === 0 && <p className="text-xs text-muted-foreground">No recent notifications.</p>}
                  </div>
                </div>
              </>
            )}

            {tab === "members" && (
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2.5">Team Members ({detail.members.length})</p>
                <div className="space-y-2">
                  {detail.members.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 p-2.5 rounded-[10px] border border-border">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0" style={{ backgroundColor: detail.color }}>
                        {m.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground">{m.name}</p>
                        <p className="text-[10px] text-muted-foreground">{m.role}</p>
                      </div>
                      {m.is_head && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: detail.color }}>HEAD</span>
                      )}
                    </div>
                  ))}
                  {detail.members.length === 0 && (
                    <p className="text-xs text-muted-foreground py-2">No assigned members.</p>
                  )}
                </div>
              </div>
            )}

            {tab === "projects" && (
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2.5">Recent Department Projects</p>
                <div className="space-y-1.5">
                  {detail.recent_projects.map((p) => (
                    <div key={p.id} className="flex items-center gap-3 p-2.5 rounded-[10px] border border-border">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{p.title}</p>
                        <p className="text-[10px] text-muted-foreground">{p.job_number}</p>
                      </div>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950/40">
                        {p.status}
                      </span>
                    </div>
                  ))}
                  {detail.recent_projects.length === 0 && (
                    <p className="text-xs text-muted-foreground py-2">No active projects.</p>
                  )}
                </div>
              </div>
            )}

            {tab === "analytics" && analytics && (
              <div className="space-y-3">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Performance Metrics</p>
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { label: "Total Projects",         value: analytics.total_projects,        icon: FileText },
                    { label: "Completed RFQs",         value: analytics.completed_rfqs,        icon: CheckSquare },
                    { label: "Pending RFQs",           value: analytics.pending_rfqs,          icon: Clock },
                    { label: "Avg Process Time",       value: `${analytics.avg_processing_time_days} days`, icon: BarChart2 },
                    { label: "AI Processings",         value: analytics.ai_processing_count,   icon: Cpu },
                    { label: "Human Reviews",          value: analytics.human_reviews,         icon: UserCheck },
                  ].map(({ label, value, icon: Icon }) => (
                    <div key={label} className="p-3 rounded-[10px] border border-border bg-muted/20">
                      <Icon size={14} className="text-primary mb-1" />
                      <p className="text-[10px] text-muted-foreground">{label}</p>
                      <p className="text-sm font-bold text-foreground mt-0.5">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>
    </AdminDrawer>
  );
}

// ── Department Card ───────────────────────────────────────────────────────
function DeptCard({
  dept,
  onView,
  onEdit,
  onArchive,
}: {
  dept: AdminDepartmentItem;
  onView: () => void;
  onEdit: () => void;
  onArchive: () => void;
}) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden hover:shadow-sm transition-all cursor-pointer group" onClick={onView}>
      <div className="h-1" style={{ backgroundColor: dept.color }} />

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: dept.color }} />
              <h3 className="text-sm font-bold text-foreground">{dept.name}</h3>
              <span className="text-[10px] font-mono text-muted-foreground">({dept.code})</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{dept.description || "No description provided."}</p>
          </div>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${dept.is_active ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40" : "text-muted-foreground bg-muted"}`}>
            {dept.is_active ? "● Active" : "○ Archived"}
          </span>
        </div>

        {/* Manager */}
        <div className="flex items-center gap-2 mb-3 p-2.5 rounded-[8px] bg-muted/30">
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0" style={{ backgroundColor: dept.color }}>
            {dept.manager_name ? dept.manager_name.substring(0, 2).toUpperCase() : "NA"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] text-muted-foreground">Department Head</p>
            <p className="text-xs font-semibold text-foreground truncate">{dept.manager_name || "Unassigned"}</p>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Users size={10} />
            <span>{dept.user_count} members</span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-2 mb-4 text-[10px]">
          <div className="text-center p-2 rounded-[8px] bg-blue-50/60 dark:bg-blue-950/20">
            <p className="font-bold text-blue-600 dark:text-blue-400 text-sm">{dept.active_projects}</p>
            <p className="text-muted-foreground mt-0.5">Active Proj</p>
          </div>
          <div className="text-center p-2 rounded-[8px] bg-amber-50/60 dark:bg-amber-950/20">
            <p className="font-bold text-amber-600 dark:text-amber-400 text-sm">{dept.open_tasks}</p>
            <p className="text-muted-foreground mt-0.5">Open Tasks</p>
          </div>
          <div className="text-center p-2 rounded-[8px] bg-emerald-50/60 dark:bg-emerald-950/20">
            <p className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">{dept.completed_projects}</p>
            <p className="text-muted-foreground mt-0.5">Done Proj</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 pt-3 border-t border-border" onClick={e => e.stopPropagation()}>
          <button onClick={onView} className="flex-1 h-7 rounded-[7px] text-[11px] font-medium border border-border text-foreground hover:bg-accent transition-all flex items-center justify-center gap-1">
            <Eye size={11} />Details
          </button>
          <button onClick={onEdit} className="h-7 px-2.5 rounded-[7px] border border-border text-foreground hover:bg-accent transition-all flex items-center justify-center gap-1 text-[11px]">
            <Pencil size={11} />Edit
          </button>
          <button onClick={onArchive} className="h-7 px-2 rounded-[7px] border border-red-200 text-red-600 hover:bg-red-50 transition-all flex items-center justify-center text-[11px]" title="Archive Department">
            <Trash2 size={11} />Archive
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal Form: Create / Edit Dept ───────────────────────────────────────
function DeptModal({
  isOpen,
  onClose,
  dept,
  onSuccess
}: {
  isOpen: boolean;
  onClose: () => void;
  dept?: AdminDepartmentItem | null;
  onSuccess: () => void;
}) {
  const [name, setName] = useState(dept?.name || "");
  const [code, setCode] = useState(dept?.code || "");
  const [desc, setDesc] = useState(dept?.description || "");
  const [isActive, setIsActive] = useState(dept?.is_active ?? true);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setName(dept?.name || "");
    setCode(dept?.code || "");
    setDesc(dept?.description || "");
    setIsActive(dept?.is_active ?? true);
    setErr(null);
  }, [dept, isOpen]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErr(null);
    try {
      if (dept) {
        await adminApi.updateDepartment(dept.id, { name, description: desc, is_active: isActive });
      } else {
        await adminApi.createDepartment({ name, code, description: desc });
      }
      onSuccess();
      onClose();
    } catch (ex: any) {
      setErr(ex.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl max-w-md w-full p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h2 className="text-sm font-bold text-foreground">{dept ? "Edit Department" : "Create New Department"}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
        </div>

        {err && <div className="p-3 text-xs bg-red-50 text-red-600 rounded-lg">{err}</div>}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground">Department Name</label>
            <input
              type="text" required value={name} onChange={e => setName(e.target.value)}
              className="w-full h-8 px-3 rounded-[7px] text-xs bg-input-background border border-border text-foreground focus:outline-none"
              placeholder="e.g. Quality Assurance"
            />
          </div>

          {!dept && (
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground">Department Code</label>
              <input
                type="text" required value={code} onChange={e => setCode(e.target.value.toUpperCase())}
                className="w-full h-8 px-3 rounded-[7px] text-xs bg-input-background border border-border text-foreground focus:outline-none"
                placeholder="e.g. QA"
              />
            </div>
          )}

          <div>
            <label className="text-[11px] font-semibold text-muted-foreground">Description</label>
            <textarea
              value={desc} onChange={e => setDesc(e.target.value)} rows={3}
              className="w-full p-2.5 rounded-[7px] text-xs bg-input-background border border-border text-foreground focus:outline-none"
              placeholder="Responsibilities and domain..."
            />
          </div>

          {dept && (
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox" id="is_active_chk" checked={isActive} onChange={e => setIsActive(e.target.checked)}
                className="rounded border-border"
              />
              <label htmlFor="is_active_chk" className="text-xs text-foreground cursor-pointer">Active Department</label>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
            <button type="button" onClick={onClose} className="h-8 px-4 text-xs border border-border rounded-[8px]">Cancel</button>
            <button type="submit" disabled={submitting} className="h-8 px-4 text-xs font-semibold text-white bg-primary rounded-[8px]">
              {submitting ? "Saving..." : dept ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Page Component ───────────────────────────────────────────────────
export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<AdminDepartmentItem[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);

  const [search, setSearch]           = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const [selectedId, setSelectedId]   = useState<string | null>(null);
  const [editDept, setEditDept]       = useState<AdminDepartmentItem | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const fetchDepts = async () => {
    setLoading(true);
    setError(null);
    try {
      const activeParam = statusFilter === "Active" ? true : statusFilter === "Archived" ? false : undefined;
      const res = await adminApi.getDepartments({ search, is_active: activeParam });
      setDepartments(res.items);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepts();
  }, [search, statusFilter]);

  const handleArchive = async (id: string) => {
    if (!confirm("Are you sure you want to archive this department? Old projects will remain assigned.")) return;
    try {
      await adminApi.deleteDepartment(id);
      fetchDepts();
    } catch (err: any) {
      alert(`Archive failed: ${err.message}`);
    }
  };

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="p-4 space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-foreground">Departments Management</h1>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Live PostgreSQL database records
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchDepts}
              className="h-8 px-3 rounded-[8px] text-xs font-medium border border-border flex items-center gap-1 hover:bg-accent"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
            </button>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="h-8 px-4 rounded-[8px] text-xs font-semibold text-white flex items-center gap-1.5 transition-all bg-primary"
            >
              <Plus size={13} />Add Department
            </button>
          </div>
        </div>

        {/* Live KPIs */}
        <KPIRow departments={departments} />

        {/* Toolbar */}
        <div className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-2">
          <div className="relative flex-1 max-w-xs">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="search" placeholder="Search department name or code…"
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full h-7 pl-7 pr-3 rounded-[7px] text-xs bg-input-background border border-border text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-1 border border-border rounded-[8px] p-0.5">
            {["All", "Active", "Archived"].map(opt => (
              <button key={opt} onClick={() => setStatusFilter(opt)}
                className={`h-6 px-3 rounded-[6px] text-xs font-medium transition-all ${statusFilter === opt ? "text-white bg-primary" : "text-muted-foreground hover:text-foreground"}`}>
                {opt}
              </button>
            ))}
          </div>
          <div className="ml-auto text-[11px] text-muted-foreground">{departments.length} departments found</div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-48 bg-card border border-border rounded-xl p-4 animate-pulse space-y-3">
                <div className="h-4 bg-muted rounded w-1/2" />
                <div className="h-10 bg-muted rounded" />
                <div className="h-16 bg-muted rounded" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="p-6 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
            Failed to load departments: {error}
          </div>
        ) : departments.length === 0 ? (
          <div className="p-12 text-center border border-dashed border-border rounded-xl text-muted-foreground text-xs">
            No departments match your filter criteria.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {departments.map(dept => (
              <DeptCard
                key={dept.id}
                dept={dept}
                onView={() => setSelectedId(dept.id)}
                onEdit={() => setEditDept(dept)}
                onArchive={() => handleArchive(dept.id)}
              />
            ))}
          </div>
        )}

      </div>

      <DeptDrawer deptId={selectedId} onClose={() => setSelectedId(null)} />
      <DeptModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} onSuccess={fetchDepts} />
      <DeptModal isOpen={!!editDept} dept={editDept} onClose={() => setEditDept(null)} onSuccess={fetchDepts} />
    </main>
  );
}
