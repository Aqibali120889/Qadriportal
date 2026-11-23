import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import {
  Search, Bell, Sun, Moon, ChevronRight,
  ChevronDown, User, Settings, LogOut, Zap,
} from "lucide-react";
import { useNotifications } from "@/app/context/NotificationContext";
import { formatRelativeTime } from "@/app/services/notifications";

interface WorkspaceTopNavProps {
  dark: boolean;
  onToggleDark: () => void;
  rfqId: string;
  department?: string;
}

export default function WorkspaceTopNav({ dark, onToggleDark, rfqId, department = "Drawing Workspace" }: WorkspaceTopNavProps) {
  const [search, setSearch]     = useState("");
  const [notifOpen, setNotifOpen] = useState(false);
  const [userOpen, setUserOpen]   = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const userRef  = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { notifications, unreadCount: unread, markRead, markAllRead } = useNotifications();

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (userRef.current  && !userRef.current.contains(e.target as Node))  setUserOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <header className="h-12 flex-shrink-0 border-b border-border bg-card flex items-center gap-3 px-4 z-20">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-xs flex-shrink-0 min-w-0">
        <Link to="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap">
          Dashboard
        </Link>
        <ChevronRight size={12} className="text-muted-foreground flex-shrink-0" />
        <span className="text-muted-foreground whitespace-nowrap">{department}</span>
        <ChevronRight size={12} className="text-muted-foreground flex-shrink-0" />
        <span className="font-semibold text-foreground whitespace-nowrap">{rfqId}</span>
      </nav>

      <div className="w-px h-5 bg-border mx-0.5 flex-shrink-0" />

      {/* Search */}
      <div className="flex-1 max-w-xs relative">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <input
          type="search"
          placeholder="Search fields, values…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-7 pl-7 pr-3 rounded-[7px] text-xs bg-input-background border border-border
            text-foreground placeholder:text-muted-foreground/60
            focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary/50 transition-all"
        />
      </div>

      {/* Right actions */}
      <div className="ml-auto flex items-center gap-1">
        <button
          onClick={onToggleDark}
          aria-label="Toggle theme"
          className="w-7 h-7 flex items-center justify-center rounded-[7px] text-muted-foreground hover:bg-accent hover:text-foreground transition-all"
        >
          {dark ? <Sun size={14} /> : <Moon size={14} />}
        </button>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => { setNotifOpen((v) => !v); setUserOpen(false); }}
            className="w-7 h-7 flex items-center justify-center rounded-[7px] text-muted-foreground hover:bg-accent relative transition-all"
          >
            <Bell size={14} />
            {unread > 0 && (
              <span className="absolute top-0.5 right-0.5 w-3 h-3 rounded-full text-[8px] font-bold text-white flex items-center justify-center"
                style={{ backgroundColor: "#F5821F" }}>
                {unread}
              </span>
            )}
          </button>
          {notifOpen && (
            <div className="absolute right-0 top-9 w-72 bg-card border border-border rounded-[10px] shadow-[0_8px_24px_rgba(0,0,0,0.12)] overflow-hidden z-50">
              <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">Notifications</span>
                {unread > 0 && (
                  <button onClick={markAllRead} className="text-[10px] font-medium hover:underline" style={{ color: "#F5821F" }}>
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-72 overflow-y-auto">
                {notifications.length === 0 && (
                  <p className="px-3 py-6 text-xs text-muted-foreground text-center">No notifications yet</p>
                )}
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => { markRead(n.id); setNotifOpen(false); if (n.route) navigate(n.route); }}
                    className={`px-3 py-2.5 border-b border-border last:border-0 flex gap-2 hover:bg-accent/40 cursor-pointer
                      ${!n.is_read ? "bg-indigo-50/30 dark:bg-indigo-950/20" : ""}`}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${!n.is_read ? "bg-indigo-500" : "bg-transparent"}`} />
                    <div className="min-w-0">
                      <p className="text-xs text-foreground leading-snug">{n.title}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{formatRelativeTime(n.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* User */}
        <div className="relative" ref={userRef}>
          <button
            onClick={() => { setUserOpen((v) => !v); setNotifOpen(false); }}
            className="flex items-center gap-1.5 h-7 pl-1 pr-2 rounded-[7px] hover:bg-accent transition-all"
          >
            <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
              style={{ backgroundColor: "#3B82F6" }}>AA</div>
            <ChevronDown size={11} className="text-muted-foreground" />
          </button>
          {userOpen && (
            <div className="absolute right-0 top-9 w-48 bg-card border border-border rounded-[10px] shadow-[0_8px_24px_rgba(0,0,0,0.12)] overflow-hidden z-50 py-1">
              <div className="px-3 py-2 border-b border-border">
                <p className="text-xs font-semibold text-foreground">Aqib Ali</p>
                <p className="text-[10px] text-muted-foreground">Cost Estimation Engineer</p>
              </div>
              {[{ icon: User, label: "Profile" }, { icon: Zap, label: "Workspace" }, { icon: Settings, label: "Preferences" }].map(({ icon: Icon, label }) => (
                <button key={label} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-foreground hover:bg-accent transition-colors">
                  <Icon size={13} className="text-muted-foreground" />{label}
                </button>
              ))}
              <div className="h-px bg-border my-1" />
              <button className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
                <LogOut size={13} />Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
