import { useRef } from "react";
import { useDrag, useDrop } from "react-dnd";
import {
  Paperclip, MessageSquare, Calendar, MoreHorizontal,
  ExternalLink, UserPlus, MessageCircle, FolderOpen, AlertTriangle, ArrowRight,
} from "lucide-react";
import type { Task, ColumnId } from "@/app/types/task";
import { PRIORITY_CONFIG } from "@/app/types/task";

const DRAG_TYPE = "TASK";

interface TaskCardProps {
  task: Task;
  columnId: ColumnId;
  index: number;
  onMoveTask: (taskId: string, fromColumn: ColumnId, toColumn: ColumnId, toIndex?: number) => void;
  onReorder: (columnId: ColumnId, fromIndex: number, toIndex: number) => void;
  onOpenTask: (task: Task) => void;
  isDark: boolean;
}

interface DragItem {
  id: string;
  fromColumn: ColumnId;
  index: number;
}

const AI_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; darkBg: string }> = {
  QUEUED:     { label: "AI Queued",     color: "#D97706", bg: "#FFFBEB", darkBg: "rgba(217,119,6,0.12)" },
  PROCESSING: { label: "AI Processing", color: "#3B82F6", bg: "#EFF6FF", darkBg: "rgba(59,130,246,0.12)" },
  COMPLETED:  { label: "AI Ready",      color: "#16A34A", bg: "#F0FDF4", darkBg: "rgba(34,197,94,0.12)" },
  FAILED:     { label: "AI Failed",     color: "#DC2626", bg: "#FEF2F2", darkBg: "rgba(239,68,68,0.12)" },
};

function formatDueDate(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return { label: `${Math.abs(diff)}d overdue`, overdue: true };
  if (diff === 0) return { label: "Due today", overdue: false };
  if (diff === 1) return { label: "Due tomorrow", overdue: false };
  return {
    label: date.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
    overdue: false,
  };
}

export default function TaskCard({ task, columnId, index, onMoveTask, onReorder, onOpenTask, isDark }: TaskCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const pCfg = PRIORITY_CONFIG[task.priority];
  const due = formatDueDate(task.dueDate);
  const aiCfg = task.aiStatus ? AI_STATUS_CONFIG[task.aiStatus] : undefined;

  const [{ isDragging }, dragRef] = useDrag<DragItem, void, { isDragging: boolean }>({
    type: DRAG_TYPE,
    item: { id: task.id, fromColumn: columnId, index },
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  });

  const [{ isOver }, dropRef] = useDrop<DragItem, void, { isOver: boolean }>({
    accept: DRAG_TYPE,
    hover(item) {
      if (!ref.current) return;
      if (item.id === task.id) return;
      if (item.fromColumn === columnId && item.index !== index) {
        onReorder(columnId, item.index, index);
        item.index = index;
      }
    },
    collect: (monitor) => ({ isOver: monitor.isOver() }),
  });

  dragRef(dropRef(ref));

  const HOVER_ACTIONS = [
    { icon: ExternalLink,  label: "Open"     },
    { icon: UserPlus,      label: "Assign"   },
    { icon: MessageCircle, label: "Comment"  },
    { icon: FolderOpen,    label: "Attach"   },
    { icon: AlertTriangle, label: "Priority" },
    { icon: ArrowRight,    label: "Move"     },
  ];

  return (
    <div
      ref={ref}
      className={`group bg-card border rounded-[10px] p-3 cursor-grab active:cursor-grabbing
        shadow-[0_1px_3px_rgba(0,0,0,0.07)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.10)]
        transition-all duration-150 relative select-none
        ${isDragging ? "opacity-40 scale-95" : "opacity-100"}
        ${isOver ? "ring-2 ring-indigo-400/50" : ""}
        border-border`}
    >
      {/* Top row: RFQ ID + priority badge + menu */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <span className="text-[10px] font-mono font-semibold text-muted-foreground">{task.rfqId}</span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-tight"
            style={{
              color: pCfg.color,
              backgroundColor: isDark ? pCfg.darkBg : pCfg.bg,
            }}
          >
            {task.priority}
          </span>
          <button
            className="w-5 h-5 flex items-center justify-center rounded-[5px] opacity-0 group-hover:opacity-100
              text-muted-foreground hover:bg-accent hover:text-foreground transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal size={13} />
          </button>
        </div>
      </div>

      {/* Customer + Project */}
      <div className="mb-2.5">
        <p className="text-[11px] font-medium text-muted-foreground leading-tight">{task.customer}</p>
        <p className="text-sm font-semibold text-foreground leading-snug mt-0.5 line-clamp-2">{task.projectName}</p>
      </div>

      {/* Progress bar */}
      {task.progress > 0 && task.status !== "completed" && (
        <div className="mb-2.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-muted-foreground">Progress</span>
            <span className="text-[10px] font-semibold text-foreground">{task.progress}%</span>
          </div>
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${task.progress}%`,
                backgroundColor: task.progress >= 80 ? "#22C55E" : task.progress >= 50 ? "#3B82F6" : "#F59E0B",
              }}
            />
          </div>
        </div>
      )}

      {/* Due date + AI status */}
      <div className="flex items-center justify-between gap-1.5 mb-3">
        <div className="flex items-center gap-1.5">
          <Calendar size={11} className={due.overdue ? "text-red-500" : "text-muted-foreground"} />
          <span
            className={`text-[11px] font-medium ${
              due.overdue ? "text-red-500" : "text-muted-foreground"
            }`}
          >
            {due.label}
          </span>
        </div>
        {aiCfg && (
          <span
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-tight flex-shrink-0"
            style={{ color: aiCfg.color, backgroundColor: isDark ? aiCfg.darkBg : aiCfg.bg }}
          >
            {aiCfg.label}
          </span>
        )}
      </div>

      {/* Bottom row: assignee + meta */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div
            className="w-5.5 h-5.5 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
            style={{ backgroundColor: task.assignee.color, width: 22, height: 22 }}
            title={task.assignee.name}
          >
            {task.assignee.initials}
          </div>
          <span className="text-[11px] text-muted-foreground truncate max-w-[80px]">{task.assignee.name.split(" ")[0]}</span>
        </div>

        <div className="flex items-center gap-2">
          {task.attachments > 0 && (
            <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
              <Paperclip size={10} />{task.attachments}
            </span>
          )}
          {task.comments > 0 && (
            <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
              <MessageSquare size={10} />{task.comments}
            </span>
          )}
        </div>
      </div>

      {/* Hover action bar */}
      <div className="absolute inset-x-0 -bottom-px opacity-0 group-hover:opacity-100 transition-all duration-150 translate-y-0.5 group-hover:translate-y-0 px-2 pb-2">
        <div
          className="flex items-center justify-between gap-1 p-1.5 rounded-[8px] border border-border shadow-[0_4px_12px_rgba(0,0,0,0.12)]"
          style={{ backgroundColor: isDark ? "#1E1E20" : "#FFFFFF" }}
          onClick={(e) => e.stopPropagation()}
        >
          {HOVER_ACTIONS.map(({ icon: Icon, label }) => (
            <button
              key={label}
              title={label}
              onClick={() => label === "Open" && onOpenTask(task)}
              className="flex-1 flex items-center justify-center py-1 rounded-[6px] text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <Icon size={12} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
