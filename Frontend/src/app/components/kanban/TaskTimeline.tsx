/**
 * components/kanban/TaskTimeline.tsx
 * Chronological activity feed from task_history entries.
 */

import {
  Clock, UserPlus, UserMinus, ArrowRight, Star,
  MessageSquare, Calendar, CheckCircle2, XCircle,
  Sparkles, Type, AlertTriangle,
} from "lucide-react";
import type { TaskHistoryEntry } from "@/app/types/kanban";

interface Props {
  history: TaskHistoryEntry[];
  dark?:   boolean;
}

interface EventConfig {
  icon:  React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  label: (e: TaskHistoryEntry) => string;
}

const EVENT_CONFIG: Record<string, EventConfig> = {
  created:          { icon: Star,           color: "#F5821F", label: () => "Task created" },
  assigned:         { icon: UserPlus,       color: "#3B82F6", label: (e) => `Assigned to ${e.new_value ?? "someone"}` },
  unassigned:       { icon: UserMinus,      color: "#6B7280", label: () => "Assignee removed" },
  status_changed:   { icon: ArrowRight,     color: "#8B5CF6", label: (e) => `Status: ${(e.old_value ?? "").replace("_"," ")} → ${(e.new_value ?? "").replace("_"," ")}` },
  priority_changed: { icon: AlertTriangle,  color: "#F59E0B", label: (e) => `Priority changed to ${e.new_value ?? ""}` },
  comment_added:    { icon: MessageSquare,  color: "#10B981", label: () => "Comment added" },
  due_date_changed: { icon: Calendar,       color: "#EC4899", label: (e) => `Due date → ${e.new_value ?? ""}` },
  title_changed:    { icon: Type,           color: "#6B7280", label: () => "Title updated" },
  completed:        { icon: CheckCircle2,   color: "#22C55E", label: () => "Task completed" },
  reopened:         { icon: ArrowRight,     color: "#F97316", label: () => "Task reopened" },
  cancelled:        { icon: XCircle,        color: "#EF4444", label: () => "Task cancelled" },
  ai_generated:     { icon: Sparkles,       color: "#8B5CF6", label: () => "AI auto-generated task" },
};

function timeStr(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export default function TaskTimeline({ history, dark }: Props) {
  if (!history.length) {
    return (
      <div className="flex items-center justify-center py-6">
        <p className="text-xs text-muted-foreground/60">No activity yet.</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-[15px] top-3 bottom-3 w-px bg-border" />

      <div className="flex flex-col gap-0">
        {history.map((entry, i) => {
          const cfg = EVENT_CONFIG[entry.event_type] ?? {
            icon: Clock, color: "#6B7280", label: (e: TaskHistoryEntry) => e.event_type,
          };
          const Icon = cfg.icon;
          return (
            <div key={entry.id} className="flex gap-3 pb-4 relative">
              {/* Dot */}
              <div
                className="relative z-10 w-[30px] h-[30px] flex-shrink-0 rounded-full flex items-center justify-center"
                style={{ backgroundColor: dark ? `${cfg.color}22` : `${cfg.color}18` }}
              >
                <Icon size={13} style={{ color: cfg.color }} />
              </div>
              {/* Content */}
              <div className="flex-1 pt-1 min-w-0">
                <p className="text-xs font-medium text-foreground leading-snug">
                  {cfg.label(entry)}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {entry.actor_name && (
                    <span className="text-[10px] font-medium text-muted-foreground">
                      {entry.actor_name}
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground/60">·</span>
                  <span className="text-[10px] text-muted-foreground/60">{timeStr(entry.created_at)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
