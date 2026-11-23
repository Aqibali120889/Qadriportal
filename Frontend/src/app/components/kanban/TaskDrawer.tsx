/**
 * components/kanban/TaskDrawer.tsx
 * Slide-in right panel showing full task detail:
 *   - Task meta (title, status, priority, assignee, dates)
 *   - Inline edit
 *   - Comments thread
 *   - Activity timeline
 */

import { useState } from "react";
import {
  X, Edit2, Check, Calendar, Clock, User, Tag,
  MessageSquare, History, ChevronLeft, Sparkles,
  AlertTriangle, CheckCircle2, ExternalLink,
} from "lucide-react";
import type { KanbanTask, TaskStatus, TaskPriority, AssignableUser } from "@/app/types/kanban";
import {
  PRIORITY_CONFIG, KANBAN_COLUMNS, dueDateLabel, isOverdue,
  CE_TASK_TYPES, FOUNDRY_TASK_TYPES,
} from "@/app/types/kanban";
import AssigneeAvatar from "./AssigneeAvatar";
import PriorityBadge from "./PriorityBadge";
import StatusBadge from "./StatusBadge";
import TaskComments from "./TaskComments";
import TaskTimeline from "./TaskTimeline";
import { useTaskDetail, useUpdateTask } from "@/app/hooks/useKanbanTasks";
import * as tasksApi from "@/app/services/tasks";

interface Props {
  taskId:     string | null;
  onClose:    () => void;
  onStatusChange?: (taskId: string, newStatus: TaskStatus) => void;
  users?:     AssignableUser[];
  dark?:      boolean;
  dept?:      "ce" | "foundry";
  accentColor?: string;
}

type DrawerTab = "detail" | "comments" | "history";

const SECTION_HDR = "text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2";

export default function TaskDrawer({
  taskId, onClose, onStatusChange, users = [], dark, dept = "ce", accentColor = "#F5821F",
}: Props) {
  const { detail, loading, error, refetch, addComment } = useTaskDetail(taskId);
  const { update, assign, loading: saving } = useUpdateTask(taskId ?? "");
  const [tab,        setTab]        = useState<DrawerTab>("detail");
  const [commenting, setCommenting] = useState(false);
  const [editTitle,  setEditTitle]  = useState(false);
  const [titleValue, setTitleValue] = useState("");

  if (!taskId) return null;

  const task    = detail?.task;
  const taskTypes = dept === "foundry" ? FOUNDRY_TASK_TYPES : CE_TASK_TYPES;
  const due     = task ? dueDateLabel(task) : null;
  const overdue = task ? isOverdue(task) : false;

  const handleAddComment = async (content: string) => {
    setCommenting(true);
    await addComment(content);
    setCommenting(false);
  };

  const handleStatusMove = async (newStatus: TaskStatus) => {
    if (!task) return;
    await tasksApi.moveTaskStatus(task.id, newStatus);
    onStatusChange?.(task.id, newStatus);
    refetch();
  };

  const handleSaveTitle = async () => {
    if (!task || !titleValue.trim()) return;
    await update({ title: titleValue.trim() });
    setEditTitle(false);
    refetch();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20 dark:bg-black/40 backdrop-blur-[1px]"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className="fixed right-0 top-0 bottom-0 z-50 flex flex-col bg-card border-l border-border shadow-[−24px_0_64px_rgba(0,0,0,0.12)]"
        style={{ width: 420 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3.5 border-b border-border">
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-[7px] text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <ChevronLeft size={15} />
            </button>
            <span className="text-sm font-semibold text-foreground">Task Detail</span>
            {task?.is_ai_generated && (
              <span className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                style={{ color: "#8B5CF6", backgroundColor: dark ? "rgba(139,92,246,0.12)" : "rgba(139,92,246,0.07)" }}>
                <Sparkles size={9} /> AI Generated
              </span>
            )}
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-[7px] text-muted-foreground hover:bg-accent">
            <X size={14} />
          </button>
        </div>

        {/* Loading / Error */}
        {loading && (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-border border-t-primary rounded-full animate-spin" />
          </div>
        )}
        {error && (
          <div className="flex-1 flex items-center justify-center p-6">
            <p className="text-xs text-destructive text-center">{error}</p>
          </div>
        )}

        {task && (
          <>
            {/* Tabs */}
            <div className="flex-shrink-0 flex border-b border-border">
              {(["detail","comments","history"] as DrawerTab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 py-2.5 text-xs font-medium capitalize transition-colors ${
                    tab === t
                      ? "border-b-2 text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  style={tab === t ? { borderColor: accentColor, color: accentColor } : {}}
                >
                  {t === "comments" ? `Comments (${detail?.comments.length ?? 0})` : t}
                </button>
              ))}
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto">

              {/* ── Detail Tab ────────────────────────────────────────────── */}
              {tab === "detail" && (
                <div className="px-4 py-4 space-y-5">
                  {/* Title */}
                  <div>
                    {editTitle ? (
                      <div className="flex gap-2">
                        <input
                          autoFocus
                          value={titleValue}
                          onChange={(e) => setTitleValue(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") handleSaveTitle(); if (e.key === "Escape") setEditTitle(false); }}
                          className="flex-1 text-base font-semibold bg-transparent border-b border-primary outline-none text-foreground"
                        />
                        <button onClick={handleSaveTitle} disabled={saving} className="text-green-500"><Check size={16} /></button>
                        <button onClick={() => setEditTitle(false)} className="text-muted-foreground"><X size={14} /></button>
                      </div>
                    ) : (
                      <div className="flex items-start gap-2 group">
                        <h2 className="flex-1 text-base font-semibold text-foreground leading-snug">{task.title}</h2>
                        <button
                          onClick={() => { setTitleValue(task.title); setEditTitle(true); }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground mt-0.5"
                        >
                          <Edit2 size={13} />
                        </button>
                      </div>
                    )}
                    {task.rfq_number && (
                      <p className="text-[10px] font-mono text-muted-foreground mt-1">{task.rfq_number}</p>
                    )}
                    {task.project_title && (
                      <p className="text-xs text-muted-foreground">{task.project_title}</p>
                    )}
                  </div>

                  {/* Status + Priority */}
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-muted-foreground">Status</span>
                      <StatusBadge status={task.status} dark={dark} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-muted-foreground">Priority</span>
                      <PriorityBadge priority={task.priority} dark={dark} />
                    </div>
                    {task.is_ai_generated && (
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-muted-foreground">Origin</span>
                        <span className="flex items-center gap-1 text-[10px] font-medium" style={{ color: "#8B5CF6" }}>
                          <Sparkles size={9} /> AI
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Move status */}
                  <div>
                    <p className={SECTION_HDR}>Move to</p>
                    <div className="flex flex-wrap gap-1.5">
                      {KANBAN_COLUMNS.filter((c) => c.status !== task.status).map((c) => (
                        <button
                          key={c.status}
                          onClick={() => handleStatusMove(c.status)}
                          className="text-[10px] font-semibold px-2 py-1 rounded-full border transition-all hover:opacity-80"
                          style={{
                            color: c.accent,
                            backgroundColor: dark ? c.darkBg : c.bg,
                            borderColor: `${c.accent}30`,
                          }}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Meta grid */}
                  <div className="space-y-3">
                    {/* Assignee */}
                    <div className="flex items-center justify-between py-2 border-b border-border">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <User size={12} /> Assignee
                      </div>
                      {task.assignee_name ? (
                        <div className="flex items-center gap-1.5">
                          <AssigneeAvatar name={task.assignee_name} email={task.assignee_email} size={18} />
                          <span className="text-xs font-medium text-foreground">{task.assignee_name}</span>
                        </div>
                      ) : (
                        <button
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                          onClick={() => {/* open assign UI */}}
                        >
                          Unassigned — click to assign
                        </button>
                      )}
                    </div>

                    {/* Due Date */}
                    {due?.label && (
                      <div className="flex items-center justify-between py-2 border-b border-border">
                        <div className={`flex items-center gap-1.5 text-xs ${overdue ? "text-red-500" : "text-muted-foreground"}`}>
                          {overdue ? <AlertTriangle size={12} /> : <Calendar size={12} />} Due Date
                        </div>
                        <span className={`text-xs font-medium ${overdue ? "text-red-500" : "text-foreground"}`}>
                          {due.label}
                        </span>
                      </div>
                    )}

                    {/* Est. Hours */}
                    {task.estimated_hours && (
                      <div className="flex items-center justify-between py-2 border-b border-border">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Clock size={12} /> Est. Hours
                        </div>
                        <span className="text-xs font-medium text-foreground">{task.estimated_hours}h</span>
                      </div>
                    )}

                    {/* Task Type */}
                    {task.task_type && (
                      <div className="flex items-center justify-between py-2 border-b border-border">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Tag size={12} /> Type
                        </div>
                        <span className="text-xs font-medium text-foreground capitalize">
                          {task.task_type.replace(/_/g, " ")}
                        </span>
                      </div>
                    )}

                    {/* Completed */}
                    {task.completed_at && (
                      <div className="flex items-center justify-between py-2 border-b border-border">
                        <div className="flex items-center gap-1.5 text-xs text-green-600">
                          <CheckCircle2 size={12} /> Completed
                        </div>
                        <span className="text-xs font-medium text-foreground">
                          {new Date(task.completed_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  {task.description && (
                    <div>
                      <p className={SECTION_HDR}>Description</p>
                      <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap">
                        {task.description}
                      </p>
                    </div>
                  )}

                  {/* Open in workspace button */}
                  {task.project_id && (
                    <a
                      href={`/dashboard/drawing-workspace?projectId=${task.project_id}`}
                      className="flex items-center gap-1.5 justify-center w-full h-9 rounded-[8px] text-xs font-semibold text-white transition-all hover:opacity-90"
                      style={{ backgroundColor: accentColor }}
                    >
                      <ExternalLink size={13} /> Open Drawing Workspace
                    </a>
                  )}
                </div>
              )}

              {/* ── Comments Tab ──────────────────────────────────────────── */}
              {tab === "comments" && (
                <div className="px-4 py-4">
                  <TaskComments
                    comments={detail?.comments ?? []}
                    onSubmit={handleAddComment}
                    submitting={commenting}
                    dark={dark}
                  />
                </div>
              )}

              {/* ── History Tab ───────────────────────────────────────────── */}
              {tab === "history" && (
                <div className="px-4 py-4">
                  <div className="flex items-center gap-2 mb-4">
                    <History size={13} className="text-muted-foreground" />
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Activity Timeline
                    </span>
                  </div>
                  <TaskTimeline history={detail?.history ?? []} dark={dark} />
                </div>
              )}
            </div>

            {/* Footer timestamp */}
            <div className="flex-shrink-0 px-4 py-2.5 border-t border-border bg-card">
              <p className="text-[10px] text-muted-foreground/60 text-center">
                Created {new Date(task.created_at).toLocaleDateString("en-GB", {
                  day: "numeric", month: "short", year: "numeric",
                })}
                {task.creator_name ? ` by ${task.creator_name}` : ""}
              </p>
            </div>
          </>
        )}
      </div>
    </>
  );
}
