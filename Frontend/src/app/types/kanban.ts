/**
 * Frontend/src/app/types/kanban.ts
 * ──────────────────────────────────────────────────────────────────────────────
 * Phase 10 — Type definitions for the enterprise Kanban task system.
 *
 * Parallel to the existing task.ts (which maps projects to kanban cards).
 * This file models real kanban_tasks DB entities with full lifecycle support.
 */

// ── Enums ─────────────────────────────────────────────────────────────────────

export type TaskStatus =
  | "todo"
  | "in_progress"
  | "waiting_review"
  | "blocked"
  | "completed"
  | "cancelled";

export type TaskPriority = "critical" | "high" | "medium" | "low";

// ── Column definitions ────────────────────────────────────────────────────────

export interface KanbanColumnDef {
  status:      TaskStatus;
  label:       string;
  accent:      string;
  darkAccent:  string;
  bg:          string;
  darkBg:      string;
  description: string;
}

export const KANBAN_COLUMNS: KanbanColumnDef[] = [
  {
    status:      "todo",
    label:       "To Do",
    accent:      "#64748B",
    darkAccent:  "#94A3B8",
    bg:          "#F8FAFC",
    darkBg:      "rgba(100,116,139,0.12)",
    description: "Tasks not yet started",
  },
  {
    status:      "in_progress",
    label:       "In Progress",
    accent:      "#3B82F6",
    darkAccent:  "#60A5FA",
    bg:          "#EFF6FF",
    darkBg:      "rgba(59,130,246,0.12)",
    description: "Actively being worked on",
  },
  {
    status:      "waiting_review",
    label:       "Waiting Review",
    accent:      "#F59E0B",
    darkAccent:  "#FBBF24",
    bg:          "#FFFBEB",
    darkBg:      "rgba(245,158,11,0.12)",
    description: "Submitted — awaiting review or approval",
  },
  {
    status:      "blocked",
    label:       "Blocked",
    accent:      "#EF4444",
    darkAccent:  "#F87171",
    bg:          "#FEF2F2",
    darkBg:      "rgba(239,68,68,0.12)",
    description: "Cannot proceed — needs resolution",
  },
  {
    status:      "completed",
    label:       "Completed",
    accent:      "#22C55E",
    darkAccent:  "#4ADE80",
    bg:          "#F0FDF4",
    darkBg:      "rgba(34,197,94,0.12)",
    description: "Done and signed off",
  },
];

export const PRIORITY_CONFIG: Record<
  TaskPriority,
  { label: string; color: string; bg: string; darkBg: string }
> = {
  critical: { label: "Critical", color: "#EF4444", bg: "#FEF2F2", darkBg: "rgba(239,68,68,0.12)" },
  high:     { label: "High",     color: "#F97316", bg: "#FFF7ED", darkBg: "rgba(249,115,22,0.12)" },
  medium:   { label: "Medium",   color: "#D97706", bg: "#FFFBEB", darkBg: "rgba(217,119,6,0.12)"  },
  low:      { label: "Low",      color: "#64748B", bg: "#F8FAFC", darkBg: "rgba(100,116,139,0.12)" },
};

// ── Task type catalogs ────────────────────────────────────────────────────────

export const CE_TASK_TYPES = [
  { value: "initial_review",         label: "Initial RFQ Review" },
  { value: "ai_review",              label: "AI Review" },
  { value: "commercial_review",      label: "Commercial Review" },
  { value: "cost_calculation",       label: "Cost Calculation" },
  { value: "rfq_sheet_verification", label: "RFQ Sheet Verification" },
  { value: "customer_clarification", label: "Customer Clarification" },
  { value: "final_approval",         label: "Final Approval" },
  { value: "other",                  label: "Other" },
];

export const FOUNDRY_TASK_TYPES = [
  { value: "material_selection", label: "Material Selection" },
  { value: "pattern_review",     label: "Pattern Review" },
  { value: "moulding",           label: "Moulding" },
  { value: "casting",            label: "Casting" },
  { value: "fettling",           label: "Fettling" },
  { value: "foundry_costing",    label: "Foundry Costing" },
  { value: "foundry_approval",   label: "Foundry Approval" },
  { value: "other",              label: "Other" },
];

// ── Core data shapes ──────────────────────────────────────────────────────────

export interface KanbanTask {
  id:              string;
  project_id:      string;
  department_id:   string;
  title:           string;
  description?:    string | null;
  task_type?:      string | null;
  status:          TaskStatus;
  priority:        TaskPriority;
  sort_order:      number;
  assigned_to?:    string | null;
  assigned_by?:    string | null;
  created_by?:     string | null;
  due_date?:       string | null;  // ISO date string YYYY-MM-DD
  estimated_hours?: number | null;
  completed_at?:   string | null;
  is_ai_generated: boolean;
  created_at:      string;
  updated_at:      string;

  // Enriched from server joins
  rfq_number?:     string | null;
  project_title?:  string | null;
  assignee_name?:  string | null;
  assignee_email?: string | null;
  creator_name?:   string | null;
  comments_count:  number;
}

export interface TaskComment {
  id:            string;
  task_id:       string;
  user_id?:      string | null;
  department_id?: string | null;
  content:       string;
  created_at:    string;
  updated_at:    string;
  author_name?:  string | null;
  author_email?: string | null;
}

export interface TaskHistoryEntry {
  id:         string;
  task_id:    string;
  user_id?:   string | null;
  event_type: string;
  old_value?: string | null;
  new_value?: string | null;
  metadata?:  Record<string, unknown> | null;
  created_at: string;
  actor_name?: string | null;
}

export interface TaskDetail {
  task:     KanbanTask;
  comments: TaskComment[];
  history:  TaskHistoryEntry[];
}

export interface KanbanBoardColumn {
  status: TaskStatus;
  tasks:  KanbanTask[];
  count:  number;
}

export interface BoardResponse {
  columns: KanbanBoardColumn[];
  total:   number;
  dept_id?: string | null;
}

export interface AssignableUser {
  id:            string;
  name:          string;
  email:         string;
  department_id?: string | null;
}

// ── Util helpers ──────────────────────────────────────────────────────────────

export function isOverdue(task: KanbanTask): boolean {
  if (!task.due_date) return false;
  if (task.status === "completed" || task.status === "cancelled") return false;
  return new Date(task.due_date) < new Date(new Date().toDateString());
}

export function dueDateLabel(task: KanbanTask): { label: string; overdue: boolean; soon: boolean } {
  if (!task.due_date) return { label: "", overdue: false, soon: false };
  const due   = new Date(task.due_date);
  const today = new Date(new Date().toDateString());
  const diff  = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return { label: `${Math.abs(diff)}d overdue`, overdue: true, soon: false };
  if (diff === 0) return { label: "Due today", overdue: false, soon: true };
  if (diff === 1) return { label: "Due tomorrow", overdue: false, soon: true };
  return {
    label: due.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
    overdue: false,
    soon: diff <= 3,
  };
}

export function taskTypeLabel(taskType: string | null | undefined, dept: "ce" | "foundry" = "ce"): string {
  const list = dept === "foundry" ? FOUNDRY_TASK_TYPES : CE_TASK_TYPES;
  return list.find((t) => t.value === taskType)?.label ?? taskType ?? "Task";
}
