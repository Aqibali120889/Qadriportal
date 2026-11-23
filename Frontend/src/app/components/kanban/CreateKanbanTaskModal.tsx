/**
 * components/kanban/CreateKanbanTaskModal.tsx
 * Modal for creating a new enterprise task linked to an RFQ/project.
 * Replaces the old CreateTaskModal for the new system.
 */

import { useState } from "react";
import { X, Paperclip, ChevronRight, Sparkles } from "lucide-react";
import type { TaskPriority } from "@/app/types/kanban";
import { CE_TASK_TYPES, FOUNDRY_TASK_TYPES, PRIORITY_CONFIG } from "@/app/types/kanban";
import type { CreateTaskPayload } from "@/app/services/tasks";

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (payload: CreateTaskPayload) => Promise<void>;
  saving: boolean;
  // Pre-selected project (when opening from a project context)
  defaultProjectId?: string;
  // Project list for dropdown
  projects?: Array<{ id: string; rfq_number: string; title: string }>;
  loadingProjects?: boolean;
  dept?: "ce" | "foundry";
  dark?: boolean;
  // Super Admin: explicit department UUID to tag the task with
  departmentId?: string;
}

const INPUT_CLS =
  "w-full h-9 px-3 rounded-[8px] text-sm text-foreground bg-input-background border border-border " +
  "placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary/50 " +
  "transition-all duration-150";

const SELECT_CLS =
  "w-full h-9 px-3 rounded-[8px] text-sm text-foreground bg-input-background border border-border " +
  "focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary/50 transition-all duration-150 cursor-pointer";

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

export default function CreateKanbanTaskModal({
  open, onClose, onSave, saving, defaultProjectId,
  projects = [], loadingProjects = false, dept = "ce", dark, departmentId,
}: Props) {
  const today = new Date().toISOString().split("T")[0];
  const taskTypes = dept === "foundry" ? FOUNDRY_TASK_TYPES : CE_TASK_TYPES;

  const [projectId, setProjectId] = useState(defaultProjectId ?? "");
  const [title, setTitle] = useState("");
  const [taskType, setTaskType] = useState(taskTypes[0].value);
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [estHours, setEstHours] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!open) return null;

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!projectId.trim()) e.projectId = "Select an RFQ/Project.";
    if (!title.trim()) e.title = "Task title is required.";
    setErrors(e);
    return !Object.keys(e).length;
  }

  async function handleSave() {
    if (!validate()) return;
    const payload: CreateTaskPayload = {
      project_id: projectId,
      title: title.trim(),
      task_type: taskType || undefined,
      priority,
      description: notes.trim() || undefined,
      due_date: dueDate || undefined,
      estimated_hours: estHours ? parseFloat(estHours) : undefined,
      // Include department_id if provided (Super Admin board)
      ...(departmentId ? { department_id: departmentId } : {}),
    } as CreateTaskPayload;
    await onSave(payload);
    // Reset
    setTitle(""); setNotes(""); setDueDate(""); setEstHours("");
    setErrors({});
    onClose();
  }

  const pCfg = PRIORITY_CONFIG[priority];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg bg-card rounded-[14px] border border-border shadow-[0_24px_64px_rgba(0,0,0,0.22)] overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-foreground">New Task</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {dept === "foundry" ? "Foundry" : "Cost Estimation"} · Kanban Task
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-[7px] text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* RFQ / Project */}
          <Field label="RFQ / Project" required>
            <select
              value={projectId}
              onChange={(e) => { setProjectId(e.target.value); setErrors((p) => ({ ...p, projectId: "" })); }}
              className={`${SELECT_CLS} ${errors.projectId ? "border-destructive" : ""}`}
              disabled={loadingProjects}
            >
              {loadingProjects ? (
                <option value="">Loading projects…</option>
              ) : projects.length === 0 ? (
                <option value="">No projects found</option>
              ) : (
                <>
                  <option value="">— Select an RFQ —</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.rfq_number} · {p.title}</option>
                  ))}
                </>
              )}
            </select>
            {errors.projectId && <p className="mt-1 text-xs text-destructive">{errors.projectId}</p>}
          </Field>

          {/* Title */}
          <Field label="Task Title" required>
            <input
              type="text"
              placeholder={`e.g. ${taskTypes[0].label}`}
              value={title}
              onChange={(e) => { setTitle(e.target.value); setErrors((p) => ({ ...p, title: "" })); }}
              className={`${INPUT_CLS} ${errors.title ? "border-destructive" : ""}`}
            />
            {errors.title && <p className="mt-1 text-xs text-destructive">{errors.title}</p>}
          </Field>

          {/* Task Type + Priority */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Task Type">
              <select value={taskType} onChange={(e) => setTaskType(e.target.value)} className={SELECT_CLS}>
                {taskTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </Field>
            <Field label="Priority">
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className={SELECT_CLS}
              >
                {(["critical", "high", "medium", "low"] as TaskPriority[]).map((p) => (
                  <option key={p} value={p}>{PRIORITY_CONFIG[p].label}</option>
                ))}
              </select>
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: pCfg.color }} />
                <span className="text-[11px]" style={{ color: pCfg.color }}>{pCfg.label} priority</span>
              </div>
            </Field>
          </div>

          {/* Due Date + Est. Hours */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Due Date">
              <input
                type="date"
                min={today}
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={INPUT_CLS}
              />
            </Field>
            <Field label="Est. Hours">
              <input
                type="number"
                min="0"
                step="0.5"
                placeholder="e.g. 4"
                value={estHours}
                onChange={(e) => setEstHours(e.target.value)}
                className={INPUT_CLS}
              />
            </Field>
          </div>

          {/* Notes */}
          <Field label="Description / Notes">
            <textarea
              className="w-full px-3 py-2 rounded-[8px] text-sm text-foreground bg-input-background border border-border
                placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/30
                focus:border-primary/50 transition-all duration-150 resize-none"
              rows={3}
              placeholder="Additional context or requirements…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>

          {/* AI badge */}
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-[8px] border border-dashed"
            style={{ borderColor: "#8B5CF630", backgroundColor: dark ? "rgba(139,92,246,0.05)" : "rgba(139,92,246,0.03)" }}
          >
            <Sparkles size={11} style={{ color: "#8B5CF6" }} />
            <p className="text-[10px] text-muted-foreground">
              AI will auto-generate related tasks based on pipeline events (when enabled per project).
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-border flex-shrink-0 bg-card">
          <button
            onClick={onClose}
            className="h-8 px-4 rounded-[8px] text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="h-8 px-4 rounded-[8px] text-sm font-semibold text-white flex items-center gap-1.5 transition-all disabled:opacity-50"
            style={{ backgroundColor: "#F5821F" }}
            onMouseEnter={(e) => !saving && (e.currentTarget.style.backgroundColor = "#D9710E")}
            onMouseLeave={(e) => !saving && (e.currentTarget.style.backgroundColor = "#F5821F")}
          >
            {saving ? "Creating…" : "Create Task"} <ChevronRight size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
