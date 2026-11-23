/**
 * Frontend/src/app/hooks/useProjects.ts
 * ──────────────────────────────────────────────────────────────────────────────
 * React hooks for project data fetching.
 * Encapsulates loading / error state for all project-related API calls.
 */

import { useCallback, useEffect, useState } from "react";
import {
  api,
  ApiError,
  type PaginatedProjects,
  type ProjectDetail,
} from "@/app/services/api";

// ── useProjectList ─────────────────────────────────────────────────────────────

interface UseProjectListState {
  data: PaginatedProjects | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useProjectList(page = 1, pageSize = 20): UseProjectListState {
  const [data, setData] = useState<PaginatedProjects | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    api.projects
      .list(page, pageSize)
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Failed to load projects");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [page, pageSize, tick]);

  return { data, loading, error, refetch };
}

// ── useProjectDetail ───────────────────────────────────────────────────────────

interface UseProjectDetailState {
  data: ProjectDetail | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useProjectDetail(projectId: string | null): UseProjectDetailState {
  const [data, setData] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!projectId) {
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    api.projects
      .getDetail(projectId)
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Failed to load project");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [projectId, tick]);

  return { data, loading, error, refetch };
}

// ── useKanbanBoard ─────────────────────────────────────────────────────────────

interface UseKanbanState {
  data: import("@/app/services/api").KanbanBoardResponse | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  updateStatus: (projectId: string, newStatus: string) => Promise<void>;
}

export function useKanbanBoard(): UseKanbanState {
  const [data, setData] = useState<import("@/app/services/api").KanbanBoardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    api.projects
      .kanban()
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Failed to load kanban data");
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [tick]);

  // Optimistic status update — update local state immediately then persist
  const updateStatus = useCallback(async (projectId: string, newStatus: string) => {
    // Map DB status → kanban column
    const COLUMN_MAP: Record<string, string> = {
      DRAFT: "pending", ACTIVE: "in-progress",
      ON_HOLD: "review", COMPLETED: "completed", CANCELLED: "completed",
    };
    // Optimistic update
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        tasks: prev.tasks.map((t) =>
          t.id === projectId
            ? { ...t, status: newStatus, kanban_column: COLUMN_MAP[newStatus] ?? "pending" }
            : t
        ),
      };
    });
    try {
      await api.projects.updateStatus(projectId, newStatus);
    } catch {
      // Revert on failure
      refetch();
    }
  }, [refetch]);

  return { data, loading, error, refetch, updateStatus };
}

// ── useDashboardStats ──────────────────────────────────────────────────────────

interface UseDashboardStatsState {
  data: import("@/app/services/api").DepartmentStats | null;
  loading: boolean;
  error: string | null;
}

export function useDashboardStats(): UseDashboardStatsState {
  const [data, setData] = useState<import("@/app/services/api").DepartmentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.projects
      .stats()
      .then((res) => { if (!cancelled) { setData(res); setLoading(false); } })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Failed to load stats");
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, []);

  return { data, loading, error };
}
