import { useState } from "react";
import {
  Plus, Search, Pin, Star, Trash2, Archive,
  Edit3, MoreHorizontal, MessageSquare, Tag,
} from "lucide-react";
import type { Conversation } from "@/app/types/ai-assistant";

interface ConversationHistoryProps {
  conversations: Conversation[];
  activeId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onPin: (id: string) => void;
  onRename: (id: string, title: string) => void;
}

interface ContextMenuState {
  id: string;
  x: number;
  y: number;
}

export default function ConversationHistory({
  conversations, activeId, onSelect, onNew, onDelete, onPin, onRename,
}: ConversationHistoryProps) {
  const [search, setSearch] = useState("");
  const [ctxMenu, setCtxMenu] = useState<ContextMenuState | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");

  const filtered = conversations.filter(
    (c) =>
      !c.archived &&
      (c.title.toLowerCase().includes(search.toLowerCase()) ||
        (c.rfqId?.toLowerCase().includes(search.toLowerCase()) ?? false))
  );
  const pinned = filtered.filter((c) => c.pinned);
  const recent = filtered.filter((c) => !c.pinned);

  function openCtx(e: React.MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ id, x: e.clientX, y: e.clientY });
  }

  function closeCtx() { setCtxMenu(null); }

  function startRename(id: string, title: string) {
    setRenaming(id);
    setRenameVal(title);
    closeCtx();
  }

  function ConvRow({ conv }: { conv: Conversation }) {
    const isActive = conv.id === activeId;
    return (
      <div
        onClick={() => onSelect(conv.id)}
        onContextMenu={(e) => openCtx(e, conv.id)}
        className={`group relative flex flex-col gap-0.5 px-3 py-2.5 rounded-[8px] cursor-pointer transition-all
          ${isActive
            ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300"
            : "hover:bg-accent/60 text-foreground"
          }`}
      >
        {renaming === conv.id ? (
          <input
            autoFocus
            className="w-full text-xs bg-transparent border-b border-primary focus:outline-none text-foreground"
            value={renameVal}
            onChange={(e) => setRenameVal(e.target.value)}
            onBlur={() => { onRename(conv.id, renameVal); setRenaming(null); }}
            onKeyDown={(e) => {
              if (e.key === "Enter") { onRename(conv.id, renameVal); setRenaming(null); }
              if (e.key === "Escape") setRenaming(null);
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="text-[12px] font-semibold leading-tight line-clamp-1 pr-6">{conv.title}</span>
        )}

        <div className="flex items-center gap-1.5">
          {conv.rfqId && (
            <span className="flex items-center gap-0.5 text-[9px] font-mono font-semibold px-1 py-px rounded"
              style={{ backgroundColor: "rgba(245,130,31,0.1)", color: "#F5821F" }}>
              <Tag size={8} />{conv.rfqId}
            </span>
          )}
          <span className="text-[10px] text-muted-foreground">{conv.lastUpdated}</span>
        </div>

        {/* Hover menu button */}
        <button
          onClick={(e) => openCtx(e, conv.id)}
          className="absolute right-2 top-2.5 w-5 h-5 flex items-center justify-center rounded-[4px]
            opacity-0 group-hover:opacity-100 text-muted-foreground hover:bg-accent hover:text-foreground transition-all"
        >
          <MoreHorizontal size={12} />
        </button>

        {conv.pinned && (
          <Pin size={9} className="absolute right-2 bottom-2 text-muted-foreground/60" />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full border-r border-border bg-card" onClick={closeCtx}>
      {/* Header */}
      <div className="flex-shrink-0 px-3 pt-3 pb-2 border-b border-border">
        <button
          onClick={onNew}
          className="w-full h-8 flex items-center justify-center gap-2 rounded-[8px] text-xs font-semibold text-white transition-all"
          style={{ backgroundColor: "#F5821F" }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#D9710E")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#F5821F")}
        >
          <Plus size={14} />
          New Conversation
        </button>

        {/* Search */}
        <div className="relative mt-2">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            placeholder="Search conversations…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-7 pl-7 pr-3 rounded-[7px] text-[11px] bg-input-background border border-border
              text-foreground placeholder:text-muted-foreground/60
              focus:outline-none focus:ring-1 focus:ring-ring/30 transition-all"
          />
        </div>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {pinned.length > 0 && (
          <>
            <p className="px-2 py-1 text-[9px] uppercase tracking-wider font-semibold text-muted-foreground">
              Pinned
            </p>
            {pinned.map((c) => <ConvRow key={c.id} conv={c} />)}
            <div className="h-px bg-border mx-1 my-2" />
          </>
        )}

        {recent.length > 0 && (
          <>
            <p className="px-2 py-1 text-[9px] uppercase tracking-wider font-semibold text-muted-foreground">
              Recent
            </p>
            {recent.map((c) => <ConvRow key={c.id} conv={c} />)}
          </>
        )}

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <MessageSquare size={24} className="text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground/50">No conversations found</p>
          </div>
        )}
      </div>

      {/* Context menu */}
      {ctxMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={closeCtx} />
          <div
            className="fixed z-50 bg-card border border-border rounded-[10px] shadow-[0_8px_24px_rgba(0,0,0,0.14)] py-1 w-44"
            style={{ left: Math.min(ctxMenu.x, window.innerWidth - 180), top: Math.min(ctxMenu.y, window.innerHeight - 180) }}
          >
            {[
              { icon: Edit3,   label: "Rename",  action: () => { const c = conversations.find((x) => x.id === ctxMenu.id); if (c) startRename(c.id, c.title); } },
              { icon: Pin,     label: "Pin / Unpin", action: () => { onPin(ctxMenu.id); closeCtx(); } },
              { icon: Star,    label: "Favourite",   action: closeCtx },
              { icon: Archive, label: "Archive",      action: closeCtx },
              { icon: Trash2,  label: "Delete",       action: () => { onDelete(ctxMenu.id); closeCtx(); }, danger: true },
            ].map(({ icon: Icon, label, action, danger }) => (
              <button
                key={label}
                onClick={action}
                className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-xs transition-colors
                  ${danger
                    ? "text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                    : "text-foreground hover:bg-accent"
                  }`}
              >
                <Icon size={12} className={danger ? "text-red-500" : "text-muted-foreground"} />
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
