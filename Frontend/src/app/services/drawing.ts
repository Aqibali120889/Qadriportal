/**
 * services/drawing.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Phase 4: API client for the AI Drawing Processing pipeline.
 *
 * All endpoints are under /api/v1/projects/{projectId}/drawing/
 */

const BASE = (import.meta.env.VITE_API_BASE_URL as string) || "";


async function drawingRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
    ...(init?.headers as Record<string, string> ?? {}),
  };
  const { supabase } = await import("@/app/lib/supabase");
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  // No dev bypass — unauthenticated requests return 401 from the backend

  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.message ?? err.detail ?? `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ProcessingStatus {
  project_id: string;
  status: "NONE" | "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";
  job_id: string | null;
  extraction_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
}

export interface ProcessResult {
  project_id: string;
  job_id: string | null;
  extraction_id: string | null;
  status: string;
  cached: boolean;
  entity_count: number | null;
  error: string | null;
}

export interface ExtractionField {
  id: string;
  label: string;
  value: string;
  originalValue: string;
  confidence: "high" | "medium" | "low";
  reviewStatus: "pending" | "approved" | "rejected";
  isEdited: boolean;
  unit?: string;
}

export interface ExtractionSection {
  id: string;
  title: string;
  fields: ExtractionField[];
}

export interface ExtractionData {
  project_id: string;
  total_fields: number;
  reviewed_count: number;
  sections: ExtractionSection[];
  has_extraction: boolean;
}

// ── API Client ────────────────────────────────────────────────────────────────

export const drawingApi = {
  /**
   * Trigger AI processing. Returns cached result immediately if already processed.
   */
  processDrawing: (projectId: string): Promise<ProcessResult> =>
    drawingRequest<ProcessResult>(`/api/v1/projects/${projectId}/drawing/process`, {
      method: "POST",
      body: JSON.stringify({}),
    }),

  /**
   * Get the latest processing job status.
   */
  getStatus: (projectId: string): Promise<ProcessingStatus> =>
    drawingRequest<ProcessingStatus>(`/api/v1/projects/${projectId}/drawing/status`),

  /**
   * Get the full extraction data (sections + fields) for the AI Extraction Panel.
   */
  getExtraction: (projectId: string): Promise<ExtractionData> =>
    drawingRequest<ExtractionData>(`/api/v1/projects/${projectId}/drawing/extraction`),

  /**
   * Approve, reject, or edit an extracted field.
   * Returns rfq_synced=true when the field was approved and pushed to the RFQ worksheet.
   */
  reviewField: (
    projectId: string,
    entityId: string,
    reviewStatus: "approved" | "rejected" | "pending",
    value?: string
  ): Promise<{ id: string; review_status: string; value: string | null; rfq_synced: boolean }> =>
    drawingRequest(`/api/v1/projects/${projectId}/drawing/extraction/${entityId}`, {
      method: "PATCH",
      body: JSON.stringify({ review_status: reviewStatus, value: value ?? null }),
    }),

  /**
   * Force reprocess — creates a fresh AI job regardless of existing results.
   */
  reprocessDrawing: (projectId: string): Promise<ProcessResult> =>
    drawingRequest<ProcessResult>(`/api/v1/projects/${projectId}/drawing/reprocess`, {
      method: "POST",
      body: JSON.stringify({}),
    }),

  /**
   * Bulk sync all approved fields into the linked RFQ worksheet.
   * Safe to call multiple times — only empty cells are written.
   */
  syncToRFQ: (projectId: string): Promise<{
    project_id: string;
    synced: boolean;
    fields_updated: string[];
    rfq_id: string | null;
  }> =>
    drawingRequest(`/api/v1/projects/${projectId}/drawing/sync`, {
      method: "POST",
      body: JSON.stringify({}),
    }),
};
