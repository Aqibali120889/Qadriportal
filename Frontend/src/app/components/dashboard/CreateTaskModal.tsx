import { useState } from "react";
import { X, Paperclip, ChevronRight } from "lucide-react";
import type { Task, ColumnId, Priority } from "@/app/types/task";
import { ENGINEERS, PRIORITY_CONFIG } from "@/app/types/task";

interface CreateTaskModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (task: Omit<Task, "id" | "attachments" | "comments" | "progress">) => void;
}

const INPUT_CLS =
  "w-full h-9 px-3 rounded-[8px] text-sm text-foreground bg-input-background border border-border " +
  "placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary/50 " +
  "transition-all duration-150";

const SELECT_CLS =
  "w-full h-9 px-3 rounded-[8px] text-sm text-foreground bg-input-background border border-border " +
  "focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary/50 transition-all duration-150 cursor-pointer";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">
        {label}
      </label>
      {children}
    </div>
  );
}

export default function CreateTaskModal({ open, onClose, onSave }: CreateTaskModalProps) {
  const today = new Date().toISOString().split("T")[0];
  const nextRfq = `RFQ-2026-0${String(Math.floor(Math.random() * 900) + 100)}`;

  const [rfqId,      setRfqId]      = useState(nextRfq);
  const [customer,   setCustomer]   = useState("");
  const [project,    setProject]    = useState("");
  const [priority,   setPriority]   = useState<Priority>("Medium");
  const [dueDate,    setDueDate]    = useState(today);
  const [engineerId, setEngineerId] = useState(ENGINEERS[0].id);
  const [notes,      setNotes]      = useState("");
  const [fileName,   setFileName]   = useState("");
  const [errors,     setErrors]     = useState<Record<string, string>>({});

  if (!open) return null;

  function validate() {
    const e: Record<string, string> = {};
    if (!customer.trim()) e.customer = "Customer is required.";
    if (!project.trim())  e.project  = "Project name is required.";
    if (!dueDate)         e.dueDate  = "Due date is required.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function buildTask(): Omit<Task, "id" | "attachments" | "comments" | "progress"> {
    return {
      rfqId,
      customer: customer.trim(),
      projectName: project.trim(),
      priority,
      dueDate,
      assignee: ENGINEERS.find((e) => e.id === engineerId)!,
      status: "pending" as ColumnId,
      description: notes.trim(),
    };
  }

  function handleSave() {
    if (!validate()) return;
    onSave(buildTask());
    onClose();
  }

  function handleSaveOpen() {
    if (!validate()) return;
    onSave(buildTask());
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg bg-card rounded-[14px] border border-border shadow-[0_24px_64px_rgba(0,0,0,0.18)] overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-foreground">New RFQ Task</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Create a new cost estimation task</p>
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
          {/* Row: RFQ ID + Priority */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="RFQ ID">
              <input
                type="text"
                className={INPUT_CLS}
                value={rfqId}
                onChange={(e) => setRfqId(e.target.value)}
              />
            </Field>
            <Field label="Priority">
              <div className="relative">
                <select
                  className={SELECT_CLS}
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as Priority)}
                >
                  {(["Critical", "High", "Medium", "Low"] as Priority[]).map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              {/* Priority indicator */}
              <div className="flex items-center gap-1.5 mt-1.5">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: PRIORITY_CONFIG[priority].color }}
                />
                <span className="text-[11px]" style={{ color: PRIORITY_CONFIG[priority].color }}>
                  {priority} priority selected
                </span>
              </div>
            </Field>
          </div>

          {/* Customer */}
          <Field label="Customer Name">
            <input
              type="text"
              className={`${INPUT_CLS} ${errors.customer ? "border-destructive" : ""}`}
              placeholder="e.g. Lucky Cement"
              value={customer}
              onChange={(e) => { setCustomer(e.target.value); if (errors.customer) setErrors((p) => ({ ...p, customer: "" })); }}
            />
            {errors.customer && <p className="mt-1 text-xs text-destructive">{errors.customer}</p>}
          </Field>

          {/* Project Name */}
          <Field label="Project Name">
            <input
              type="text"
              className={`${INPUT_CLS} ${errors.project ? "border-destructive" : ""}`}
              placeholder="e.g. Crusher Housing Assembly"
              value={project}
              onChange={(e) => { setProject(e.target.value); if (errors.project) setErrors((p) => ({ ...p, project: "" })); }}
            />
            {errors.project && <p className="mt-1 text-xs text-destructive">{errors.project}</p>}
          </Field>

          {/* Row: Due Date + Engineer */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Due Date">
              <input
                type="date"
                className={`${INPUT_CLS} ${errors.dueDate ? "border-destructive" : ""}`}
                value={dueDate}
                min={today}
                onChange={(e) => { setDueDate(e.target.value); if (errors.dueDate) setErrors((p) => ({ ...p, dueDate: "" })); }}
              />
              {errors.dueDate && <p className="mt-1 text-xs text-destructive">{errors.dueDate}</p>}
            </Field>
            <Field label="Assign Engineer">
              <select
                className={SELECT_CLS}
                value={engineerId}
                onChange={(e) => setEngineerId(e.target.value)}
              >
                {ENGINEERS.map((eng) => (
                  <option key={eng.id} value={eng.id}>{eng.name}</option>
                ))}
              </select>
            </Field>
          </div>

          {/* Attach Drawing */}
          <Field label="Attach Drawing">
            <label className="flex items-center gap-2 h-9 px-3 rounded-[8px] border border-dashed border-border bg-input-background cursor-pointer hover:bg-accent/40 transition-colors">
              <Paperclip size={13} className="text-muted-foreground flex-shrink-0" />
              <span className="text-sm text-muted-foreground truncate">
                {fileName || "Click to attach drawing file…"}
              </span>
              <input
                type="file"
                className="hidden"
                accept=".pdf,.dwg,.dxf,.png,.jpg"
                onChange={(e) => setFileName(e.target.files?.[0]?.name || "")}
              />
            </label>
          </Field>

          {/* Notes */}
          <Field label="Notes">
            <textarea
              className="w-full px-3 py-2 rounded-[8px] text-sm text-foreground bg-input-background border border-border
                placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary/50
                transition-all duration-150 resize-none"
              rows={3}
              placeholder="Additional notes or requirements…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>
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
            className="h-8 px-4 rounded-[8px] text-sm font-medium border border-border text-foreground hover:bg-accent transition-colors"
          >
            Save
          </button>
          <button
            onClick={handleSaveOpen}
            className="h-8 px-4 rounded-[8px] text-sm font-semibold text-white flex items-center gap-1.5 transition-all"
            style={{ backgroundColor: "#F5821F" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#D9710E")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#F5821F")}
          >
            Save & Open <ChevronRight size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
