/**
 * Frontend/src/app/services/notifications.ts
 * ──────────────────────────────────────────────────────────────────────────────
 * Typed API client for the Notification Center (Bell dropdown) + the live
 * SSE stream. Follows the same auth/fetch conventions as services/api.ts.
 */

import { supabase } from "@/app/lib/supabase";

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) || "";


export interface NotificationItem {
  id: string;
  project_id: string | null;
  rfq_number: string | null;
  department_id: string | null;
  user_id: string | null;
  event_type: string | null;
  notification_type: "INFO" | "SUCCESS" | "WARNING" | "ERROR" | "TASK";
  title: string;
  message: string | null;
  route: string | null;
  is_read: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string;
  read_at: string | null;
}

export interface PaginatedNotifications {
  items: NotificationItem[];
  total: number;
  page: number;
  page_size: number;
  has_next: boolean;
}

async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  // No dev bypass — unauthenticated requests return 401 from the backend
  return headers;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = await authHeaders();
  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers: { ...headers, ...(init?.headers as Record<string, string> ?? {}) } });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail?.message ?? body.message ?? `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

/** Shared "5m ago" / "2h ago" formatter — used by every Bell dropdown variant. */
export function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export const notificationsApi = {
  list: (page = 1, pageSize = 20, unreadOnly = false): Promise<PaginatedNotifications> =>
    request<PaginatedNotifications>(
      `/api/v1/notifications?page=${page}&page_size=${pageSize}&unread_only=${unreadOnly}`
    ),

  unreadCount: (): Promise<{ unread_count: number }> =>
    request<{ unread_count: number }>("/api/v1/notifications/unread-count"),

  markRead: (id: string): Promise<{ id: string; is_read: boolean; read_at: string | null }> =>
    request(`/api/v1/notifications/${id}/read`, { method: "PATCH" }),

  markAllRead: (): Promise<{ updated: number }> =>
    request("/api/v1/notifications/read-all", { method: "PATCH" }),
};

/**
 * Open the live notification stream (SSE). Browser EventSource cannot send
 * custom headers, so the token travels as a query param — the backend's
 * get_request_context_sse dependency exists specifically for this endpoint.
 *
 * Returns a cleanup function that closes the connection. Reconnection is
 * handled natively by EventSource (the browser automatically retries on
 * drop) — no hand-rolled backoff needed for this app's scale.
 */
export async function connectNotificationStream(
  onEvent: (n: NotificationItem) => void,
  onError?: (err: Event) => void,
): Promise<() => void> {
  const token = await getAccessToken();
  if (!token) {
    // No session — cannot open SSE stream; caller will handle the absence
    return () => {};
  }

  const params = new URLSearchParams();
  params.set("token", token);

  const source = new EventSource(`${BASE_URL}/api/v1/notifications/stream?${params.toString()}`);

  source.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data) as NotificationItem;
      onEvent(data);
    } catch {
      // Ignore malformed/heartbeat frames — heartbeats are SSE comments
      // (": keep-alive") and never reach onmessage in the first place.
    }
  };

  source.onerror = (err) => {
    onError?.(err);
  };

  return () => source.close();
}
