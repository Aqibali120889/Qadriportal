/**
 * Frontend/src/app/services/tasks.ts
 * ──────────────────────────────────────────────────────────────────────────────
 * Phase 10 — Typed API client for the Kanban task management system.
 * Mirrors all /api/v1/tasks/* endpoints.
 */

import { supabase } from "@/app/lib/supabase";
import type {
  AssignableUser,
  BoardResponse,
  KanbanTask,
  TaskComment,
  TaskDetail,
  TaskHistoryEntry,
  TaskPriority,
  TaskStatus,
} from "@/app/types/kanban";

const BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string) || "";

// ── Auth header ───────────────────────────────────────────────────────────────

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
  };
  // Always attach Authorization when a real session token exists
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  // No dev bypass — unauthenticated requests return 401 from the backend
  return headers;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = await authHeaders();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { ...headers, ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const j = await res.json(); msg = j.detail ?? JSON.stringify(j); } catch { }
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ── Board ─────────────────────────────────────────────────────────────────────

export interface BoardFilters {
  project_id?: string;
  department_id?: string;
  assigned_to?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  search?: string;
  my_tasks?: boolean;
  include_cancelled?: boolean;
}

export async function getBoard(filters: BoardFilters = {}): Promise<BoardResponse> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
  });
  const q = params.toString();
  return request<BoardResponse>(`/api/v1/tasks/board${q ? `?${q}` : ""}`);
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export interface CreateTaskPayload {
  project_id: string;
  title: string;
  description?: string;
  task_type?: string;
  priority?: TaskPriority;
  assigned_to?: string | null;
  due_date?: string | null;
  estimated_hours?: number | null;
  department_id?: string;  // Super Admin: explicit dept scoping
}

export async function createTask(payload: CreateTaskPayload): Promise<KanbanTask> {
  return request<KanbanTask>("/api/v1/tasks/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getTask(taskId: string): Promise<TaskDetail> {
  return request<TaskDetail>(`/api/v1/tasks/${taskId}`);
}

export interface UpdateTaskPayload {
  title?: string;
  description?: string;
  task_type?: string;
  priority?: TaskPriority;
  assigned_to?: string | null;
  due_date?: string | null;
  estimated_hours?: number | null;
}

export async function updateTask(taskId: string, payload: UpdateTaskPayload): Promise<KanbanTask> {
  return request<KanbanTask>(`/api/v1/tasks/${taskId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function cancelTask(taskId: string): Promise<void> {
  return request<void>(`/api/v1/tasks/${taskId}`, { method: "DELETE" });
}

// ── Status (DnD) ──────────────────────────────────────────────────────────────

export async function moveTaskStatus(taskId: string, newStatus: TaskStatus): Promise<KanbanTask> {
  return request<KanbanTask>(`/api/v1/tasks/${taskId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status: newStatus }),
  });
}

// ── Assignment ────────────────────────────────────────────────────────────────

export async function assignTask(taskId: string, userId: string | null): Promise<KanbanTask> {
  return request<KanbanTask>(`/api/v1/tasks/${taskId}/assign`, {
    method: "POST",
    body: JSON.stringify({ assigned_to: userId }),
  });
}

// ── Comments ──────────────────────────────────────────────────────────────────

export async function addComment(taskId: string, content: string): Promise<TaskComment> {
  return request<TaskComment>(`/api/v1/tasks/${taskId}/comment`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}

// ── History ───────────────────────────────────────────────────────────────────

export async function getTaskHistory(taskId: string): Promise<TaskHistoryEntry[]> {
  return request<TaskHistoryEntry[]>(`/api/v1/tasks/${taskId}/history`);
}

// ── Users ─────────────────────────────────────────────────────────────────────

export async function getAssignableUsers(): Promise<AssignableUser[]> {
  return request<AssignableUser[]>("/api/v1/tasks/meta/users");
}

// ── Project tasks ─────────────────────────────────────────────────────────────

export async function getProjectTasks(projectId: string): Promise<BoardResponse> {
  return request<BoardResponse>(`/api/v1/tasks/project/${projectId}`);
}

// ── Kanban project list (department-scoped) ───────────────────────────────────

export interface KanbanProject {
  id: string;
  rfq_number: string;
  job_number: string;
  title: string;
  status: string;
  department_id: string | null;
}

export async function getKanbanProjects(search?: string): Promise<KanbanProject[]> {
  const params = search ? `?search=${encodeURIComponent(search)}` : "";
  return request<KanbanProject[]>(`/api/v1/tasks/meta/projects${params}`);
}
