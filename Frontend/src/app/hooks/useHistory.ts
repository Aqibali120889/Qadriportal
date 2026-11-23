/**
 * Frontend/src/app/hooks/useHistory.ts
 * ──────────────────────────────────────────────────────────────────────────────
 * React hook for the department-scoped activity / history feed.
 */

import { useCallback, useEffect, useState } from "react";
import {
  api,
  ApiError,
  type PaginatedHistory,
} from "@/app/services/api";

interface UseHistoryState {
  data: PaginatedHistory | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useHistory(page = 1, pageSize = 20): UseHistoryState {
  const [data, setData] = useState<PaginatedHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    api.history
      .list(page, pageSize)
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Failed to load history");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [page, pageSize, tick]);

  return { data, loading, error, refetch };
}
