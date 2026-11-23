/**
 * components/kanban/KanbanTaskBoard.tsx
 * The main Phase 10 enterprise kanban board.
 * Used inside Dashboard.tsx (CE) and FoundryDashboard.tsx (Foundry).
 *
 * Wraps the 5 status columns with DndProvider, filter bar, and task drawer.
 */

import { useState, useCallback, useMemo } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { RefreshCw, AlertCircle, Plus, Sparkles } from "lucide-react";
import type { KanbanTask, TaskStatus, AssignableUser } from "@/app/types/kanban";
import { KANBAN_COLUMNS } from "@/app/types/kanban";
import KanbanTaskColumn from "./KanbanTaskColumn";
import TaskDrawer from "./TaskDrawer";
import TaskFilters, { type FilterState } from "./TaskFilters";
import CreateKanbanTaskModal from "./CreateKanbanTaskModal";
import { useKanbanBoard, useCreateTask, useAssignableUsers, useProjectList } from "@/app/hooks/useKanbanTasks";
import type { BoardFilters } from "@/app/services/tasks";

interface Props {
  dark?: boolean;
  dept?: "ce" | "foundry";
  accentColor?: string;
  // Super Admin: allow switching department
  isSuperAdmin?: boolean;
  departmentId?: string;
  availableDepts?: Array<{ id: string; name: string; code: string }>;
}

export default function KanbanTaskBoard({
  dark, dept = "ce", accentColor = "#F5821F",
  isSuperAdmin, departmentId, availableDepts = [],
}: Props) {
  const [filters, setFilters] = useState<FilterState>({ search: "", priority: "", myTasks: false, projectId: "" });
  const [selectedDept, setSelectedDept] = useState<string | undefined>(departmentId);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  // Build API filter from local state
  const apiFilters = useMemo<BoardFilters>(() => ({
    search: filters.search || undefined,
    priority: filters.priority || undefined,
    my_tasks: filters.myTasks,
    project_id: filters.projectId || undefined,
    department_id: selectedDept,
  }), [filters, selectedDept]);

  const { board, loading, error, refetch, moveTask } = useKanbanBoard(apiFilters);
  const { users } = useAssignableUsers();
  const { projects, loading: loadingProjects } = useProjectList();
  const { create: createTask, loading: creating } = useCreateTask((task) => {
    refetch();
    setOpenTaskId(task.id);
  });

  // Derive dept code and department_id for the create modal
  // When Super Admin selects a dept, we resolve both the code and UUID
  const resolvedDeptCode = useMemo<"ce" | "foundry">(() => {
    if (!isSuperAdmin || !selectedDept) return dept;
    const found = availableDepts.find(d => d.id === selectedDept);
    if (!found) return dept;
    const code = found.code.toLowerCase();
    return code === "foundry" ? "foundry" : "ce";
  }, [isSuperAdmin, selectedDept, availableDepts, dept]);

  const resolvedDepartmentId = isSuperAdmin && selectedDept ? selectedDept : undefined;

  // Map board columns from API (status → tasks) for our local column defs
  const columnTaskMap = useMemo<Record<string, KanbanTask[]>>(() => {
    const map: Record<string, KanbanTask[]> = {};
    KANBAN_COLUMNS.forEach((c) => { map[c.status] = []; });
    if (!board) return map;
    board.columns.forEach((col) => { map[col.status] = col.tasks as KanbanTask[]; });
    return map;
  }, [board]);

  const totalCount = useMemo(
    () => Object.values(columnTaskMap).reduce((s, t) => s + t.length, 0),
    [columnTaskMap]
  );

  // Local reorder (visual only — sort_order persisted on next save)
  const [localMap, setLocalMap] = useState<Record<string, KanbanTask[]> | null>(null);
  const effectiveMap = localMap ?? columnTaskMap;

  const handleMove = useCallback((taskId: string, from: TaskStatus, to: TaskStatus) => {
    // Optimistic reorder in local state
    setLocalMap((prev) => {
      const base = prev ?? columnTaskMap;
      const task = base[from]?.find((t) => t.id === taskId);
      if (!task) return prev;
      const newMap = { ...base };
      newMap[from] = base[from].filter((t) => t.id !== taskId);
      newMap[to] = [...(base[to] ?? []), { ...task, status: to }];
      return newMap;
    });
    moveTask(taskId, to);
  }, [columnTaskMap, moveTask]);

  const handleReorder = useCallback((status: TaskStatus, fromIdx: number, toIdx: number) => {
    setLocalMap((prev) => {
      const base = prev ?? columnTaskMap;
      const arr = [...(base[status] ?? [])];
      const [moved] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, moved);
      return { ...base, [status]: arr };
    });
  }, [columnTaskMap]);

  // Sync local map when board refreshes
  const handleRefetch = useCallback(() => {
    setLocalMap(null);
    refetch();
  }, [refetch]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <RefreshCw size={20} className="animate-spin" style={{ color: accentColor }} />
          <p className="text-sm">Loading task board…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-3">
        <AlertCircle size={24} className="text-red-400" />
        <p className="text-sm font-semibold text-foreground">Failed to load tasks</p>
        <p className="text-xs text-muted-foreground">{error}</p>
        <button
          onClick={handleRefetch}
          className="text-xs font-medium px-4 py-2 rounded-[8px] border border-border hover:bg-accent transition-all"
          style={{ color: accentColor }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="flex flex-col gap-3 h-full">
        {/* Toolbar */}
        <div className="flex-shrink-0 flex items-center justify-between gap-3 flex-wrap">
          {/* Left: title + dept switcher (super admin) */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-foreground">Task Board</h2>
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ backgroundColor: `${accentColor}18`, color: accentColor }}
              >
                {totalCount} tasks
              </span>
            </div>

            {/* Super Admin dept toggle */}
            {isSuperAdmin && availableDepts.length > 0 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setSelectedDept(undefined)}
                  className={`text-[10px] font-semibold h-6 px-2.5 rounded-full transition-all ${!selectedDept
                      ? "text-white"
                      : "text-muted-foreground hover:text-foreground border border-border"
                    }`}
                  style={!selectedDept ? { backgroundColor: accentColor } : {}}
                >
                  All
                </button>
                {availableDepts.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setSelectedDept(d.id)}
                    className={`text-[10px] font-semibold h-6 px-2.5 rounded-full transition-all ${selectedDept === d.id
                        ? "text-white"
                        : "text-muted-foreground hover:text-foreground border border-border"
                      }`}
                    style={selectedDept === d.id ? { backgroundColor: accentColor } : {}}
                  >
                    {d.code}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: refresh + new task */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefetch}
              className="h-8 px-2.5 rounded-[8px] text-xs font-medium flex items-center gap-1.5 border border-border text-muted-foreground hover:bg-accent transition-all"
              title="Refresh board"
            >
              <RefreshCw size={11} />
            </button>
            <button
              onClick={() => setCreateOpen(true)}
              className="h-8 px-3.5 rounded-[8px] text-xs font-semibold text-white flex items-center gap-1.5 transition-all hover:opacity-90"
              style={{ backgroundColor: accentColor }}
            >
              <Plus size={12} /> New Task
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex-shrink-0">
          <TaskFilters
            filters={filters}
            onChange={setFilters}
            resultCount={totalCount}
            dark={dark}
            projects={projects}
          />
        </div>

        {/* Columns */}
        <div className="flex gap-3 flex-1 overflow-x-auto overflow-y-hidden pb-2">
          {KANBAN_COLUMNS.map((col) => (
            <KanbanTaskColumn
              key={col.status}
              colDef={col}
              tasks={effectiveMap[col.status] ?? []}
              onMove={handleMove}
              onReorder={handleReorder}
              onNewTask={() => setCreateOpen(true)}
              onOpen={(task) => setOpenTaskId(task.id)}
              dark={dark}
              accentColor={accentColor}
            />
          ))}
        </div>
      </div>

      {/* Task Drawer */}
      <TaskDrawer
        taskId={openTaskId}
        onClose={() => setOpenTaskId(null)}
        onStatusChange={(taskId, newStatus) => handleMove(taskId, "todo" as TaskStatus, newStatus)}
        users={users}
        dark={dark}
        dept={dept}
        accentColor={accentColor}
      />

      {/* Create Modal */}
      <CreateKanbanTaskModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSave={async (payload) => { await createTask(payload); }}
        saving={creating}
        projects={projects}
        loadingProjects={loadingProjects}
        dept={resolvedDeptCode}
        departmentId={resolvedDepartmentId}
        dark={dark}
      />
    </DndProvider>
  );
}
