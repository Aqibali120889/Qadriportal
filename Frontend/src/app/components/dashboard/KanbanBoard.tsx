import { useRef } from "react";
import { useDrop } from "react-dnd";
import { Plus } from "lucide-react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import TaskCard from "./TaskCard";
import type { Task, ColumnId } from "@/app/types/task";
import { COLUMNS } from "@/app/types/task";

const DRAG_TYPE = "TASK";

interface BoardState {
  tasks: Record<string, Task>;
  columns: Record<ColumnId, string[]>;
}

interface ColumnDropProps {
  columnId: ColumnId;
  children: React.ReactNode;
  onDrop: (taskId: string, fromColumn: ColumnId, toColumn: ColumnId) => void;
  isOver: boolean;
  accent: string;
}

function ColumnDropZone({
  columnId, children, onDrop,
}: {
  columnId: ColumnId;
  children: (isOver: boolean) => React.ReactNode;
  onDrop: (taskId: string, fromColumn: ColumnId, toColumn: ColumnId) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [{ isOver }, dropRef] = useDrop<
    { id: string; fromColumn: ColumnId; index: number },
    void,
    { isOver: boolean }
  >({
    accept: DRAG_TYPE,
    drop(item) {
      if (item.fromColumn !== columnId) {
        onDrop(item.id, item.fromColumn, columnId);
      }
    },
    collect: (monitor) => ({ isOver: monitor.isOver({ shallow: false }) }),
  });
  dropRef(ref);
  return <div ref={ref} className="flex-1 overflow-y-auto">{children(isOver)}</div>;
}

interface KanbanBoardProps {
  board: BoardState;
  onMoveTask: (taskId: string, fromColumn: ColumnId, toColumn: ColumnId) => void;
  onReorder: (columnId: ColumnId, fromIndex: number, toIndex: number) => void;
  onNewTask: () => void;
  onOpenTask: (task: Task) => void;
  searchQuery: string;
  isDark: boolean;
}

function KanbanColumn({
  colDef,
  taskIds,
  tasks,
  onMoveTask,
  onReorder,
  onNewTask,
  onOpenTask,
  searchQuery,
  isDark,
}: {
  colDef: (typeof COLUMNS)[0];
  taskIds: string[];
  tasks: Record<string, Task>;
  onMoveTask: (taskId: string, fromColumn: ColumnId, toColumn: ColumnId) => void;
  onReorder: (columnId: ColumnId, fromIndex: number, toIndex: number) => void;
  onNewTask: () => void;
  onOpenTask: (task: Task) => void;
  searchQuery: string;
  isDark: boolean;
}) {
  const q = searchQuery.toLowerCase();
  const filtered = taskIds.filter((id) => {
    if (!q) return true;
    const t = tasks[id];
    return (
      t.rfqId.toLowerCase().includes(q) ||
      t.customer.toLowerCase().includes(q) ||
      t.projectName.toLowerCase().includes(q) ||
      (t.drawingNumber?.toLowerCase().includes(q) ?? false)
    );
  });

  return (
    <div className="flex flex-col bg-background rounded-[12px] border border-border overflow-hidden flex-1"
      style={{ minWidth: 240 }}>
      {/* Column header - sticky */}
      <div className="flex-shrink-0 flex items-center justify-between px-3 py-2.5 border-b border-border bg-card sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: isDark ? colDef.darkAccent : colDef.accent }}
          />
          <span className="text-sm font-semibold text-foreground">{colDef.title}</span>
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
            style={{
              backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
              color: "var(--muted-foreground)",
            }}
          >
            {filtered.length}
          </span>
        </div>
        {colDef.id === "pending" && (
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
      <ColumnDropZone columnId={colDef.id} onDrop={onMoveTask}>
        {(isOver) => (
          <div
            className={`flex flex-col gap-2 p-2 min-h-[120px] transition-colors ${
              isOver ? "bg-indigo-50/40 dark:bg-indigo-950/20" : ""
            }`}
          >
            {filtered.map((id, idx) => (
              <TaskCard
                key={id}
                task={tasks[id]}
                columnId={colDef.id}
                index={idx}
                onMoveTask={onMoveTask}
                onReorder={onReorder}
                onOpenTask={onOpenTask}
                isDark={isDark}
              />
            ))}
            {filtered.length === 0 && (
              <div className="flex-1 flex items-center justify-center py-8">
                <p className="text-xs text-muted-foreground/50">
                  {searchQuery ? "No results" : "Drop tasks here"}
                </p>
              </div>
            )}
          </div>
        )}
      </ColumnDropZone>
    </div>
  );
}

export default function KanbanBoard({
  board, onMoveTask, onReorder, onNewTask, onOpenTask, searchQuery, isDark,
}: KanbanBoardProps) {
  return (
    <DndProvider backend={HTML5Backend}>
      <div className="flex gap-3 h-full min-w-0 pb-4">
        {COLUMNS.map((col) => (
          <KanbanColumn
            key={col.id}
            colDef={col}
            taskIds={board.columns[col.id]}
            tasks={board.tasks}
            onMoveTask={onMoveTask}
            onReorder={onReorder}
            onNewTask={onNewTask}
            onOpenTask={onOpenTask}
            searchQuery={searchQuery}
            isDark={isDark}
          />
        ))}
      </div>
    </DndProvider>
  );
}
