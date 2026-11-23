import { useState, useEffect } from "react";
import {
  Users, UserPlus, Search, Eye, Pencil,
  Shield, Lock, Unlock, UserX, CheckCircle2,
  Mail, Phone, Calendar, Building2,
  Activity, Monitor, RefreshCw, X, AlertTriangle, Trash2
} from "lucide-react";
import AdminDrawer from "@/app/components/admin/AdminDrawer";
import {
  adminApi,
  AdminUserItem,
  AdminUserDetail,
  AdminDepartmentItem,
  AdminRoleItem,
  AdminUsersDashboardCounts
} from "@/app/services/admin";

// ── User Drawer ───────────────────────────────────────────────────────────
function UserDrawer({
  userId,
  onClose,
  onUserUpdated
}: {
  userId: string | null;
  onClose: () => void;
  onUserUpdated: () => void;
}) {
  const [detail, setDetail]           = useState<AdminUserDetail | null>(null);
  const [securityEvents, setEvents]  = useState<any[]>([]);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [actionMsg, setActionMsg]     = useState<string | null>(null);
  const [tab, setTab]                 = useState<"profile" | "tasks" | "activity" | "sessions" | "security" | "permissions">("profile");

  const loadUser = () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    adminApi.getUserDetail(userId)
      .then(setDetail)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));

    adminApi.getUserSecurityEvents(userId)
      .then(res => setEvents(res.items || []))
      .catch(() => {});
  };

  useEffect(() => {
    loadUser();
  }, [userId]);

  if (!userId) return null;

  const handleLock = async () => {
    try {
      await adminApi.lockUser(userId);
      setActionMsg("User account locked.");
      loadUser();
      onUserUpdated();
    } catch (err: any) {
      alert(`Lock failed: ${err.message}`);
    }
  };

  const handleUnlock = async () => {
    try {
      await adminApi.unlockUser(userId);
      setActionMsg("User account unlocked.");
      loadUser();
      onUserUpdated();
    } catch (err: any) {
      alert(`Unlock failed: ${err.message}`);
    }
  };

  const handleDeactivate = async () => {
    if (!confirm("Are you sure you want to deactivate this account?")) return;
    try {
      await adminApi.deactivateUser(userId);
      setActionMsg("User account deactivated.");
      loadUser();
      onUserUpdated();
    } catch (err: any) {
      alert(`Deactivation failed: ${err.message}`);
    }
  };

  const handleTerminateSession = async (sessionId: string) => {
    try {
      await adminApi.revokeUserSession(userId, sessionId);
      setActionMsg("Session terminated.");
      loadUser();
      onUserUpdated();
    } catch (err: any) {
      alert(`Session termination failed: ${err.message}`);
    }
  };

  const badge = detail ? (
    <>
      <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ backgroundColor: detail.avatar_color }}>
        {detail.initials}
      </div>
      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950/40">
        {detail.department_name}
      </span>
      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${detail.status === "ACTIVE" ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40" : detail.status === "LOCKED" ? "text-red-600 bg-red-50" : "text-muted-foreground bg-muted"}`}>
        ● {detail.status}
      </span>
    </>
  ) : null;

  const tabs: { id: typeof tab; label: string }[] = [
    { id: "profile",     label: "Profile"     },
    { id: "tasks",       label: "Tasks"       },
    { id: "activity",    label: "History"     },
    { id: "sessions",    label: "Sessions"    },
    { id: "security",    label: "Security"    },
    { id: "permissions", label: "Permissions" },
  ];

  return (
    <AdminDrawer
      open={!!userId}
      onClose={onClose}
      width={480}
      title={detail ? detail.full_name : "User Details"}
      subtitle={detail ? `${detail.role_name} · Joined ${detail.created_at ? new Date(detail.created_at).toLocaleDateString() : "N/A"}` : "Loading user..."}
      badge={badge}
      footer={
        detail ? (
          <div className="flex items-center gap-2">
            {detail.status === "LOCKED" ? (
              <button onClick={handleUnlock} className="flex-1 h-8 rounded-[8px] text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 flex items-center justify-center gap-1.5">
                <Unlock size={12} />Unlock Account
              </button>
            ) : (
              <button onClick={handleLock} className="flex-1 h-8 rounded-[8px] text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 flex items-center justify-center gap-1.5">
                <Lock size={12} />Lock Account
              </button>
            )}
            <button onClick={handleDeactivate} className="h-8 px-3 rounded-[8px] text-xs font-medium border border-red-200 text-red-600 hover:bg-red-50 flex items-center gap-1.5">
              <UserX size={12} />Deactivate
            </button>
          </div>
        ) : null
      }
    >
      {actionMsg && (
        <div className="mx-5 mt-3 p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-lg flex items-center justify-between">
          <span>{actionMsg}</span>
          <button onClick={() => setActionMsg(null)}><X size={12} /></button>
        </div>
      )}

      <div className="flex border-b border-border px-5 gap-0 overflow-x-auto">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-3 py-2.5 text-xs font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${tab === t.id ? "border-primary text-foreground font-bold" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-5 space-y-5">
        {loading ? (
          <div className="space-y-4 py-8">
            <div className="h-12 bg-muted rounded animate-pulse" />
            <div className="h-24 bg-muted rounded animate-pulse" />
          </div>
        ) : error ? (
          <div className="p-4 bg-red-50 text-red-700 text-xs rounded-xl">
            Failed to load detail: {error}
          </div>
        ) : detail ? (
          <>
            {tab === "profile" && (
              <>
                <div className="flex items-center gap-4 p-4 rounded-[12px] border border-border bg-muted/20">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold text-white flex-shrink-0" style={{ backgroundColor: detail.avatar_color }}>
                    {detail.initials}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">{detail.full_name}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{detail.role_name}</p>
                    <p className="text-[11px] font-medium text-primary mt-1">{detail.department_name}</p>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2.5">Contact & Account Info</p>
                  <div className="space-y-2">
                    {[
                      { icon: Mail,     label: "Email",    value: detail.email },
                      { icon: Phone,    label: "Phone",    value: detail.phone || "Not set" },
                      { icon: Building2,label: "Dept Code",value: detail.department_code || "—" },
                      { icon: Calendar, label: "Joined",   value: detail.created_at ? new Date(detail.created_at).toLocaleDateString() : "—" },
                    ].map(({ icon: Icon, label, value }) => (
                      <div key={label} className="flex items-center gap-3 p-2.5 rounded-[8px] border border-border">
                        <Icon size={13} className="text-muted-foreground flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[10px] text-muted-foreground">{label}</p>
                          <p className="text-xs font-medium text-foreground truncate">{value}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {tab === "tasks" && (
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-3">Assigned Tasks ({detail.open_tasks.length})</p>
                <div className="space-y-2">
                  {detail.open_tasks.map((task) => (
                    <div key={task.id} className="p-3 rounded-[10px] border border-border">
                      <p className="text-xs font-semibold text-foreground">{task.title}</p>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                        <span className="uppercase font-bold text-amber-600">{task.priority}</span>
                        <span>·</span>
                        <span>Due: {task.due_date ? new Date(task.due_date).toLocaleDateString() : "No deadline"}</span>
                      </div>
                    </div>
                  ))}
                  {detail.open_tasks.length === 0 && (
                    <p className="text-xs text-muted-foreground py-4 text-center">No assigned open tasks.</p>
                  )}
                </div>
              </div>
            )}

            {tab === "activity" && (
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-3">Login History ({detail.login_history.length})</p>
                <div className="space-y-2">
                  {detail.login_history.map((lh) => (
                    <div key={lh.id} className="p-2.5 rounded-[8px] border border-border flex items-center justify-between text-xs">
                      <div>
                        <p className="font-medium text-foreground">{lh.login_time ? new Date(lh.login_time).toLocaleString() : "—"}</p>
                        <p className="text-[10px] text-muted-foreground">{lh.browser} ({lh.ip_address})</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${lh.login_status === "SUCCESS" ? "text-emerald-600 bg-emerald-50" : "text-red-600 bg-red-50"}`}>
                        {lh.login_status}
                      </span>
                    </div>
                  ))}
                  {detail.login_history.length === 0 && (
                    <p className="text-xs text-muted-foreground py-4 text-center">No login history recorded.</p>
                  )}
                </div>
              </div>
            )}

            {tab === "sessions" && (
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-3">Active User Sessions ({detail.sessions.length})</p>
                <div className="space-y-2">
                  {detail.sessions.map((s) => (
                    <div key={s.id} className="p-3 rounded-[10px] border border-border flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Monitor size={14} className="text-muted-foreground" />
                        <div>
                          <p className="text-xs font-semibold text-foreground">{s.browser || "Browser"} on {s.operating_system || "OS"}</p>
                          <p className="text-[10px] text-muted-foreground">IP: {s.ip_address || "Unknown"} · Started {s.created_at ? new Date(s.created_at).toLocaleTimeString() : ""}</p>
                        </div>
                      </div>
                      <button onClick={() => handleTerminateSession(s.id)} className="h-6 px-2 text-[10px] text-red-600 border border-red-200 rounded hover:bg-red-50">
                        Terminate
                      </button>
                    </div>
                  ))}
                  {detail.sessions.length === 0 && (
                    <p className="text-xs text-muted-foreground py-4 text-center">No active user sessions.</p>
                  )}
                </div>
              </div>
            )}

            {tab === "security" && (
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-3">Security Audit Events ({securityEvents.length})</p>
                <div className="space-y-2">
                  {securityEvents.map((evt) => (
                    <div key={evt.id} className="p-2.5 rounded-[8px] border border-border flex items-start gap-2.5">
                      <AlertTriangle size={13} className="text-amber-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-foreground">{evt.event_type}</p>
                        <p className="text-[11px] text-muted-foreground">{evt.description}</p>
                        <p className="text-[9px] text-muted-foreground/60 mt-0.5">{evt.created_at ? new Date(evt.created_at).toLocaleString() : ""}</p>
                      </div>
                    </div>
                  ))}
                  {securityEvents.length === 0 && (
                    <p className="text-xs text-muted-foreground py-4 text-center">No security events logged for this user.</p>
                  )}
                </div>
              </div>
            )}

            {tab === "permissions" && (
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-3">Effective RBAC Permissions ({detail.permissions.length})</p>
                <div className="space-y-1.5">
                  {detail.permissions.map((perm, i) => (
                    <div key={i} className="flex items-center gap-2.5 p-2 rounded-[8px] border border-border bg-muted/10">
                      <CheckCircle2 size={13} className="text-emerald-500 flex-shrink-0" />
                      <span className="text-xs text-foreground font-mono">{perm}</span>
                    </div>
                  ))}
                  {detail.permissions.length === 0 && (
                    <p className="text-xs text-muted-foreground py-2">No explicit permissions attached to role.</p>
                  )}
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>
    </AdminDrawer>
  );
}

// ── Modal Form: Create / Edit User ───────────────────────────────────────
function UserModal({
  isOpen,
  onClose,
  user,
  departments,
  roles,
  onSuccess
}: {
  isOpen: boolean;
  onClose: () => void;
  user?: AdminUserItem | null;
  departments: AdminDepartmentItem[];
  roles: AdminRoleItem[];
  onSuccess: () => void;
}) {
  const [email, setEmail]         = useState(user?.email || "");
  const [firstName, setFirstName] = useState(user?.first_name || "");
  const [lastName, setLastName]   = useState(user?.last_name || "");
  const [deptId, setDeptId]       = useState(user?.department_id || "");
  const [roleId, setRoleId]       = useState(user?.role_id || "");
  const [isActive, setIsActive]   = useState(user?.is_active ?? true);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr]             = useState<string | null>(null);

  useEffect(() => {
    setEmail(user?.email || "");
    setFirstName(user?.first_name || "");
    setLastName(user?.last_name || "");
    setDeptId(user?.department_id || "");
    setRoleId(user?.role_id || "");
    setIsActive(user?.is_active ?? true);
    setErr(null);
  }, [user, isOpen]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (!user) {
      const cleanEmail = email.trim();
      if (!cleanEmail || !cleanEmail.includes("@")) {
        setErr("Please enter a valid email address.");
        return;
      }
      if (!firstName.trim()) {
        setErr("First Name is required.");
        return;
      }
      if (!deptId) {
        setErr("Please select a department.");
        return;
      }
      if (!roleId) {
        setErr("Please select a role.");
        return;
      }
    }

    setSubmitting(true);
    try {
      if (user) {
        await adminApi.updateUser(user.id, {
          first_name: firstName,
          last_name: lastName,
          department_id: deptId || null,
          role_id: roleId || null,
          is_active: isActive,
        });
      } else {
        await adminApi.createUser({
          email: email.trim(),
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          department_id: deptId || undefined,
          role_id: roleId || undefined,
          redirect_to: `${window.location.origin}/reset-password`,
        });
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
          <h2 className="text-sm font-bold text-foreground">{user ? "Edit User Account" : "Invite New User"}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
        </div>

        {err && <div className="p-3 text-xs bg-red-50 text-red-600 rounded-lg">{err}</div>}

        <form onSubmit={handleSubmit} className="space-y-3">
          {!user && (
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground">Email Address</label>
              <input
                type="email" required value={email} onChange={e => setEmail(e.target.value)}
                className="w-full h-8 px-3 rounded-[7px] text-xs bg-input-background border border-border text-foreground focus:outline-none"
                placeholder="user@qadrigroup.com"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground">First Name</label>
              <input
                type="text" value={firstName} onChange={e => setFirstName(e.target.value)}
                className="w-full h-8 px-3 rounded-[7px] text-xs bg-input-background border border-border text-foreground focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground">Last Name</label>
              <input
                type="text" value={lastName} onChange={e => setLastName(e.target.value)}
                className="w-full h-8 px-3 rounded-[7px] text-xs bg-input-background border border-border text-foreground focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-muted-foreground">Department</label>
            <select
              value={deptId} onChange={e => setDeptId(e.target.value)}
              className="w-full h-8 px-2.5 rounded-[7px] text-xs bg-input-background border border-border text-foreground focus:outline-none"
            >
              <option value="">Select Department...</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name} ({d.code})</option>)}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-muted-foreground">Role</label>
            <select
              value={roleId} onChange={e => setRoleId(e.target.value)}
              className="w-full h-8 px-2.5 rounded-[7px] text-xs bg-input-background border border-border text-foreground focus:outline-none"
            >
              <option value="">Select Role...</option>
              {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>

          {user && (
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox" id="user_active_chk" checked={isActive} onChange={e => setIsActive(e.target.checked)}
                className="rounded border-border"
              />
              <label htmlFor="user_active_chk" className="text-xs text-foreground cursor-pointer">Account Active</label>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
            <button type="button" onClick={onClose} className="h-8 px-4 text-xs border border-border rounded-[8px]">Cancel</button>
            <button type="submit" disabled={submitting} className="h-8 px-4 text-xs font-semibold text-white bg-primary rounded-[8px]">
              {submitting ? "Saving..." : user ? "Update User" : "Send Invite"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Users Management Page ───────────────────────────────────────────
export default function UsersPage() {
  const [users, setUsers]             = useState<AdminUserItem[]>([]);
  const [counts, setCounts]           = useState<AdminUsersDashboardCounts | null>(null);
  const [total, setTotal]             = useState(0);
  const [page, setPage]               = useState(1);
  const [pages, setPages]             = useState(1);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);

  const [departments, setDepartments] = useState<AdminDepartmentItem[]>([]);
  const [roles, setRoles]             = useState<AdminRoleItem[]>([]);

  const [search, setSearch]           = useState("");
  const [deptFilter, setDeptFilter]   = useState("");
  const [roleFilter, setRoleFilter]   = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [selectedId, setSelectedId]   = useState<string | null>(null);
  const [editUser, setEditUser]       = useState<AdminUserItem | null>(null);
  const [isInviteOpen, setIsInviteOpen] = useState(false);

  useEffect(() => {
    adminApi.getDepartments({ page_size: 100 }).then(res => setDepartments(res.items)).catch(() => {});
    adminApi.getRoles().then(res => setRoles(res.items)).catch(() => {});
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.getUsers({
        page,
        page_size: 15,
        search,
        department_id: deptFilter || undefined,
        role_id: roleFilter || undefined,
        status: statusFilter || undefined,
      });
      setUsers(res.items);
      setTotal(res.total);
      setPages(res.pages);
      if (res.dashboard_counts) setCounts(res.dashboard_counts);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page, search, deptFilter, roleFilter, statusFilter]);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to soft-delete this user account?")) return;
    try {
      await adminApi.deleteUser(id);
      fetchUsers();
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleLockUser = async (id: string) => {
    try {
      await adminApi.lockUser(id);
      fetchUsers();
    } catch (err: any) {
      alert(`Lock failed: ${err.message}`);
    }
  };

  const handleUnlockUser = async (id: string) => {
    try {
      await adminApi.unlockUser(id);
      fetchUsers();
    } catch (err: any) {
      alert(`Unlock failed: ${err.message}`);
    }
  };

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="p-4 space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-foreground">Users Management</h1>
            <p className="text-[11px] text-muted-foreground mt-0.5">{total} registered users in PostgreSQL</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchUsers}
              className="h-8 px-3 rounded-[8px] text-xs font-medium border border-border flex items-center gap-1 hover:bg-accent"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
            </button>
            <button
              onClick={() => setIsInviteOpen(true)}
              className="h-8 px-4 rounded-[8px] text-xs font-semibold text-white flex items-center gap-1.5 transition-all bg-primary"
            >
              <UserPlus size={13} />Invite User
            </button>
          </div>
        </div>

        {/* Live Dashboard Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
          {[
            { label: "Total Users",  value: counts?.total_users ?? total, color: "#F5821F" },
            { label: "Online Now",   value: counts?.online_users ?? 0,    color: "#22C55E" },
            { label: "Invited",      value: counts?.invited_users ?? 0,   color: "#3B82F6" },
            { label: "Locked",       value: counts?.locked_users ?? 0,    color: "#EF4444" },
            { label: "Inactive",     value: counts?.inactive_users ?? 0,  color: "#6B7280" },
            { label: "Admins",       value: counts?.admins ?? 0,          color: "#8B5CF6" },
            { label: "Dept Users",   value: counts?.department_users ?? 0, color: "#06B6D4" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-card border border-border rounded-xl p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">{label}</p>
              <p className="text-lg font-bold leading-tight mt-1" style={{ color }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="search" placeholder="Search name or email…"
              value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="w-full h-7 pl-7 pr-3 rounded-[7px] text-xs bg-input-background border border-border text-foreground focus:outline-none"
            />
          </div>

          <select value={deptFilter} onChange={e => { setDeptFilter(e.target.value); setPage(1); }}
            className="h-7 px-2.5 rounded-[7px] text-xs border border-border bg-input-background text-foreground cursor-pointer">
            <option value="">All Departments</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>

          <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(1); }}
            className="h-7 px-2.5 rounded-[7px] text-xs border border-border bg-input-background text-foreground cursor-pointer">
            <option value="">All Roles</option>
            {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>

          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="h-7 px-2.5 rounded-[7px] text-xs border border-border bg-input-background text-foreground cursor-pointer">
            <option value="">All Statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="INVITED">INVITED</option>
            <option value="INACTIVE">INACTIVE</option>
            <option value="LOCKED">LOCKED</option>
          </select>
        </div>

        {/* Users Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  {["User", "Email", "Department", "Role", "Status", "Projects", "Tasks", "Last Login", "Session", "Actions"].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={10} className="px-4 py-12 text-center text-xs text-muted-foreground">Loading users from PostgreSQL...</td></tr>
                ) : error ? (
                  <tr><td colSpan={10} className="px-4 py-8 text-center text-xs text-red-600">Failed to load users: {error}</td></tr>
                ) : users.length === 0 ? (
                  <tr><td colSpan={10} className="px-4 py-10 text-center text-sm text-muted-foreground">No users match your filters.</td></tr>
                ) : (
                  users.map((user) => (
                    <tr
                      key={user.id}
                      className="border-b border-border last:border-0 hover:bg-accent/20 transition-colors cursor-pointer"
                      onClick={() => setSelectedId(user.id)}
                    >
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0" style={{ backgroundColor: user.avatar_color }}>
                            {user.initials}
                          </div>
                          <span className="font-semibold text-foreground">{user.full_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5"><span className="text-[11px] text-muted-foreground">{user.email}</span></td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950/40">
                          {user.department_name}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap"><span className="text-[11px] text-foreground">{user.role_name}</span></td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${user.status === "ACTIVE" ? "text-emerald-600 bg-emerald-50" : user.status === "LOCKED" ? "text-red-600 bg-red-50" : "text-muted-foreground bg-muted"}`}>
                          {user.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center"><span className="text-[11px] font-semibold text-foreground">{user.assigned_projects}</span></td>
                      <td className="px-4 py-2.5 text-center"><span className="text-[11px] font-semibold text-foreground">{user.open_tasks}</span></td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className="text-[11px] text-muted-foreground">
                          {user.last_login ? new Date(user.last_login).toLocaleDateString() : "Never"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        {user.active_session
                          ? <span className="text-[10px] font-medium text-emerald-600 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />Online</span>
                          : <span className="text-[10px] text-muted-foreground">Offline</span>}
                      </td>
                      <td className="px-4 py-2.5" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <button onClick={() => setSelectedId(user.id)} className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-foreground" title="View Details">
                            <Eye size={11} />
                          </button>
                          <button onClick={() => setEditUser(user)} className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-foreground" title="Edit User">
                            <Pencil size={11} />
                          </button>
                          {user.status === "LOCKED" ? (
                            <button onClick={() => handleUnlockUser(user.id)} className="w-6 h-6 flex items-center justify-center text-emerald-600 hover:text-emerald-700" title="Unlock User">
                              <Unlock size={11} />
                            </button>
                          ) : (
                            <button onClick={() => handleLockUser(user.id)} className="w-6 h-6 flex items-center justify-center text-amber-600 hover:text-amber-700" title="Lock User">
                              <Lock size={11} />
                            </button>
                          )}
                          <button onClick={() => handleDelete(user.id)} className="w-6 h-6 flex items-center justify-center text-red-500 hover:text-red-700" title="Soft Delete">
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pages > 1 && (
            <div className="p-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
              <span>Page {page} of {pages} ({total} items)</span>
              <div className="flex gap-1">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-2.5 py-1 border border-border rounded disabled:opacity-40">Previous</button>
                <button disabled={page >= pages} onClick={() => setPage(p => p + 1)} className="px-2.5 py-1 border border-border rounded disabled:opacity-40">Next</button>
              </div>
            </div>
          )}
        </div>

      </div>

      <UserDrawer userId={selectedId} onClose={() => setSelectedId(null)} onUserUpdated={fetchUsers} />
      <UserModal isOpen={isInviteOpen} onClose={() => setIsInviteOpen(false)} departments={departments} roles={roles} onSuccess={fetchUsers} />
      <UserModal isOpen={!!editUser} user={editUser} onClose={() => setEditUser(null)} departments={departments} roles={roles} onSuccess={fetchUsers} />
    </main>
  );
}
