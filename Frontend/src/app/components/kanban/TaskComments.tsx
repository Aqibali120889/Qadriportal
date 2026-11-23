/**
 * components/kanban/TaskComments.tsx
 * Threaded comment list + inline comment input for the Task Drawer.
 */

import { useState } from "react";
import { Send, MessageSquare } from "lucide-react";
import AssigneeAvatar from "./AssigneeAvatar";
import type { TaskComment } from "@/app/types/kanban";

interface Props {
  comments:   TaskComment[];
  onSubmit:   (content: string) => Promise<void>;
  submitting: boolean;
  dark?:      boolean;
}

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60)  return "just now";
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function TaskComments({ comments, onSubmit, submitting, dark }: Props) {
  const [value, setValue] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    await onSubmit(trimmed);
    setValue("");
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <MessageSquare size={13} className="text-muted-foreground" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Comments ({comments.length})
        </span>
      </div>

      {/* Comment list */}
      <div className="flex flex-col gap-3 max-h-48 overflow-y-auto pr-1">
        {comments.length === 0 && (
          <p className="text-xs text-muted-foreground/60 py-2">No comments yet. Be the first!</p>
        )}
        {comments.map((c) => (
          <div key={c.id} className="flex gap-2.5">
            <AssigneeAvatar name={c.author_name} email={c.author_email} size={24} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[11px] font-semibold text-foreground">
                  {c.author_name || c.author_email || "User"}
                </span>
                <span className="text-[10px] text-muted-foreground">{timeAgo(c.created_at)}</span>
              </div>
              <div
                className="text-xs text-foreground/90 rounded-[8px] px-3 py-2 leading-relaxed"
                style={{ backgroundColor: dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)" }}
              >
                {c.content}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex items-end gap-2 mt-1">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(e); }
          }}
          placeholder="Add a comment… (Enter to send)"
          rows={2}
          className="flex-1 text-xs rounded-[8px] px-3 py-2 border border-border bg-input-background
            text-foreground placeholder:text-muted-foreground/60
            focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary/50 resize-none transition-all"
        />
        <button
          type="submit"
          disabled={!value.trim() || submitting}
          className="flex-shrink-0 w-8 h-8 rounded-[8px] flex items-center justify-center text-white transition-all disabled:opacity-40"
          style={{ backgroundColor: "#F5821F" }}
        >
          <Send size={13} />
        </button>
      </form>
    </div>
  );
}
