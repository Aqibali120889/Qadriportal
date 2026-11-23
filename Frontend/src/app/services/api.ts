/**
 * Frontend/src/app/services/api.ts
 * ──────────────────────────────────────────────────────────────────────────────
 * Typed API client for the FastAPI backend.
 *
 * All requests go through the single VITE_API_BASE_URL environment variable.
 * The frontend NEVER talks to Supabase directly for data — all data flows
 * through FastAPI.
 *
 * Authentication: every request (except public health check) automatically
 * attaches the Supabase access token via the Authorization header.
 */

import { supabase } from "@/app/lib/supabase";

// ── Base URL ──────────────────────────────────────────────────────────────────
const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) || "";


// ── Type Definitions ──────────────────────────────────────────────────────────

export interface FileRecord {
  id: string;
  original_name: string | null;
  mime_type: string | null;
  file_size: number | null;
  storage_path: string | null;
  storage_provider: string | null;
  status: string;
  current_version: number;
  created_at: string;
}

export interface DrawingRecord {
  id: string;
  drawing_title: string | null;
  drawing_number: string | null;
  revision: string | null;
  total_pages: number | null;
  file: FileRecord | null;
  signed_url: string | null;
  created_at: string;
}

export interface AttachmentRecord {
  id: string;
  attachment_name: string | null;
  attachment_size: number | null;
  file: FileRecord | null;
}

export interface EmailRecord {
  id: string;
  subject: string | null;
  body: string | null;
  body_preview: string | null;
  sender_email: string | null;
  received_at: string | null;
  attachments: AttachmentRecord[];
}

export interface ProjectListItem {
  id: string;
  job_number: string;
  title: string | null;
  status: string;
  priority: string | null;
  sender_email: string | null;
  attachment_count: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectDetail {
  id: string;
  job_number: string;
  title: string | null;
  status: string;
  priority: string | null;
  created_at: string;
  updated_at: string;
  email: EmailRecord | null;
  drawing: DrawingRecord | null;
  files: FileRecord[];
}

export interface PaginatedProjects {
  items: ProjectListItem[];
  total: number;
  page: number;
  page_size: number;
  has_next: boolean;
}

// ── Phase 3: Dashboard Stats ──────────────────────────────────────────────────

export interface DepartmentStats {
  department_id: string;
  department_name: string;
  department_code: string;
  total: number;
  draft: number;
  active: number;
  on_hold: number;
  completed: number;
  cancelled: number;
}

// ── Phase 3: Kanban Board ─────────────────────────────────────────────────────

export interface KanbanTaskItem {
  id: string;
  job_number: string;
  rfq_number: string | null;
  title: string | null;
  status: string;           // DB status: DRAFT | ACTIVE | ON_HOLD | COMPLETED | CANCELLED
  kanban_column: string;    // pending | in-progress | review | completed
  priority: string | null;
  sender_email: string | null;
  attachment_count: number;
  estimated_completion: string | null;
  created_at: string;
  updated_at: string;
  drawing_number: string | null;
  drawing_status: string;   // NONE | RECEIVED
  ai_status: string;        // NONE | QUEUED | PROCESSING | COMPLETED | FAILED
  has_excel_session: boolean;
}

export interface KanbanBoardResponse {
  department_id: string;
  department_code: string;
  tasks: KanbanTaskItem[];
  columns: string[];
}

// ── Phase 3: History ──────────────────────────────────────────────────────────

export interface HistoryItem {
  id: string;
  event_type: string;    // "notification" | "project_created" | "project_updated"
  title: string;
  message: string | null;
  project_id: string | null;
  job_number: string | null;
  notification_type: string | null;  // INFO | SUCCESS | WARNING | ERROR | TASK
  status: string | null;
  created_at: string;
}

export interface PaginatedHistory {
  items: HistoryItem[];
  total: number;
  page: number;
  page_size: number;
  has_next: boolean;
}

// ── Error ─────────────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ── HTTP Helper ───────────────────────────────────────────────────────────────

/**
 * Get the current Supabase access token.
 * Returns null if the user is not authenticated.
 */
async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/**
 * Authenticated fetch wrapper.
 * Automatically attaches the Supabase JWT to every request.
 */
async function request<T>(
  path: string,
  init?: RequestInit,
  requireAuth = true,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
    ...(init?.headers as Record<string, string> ?? {}),
  };

  if (requireAuth) {
    const token = await getAccessToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    // No dev bypass — unauthenticated requests return 401 from the backend
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    let errorBody: { code?: string; message?: string; detail?: string } = {};
    try {
      errorBody = await response.json();
    } catch {
      // Non-JSON error body
    }
    throw new ApiError(
      response.status,
      errorBody.code ?? "UNKNOWN_ERROR",
      errorBody.message ?? errorBody.detail ?? `HTTP ${response.status}`,
    );
  }

  // 204 No Content — return empty
  if (response.status === 204) {
    return undefined as unknown as T;
  }

  return response.json() as Promise<T>;
}

// ── API Client ────────────────────────────────────────────────────────────────

export const api = {
  // ── Projects (department-scoped) ──────────────────────────────────────────
  projects: {
    list: (page = 1, pageSize = 20): Promise<PaginatedProjects> =>
      request<PaginatedProjects>(`/api/v1/projects?page=${page}&page_size=${pageSize}`),

    getDetail: (projectId: string): Promise<ProjectDetail> =>
      request<ProjectDetail>(`/api/v1/projects/${projectId}`),

    getEmail: (projectId: string): Promise<EmailRecord> =>
      request<EmailRecord>(`/api/v1/projects/${projectId}/email`),

    getDrawing: (projectId: string): Promise<DrawingRecord> =>
      request<DrawingRecord>(`/api/v1/projects/${projectId}/drawing`),

    // Phase 3 additions
    stats: (): Promise<DepartmentStats> =>
      request<DepartmentStats>("/api/v1/projects/stats"),

    kanban: (): Promise<KanbanBoardResponse> =>
      request<KanbanBoardResponse>("/api/v1/projects/kanban"),

    updateStatus: (projectId: string, status: string): Promise<{ id: string; status: string; kanban_column: string }> =>
      request(`/api/v1/projects/${projectId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
  },

  // ── History (department-scoped) ────────────────────────────────────────────
  history: {
    list: (page = 1, pageSize = 20): Promise<PaginatedHistory> =>
      request<PaginatedHistory>(`/api/v1/history?page=${page}&page_size=${pageSize}`),
  },

  // ── Health (public, no auth) ──────────────────────────────────────────────
  health: (): Promise<{ status: string; version: string }> =>
    request<{ status: string; version: string }>("/health", undefined, false),
};

export { request };

// ── Convenience alias used by useProjectList hook ────────────────────────────
// Exposes a listProjects() method that returns { items, total } shape.
export const projectApi = {
  listProjects: (opts: { limit?: number; page?: number } = {}): Promise<PaginatedProjects> => {
    const page = opts.page ?? 1;
    const pageSize = opts.limit ?? 200;
    return request<PaginatedProjects>(`/api/v1/projects?page=${page}&page_size=${pageSize}`);
  },
};
