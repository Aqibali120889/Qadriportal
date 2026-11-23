/**
 * Frontend/src/app/pages/AIAssistant.tsx
 * ──────────────────────────────────────────────────────────────────────────────
 * Phase 8.1: AI Assistant — Complete RFQ Context Integration
 *
 * New in 8.1:
 *   ✅ RFQ selector is fully connected to /api/v1/assistant/rfqs (dept-scoped)
 *   ✅ Every chat message forwards: project_id, rfq_number, department,
 *      user_id, session_id, conversation_id, timestamp  → n8n webhook
 *   ✅ Switching RFQ clears the active chat and starts a fresh conversation
 *   ✅ Selected RFQ is persisted to localStorage (survives refresh)
 *   ✅ session_id is a stable UUID per browser session
 *   ✅ Context panel + mode badge stay in sync with selected RFQ
 *
 * Architecture:
 *   User selects RFQ → setSelectedRFQ → new conversation auto-created
 *   → FastAPI /api/v1/assistant/chat
 *   → n8n RAG Webhook (full payload)
 *   → AI response stored + returned
 *   → Rendered in existing ChatInterface / MessageBubble components
 *
 * Reuses ALL existing UI sub-components.
 */

import {
  useState, useEffect, useCallback, useRef, useMemo,
} from "react";
import { useOutletContext, useLocation } from "react-router";
import {
  X, Bell, Sun, Moon, Plus, ChevronDown, Search,
  User, Settings, LogOut, Globe, ChevronRight, AlertCircle,
  Info,
} from "lucide-react";
import { Link } from "react-router";
import ConversationHistory from "@/app/components/ai-assistant/ConversationHistory";
import ChatInterface from "@/app/components/ai-assistant/ChatInterface";
import ContextPanel from "@/app/components/ai-assistant/ContextPanel";
import type { Conversation, Message, ContextChip } from "@/app/types/ai-assistant";
import { assistantApi, type RFQItem, type AIConversation } from "@/app/services/assistant";

// Shared layout context — both CELayoutContext and FoundryLayoutContext
// have the same shape: { dark: boolean; toggleDark: () => void }
interface LayoutContext {
  dark: boolean;
  toggleDark: () => void;
}


// ── Constants ─────────────────────────────────────────────────────────────────

const LS_SELECTED_RFQ_KEY = "qadri_ai_selected_rfq";
const LS_SESSION_ID_KEY   = "qadri_ai_session_id";

/** Stable session UUID — generated once per browser session. */
function getSessionId(): string {
  let sid = sessionStorage.getItem(LS_SESSION_ID_KEY);
  if (!sid) {
    sid = crypto.randomUUID();
    sessionStorage.setItem(LS_SESSION_ID_KEY, sid);
  }
  return sid;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toLocalTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit",
  });
}

function toRelativeDate(iso: string): string {
  const d       = new Date(iso);
  const diffMs  = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1)  return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  return diffDays === 1 ? "Yesterday" : `${diffDays} days ago`;
}

function toFrontendMessage(m: {
  id: string; role: "user" | "assistant"; content: string; created_at: string;
}): Message {
  return {
    id:         m.id,
    role:       m.role,
    content:    m.content,
    timestamp:  toLocalTime(m.created_at),
    confidence: m.role === "assistant" ? "high" : undefined,
  };
}

function toFrontendConversation(c: AIConversation, messages: Message[] = []): Conversation {
  return {
    id:          c.id,
    title:       c.title ?? (c.rfq_number ? `Chat — ${c.rfq_number}` : "Global Chat"),
    rfqId:       c.rfq_number ?? undefined,
    preview:     messages[messages.length - 1]?.content.slice(0, 60) ?? "",
    lastUpdated: c.last_message_at
      ? toRelativeDate(c.last_message_at)
      : toRelativeDate(c.created_at),
    pinned:   false,
    archived: false,
    messages,
  };
}

// ── RFQ Selector ──────────────────────────────────────────────────────────────

interface RFQSelectorProps {
  rfqs:     RFQItem[];
  selected: RFQItem | null;
  loading:  boolean;
  onSelect: (rfq: RFQItem | null) => void;
}

function RFQSelector({ rfqs, selected, loading, onSelect }: RFQSelectorProps) {
  const [open,   setOpen]   = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = useMemo(
    () =>
      rfqs.filter(
        (r) =>
          r.rfq_number.toLowerCase().includes(search.toLowerCase()) ||
          (r.title ?? "").toLowerCase().includes(search.toLowerCase()),
      ),
    [rfqs, search],
  );

  const statusColor = (s: string) => {
    if (s === "ACTIVE")    return { bg: "rgba(34,197,94,0.15)",  text: "rgb(22,163,74)" };
    if (s === "COMPLETED") return { bg: "rgba(99,102,241,0.15)", text: "rgb(79,70,229)" };
    return                        { bg: "rgba(148,163,184,0.15)", text: "rgb(100,116,139)" };
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={loading}
        id="rfq-selector-btn"
        className="flex items-center gap-2 h-7 pl-2.5 pr-2 rounded-[7px] border border-border bg-input-background hover:bg-accent text-xs transition-all min-w-[180px] max-w-[260px]"
      >
        {selected ? (
          <>
            <span className="font-semibold text-foreground truncate flex-1 text-left">
              {selected.rfq_number}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); onSelect(null); }}
              className="flex-shrink-0 text-muted-foreground hover:text-foreground"
              aria-label="Clear RFQ selection"
            >
              <X size={11} />
            </button>
          </>
        ) : (
          <>
            <Globe size={12} className="text-muted-foreground flex-shrink-0" />
            <span className="text-muted-foreground flex-1 text-left truncate">
              {loading ? "Loading RFQs…" : "Global mode — select RFQ"}
            </span>
            <ChevronDown size={11} className="text-muted-foreground flex-shrink-0" />
          </>
        )}
      </button>

      {open && (
        <div className="absolute top-9 left-0 w-80 bg-card border border-border rounded-[10px] shadow-[0_8px_24px_rgba(0,0,0,0.16)] overflow-hidden z-50">
          {/* Search */}
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                autoFocus
                type="search"
                placeholder="Search by RFQ number or title…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-7 pl-7 pr-3 rounded-[6px] text-xs bg-input-background border border-border text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/30"
              />
            </div>
          </div>

          {/* Global mode */}
          <button
            onClick={() => { onSelect(null); setOpen(false); setSearch(""); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-accent transition-colors border-b border-border"
          >
            <Globe size={12} className="text-muted-foreground" />
            <span className="font-medium text-foreground">Global Mode</span>
            <span className="ml-auto text-muted-foreground text-[10px]">Full knowledge base</span>
          </button>

          {/* RFQ list */}
          <div className="max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-xs text-muted-foreground text-center">
                {loading
                  ? "Loading RFQs…"
                  : search
                    ? "No RFQs match your search"
                    : "No RFQs available for your department"
                }
              </p>
            ) : (
              filtered.map((rfq) => {
                const col = statusColor(rfq.status);
                return (
                  <button
                    key={rfq.project_id}
                    onClick={() => { onSelect(rfq); setOpen(false); setSearch(""); }}
                    className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs hover:bg-accent transition-colors text-left ${
                      selected?.project_id === rfq.project_id ? "bg-accent" : ""
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground truncate">{rfq.rfq_number}</p>
                      {rfq.title && (
                        <p className="text-muted-foreground truncate text-[10px] mt-0.5">{rfq.title}</p>
                      )}
                    </div>
                    <span
                      className="flex-shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                      style={{ backgroundColor: col.bg, color: col.text }}
                    >
                      {rfq.status}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer hint */}
          {rfqs.length > 0 && (
            <div className="px-3 py-2 border-t border-border flex items-center gap-1.5">
              <Info size={10} className="text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">
                {rfqs.length} RFQ{rfqs.length !== 1 ? "s" : ""} in your department
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Active RFQ Context Banner ─────────────────────────────────────────────────

function RFQContextBanner({ rfq }: { rfq: RFQItem }) {
  const statusColor = rfq.status === "ACTIVE"
    ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900 text-green-700 dark:text-green-400"
    : "bg-indigo-50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-900 text-indigo-700 dark:text-indigo-400";

  return (
    <div className={`flex items-center gap-2 px-4 py-1.5 border-b text-[11px] ${statusColor}`}>
      <ChevronRight size={11} className="flex-shrink-0" />
      <span className="font-semibold">{rfq.rfq_number}</span>
      {rfq.title && <span className="text-muted-foreground truncate max-w-xs">— {rfq.title}</span>}
      <span className="ml-auto font-medium opacity-70">{rfq.status}</span>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AIAssistant() {
  const { dark, toggleDark } = useOutletContext<LayoutContext>();
  const location = useLocation();
  const isFoundry = location.pathname.startsWith("/foundry");
  // Department-aware accent color
  const accentColor    = isFoundry ? "#F59E0B" : "#F5821F";
  const accentHover    = isFoundry ? "#D97706" : "#D9710E";
  const dashboardRoute = isFoundry ? "/foundry"   : "/dashboard";

  // ── Stable session ID ────────────────────────────────────────────────────
  const sessionId = useMemo(() => getSessionId(), []);

  // ── State ─────────────────────────────────────────────────────────────────
  const [rfqs,       setRfqs]       = useState<RFQItem[]>([]);
  const [rfqsLoading, setRfqsLoading] = useState(true);

  // Restore persisted RFQ selection on mount
  const [selectedRFQ, setSelectedRFQState] = useState<RFQItem | null>(() => {
    try {
      const stored = localStorage.getItem(LS_SELECTED_RFQ_KEY);
      return stored ? (JSON.parse(stored) as RFQItem) : null;
    } catch {
      return null;
    }
  });

  const [conversations,  setConversations]  = useState<Conversation[]>([]);
  const [activeConvId,   setActiveConvId]   = useState<string | null>(null);
  const [convsLoading,   setConvsLoading]   = useState(true);
  const [contextChips,   setContextChips]   = useState<ContextChip[]>([]);
  const [isStreaming,    setIsStreaming]     = useState(false);
  const [sendError,      setSendError]      = useState<string | null>(null);
  const [isSendingWithFile, setIsSendingWithFile] = useState(false);
  const [uploadBanner,  setUploadBanner]    = useState<{ ok: boolean; msg: string } | null>(null);
  const [userMenuOpen,  setUserMenuOpen]    = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // ── Persist + setter ──────────────────────────────────────────────────────
  const setSelectedRFQ = useCallback((rfq: RFQItem | null) => {
    setSelectedRFQState(rfq);
    if (rfq) {
      localStorage.setItem(LS_SELECTED_RFQ_KEY, JSON.stringify(rfq));
    } else {
      localStorage.removeItem(LS_SELECTED_RFQ_KEY);
    }
  }, []);

  // ── Derived ───────────────────────────────────────────────────────────────
  const activeConv = conversations.find((c) => c.id === activeConvId) ?? null;

  // ── Load RFQs on mount ────────────────────────────────────────────────────
  useEffect(() => {
    assistantApi.listRFQs()
      .then((list) => {
        setRfqs(list);
        // If a persisted RFQ is no longer in the list (e.g. deleted), clear it
        if (selectedRFQ) {
          const still = list.find((r) => r.project_id === selectedRFQ.project_id);
          if (!still) {
            setSelectedRFQ(null);
          } else {
            // Refresh with latest data (status may have changed)
            setSelectedRFQState(still);
          }
        }
      })
      .catch(() => setRfqs([]))
      .finally(() => setRfqsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Load conversations on mount ───────────────────────────────────────────
  useEffect(() => {
    assistantApi.listConversations()
      .then((apiConvs) => {
        const mapped = apiConvs.map((c) => toFrontendConversation(c));
        setConversations(mapped);
        // Restore to conversation that matches selected RFQ, else most recent
        if (selectedRFQ) {
          const match = mapped.find((c) => c.rfqId === selectedRFQ.rfq_number);
          setActiveConvId(match?.id ?? null);
        } else if (mapped.length > 0) {
          setActiveConvId(mapped[0].id);
        }
      })
      .catch(() => setConversations([]))
      .finally(() => setConvsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Load messages when active conversation changes ────────────────────────
  useEffect(() => {
    if (!activeConvId) return;
    const conv = conversations.find((c) => c.id === activeConvId);
    if (conv && conv.messages.length === 0) {
      assistantApi.getMessages(activeConvId)
        .then((msgs) => {
          const mapped = msgs.map(toFrontendMessage);
          setConversations((prev) =>
            prev.map((c) => c.id === activeConvId ? { ...c, messages: mapped } : c),
          );
        })
        .catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConvId]);

  // ── RFQ change: reset active conversation ─────────────────────────────────
  // When user picks a different RFQ, clear the active chat so the next
  // message auto-creates a fresh conversation scoped to that RFQ.
  const prevRFQRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const prevRFQ = prevRFQRef.current;
    // Skip the very first render
    if (prevRFQ === undefined) {
      prevRFQRef.current = selectedRFQ?.rfq_number ?? null;
      return;
    }
    const newRFQ = selectedRFQ?.rfq_number ?? null;
    if (newRFQ === prevRFQ) return;

    prevRFQRef.current = newRFQ;
    setSendError(null);

    if (newRFQ) {
      // Try to resume an existing conversation for this RFQ
      const existing = conversations.find((c) => c.rfqId === newRFQ);
      setActiveConvId(existing?.id ?? null);
    } else {
      // Switched to global mode — resume most-recent global conversation
      const globalConv = conversations.find((c) => !c.rfqId);
      setActiveConvId(globalConv?.id ?? null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRFQ]);

  // ── Context chips stay in sync with selected RFQ ──────────────────────────
  useEffect(() => {
    if (selectedRFQ) {
      setContextChips([
        { id: "rfq",    label: selectedRFQ.rfq_number,         type: "rfq" },
        { id: "status", label: `Status: ${selectedRFQ.status}`, type: "general" },
        ...(selectedRFQ.title
          ? [{ id: "title", label: selectedRFQ.title, type: "project" as const }]
          : []),
      ]);
    } else {
      setContextChips([{ id: "global", label: "Global Knowledge Base", type: "general" }]);
    }
  }, [selectedRFQ]);

  // ── Close user menu on outside click ─────────────────────────────────────
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node))
        setUserMenuOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Send message ──────────────────────────────────────────────────────────
  const handleSend = useCallback(
    async (text: string, _attachments: string[]) => {
      setSendError(null);

      const tempUserId = `u-${Date.now()}`;
      const ts = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
      const userMsg: Message = { id: tempUserId, role: "user", content: text, timestamp: ts };

      let convId = activeConvId;

      setConversations((prev) => {
        if (convId) {
          return prev.map((c) =>
            c.id === convId
              ? { ...c, messages: [...c.messages, userMsg], lastUpdated: "Just now", preview: text.slice(0, 60) }
              : c,
          );
        }
        return prev;
      });

      setIsStreaming(true);

      try {
        const resp = await assistantApi.chat(
          text,
          convId ?? undefined,
          selectedRFQ?.rfq_number,
          !selectedRFQ,             // globalMode
          selectedRFQ?.project_id,  // project_id — NEW in 8.1
          sessionId,                // session_id — NEW in 8.1
        );

        const newConvId = resp.conversation_id;

        if (!convId) {
          const newConv: Conversation = {
            id:          newConvId,
            title:       selectedRFQ ? `Chat — ${selectedRFQ.rfq_number}` : "Global Chat",
            rfqId:       selectedRFQ?.rfq_number,
            preview:     text.slice(0, 60),
            lastUpdated: "Just now",
            pinned:      false,
            archived:    false,
            messages:    [userMsg, toFrontendMessage(resp.message)],
          };
          setConversations((prev) => [newConv, ...prev]);
          setActiveConvId(newConvId);
          return;
        }

        const assistantMsg = toFrontendMessage(resp.message);
        setConversations((prev) =>
          prev.map((c) =>
            c.id === newConvId
              ? {
                  ...c,
                  messages:    [...c.messages, assistantMsg],
                  lastUpdated: "Just now",
                  preview:     assistantMsg.content.slice(0, 60),
                }
              : c,
          ),
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to reach AI assistant";
        setSendError(msg);
        setConversations((prev) =>
          prev.map((c) =>
            c.id === convId
              ? { ...c, messages: c.messages.filter((m) => m.id !== tempUserId) }
              : c,
          ),
        );
      } finally {
        setIsStreaming(false);
      }
    },
    [activeConvId, selectedRFQ, sessionId],
  );

  // ── New conversation ──────────────────────────────────────────────────────
  const handleNewConversation = useCallback(() => {
    setActiveConvId(null);
    setSendError(null);
  }, []);

  // ── Select conversation ───────────────────────────────────────────────────
  const handleSelectConversation = useCallback((id: string) => {
    setActiveConvId(id);
    setSendError(null);
  }, []);

  // ── Delete conversation ───────────────────────────────────────────────────
  const handleDelete = useCallback(
    async (id: string) => {
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConvId === id) {
        const remaining = conversations.filter((c) => c.id !== id);
        setActiveConvId(remaining[0]?.id ?? null);
      }
      try { await assistantApi.deleteConversation(id); } catch { /* ignore */ }
    },
    [activeConvId, conversations],
  );

  const handlePin = useCallback((id: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, pinned: !c.pinned } : c)),
    );
  }, []);

  const handleRename = useCallback((id: string, title: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title } : c)),
    );
  }, []);

  const handleRegenerate = useCallback(
    (msgId: string) => {
      const conv = conversations.find((c) => c.id === activeConvId);
      if (!conv) return;
      const msgIdx = conv.messages.findIndex((m) => m.id === msgId);
      if (msgIdx < 1) return;
      const prevUser = conv.messages[msgIdx - 1];
      if (prevUser?.role === "user") handleSend(prevUser.content, []);
    },
    [conversations, activeConvId, handleSend],
  );

  const handleLike = useCallback((msgId: string, liked: boolean) => {
    setConversations((prev) =>
      prev.map((c) => ({
        ...c,
        messages: c.messages.map((m) => (m.id === msgId ? { ...m, liked } : m)),
      })),
    );
  }, []);

  const handleSuggestedAction = useCallback(
    (label: string) => handleSend(label, []),
    [handleSend],
  );
  const handleAddChip = useCallback((chip: ContextChip) => {
    setContextChips((prev) => [...prev, chip]);
  }, []);
  const handleRemoveChip = useCallback((id: string) => {
    setContextChips((prev) => prev.filter((c) => c.id !== id));
  }, []);

  // ── Send text + file ──────────────────────────────────────────────────────
  const handleSendWithFile = useCallback(
    async (text: string, file: File) => {
      setSendError(null);
      setIsSendingWithFile(true);
      setUploadBanner(null);

      const tempUserId = `u-${Date.now()}`;
      const ts = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
      const displayText = `${text}\n\n📎 _${file.name}_`;
      const userMsg: Message = { id: tempUserId, role: "user", content: displayText, timestamp: ts };

      let convId = activeConvId;
      setConversations((prev) => {
        if (convId) {
          return prev.map((c) =>
            c.id === convId
              ? { ...c, messages: [...c.messages, userMsg], lastUpdated: "Just now", preview: text.slice(0, 60) }
              : c,
          );
        }
        return prev;
      });

      try {
        const result = await assistantApi.chatWithFile(
          text,
          file,
          convId ?? undefined,
          selectedRFQ?.rfq_number,
          !selectedRFQ,
          selectedRFQ?.project_id,  // NEW in 8.1
          sessionId,                // NEW in 8.1
        );

        const newConvId = result.conversation_id;

        if (!convId) {
          const newConv: Conversation = {
            id:          newConvId,
            title:       selectedRFQ ? `Chat — ${selectedRFQ.rfq_number}` : "Global Chat",
            rfqId:       selectedRFQ?.rfq_number,
            preview:     text.slice(0, 60),
            lastUpdated: "Just now",
            pinned:      false,
            archived:    false,
            messages:    [userMsg, toFrontendMessage(result.message)],
          };
          setConversations((prev) => [newConv, ...prev]);
          setActiveConvId(newConvId);
        } else {
          const assistantMsg = toFrontendMessage(result.message);
          setConversations((prev) =>
            prev.map((c) =>
              c.id === newConvId
                ? { ...c, messages: [...c.messages, assistantMsg], lastUpdated: "Just now", preview: assistantMsg.content.slice(0, 60) }
                : c,
            ),
          );
        }

        setUploadBanner({ ok: true, msg: `✓ "${file.name}" processed with your message.` });
        setTimeout(() => setUploadBanner(null), 5000);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to send message with file";
        setSendError(msg);
        setConversations((prev) =>
          prev.map((c) =>
            c.id === convId
              ? { ...c, messages: c.messages.filter((m) => m.id !== tempUserId) }
              : c,
          ),
        );
      } finally {
        setIsSendingWithFile(false);
      }
    },
    [activeConvId, selectedRFQ, sessionId],
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

      {/* ── Top nav ──────────────────────────────────────────────────────────── */}
      <header className="h-12 flex-shrink-0 border-b border-border bg-card flex items-center gap-3 px-4 z-20">
        <span className="text-sm font-semibold text-foreground flex-shrink-0">
          AI Assistant
        </span>
        <div className="w-px h-5 bg-border mx-0.5 flex-shrink-0" />

        {/* RFQ Selector — the core of Phase 8.1 */}
        <RFQSelector
          rfqs={rfqs}
          selected={selectedRFQ}
          loading={rfqsLoading}
          onSelect={(rfq) => {
            setSelectedRFQ(rfq);
            setSendError(null);
          }}
        />

        {/* Mode badge */}
        <div className={`hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
          selectedRFQ
            ? "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300"
            : "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"
        }`}>
          {selectedRFQ ? (
            <><ChevronRight size={9} />{selectedRFQ.rfq_number}</>
          ) : (
            <><Globe size={9} />Global Mode</>
          )}
        </div>

        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={toggleDark}
            className="w-7 h-7 flex items-center justify-center rounded-[7px] text-muted-foreground hover:bg-accent transition-all"
          >
            {dark ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          <button className="w-7 h-7 flex items-center justify-center rounded-[7px] text-muted-foreground hover:bg-accent relative transition-all">
            <Bell size={14} />
            <span
              className="absolute top-0.5 right-0.5 w-2.5 h-2.5 rounded-full text-[8px] font-bold text-white flex items-center justify-center"
              style={{ backgroundColor: "#F5821F" }}
            >
              2
            </span>
          </button>

          <button
            id="new-chat-btn"
            onClick={handleNewConversation}
            className="hidden sm:flex h-7 items-center gap-1.5 px-2.5 rounded-[7px] text-xs font-semibold text-white transition-all"
            style={{ backgroundColor: accentColor }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = accentHover)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = accentColor)}
          >
            <Plus size={12} />New Chat
          </button>

          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setUserMenuOpen((v) => !v)}
              className="flex items-center gap-1.5 h-7 pl-1 pr-2 rounded-[7px] hover:bg-accent transition-all"
            >
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                style={{ backgroundColor: "#3B82F6" }}
              >
                AA
              </div>
              <ChevronDown size={11} className="text-muted-foreground" />
            </button>
            {userMenuOpen && (
              <div className="absolute right-0 top-9 w-48 bg-card border border-border rounded-[10px] shadow-[0_8px_24px_rgba(0,0,0,0.12)] overflow-hidden z-50 py-1">
                <div className="px-3 py-2 border-b border-border">
                  <p className="text-xs font-semibold text-foreground">Aqib Ali</p>
                  <p className="text-[10px] text-muted-foreground">Cost Estimation Engineer</p>
                </div>
                {[
                  { icon: User, label: "Profile" },
                  { icon: Settings, label: "Preferences" },
                ].map(({ icon: Icon, label }) => (
                  <button
                    key={label}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-foreground hover:bg-accent transition-colors"
                  >
                    <Icon size={13} className="text-muted-foreground" />
                    {label}
                  </button>
                ))}
                <div className="h-px bg-border my-1" />
                <Link
                  to={dashboardRoute}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent transition-colors"
                >
                  ← Back to Dashboard
                </Link>
                <button className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
                  <LogOut size={13} />Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Active RFQ context banner ─────────────────────────────────────── */}
      {selectedRFQ && <RFQContextBanner rfq={selectedRFQ} />}

      {/* ── Error banner ─────────────────────────────────────────────────────── */}
      {sendError && (
        <div className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-950/30 border-b border-red-200 dark:border-red-900 text-xs text-red-600 dark:text-red-400">
          <AlertCircle size={13} className="flex-shrink-0" />
          <span className="flex-1">{sendError}</span>
          <button onClick={() => setSendError(null)} className="hover:opacity-70">
            <X size={12} />
          </button>
        </div>
      )}

      {/* ── File-send status banner ───────────────────────────────────────────── */}
      {(isSendingWithFile || uploadBanner) && (
        <div className={`flex items-center gap-2 px-4 py-2 border-b text-xs ${
          isSendingWithFile
            ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900 text-amber-700 dark:text-amber-300"
            : uploadBanner?.ok
              ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900 text-green-700 dark:text-green-300"
              : "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900 text-red-600 dark:text-red-400"
        }`}>
          {isSendingWithFile
            ? <span className="animate-pulse">Sending message + file to AI…</span>
            : <span className="flex-1">{uploadBanner?.msg}</span>
          }
          {!isSendingWithFile && (
            <button onClick={() => setUploadBanner(null)} className="hover:opacity-70 ml-auto">
              <X size={12} />
            </button>
          )}
        </div>
      )}

      {/* ── Three-panel layout ───────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar: conversation history */}
        <div className="hidden md:flex flex-col flex-shrink-0" style={{ width: 240 }}>
          {convsLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <span className="text-xs text-muted-foreground animate-pulse">Loading…</span>
            </div>
          ) : (
            <ConversationHistory
              conversations={conversations}
              activeId={activeConvId ?? ""}
              onSelect={handleSelectConversation}
              onNew={handleNewConversation}
              onDelete={handleDelete}
              onPin={handlePin}
              onRename={handleRename}
            />
          )}
        </div>

        {/* Main chat */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          <ChatInterface
            messages={activeConv?.messages ?? []}
            isStreaming={isStreaming}
            contextChips={contextChips}
            onSend={handleSend}
            onSendWithFile={handleSendWithFile}
            isSendingWithFile={isSendingWithFile}
            onRegenerate={handleRegenerate}
            onLike={handleLike}
            onRemoveChip={handleRemoveChip}
            onSuggestedAction={handleSuggestedAction}
            conversationTitle={
              activeConv?.title ??
              (selectedRFQ ? `New Chat — ${selectedRFQ.rfq_number}` : "New Global Chat")
            }
          />
        </div>

        {/* Context panel */}
        <div
          className="hidden xl:flex flex-col flex-shrink-0 border-l border-border"
          style={{ width: 268 }}
        >
          <ContextPanel
            contextChips={contextChips}
            onAddChip={handleAddChip}
            onRemoveChip={handleRemoveChip}
            onSuggestedAction={handleSuggestedAction}
          />
        </div>
      </div>
    </div>
  );
}
