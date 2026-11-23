import { useState, useEffect } from "react";
import { Outlet, useNavigate } from "react-router";
import AdminSidebar from "./AdminSidebar";
import AdminTopNav from "./AdminTopNav";
import type { Notification } from "@/app/types/admin";
import { NotificationProvider, useNotifications } from "@/app/context/NotificationContext";
import { formatRelativeTime } from "@/app/services/notifications";

function useDarkMode() {
  const [dark, setDark] = useState(() =>
    typeof window !== "undefined" && localStorage.getItem("qg-theme") === "dark"
  );
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("qg-theme", dark ? "dark" : "light");
  }, [dark]);
  return [dark, () => setDark((d) => !d)] as const;
}

const TYPE_MAP: Record<string, Notification["type"]> = {
  INFO: "info", SUCCESS: "success", WARNING: "warning", ERROR: "error", TASK: "info",
};

function AdminLayoutInner() {
  const [dark, toggleDark]                      = useDarkMode();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { notifications: raw, markAllRead, markRead } = useNotifications();
  const navigate = useNavigate();

  const notifications: Notification[] = raw.map((n) => ({
    id: n.id,
    title: n.title,
    message: n.message ?? "",
    time: formatRelativeTime(n.created_at),
    read: n.is_read,
    type: TYPE_MAP[n.notification_type] ?? "info",
    route: n.route,
  }));

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background font-[Inter,system-ui,sans-serif]">
      <AdminSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((v) => !v)} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AdminTopNav
          dark={dark}
          onToggleDark={toggleDark}
          notifications={notifications}
          onMarkAllRead={markAllRead}
          onNotificationClick={(n) => {
            markRead(n.id);
            if (n.route) navigate(n.route);
          }}
        />
        <Outlet />
      </div>
    </div>
  );
}

export default function AdminLayout() {
  return (
    <NotificationProvider>
      <AdminLayoutInner />
    </NotificationProvider>
  );
}
