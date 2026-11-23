import { useState, useEffect } from "react";
import { Outlet } from "react-router";
import Sidebar from "@/app/components/dashboard/Sidebar";
import { NotificationProvider } from "@/app/context/NotificationContext";

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

export interface CELayoutContext {
  dark: boolean;
  toggleDark: () => void;
}

export default function CELayout() {
  const [dark, toggleDark]                      = useDarkMode();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <NotificationProvider>
      <div className="flex h-screen w-screen overflow-hidden bg-background font-[Inter,system-ui,sans-serif]">
        <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((v) => !v)} />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Outlet context={{ dark, toggleDark } satisfies CELayoutContext} />
        </div>
      </div>
    </NotificationProvider>
  );
}
