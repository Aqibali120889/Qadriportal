/**
 * components/kanban/TaskFilters.tsx
 * Filter bar rendered above the Kanban board.
 * Supports: search, priority, my-tasks toggle, overdue, project filter.
 */

import { Search, Filter, X, User, AlertCircle } from "lucide-react";
import type { TaskPriority } from "@/app/types/kanban";

export interface FilterState {
  search:     string;
  priority:   TaskPriority | "";
  myTasks:    boolean;
  projectId:  string;
}

interface Props {
  filters:    FilterState;
  onChange:   (f: FilterState) => void;
  resultCount: number;
  dark?:      boolean;
  // Optional: list of projects for RFQ filter
  projects?:  Array<{ id: string; rfq_number: string; title: string }>;
}

const PRIORITY_OPTS: Array<{ value: TaskPriority | ""; label: string }> = [
  { value: "",         label: "All priorities" },
  { value: "critical", label: "Critical"       },
  { value: "high",     label: "High"           },
  { value: "medium",   label: "Medium"         },
  { value: "low",      label: "Low"            },
];

const INPUT_CLS =
  "h-8 rounded-[8px] text-xs bg-input-background border border-border text-foreground " +
  "placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/30 " +
  "focus:border-primary/50 transition-all duration-150";

export default function TaskFilters({ filters, onChange, resultCount, dark, projects = [] }: Props) {
  const set = (patch: Partial<FilterState>) => onChange({ ...filters, ...patch });
  const hasFilters = filters.search || filters.priority || filters.myTasks || filters.projectId;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Search */}
      <div className="relative flex-shrink-0">
        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          value={filters.search}
          onChange={(e) => set({ search: e.target.value })}
          placeholder="Search tasks…"
          className={`${INPUT_CLS} pl-7 pr-3 w-44`}
        />
      </div>

      {/* Priority */}
      <select
        value={filters.priority}
        onChange={(e) => set({ priority: e.target.value as TaskPriority | "" })}
        className={`${INPUT_CLS} px-2 cursor-pointer`}
      >
        {PRIORITY_OPTS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      {/* RFQ / Project */}
      {projects.length > 0 && (
        <select
          value={filters.projectId}
          onChange={(e) => set({ projectId: e.target.value })}
          className={`${INPUT_CLS} px-2 max-w-[160px] cursor-pointer`}
        >
          <option value="">All RFQs</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.rfq_number}</option>
          ))}
        </select>
      )}

      {/* My Tasks toggle */}
      <button
        onClick={() => set({ myTasks: !filters.myTasks })}
        className={`h-8 px-3 rounded-[8px] text-xs font-medium flex items-center gap-1.5 border transition-all duration-150 ${
          filters.myTasks
            ? "border-indigo-500/50 text-indigo-600 dark:text-indigo-400"
            : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
        }`}
        style={filters.myTasks ? { backgroundColor: dark ? "rgba(99,102,241,0.12)" : "rgba(99,102,241,0.06)" } : {}}
      >
        <User size={11} /> My Tasks
      </button>

      {/* Clear */}
      {hasFilters && (
        <button
          onClick={() => onChange({ search: "", priority: "", myTasks: false, projectId: "" })}
          className="h-8 px-2.5 rounded-[8px] text-xs font-medium flex items-center gap-1.5 border border-border text-muted-foreground hover:bg-accent hover:text-destructive transition-all"
        >
          <X size={11} /> Clear
        </button>
      )}

      {/* Count */}
      <span className="text-[10px] font-medium text-muted-foreground ml-auto">
        {resultCount} task{resultCount !== 1 ? "s" : ""}
      </span>
    </div>
  );
}
