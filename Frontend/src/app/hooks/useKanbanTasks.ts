/**
 * Frontend/src/app/hooks/useKanbanTasks.ts
 * ──────────────────────────────────────────────────────────────────────────────
 * Phase 10 — React hooks for the Kanban task management system.
 */

import { useCallback, useEffect, useState } from "react";
import * as tasksApi from "@/app/services/tasks";
import type {
  AssignableUser,
  BoardResponse,
  KanbanTask,
  TaskComment,
  TaskDetail,
  TaskStatus,
} from "@/app/types/kanban";
import type { BoardFilters, KanbanProject } from "@/app/services/tasks";

// ── useKanbanBoard ─────────────────────────────────────────────────────────────

export function useKanbanBoard(filters: BoardFilters = {}) {
  const [board, setBoard] = useState<BoardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Stringify filters so we can use them in dep array
  const filterKey = JSON.stringify(filters);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await tasksApi.getBoard(filters);
      setBoard(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load board");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey]);

  useEffect(() => { fetch(); }, [fetch]);

  // Optimistic DnD status move
  const moveTask = useCallback(async (taskId: string, newStatus: TaskStatus) => {
    if (!board) return;

    // Optimistic: move the task in local state immediately
    setBoard((prev) => {
      if (!prev) return prev;
      let movedTask: KanbanTask | undefined;
      const newColumns = prev.columns.map((col) => {
        const without = col.tasks.filter((t) => t.id !== taskId);
        const found = col.tasks.find((t) => t.id === taskId);
        if (found) movedTask = found;
        return { ...col, tasks: without, count: without.length };
      });
      if (!movedTask) return prev;
      movedTask = { ...movedTask, status: newStatus };
      const final = newColumns.map((col) =>
        col.status === newStatus
          ? { ...col, tasks: [...col.tasks, movedTask!], count: col.count + 1 }
          : col
      );
      return { ...prev, columns: final };
    });

    // Persist
    try {
      await tasksApi.moveTaskStatus(taskId, newStatus);
    } catch {
      // Revert on failure
      fetch();
    }
  }, [board, fetch]);

  const refetch = useCallback(() => fetch(), [fetch]);

  return { board, loading, error, refetch, moveTask };
}

// ── useTaskDetail ──────────────────────────────────────────────────────────────

export function useTaskDetail(taskId: string | null) {
  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!taskId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await tasksApi.getTask(taskId);
      setDetail(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load task");
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => { fetch(); }, [fetch]);

  const addComment = useCallback(async (content: string): Promise<TaskComment | null> => {
    if (!taskId) return null;
    try {
      const comment = await tasksApi.addComment(taskId, content);
      setDetail((prev) => prev
        ? { ...prev, comments: [...prev.comments, comment] }
        : prev
      );
      return comment;
    } catch { return null; }
  }, [taskId]);

  const refetch = useCallback(() => fetch(), [fetch]);

  return { detail, loading, error, refetch, addComment };
}

// ── useCreateTask ──────────────────────────────────────────────────────────────

export function useCreateTask(onSuccess?: (task: KanbanTask) => void) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = useCallback(async (payload: tasksApi.CreateTaskPayload) => {
    setLoading(true);
    setError(null);
    try {
      const task = await tasksApi.createTask(payload);
      onSuccess?.(task);
      return task;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Create failed";
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, [onSuccess]);

  return { create, loading, error };
}

// ── useUpdateTask ──────────────────────────────────────────────────────────────

export function useUpdateTask(taskId: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = useCallback(async (payload: tasksApi.UpdateTaskPayload) => {
    setLoading(true);
    setError(null);
    try {
      const task = await tasksApi.updateTask(taskId, payload);
      return task;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Update failed");
      return null;
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  const assign = useCallback(async (userId: string | null) => {
    setLoading(true);
    try {
      const task = await tasksApi.assignTask(taskId, userId);
      return task;
    } catch { return null; }
    finally { setLoading(false); }
  }, [taskId]);

  return { update, assign, loading, error };
}

// ── useAssignableUsers ────────────────────────────────────────────────────────

export function useAssignableUsers() {
  const [users, setUsers] = useState<AssignableUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    tasksApi.getAssignableUsers()
      .then(setUsers)
      .catch(() => { })
      .finally(() => setLoading(false));
  }, []);

  return { users, loading };
}

// ── useProjectList (for RFQ dropdown in Create modal) ────────────────────

export function useProjectList() {
  const [projects, setProjects] = useState<KanbanProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    tasksApi.getKanbanProjects()
      .then(setProjects)
      .catch((err) => {
        console.error("[useProjectList] failed to fetch kanban projects:", err);
      })
      .finally(() => setLoading(false));
  }, []);

  return { projects, loading };
}
