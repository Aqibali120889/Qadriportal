/**
 * Frontend/src/app/services/assistant.ts
 * ──────────────────────────────────────────────────────────────────────────────
 * Phase 8.1: Typed API client for the AI Assistant module.
 *
 * All authenticated requests go through the existing request() helper.
 * FormData endpoints (chatWithFile, ingestDocument) use raw fetch with
 * the Supabase access token from the current session.
 *
 * Phase 2A: Removed dev bypass token and X-Dev-User-Email header.
 */

import { supabase } from "@/app/lib/supabase";
import { request } from "./api";

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) || "";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RFQItem {
  rfq_number:  string;
  project_id:  string;
  title:       string | null;
  status:      string;
}

export interface AIMessage {
  id:         string;
  role:       "user" | "assistant";
  content:    string;
  metadata:   Record<string, unknown>;
  created_at: string;
}

export interface AIConversation {
  id:              string;
  title:           string | null;
  rfq_number:      string | null;
  project_id:      string | null;
  message_count:   number;
  last_message_at: string | null;
  created_at:      string;
}

export interface ChatResponse {
  conversation_id: string;
  message:         AIMessage;
  rfq_number:      string | null;
  global_mode:     boolean;
}

export interface DocumentIngestResponse {
  success:    boolean;
  message:    string;
  filename:   string;
  size_mb:    number | null;
  rfq_number: string | null;
  project_id: string | null;
}

// ── API Client ────────────────────────────────────────────────────────────────

export const assistantApi = {
  /** List all RFQ numbers accessible to the current user (department-scoped). */
  listRFQs: (): Promise<RFQItem[]> =>
    request<RFQItem[]>("/api/v1/assistant/rfqs"),

  /** List all AI conversations for the current user. */
  listConversations: (): Promise<AIConversation[]> =>
    request<AIConversation[]>("/api/v1/assistant/conversations"),

  /** Create a new conversation, optionally tied to an RFQ. */
  createConversation: (rfq_number?: string, title?: string): Promise<AIConversation> =>
    request<AIConversation>("/api/v1/assistant/conversations", {
      method: "POST",
      body: JSON.stringify({ rfq_number: rfq_number ?? null, title: title ?? null }),
    }),

  /** Load all messages for a conversation. */
  getMessages: (conversationId: string): Promise<AIMessage[]> =>
    request<AIMessage[]>(`/api/v1/assistant/conversations/${conversationId}/messages`),

  /** Delete a conversation. */
  deleteConversation: (conversationId: string): Promise<void> =>
    request<void>(`/api/v1/assistant/conversations/${conversationId}`, {
      method: "DELETE",
    }),

  /**
   * Send a message to the RAG assistant with full context metadata.
   *
   * The backend will forward to n8n with the complete payload:
   *   question, project_id, rfq_number, department, user_id,
   *   session_id, conversation_id, timestamp
   *
   * @param message        The user's text question
   * @param conversationId Existing conversation ID (undefined → auto-create)
   * @param rfqNumber      Selected RFQ number (undefined → global mode)
   * @param globalMode     Explicitly request global knowledge-base mode
   * @param projectId      Resolved project UUID for the selected RFQ
   * @param sessionId      Client-side session UUID (persisted across reloads)
   */
  chat: (
    message:         string,
    conversationId?: string,
    rfqNumber?:      string,
    globalMode  = false,
    projectId?:      string,
    sessionId?:      string,
  ): Promise<ChatResponse> =>
    request<ChatResponse>("/api/v1/assistant/chat", {
      method: "POST",
      body: JSON.stringify({
        message,
        conversation_id: conversationId ?? null,
        rfq_number:      rfqNumber      ?? null,
        global_mode:     globalMode,
        project_id:      projectId      ?? null,
        session_id:      sessionId      ?? null,
      }),
    }),

  /**
   * Send a text message WITH a file attachment.
   * Uses FormData (multipart) — cannot use the base request() helper.
   */
  chatWithFile: async (
    message:          string,
    file:             File,
    conversationId?:  string,
    rfqNumber?:       string,
    globalMode  = false,
    projectId?:       string,
    sessionId?:       string,
  ): Promise<ChatResponse> => {
    const { data } = await supabase.auth.getSession();
    const token    = data.session?.access_token;

    const form = new FormData();
    form.append("message",     message);
    form.append("file",        file);
    form.append("global_mode", String(globalMode));
    if (conversationId) form.append("conversation_id", conversationId);
    if (rfqNumber)      form.append("rfq_number",      rfqNumber);
    if (projectId)      form.append("project_id",      projectId);
    if (sessionId)      form.append("session_id",      sessionId);

    const headers: Record<string, string> = {
      "ngrok-skip-browser-warning": "true",
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    // No dev bypass — unauthenticated requests return 401 from the backend

    const response = await fetch(`${BASE_URL}/api/v1/assistant/chat-with-file`, {
      method: "POST",
      headers,
      body:   form,
    });

    if (!response.ok) {
      let detail = `HTTP ${response.status}`;
      try {
        const err = await response.json();
        detail = err.message ?? err.detail ?? detail;
      } catch { /* non-JSON error body */ }
      throw new Error(detail);
    }

    return response.json() as Promise<ChatResponse>;
  },

  /**
   * Upload a PDF/DOCX/DOC/TXT document to the AI knowledge base.
   * Bytes are forwarded to n8n's vector-ingest webhook — not stored in DB.
   */
  ingestDocument: async (
    file:         File,
    rfqNumber?:   string,
    description?: string,
  ): Promise<DocumentIngestResponse> => {
    const { data } = await supabase.auth.getSession();
    const token    = data.session?.access_token;

    const form = new FormData();
    form.append("file", file);
    if (rfqNumber)   form.append("rfq_number",  rfqNumber);
    if (description) form.append("description", description);

    const headers: Record<string, string> = {
      "ngrok-skip-browser-warning": "true",
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    // No dev bypass — unauthenticated requests return 401 from the backend
    // NOTE: Do NOT set Content-Type — browser sets the multipart boundary automatically.

    const response = await fetch(`${BASE_URL}/api/v1/assistant/documents/ingest`, {
      method: "POST",
      headers,
      body:   form,
    });

    if (!response.ok) {
      let detail = `HTTP ${response.status}`;
      try {
        const err = await response.json();
        detail = err.message ?? err.detail ?? detail;
      } catch { /* non-JSON error body */ }
      throw new Error(detail);
    }

    return response.json() as Promise<DocumentIngestResponse>;
  },
};
