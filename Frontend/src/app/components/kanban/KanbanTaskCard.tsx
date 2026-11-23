/**
 * components/kanban/KanbanTaskCard.tsx
 * Rich task card for the Phase 10 enterprise kanban board.
 * Supports drag-and-drop via react-dnd.
 */

import { useRef } from "react";
import { useDrag, useDrop } from "react-dnd";
import {
  Calendar, MessageSquare, MoreHorizontal, Paperclip,
  Sparkles, AlertTriangle, ArrowRight, ExternalLink,
} from "lucide-react";
import type { KanbanTask, TaskStatus } from "@/app/types/kanban";
import { PRIORITY_CONFIG, dueDateLabel, isOverdue } from "@/app/types/kanban";
import AssigneeAvatar from "./AssigneeAvatar";

const DRAG_TYPE = "KANBAN_TASK_V2";

interface DragItem { id: string; fromStatus: TaskStatus; index: number; }

interface Props {
  task:       KanbanTask;
  status:     TaskStatus;
  index:      number;
  onMove:     (taskId: string, from: TaskStatus, to: TaskStatus) => void;
  onReorder:  (status: TaskStatus, from: number, to: number) => void;
  onOpen:     (task: KanbanTask) => void;
  dark?:      boolean;
  accentColor?: string;   // dept accent (#F5821F CE, amber Foundry)
}

export default function KanbanTaskCard({
  task, status, index, onMove, onReorder, onOpen, dark, accentColor = "#F5821F",
}: Props) {
  const ref   = useRef<HTMLDivElement>(null);
  const pCfg  = PRIORITY_CONFIG[task.priority];
  const due   = dueDateLabel(task);
  const overdue = isOverdue(task);

  const [{ isDragging }, dragRef] = useDrag<DragItem, void, { isDragging: boolean }>({
    type: DRAG_TYPE,
    item: { id: task.id, fromStatus: status, index },
    collect: (m) => ({ isDragging: m.isDragging() }),
  });

  const [{ isOver }, dropRef] = useDrop<DragItem, void, { isOver: boolean }>({
    accept: DRAG_TYPE,
    hover(item) {
      if (!ref.current || item.id === task.id) return;
      if (item.fromStatus === status && item.index !== index) {
        onReorder(status, item.index, index);
        item.index = index;
      }
    },
    collect: (m) => ({ isOver: m.isOver() }),
  });

  dragRef(dropRef(ref));

  return (
    <div
      ref={ref}
      onClick={() => onOpen(task)}
      className={`group relative bg-card border rounded-[10px] p-3 cursor-grab active:cursor-grabbing
        shadow-[0_1px_3px_rgba(0,0,0,0.07)] hover:shadow-[0_4px_14px_rgba(0,0,0,0.12)]
        transition-all duration-150 select-none
        ${isDragging ? "opacity-40 scale-95 rotate-1" : "opacity-100"}
        ${isOver    ? "ring-2 ring-indigo-400/40" : ""}
        ${overdue   ? "border-l-[3px] border-l-red-400" : "border-border"}
      `}
    >
      {/* AI badge */}
      {task.is_ai_generated && (
        <div className="absolute top-2 right-2" title="AI generated task">
          <Sparkles size={10} style={{ color: "#8B5CF6" }} />
        </div>
      )}

      {/* Top row: RFQ tag + priority */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          {task.rfq_number && (
            <span className="text-[10px] font-mono font-semibold text-muted-foreground truncate">
              {task.rfq_number}
            </span>
          )}
        </div>
        <span
          className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-tight flex-shrink-0"
          style={{ color: pCfg.color, backgroundColor: dark ? pCfg.darkBg : pCfg.bg }}
        >
          {pCfg.label}
        </span>
      </div>

      {/* Title */}
      <p className="text-sm font-semibold text-foreground leading-snug line-clamp-2 mb-1">
        {task.title}
      </p>

      {/* Task type */}
      {task.task_type && (
        <p className="text-[10px] text-muted-foreground mb-2.5">{task.task_type.replace(/_/g, " ")}</p>
      )}

      {/* Due date */}
      {due.label && (
        <div className={`flex items-center gap-1.5 mb-2.5 ${overdue ? "text-red-500" : "text-muted-foreground"}`}>
          {overdue ? <AlertTriangle size={10} /> : <Calendar size={10} />}
          <span className="text-[11px] font-medium">{due.label}</span>
        </div>
      )}

      {/* Bottom: assignee + meta counts */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {task.assignee_name ? (
            <AssigneeAvatar name={task.assignee_name} email={task.assignee_email} size={20} />
          ) : (
            <div className="w-5 h-5 rounded-full border border-dashed border-border flex items-center justify-center">
              <span className="text-[8px] text-muted-foreground">?</span>
            </div>
          )}
          {task.assignee_name && (
            <span className="text-[10px] text-muted-foreground truncate max-w-[70px]">
              {task.assignee_name.split(" ")[0]}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {(task.comments_count > 0) && (
            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <MessageSquare size={10} />{task.comments_count}
            </span>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onOpen(task); }}
            className="w-5 h-5 flex items-center justify-center rounded-[5px] opacity-0 group-hover:opacity-100
              text-muted-foreground hover:bg-accent hover:text-foreground transition-all"
            title="Open task"
          >
            <MoreHorizontal size={11} />
          </button>
        </div>
      </div>

      {/* Hover action strip */}
      <div className="absolute inset-x-0 -bottom-px opacity-0 group-hover:opacity-100 transition-all duration-150 translate-y-0.5 group-hover:translate-y-0 px-2 pb-2 pointer-events-none group-hover:pointer-events-auto">
        <div
          className="flex items-center justify-around gap-1 p-1.5 rounded-[8px] border border-border shadow-[0_4px_12px_rgba(0,0,0,0.14)]"
          style={{ backgroundColor: dark ? "#1E1E20" : "#FFFFFF" }}
          onClick={(e) => e.stopPropagation()}
        >
          {[
            { icon: ExternalLink, label: "Open",   action: () => onOpen(task) },
            { icon: ArrowRight,   label: "Move",   action: () => {} },
            { icon: Paperclip,    label: "Attach", action: () => {} },
          ].map(({ icon: Icon, label, action }) => (
            <button
              key={label}
              title={label}
              onClick={action}
              className="flex-1 flex items-center justify-center py-1 rounded-[6px] text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <Icon size={11} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export { DRAG_TYPE };
