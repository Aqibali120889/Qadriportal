/**
 * Frontend/src/app/context/NotificationContext.tsx
 * ──────────────────────────────────────────────────────────────────────────────
 * One shared notification data source per top-level layout (CELayout,
 * FoundryLayout, AdminLayout each mount exactly one NotificationProvider).
 *
 * Existing Bell components (TopNav, WorkspaceTopNav, AdminTopNav) keep their
 * own markup — only the data source changes, via useNotifications().
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  connectNotificationStream,
  notificationsApi,
  type NotificationItem,
} from "@/app/services/notifications";

interface NotificationContextValue {
  notifications: NotificationItem[];
  unreadCount: number;
  loading: boolean;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  refetch: () => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

const MAX_KEPT = 50; // dropdown only ever shows the most recent handful

export function NotificationProvider({ children }: { readonly children: ReactNode }) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const closeStreamRef = useRef<(() => void) | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([notificationsApi.list(1, 20), notificationsApi.unreadCount()])
      .then(([list, count]) => {
        setNotifications(list.items);
        setUnreadCount(count.unread_count);
      })
      .catch(() => {
        // Notification center failing to load must never block the rest of the app.
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();

    let cancelled = false;
    connectNotificationStream(
      (notif) => {
        if (cancelled) return;
        setNotifications((prev) => [notif, ...prev].slice(0, MAX_KEPT));
        if (!notif.is_read) setUnreadCount((c) => c + 1);
      },
      () => {
        // EventSource retries natively — nothing to do here besides not crash.
      }
    ).then((close) => {
      if (cancelled) close();
      else closeStreamRef.current = close;
    });

    return () => {
      cancelled = true;
      closeStreamRef.current?.();
    };
  }, [load]);

  const markRead = useCallback(async (id: string) => {
    const target = notifications.find((n) => n.id === id);
    if (!target || target.is_read) return;
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await notificationsApi.markRead(id);
    } catch {
      load(); // revert to server truth on failure
    }
  }, [notifications, load]);

  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
    try {
      await notificationsApi.markAllRead();
    } catch {
      load();
    }
  }, [load]);

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, loading, markRead, markAllRead, refetch: load }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error("useNotifications() must be used inside a <NotificationProvider>.");
  }
  return ctx;
}
