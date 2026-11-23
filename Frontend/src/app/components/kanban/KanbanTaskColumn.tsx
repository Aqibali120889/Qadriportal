/**
 * components/kanban/KanbanTaskColumn.tsx
 * Single column in the kanban board — drop zone + header + task list.
 */

import { useRef } from "react";
import { useDrop } from "react-dnd";
import { Plus } from "lucide-react";
import type { KanbanColumnDef, KanbanTask, TaskStatus } from "@/app/types/kanban";
import KanbanTaskCard, { DRAG_TYPE } from "./KanbanTaskCard";

interface DragItem { id: string; fromStatus: TaskStatus; index: number; }

interface Props {
  colDef:    KanbanColumnDef;
  tasks:     KanbanTask[];
  onMove:    (taskId: string, from: TaskStatus, to: TaskStatus) => void;
  onReorder: (status: TaskStatus, from: number, to: number) => void;
  onNewTask: () => void;
  onOpen:    (task: KanbanTask) => void;
  dark?:     boolean;
  accentColor?: string;
}

export default function KanbanTaskColumn({
  colDef, tasks, onMove, onReorder, onNewTask, onOpen, dark, accentColor,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  const [{ isOver }, dropRef] = useDrop<DragItem, void, { isOver: boolean }>({
    accept: DRAG_TYPE,
    drop(item) {
      if (item.fromStatus !== colDef.status) {
        onMove(item.id, item.fromStatus, colDef.status);
      }
    },
    collect: (m) => ({ isOver: m.isOver({ shallow: false }) }),
  });

  dropRef(ref);

  return (
    <div
      className="flex flex-col rounded-[12px] border border-border overflow-hidden flex-1"
      style={{ minWidth: 230, backgroundColor: "var(--background)" }}
    >
      {/* Column header */}
      <div className="flex-shrink-0 flex items-center justify-between px-3 py-2.5 border-b border-border bg-card sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: dark ? colDef.darkAccent : colDef.accent }}
          />
          <span className="text-sm font-semibold text-foreground">{colDef.label}</span>
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
            style={{
              backgroundColor: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
              color: "var(--muted-foreground)",
            }}
          >
            {tasks.length}
          </span>
        </div>
        {colDef.status === "todo" && (
          <button
            onClick={onNewTask}
            className="w-6 h-6 flex items-center justify-center rounded-[6px] text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            title="Add task"
          >
            <Plus size={13} />
          </button>
        )}
      </div>

      {/* Drop zone */}
      <div
        ref={ref}
        className={`flex flex-col gap-2 p-2 min-h-[120px] flex-1 overflow-y-auto transition-colors ${
          isOver ? "bg-indigo-50/30 dark:bg-indigo-950/15" : ""
        }`}
      >
        {tasks.map((task, idx) => (
          <KanbanTaskCard
            key={task.id}
            task={task}
            status={colDef.status}
            index={idx}
            onMove={onMove}
            onReorder={onReorder}
            onOpen={onOpen}
            dark={dark}
            accentColor={accentColor}
          />
        ))}
        {tasks.length === 0 && (
          <div className="flex-1 flex items-center justify-center py-8">
            <p className="text-xs text-muted-foreground/40">
              {isOver ? "Drop here" : "No tasks"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
