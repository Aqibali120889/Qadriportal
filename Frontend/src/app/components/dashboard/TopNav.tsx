import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router";
import {
  Search, Bell, Sun, Moon, Plus, ChevronDown,
  User, Settings, LogOut, Zap,
} from "lucide-react";
import { useNotifications } from "@/app/context/NotificationContext";
import { formatRelativeTime } from "@/app/services/notifications";

interface TopNavProps {
  dark: boolean;
  onToggleDark: () => void;
  onNewTask: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  /** Optional: override the header title (defaults to CE label). */
  title?: string;
  /** Optional: override the header subtitle. */
  subtitle?: string;
}

export default function TopNav({ dark, onToggleDark, onNewTask, searchQuery, onSearchChange, title = "Cost Estimation Dashboard", subtitle = "AI Engineering Estimation Portal" }: TopNavProps) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <header className="h-14 flex-shrink-0 border-b border-border bg-card flex items-center gap-3 px-4 z-20">
      {/* Left: Title */}
      <div className="flex-shrink-0 min-w-0">
        <h1 className="text-sm font-semibold text-foreground leading-tight whitespace-nowrap">
          {title}
        </h1>
        <p className="text-[10px] text-muted-foreground leading-tight hidden sm:block">
          {subtitle}
        </p>
      </div>

      {/* Divider */}
      <div className="w-px h-6 bg-border mx-1 flex-shrink-0" />

      {/* Center: Search */}
      <div className="flex-1 max-w-sm relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <input
          type="search"
          placeholder="Search RFQ, customer, project…"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full h-8 pl-8 pr-3 rounded-[8px] text-xs bg-input-background border border-border
            text-foreground placeholder:text-muted-foreground/60
            focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary/50
            transition-all duration-150"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
          >
            ×
          </button>
        )}
      </div>

      {/* Right: actions */}
      <div className="ml-auto flex items-center gap-1.5">
        {/* Theme toggle */}
        <button
          onClick={onToggleDark}
          aria-label="Toggle theme"
          className="w-8 h-8 flex items-center justify-center rounded-[8px] text-muted-foreground hover:bg-accent hover:text-foreground transition-all duration-150"
        >
          {dark ? <Sun size={15} /> : <Moon size={15} />}
        </button>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => { setNotifOpen((v) => !v); setUserOpen(false); }}
            aria-label="Notifications"
            className="w-8 h-8 flex items-center justify-center rounded-[8px] text-muted-foreground hover:bg-accent hover:text-foreground transition-all duration-150 relative"
          >
            <Bell size={15} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full text-[9px] font-bold text-white flex items-center justify-center"
                style={{ backgroundColor: "#F5821F" }}>
                {unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-10 w-80 bg-card border border-border rounded-[12px] shadow-[0_8px_32px_rgba(0,0,0,0.12)] overflow-hidden z-50">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <span className="text-sm font-semibold text-foreground">Notifications</span>
                <span className="text-xs font-medium px-1.5 py-0.5 rounded-full"
                  style={{ backgroundColor: "rgba(245,130,31,0.1)", color: "#F5821F" }}>
                  {unreadCount} new
                </span>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {notifications.length === 0 && (
                  <p className="px-4 py-6 text-xs text-muted-foreground text-center">No notifications yet</p>
                )}
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => { markRead(n.id); setNotifOpen(false); if (n.route) navigate(n.route); }}
                    className={`flex gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-accent/40 cursor-pointer transition-colors ${
                      !n.is_read ? "bg-indigo-50/30 dark:bg-indigo-950/20" : ""
                    }`}
                  >
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${!n.is_read ? "bg-indigo-500" : "bg-transparent"}`} />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground leading-snug">{n.title}</p>
                      {n.message && <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{n.message}</p>}
                      <p className="text-[10px] text-muted-foreground mt-0.5">{formatRelativeTime(n.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-4 py-2.5 border-t border-border">
                <button
                  onClick={markAllRead}
                  className="text-xs font-medium w-full text-center"
                  style={{ color: "#F5821F" }}
                >
                  Mark all read
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Quick actions */}
        <button
          onClick={onNewTask}
          className="hidden sm:flex h-8 items-center gap-1.5 px-3 rounded-[8px] text-xs font-semibold text-white transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-ring/30"
          style={{ backgroundColor: "#F5821F" }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#D9710E")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#F5821F")}
        >
          <Plus size={13} />
          New RFQ
        </button>

        {/* User avatar */}
        <div className="relative" ref={userRef}>
          <button
            onClick={() => { setUserOpen((v) => !v); setNotifOpen(false); }}
            className="flex items-center gap-2 h-8 pl-1 pr-2 rounded-[8px] hover:bg-accent transition-all duration-150"
          >
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
              style={{ backgroundColor: "#3B82F6" }}>
              AA
            </div>
            <span className="text-xs font-medium text-foreground hidden md:block">Aqib Ali</span>
            <ChevronDown size={12} className="text-muted-foreground hidden md:block" />
          </button>

          {userOpen && (
            <div className="absolute right-0 top-10 w-52 bg-card border border-border rounded-[12px] shadow-[0_8px_32px_rgba(0,0,0,0.12)] overflow-hidden z-50 py-1">
              <div className="px-3 py-2.5 border-b border-border">
                <p className="text-sm font-semibold text-foreground">Aqib Ali</p>
                <p className="text-xs text-muted-foreground">Cost Estimation Engineer</p>
              </div>
              {[
                { icon: User,     label: "My Profile"  },
                { icon: Zap,      label: "Workspace"   },
                { icon: Settings, label: "Preferences" },
              ].map(({ icon: Icon, label }) => (
                <button
                  key={label}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors"
                >
                  <Icon size={14} className="text-muted-foreground" />
                  {label}
                </button>
              ))}
              <div className="h-px bg-border my-1" />
              <button className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
                <LogOut size={14} />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
