import { useState, useEffect } from "react";
import { Outlet } from "react-router";
import FoundrySidebar from "@/app/components/foundry/FoundrySidebar";
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

export interface FoundryLayoutContext {
  dark: boolean;
  toggleDark: () => void;
}

export default function FoundryLayout() {
  const [dark, toggleDark]                      = useDarkMode();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <NotificationProvider>
      <div className="flex h-screen w-screen overflow-hidden bg-background font-[Inter,system-ui,sans-serif]">
        <FoundrySidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((v) => !v)} />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Outlet context={{ dark, toggleDark } satisfies FoundryLayoutContext} />
        </div>
      </div>
    </NotificationProvider>
  );
}
