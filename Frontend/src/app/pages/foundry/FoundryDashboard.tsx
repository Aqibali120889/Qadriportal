/**
 * Frontend/src/app/pages/foundry/FoundryDashboard.tsx
 * ──────────────────────────────────────────────────────────────────────────────
 * Phase 10 upgrade — Foundry Department Dashboard
 *
 * Board tabs:
 *   • "Projects"  — original KanbanBoard (project-status view, unchanged)
 *   • "Task Board" — new Phase 10 KanbanTaskBoard (enterprise task management)
 *
 * Foundry accent: amber #F59E0B / #D97706
 */

import { useState, useCallback, useMemo } from "react";
import { useOutletContext } from "react-router";
import {
  Anvil, Mail, Upload, FileSpreadsheet, RefreshCw, AlertCircle,
  LayoutDashboard, CheckSquare,
} from "lucide-react";
import TopNav from "@/app/components/dashboard/TopNav";
import KPICards from "@/app/components/dashboard/KPICards";
import KanbanBoard from "@/app/components/dashboard/KanbanBoard";
import CreateTaskModal from "@/app/components/dashboard/CreateTaskModal";
import KanbanTaskBoard from "@/app/components/kanban/KanbanTaskBoard";
import type { Task, ColumnId } from "@/app/types/task";
import { COLUMNS, ENGINEERS } from "@/app/types/task";
import type { FoundryLayoutContext } from "@/app/layouts/FoundryLayout";
import type { KanbanTaskItem } from "@/app/services/api";
import { useKanbanBoard } from "@/app/hooks/useProjects";

// ── Foundry-specific engineers (kept for display) ─────────────────────────────
const FOUNDRY_ENGINEERS = [
  { id: "f1", name: "Fatima Noor", initials: "FN", color: "#F59E0B" },
  { id: "f2", name: "Hassan Raza", initials: "HR", color: "#10B981" },
  { id: "f3", name: "Imran Malik", initials: "IM", color: "#6366F1" },
  { id: "f4", name: "Nadia Tariq", initials: "NT", color: "#EC4899" },
];

function apiItemToTask(item: KanbanTaskItem, index: number): Task {
  const PRIORITY_MAP: Record<string, Task["priority"]> = {
    CRITICAL: "Critical", HIGH: "High", MEDIUM: "Medium", LOW: "Low",
  };
  const engineer = FOUNDRY_ENGINEERS[index % FOUNDRY_ENGINEERS.length];
  return {
    id: item.id,
    rfqId: item.job_number,
    customer: item.sender_email ?? "Unknown",
    projectName: item.title ?? item.job_number,
    priority: PRIORITY_MAP[(item.priority ?? "MEDIUM").toUpperCase()] ?? "Medium",
    dueDate: item.estimated_completion ?? item.updated_at.split("T")[0],
    assignee: engineer,
    attachments: item.attachment_count,
    comments: 0,
    status: item.kanban_column as ColumnId,
    progress: item.kanban_column === "completed" ? 100
      : item.kanban_column === "review" ? 80
        : item.kanban_column === "in-progress" ? 40
          : 0,
  };
}

function buildBoard(tasks: Task[]) {
  const taskMap: Record<string, Task> = {};
  const columns: Record<ColumnId, string[]> = {
    pending: [], "in-progress": [], review: [], completed: [],
  };
  for (const t of tasks) {
    taskMap[t.id] = t;
    if (columns[t.status]) columns[t.status].push(t.id);
    else columns.pending.push(t.id);
  }
  return { tasks: taskMap, columns };
}

type BoardTab = "projects" | "tasks";

const ACCENT = "#F59E0B";
const ACCENT_DARK = "#D97706";

// ── FoundryDashboard ──────────────────────────────────────────────────────────

export default function FoundryDashboard() {
  const { dark, toggleDark } = useOutletContext<FoundryLayoutContext>();
  const { data: kanbanData, loading, error, refetch, updateStatus } = useKanbanBoard();

  const [activeTab, setActiveTab] = useState<BoardTab>("projects");
  const [createOpen, setCreateOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const liveTasks = useMemo<Task[]>(
    () => (kanbanData?.tasks ?? []).map((item, idx) => apiItemToTask(item, idx)),
    [kanbanData]
  );

  const [localBoard, setLocalBoard] = useState<ReturnType<typeof buildBoard> | null>(null);

  const board = useMemo(() => {
    if (localBoard && kanbanData) return localBoard;
    return buildBoard(liveTasks);
  }, [liveTasks, localBoard, kanbanData]);

  const taskList = Object.values(board.tasks);

  const COLUMN_TO_DB_STATUS: Record<string, string> = {
    "pending": "DRAFT", "in-progress": "ACTIVE",
    "review": "ON_HOLD", "completed": "COMPLETED",
  };

  const moveTask = useCallback(async (taskId: string, fromColumn: ColumnId, toColumn: ColumnId) => {
    if (fromColumn === toColumn) return;
    setLocalBoard((prev) => {
      const base = prev ?? buildBoard(liveTasks);
      const newTask = { ...base.tasks[taskId], status: toColumn };
      return {
        tasks: { ...base.tasks, [taskId]: newTask },
        columns: {
          ...base.columns,
          [fromColumn]: base.columns[fromColumn].filter((id) => id !== taskId),
          [toColumn]: [...base.columns[toColumn], taskId],
        },
      };
    });
    const dbStatus = COLUMN_TO_DB_STATUS[toColumn];
    if (dbStatus) await updateStatus(taskId, dbStatus);
  }, [liveTasks, updateStatus]);

  const reorderTask = useCallback((columnId: ColumnId, fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    setLocalBoard((prev) => {
      const base = prev ?? buildBoard(liveTasks);
      const ids = [...base.columns[columnId]];
      const [moved] = ids.splice(fromIndex, 1);
      ids.splice(toIndex, 0, moved);
      return { ...base, columns: { ...base.columns, [columnId]: ids } };
    });
  }, [liveTasks]);

  const handleRefetch = useCallback(() => {
    setLocalBoard(null);
    refetch();
  }, [refetch]);

  const QUICK_ACTIONS = [
    { icon: Anvil, label: "New Casting Job", accent: ACCENT, onClick: () => setCreateOpen(true) },
    { icon: Mail, label: "Import Email", accent: "#3B82F6", onClick: () => { } },
    { icon: Upload, label: "Upload Drawing", accent: "#8B5CF6", onClick: () => { } },
    { icon: FileSpreadsheet, label: "Generate Excel", accent: "#22C55E", onClick: () => { } },
  ];

  const TABS: Array<{ id: BoardTab; label: string; icon: React.ComponentType<{ size?: number }> }> = [
    { id: "projects", label: "Projects", icon: LayoutDashboard },
    { id: "tasks", label: "Task Board", icon: CheckSquare },
  ];

  if (loading && activeTab === "projects") {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <RefreshCw size={22} className="animate-spin" style={{ color: ACCENT }} />
          <p className="text-sm">Loading Foundry dashboard…</p>
        </div>
      </div>
    );
  }

  if (error && activeTab === "projects") {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <AlertCircle size={28} className="text-red-400 mx-auto mb-3" />
          <p className="text-sm font-semibold text-foreground mb-1">Failed to load dashboard</p>
          <p className="text-xs text-muted-foreground mb-4">{error}</p>
          <button
            onClick={handleRefetch}
            className="text-xs font-medium px-4 py-2 rounded-[8px] border border-border hover:bg-accent transition-all"
            style={{ color: ACCENT }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      <TopNav
        dark={dark}
        onToggleDark={toggleDark}
        onNewTask={() => setCreateOpen(true)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        title="Foundry Department Dashboard"
        subtitle="Metal Casting & Production Portal"
      />

      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto flex flex-col min-w-0">
          <div className="flex-shrink-0 px-4 pt-4 pb-3 space-y-4">
            <KPICards tasks={taskList} />

            <div className="flex flex-wrap gap-2">
              {QUICK_ACTIONS.map(({ icon: Icon, label, accent, onClick }) => (
                <button
                  key={label}
                  onClick={onClick}
                  className="flex items-center gap-2 h-8 px-3.5 rounded-[8px] text-xs font-semibold border border-border bg-card hover:bg-accent transition-all duration-150 text-foreground"
                >
                  <Icon size={13} style={{ color: accent }} />
                  {label}
                </button>
              ))}
              <button
                onClick={handleRefetch}
                className="flex items-center gap-2 h-8 px-3.5 rounded-[8px] text-xs font-semibold border border-border bg-card hover:bg-accent transition-all duration-150 text-muted-foreground"
                title="Refresh board"
              >
                <RefreshCw size={12} />
                Refresh
              </button>
            </div>

            {/* Board tab switcher — Foundry amber theme */}
            <div className="flex items-center gap-0 border-b border-border">
              {TABS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold transition-colors relative ${activeTab === id
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                  {activeTab === id && (
                    <span
                      className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full"
                      style={{ backgroundColor: ACCENT }}
                    />
                  )}
                  <Icon size={13} />
                  {label}
                  {id === "projects" && (
                    <span
                      className="text-[9px] font-bold px-1.5 rounded-full"
                      style={{ backgroundColor: `${ACCENT}18`, color: ACCENT_DARK }}
                    >
                      {taskList.length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Projects view (original — unchanged) */}
          {activeTab === "projects" && (
            <div className="flex-1 overflow-hidden px-4 pb-4">
              <KanbanBoard
                board={board}
                onMoveTask={moveTask}
                onReorder={reorderTask}
                onNewTask={() => setCreateOpen(true)}
                onOpenTask={(task) => setSelectedTask(task)}
                searchQuery={searchQuery}
                isDark={dark}
              />
            </div>
          )}

          {/* Task Board (Phase 10 — new, Foundry amber accent) */}
          {activeTab === "tasks" && (
            <div className="flex-1 overflow-hidden px-4 pb-4 pt-2">
              <KanbanTaskBoard
                dark={dark}
                dept="foundry"
                accentColor={ACCENT}
              />
            </div>
          )}
        </main>
      </div>

      <CreateTaskModal open={createOpen} onClose={() => setCreateOpen(false)} onSave={() => { }} />

      {selectedTask && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
          onClick={(e) => e.target === e.currentTarget && setSelectedTask(null)}
        >
          <div className="w-full max-w-md bg-card rounded-[14px] border border-border shadow-[0_24px_64px_rgba(0,0,0,0.18)] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <p className="text-[10px] font-mono text-muted-foreground">{selectedTask.rfqId}</p>
                <h2 className="text-base font-semibold text-foreground mt-0.5">{selectedTask.projectName}</h2>
              </div>
              <button onClick={() => setSelectedTask(null)} className="w-7 h-7 flex items-center justify-center rounded-[7px] text-muted-foreground hover:bg-accent">
                ✕
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              {[
                { label: "Job #", value: selectedTask.rfqId },
                { label: "Customer", value: selectedTask.customer },
                { label: "Priority", value: selectedTask.priority },
                { label: "Status", value: COLUMNS.find((c) => c.id === selectedTask.status)?.title ?? selectedTask.status },
                { label: "Assigned", value: selectedTask.assignee.name },
                { label: "Due", value: new Date(selectedTask.dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) },
                { label: "Attachments", value: `${selectedTask.attachments} file${selectedTask.attachments !== 1 ? "s" : ""}` },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                  <span className="text-xs font-medium text-muted-foreground">{label}</span>
                  <span className="text-xs font-semibold text-foreground">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
