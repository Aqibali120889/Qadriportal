/**
 * src/app/services/admin.ts
 * ──────────────────────────────────────────────────────────────────────────────
 * Phase 11 — Typed API client for Super Admin endpoints.
 *
 * All requests go through the existing authenticated `request()` helper.
 * Endpoints:
 *   Dashboard:  GET /api/v1/admin/dashboard
 *   Projects:   GET /api/v1/admin/projects
 *   Customers:  GET /api/v1/admin/customers
 *   Depts:      GET/POST/PATCH/DELETE /api/v1/admin/departments, GET /api/v1/admin/departments/{id}
 *   Users:      GET/POST/PATCH/DELETE /api/v1/admin/users, GET /api/v1/admin/users/{id}
 *   Roles:      GET /api/v1/admin/roles
 */

import { supabase } from "@/app/lib/supabase";

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) || "";

// ── Auth helper (mirrors api.ts pattern) ──────────────────────────────────────
async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
    ...(init?.headers as Record<string, string> ?? {}),
  };

  const token = await getAccessToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  // No dev bypass — unauthenticated requests return 401 from the backend

  const response = await fetch(`${BASE_URL}${path}`, { ...init, headers });

  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const body = await response.json();
      detail = body.detail ?? body.message ?? detail;
    } catch {}
    throw new Error(detail);
  }

  // Support 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}

// ── Type Definitions ──────────────────────────────────────────────────────────

export interface AdminStatistics {
  total_rfqs:         number;
  active_rfqs:        number;
  completed_rfqs:     number;
  draft_rfqs:         number;
  on_hold_rfqs:       number;
  cancelled_rfqs:     number;
  today_rfqs:         number;
  active_departments: number;
  total_users:        number;
  active_users:       number;
  ai_processing_jobs?: number;
  pending_human_reviews?: number;
  total_kanban_tasks?: number;
  today_security_events?: number;
}

export interface AdminDeptStat {
  id:        string;
  name:      string;
  code:      string;
  total:     number;
  active:    number;
  completed: number;
  pending:   number;
  is_active: boolean;
  color:     string;
}

export interface AdminMonthlyTrend {
  month: string;
  year:  number;
  count: number;
}

export interface AdminRecentProject {
  id:             string;
  job_number:     string;
  title:          string;
  status:         string;
  status_display: string;
  priority:       string;
  progress:       number;
  department:     string;
  created_at:     string | null;
  updated_at:     string | null;
}

export interface AdminRecentNotification {
  id:         string;
  title:      string;
  message:    string;
  type:       string;
  is_read:    boolean;
  route:      string | null;
  event_type: string | null;
  created_at: string | null;
}

export interface AdminDashboardResponse {
  statistics:           AdminStatistics;
  department_stats:     AdminDeptStat[];
  status_distribution:  Record<string, number>;
  monthly_trend:        AdminMonthlyTrend[];
  recent_projects:      AdminRecentProject[];
  recent_notifications: AdminRecentNotification[];
}

export interface AdminProjectItem {
  id:             string;
  job_number:     string;
  rfq_number:     string | null;
  title:          string;
  status:         string;
  status_display: string;
  priority:       string;
  progress:       number;
  customer_id:    string | null;
  customer_name:  string | null;
  contact_person: string | null;
  customer_email: string | null;
  department_id:  string | null;
  department:     string;
  dept_code:      string;
  dept_color:     string;
  created_by:     string | null;
  created_at:     string | null;
  updated_at:     string | null;
}

export interface AdminProjectsResponse {
  items:     AdminProjectItem[];
  total:     number;
  page:      number;
  page_size: number;
  pages:     number;
}

export interface AdminProjectsParams {
  page?:          number;
  page_size?:     number;
  search?:        string;
  status?:        string;
  department_id?: string;
  sort?:          string;
}

export interface AdminCustomer {
  id:             string;
  company_name:   string | null;
  contact_person: string | null;
  email:          string | null;
  phone:          string | null;
  city:           string | null;
  country:        string | null;
  notes:          string | null;
  created_at:     string | null;
}

export interface AdminCustomersResponse {
  items:     AdminCustomer[];
  total:     number;
  page:      number;
  page_size: number;
  pages:     number;
}

// ── Department Types ─────────────────────────────────────────────────────────

export interface AdminDepartmentItem {
  id:                   string;
  name:                 string;
  code:                 string;
  description:          string;
  color:                string;
  is_active:            boolean;
  manager_id:           string | null;
  manager_name:         string;
  user_count:           number;
  active_projects:      number;
  pending_projects:     number;
  completed_projects:   number;
  total_projects:       number;
  open_tasks:           number;
  unread_notifications: number;
  created_at:           string | null;
}

export interface AdminDepartmentsResponse {
  items:     AdminDepartmentItem[];
  total:     number;
  page:      number;
  page_size: number;
  pages:     number;
}

export interface AdminDepartmentMember {
  id:         string;
  name:       string;
  email:      string;
  role:       string;
  status:     string;
  is_active:  boolean;
  last_login: string | null;
  is_head:    boolean;
}

export interface AdminDepartmentDetail {
  id:               string;
  name:             string;
  code:             string;
  description:      string;
  color:            string;
  is_active:        boolean;
  manager_id:       string | null;
  manager_name:     string;
  created_at:       string | null;
  members:          AdminDepartmentMember[];
  recent_projects:  { id: string; job_number: string; title: string; status: string; priority: string; updated_at: string | null }[];
  task_stats:       Record<string, number>;
  notifications:    { id: string; title: string; message: string; type: string; is_read: boolean; created_at: string | null }[];
}

// ── User Types ───────────────────────────────────────────────────────────────

export interface AdminUserItem {
  id:                string;
  employee_id:       string | null;
  first_name:        string;
  last_name:         string;
  full_name:         string;
  initials:          string;
  avatar_color:      string;
  avatar_url:        string | null;
  email:             string;
  phone:             string | null;
  status:            string;
  is_active:         boolean;
  department_id:     string | null;
  department_name:   string;
  department_code:   string;
  role_id:           string | null;
  role_name:         string;
  last_login:        string | null;
  created_at:        string | null;
  active_session:    boolean;
  assigned_projects: number;
  open_tasks:        number;
}

export interface AdminUsersDashboardCounts {
  total_users:      number;
  online_users:     number;
  invited_users:    number;
  locked_users:     number;
  inactive_users:   number;
  admins:           number;
  department_users: number;
}

export interface AdminUsersResponse {
  items:            AdminUserItem[];
  total:            number;
  page:             number;
  page_size:        number;
  pages:            number;
  dashboard_counts?: AdminUsersDashboardCounts;
}

export interface AdminUserSessionItem {
  id:               string;
  ip_address:       string | null;
  device:           string | null;
  browser:          string | null;
  operating_system: string | null;
  status:           string;
  created_at:       string | null;
}

export interface AdminLoginHistoryItem {
  id:               string;
  ip_address:       string | null;
  browser:          string | null;
  operating_system: string | null;
  login_status:     string;
  failure_reason:   string | null;
  login_time:       string | null;
}

export interface AdminUserDetail {
  id:                string;
  employee_id:       string | null;
  full_name:         string;
  first_name:        string;
  last_name:         string;
  initials:          string;
  avatar_color:      string;
  avatar_url:        string | null;
  email:             string;
  phone:             string | null;
  status:            string;
  is_active:         boolean;
  email_verified:    boolean;
  mfa_enabled:       boolean;
  last_login:        string | null;
  created_at:        string | null;
  department_id:     string | null;
  department_name:   string;
  department_code:   string;
  role_id:           string | null;
  role_name:         string;
  role_description:  string;
  is_super_admin:    boolean;
  permissions:       string[];
  sessions:          AdminUserSessionItem[];
  login_history:     AdminLoginHistoryItem[];
  assigned_projects: { id: string; job_number: string; title: string; status: string }[];
  open_tasks:        { id: string; title: string; status: string; priority: string; due_date: string | null }[];
}

export interface AdminRoleItem {
  id:          string;
  name:        string;
  description: string | null;
  is_system:   boolean;
}

// ── API Client ────────────────────────────────────────────────────────────────

export const adminApi = {
  // ── Dashboard ─────────────────────────────────────────────────────────────
  async getDashboard(): Promise<AdminDashboardResponse> {
    return request<AdminDashboardResponse>("/api/v1/admin/dashboard");
  },

  // ── Projects ──────────────────────────────────────────────────────────────
  async getProjects(params: AdminProjectsParams = {}): Promise<AdminProjectsResponse> {
    const qs = new URLSearchParams();
    if (params.page)          qs.set("page",          String(params.page));
    if (params.page_size)     qs.set("page_size",      String(params.page_size));
    if (params.search?.trim()) qs.set("search",        params.search.trim());
    if (params.status?.trim()) qs.set("status",        params.status.trim());
    if (params.department_id)  qs.set("department_id", params.department_id);
    if (params.sort)           qs.set("sort",          params.sort);
    const query = qs.toString();
    return request<AdminProjectsResponse>(`/api/v1/admin/projects${query ? `?${query}` : ""}`);
  },

  // ── Customers ─────────────────────────────────────────────────────────────
  async getCustomers(params: { page?: number; page_size?: number; search?: string } = {}): Promise<AdminCustomersResponse> {
    const qs = new URLSearchParams();
    if (params.page)           qs.set("page",      String(params.page));
    if (params.page_size)      qs.set("page_size",  String(params.page_size));
    if (params.search?.trim()) qs.set("search",    params.search.trim());
    const query = qs.toString();
    return request<AdminCustomersResponse>(`/api/v1/admin/customers${query ? `?${query}` : ""}`);
  },

  // ── Departments ───────────────────────────────────────────────────────────
  async getDepartments(params: { page?: number; page_size?: number; search?: string; is_active?: boolean; sort?: string } = {}): Promise<AdminDepartmentsResponse> {
    const qs = new URLSearchParams();
    if (params.page)                     qs.set("page",      String(params.page));
    if (params.page_size)                qs.set("page_size",  String(params.page_size));
    if (params.search?.trim())           qs.set("search",    params.search.trim());
    if (params.is_active !== undefined) qs.set("is_active", String(params.is_active));
    if (params.sort)                     qs.set("sort",      params.sort);
    const query = qs.toString();
    return request<AdminDepartmentsResponse>(`/api/v1/admin/departments${query ? `?${query}` : ""}`);
  },

  async getDepartmentDetail(id: string): Promise<AdminDepartmentDetail> {
    return request<AdminDepartmentDetail>(`/api/v1/admin/departments/${id}`);
  },

  async createDepartment(data: { name: string; code: string; description?: string; manager_id?: string }): Promise<AdminDepartmentItem> {
    return request<AdminDepartmentItem>("/api/v1/admin/departments", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async updateDepartment(id: string, data: { name?: string; description?: string; is_active?: boolean; manager_id?: string | null }): Promise<AdminDepartmentItem> {
    return request<AdminDepartmentItem>(`/api/v1/admin/departments/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  async deleteDepartment(id: string): Promise<void> {
    return request<void>(`/api/v1/admin/departments/${id}`, {
      method: "DELETE",
    });
  },

  async getDepartmentAnalytics(id: string): Promise<{
    department_id: string;
    total_projects: number;
    completed_rfqs: number;
    pending_rfqs: number;
    avg_processing_time_days: number;
    ai_processing_count: number;
    human_reviews: number;
    open_notifications: number;
    open_tasks: number;
  }> {
    return request(`/api/v1/admin/departments/${id}/analytics`);
  },

  // ── Users ──────────────────────────────────────────────────────────────────
  async getUsers(params: { page?: number; page_size?: number; search?: string; department_id?: string; role_id?: string; status?: string; sort?: string } = {}): Promise<AdminUsersResponse> {
    const qs = new URLSearchParams();
    if (params.page)           qs.set("page",          String(params.page));
    if (params.page_size)      qs.set("page_size",      String(params.page_size));
    if (params.search?.trim()) qs.set("search",        params.search.trim());
    if (params.department_id)  qs.set("department_id", params.department_id);
    if (params.role_id)        qs.set("role_id",        params.role_id);
    if (params.status)         qs.set("status",         params.status);
    if (params.sort)           qs.set("sort",          params.sort);
    const query = qs.toString();
    return request<AdminUsersResponse>(`/api/v1/admin/users${query ? `?${query}` : ""}`);
  },

  async getUserDetail(id: string): Promise<AdminUserDetail> {
    return request<AdminUserDetail>(`/api/v1/admin/users/${id}`);
  },

  async createUser(data: { email: string; first_name?: string; last_name?: string; department_id?: string; role_id?: string; redirect_to?: string }): Promise<{ id: string; email: string; status: string }> {
    return request<{ id: string; email: string; status: string }>("/api/v1/admin/users", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async updateUser(id: string, data: { first_name?: string; last_name?: string; department_id?: string | null; role_id?: string | null; status?: string; is_active?: boolean }): Promise<{ id: string; status: string; is_active: boolean }> {
    return request<{ id: string; status: string; is_active: boolean }>(`/api/v1/admin/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  async deleteUser(id: string): Promise<void> {
    return request<void>(`/api/v1/admin/users/${id}`, {
      method: "DELETE",
    });
  },

  async lockUser(id: string): Promise<{ message: string }> {
    return request<{ message: string }>(`/api/v1/admin/users/${id}/lock`, { method: "POST" });
  },

  async unlockUser(id: string): Promise<{ message: string }> {
    return request<{ message: string }>(`/api/v1/admin/users/${id}/unlock`, { method: "POST" });
  },

  async deactivateUser(id: string): Promise<{ message: string }> {
    return request<{ message: string }>(`/api/v1/admin/users/${id}/deactivate`, { method: "POST" });
  },

  async assignUserRole(id: string, role_id: string | null): Promise<{ message: string }> {
    return request<{ message: string }>(`/api/v1/admin/users/${id}/role`, {
      method: "POST",
      body: JSON.stringify({ role_id }),
    });
  },

  async assignUserDepartment(id: string, department_id: string | null): Promise<{ message: string }> {
    return request<{ message: string }>(`/api/v1/admin/users/${id}/department`, {
      method: "POST",
      body: JSON.stringify({ department_id }),
    });
  },

  async getUserSessions(id: string): Promise<{ items: AdminUserSessionItem[] }> {
    return request<{ items: AdminUserSessionItem[] }>(`/api/v1/admin/users/${id}/sessions`);
  },

  async revokeUserSession(userId: string, sessionId: string): Promise<void> {
    return request<void>(`/api/v1/admin/users/${userId}/sessions/${sessionId}`, { method: "DELETE" });
  },

  async getUserHistory(id: string): Promise<{ items: AdminLoginHistoryItem[] }> {
    return request<{ items: AdminLoginHistoryItem[] }>(`/api/v1/admin/users/${id}/history`);
  },

  async getUserSecurityEvents(id: string): Promise<{ items: any[] }> {
    return request<{ items: any[] }>(`/api/v1/admin/users/${id}/security-events`);
  },

  // ── Roles Dropdown ────────────────────────────────────────────────────────
  async getRoles(): Promise<{ items: AdminRoleItem[] }> {
    return request<{ items: AdminRoleItem[] }>("/api/v1/admin/roles");
  },

  // ── History & Audit ───────────────────────────────────────────────────────
  async getHistory(params: {
    page?: number;
    page_size?: number;
    search?: string;
    module?: string;
    severity?: string;
    department_id?: string;
    user_id?: string;
    project_id?: string;
    date_range?: string;
  } = {}): Promise<AdminHistoryResponse> {
    const qs = new URLSearchParams();
    if (params.page)          qs.set("page",          String(params.page));
    if (params.page_size)     qs.set("page_size",     String(params.page_size));
    if (params.search?.trim())qs.set("search",        params.search.trim());
    if (params.module)        qs.set("module",        params.module);
    if (params.severity)      qs.set("severity",      params.severity);
    if (params.department_id) qs.set("department_id", params.department_id);
    if (params.user_id)       qs.set("user_id",       params.user_id);
    if (params.project_id)    qs.set("project_id",    params.project_id);
    if (params.date_range)    qs.set("date_range",    params.date_range);
    const query = qs.toString();
    return request<AdminHistoryResponse>(`/api/v1/admin/history${query ? `?${query}` : ""}`);
  },

  async getHistoryDetail(id: string): Promise<any> {
    return request<any>(`/api/v1/admin/history/${id}`);
  },

  async getProjectHistory(projectId: string): Promise<{ items: any[] }> {
    return request<{ items: any[] }>(`/api/v1/admin/history/project/${projectId}`);
  },

  async getUserActivityTimeline(userId: string): Promise<{ items: any[] }> {
    return request<{ items: any[] }>(`/api/v1/admin/history/user/${userId}`);
  },

  getExportHistoryUrl(params: {
    search?: string;
    module?: string;
    severity?: string;
    department_id?: string;
    user_id?: string;
    project_id?: string;
    date_range?: string;
  } = {}): string {
    const qs = new URLSearchParams();
    if (params.search?.trim())qs.set("search",        params.search.trim());
    if (params.module)        qs.set("module",        params.module);
    if (params.severity)      qs.set("severity",      params.severity);
    if (params.department_id) qs.set("department_id", params.department_id);
    if (params.user_id)       qs.set("user_id",       params.user_id);
    if (params.project_id)    qs.set("project_id",    params.project_id);
    if (params.date_range)    qs.set("date_range",    params.date_range);
    const query = qs.toString();
    return `/api/v1/admin/history/export${query ? `?${query}` : ""}`;
  },

  // ── Settings ──────────────────────────────────────────────────────────────
  async getAllSettings(): Promise<Record<string, Record<string, any>>> {
    return request<Record<string, Record<string, any>>>("/api/v1/admin/settings");
  },

  async getSettingsCategory(category: string): Promise<Record<string, any>> {
    return request<Record<string, any>>(`/api/v1/admin/settings/${category}`);
  },

  async updateSettingsCategory(category: string, data: Record<string, any>): Promise<Record<string, any>> {
    return request<Record<string, any>>(`/api/v1/admin/settings/${category}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  async testEmail(): Promise<IntegrationTestResult> {
    return request<IntegrationTestResult>("/api/v1/admin/settings/test-email", { method: "POST" });
  },

  async testAI(): Promise<IntegrationTestResult> {
    return request<IntegrationTestResult>("/api/v1/admin/settings/test-ai", { method: "POST" });
  },

  async testStorage(): Promise<IntegrationTestResult> {
    return request<IntegrationTestResult>("/api/v1/admin/settings/test-storage", { method: "POST" });
  },

  async testWebhook(): Promise<IntegrationTestResult> {
    return request<IntegrationTestResult>("/api/v1/admin/settings/test-webhook", { method: "POST" });
  },
};

export interface AdminHistoryItem {
  id: string;
  event_type: string;
  module: string;
  entity_name?: string;
  entity_id?: string;
  description: string;
  severity: "INFO" | "WARNING" | "ERROR" | "CRITICAL";
  timestamp: string;
  date_group: string;
  created_at?: string;
  performed_by?: string;
  user: string;
  user_initials: string;
  department: string;
  project_id?: string;
  job_number?: string;
  project_title?: string;
}

export interface AdminHistoryResponse {
  items: AdminHistoryItem[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
  statistics: {
    today_activities: number;
    total_activities: number;
    active_users_today: number;
    ai_processing_jobs: number;
    human_reviews: number;
    projects_updated: number;
    kanban_changes: number;
    notifications_sent: number;
    system_events: number;
    security_events: number;
  };
}

export type SettingCategory =
  | "general" | "organization" | "departments" | "email"
  | "ai" | "notifications" | "security" | "storage"
  | "system" | "integrations" | "audit" | "appearance";

export interface IntegrationTestResult {
  status: "SUCCESS" | "FAILED";
  message: string;
  latency_ms?: number;
  model_version?: string;
  free_space?: string;
}
