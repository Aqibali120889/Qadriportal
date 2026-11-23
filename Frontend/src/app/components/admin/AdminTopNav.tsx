import { useState, useRef, useEffect } from "react";
import {
  Search, Bell, Sun, Moon, ChevronDown, User,
  Settings, LogOut, Shield, AlertTriangle, CheckCircle2, Info, AlertCircle,
} from "lucide-react";
import type { Notification } from "@/app/types/admin";

interface AdminTopNavProps {
  dark: boolean;
  onToggleDark: () => void;
  notifications: Notification[];
  onMarkAllRead: () => void;
  onNotificationClick?: (notification: Notification) => void;
}

export default function AdminTopNav({ dark, onToggleDark, notifications, onMarkAllRead, onNotificationClick }: AdminTopNavProps) {
  const [search, setSearch]       = useState("");
  const [notifOpen, setNotifOpen] = useState(false);
  const [userOpen, setUserOpen]   = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const userRef  = useRef<HTMLDivElement>(null);
  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (userRef.current  && !userRef.current.contains(e.target as Node))  setUserOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function notifIcon(type: Notification["type"]) {
    if (type === "error")   return <AlertCircle   size={12} className="text-red-500 flex-shrink-0"     />;
    if (type === "warning") return <AlertTriangle size={12} className="text-amber-500 flex-shrink-0"   />;
    if (type === "success") return <CheckCircle2  size={12} className="text-emerald-500 flex-shrink-0" />;
    return <Info size={12} className="text-blue-500 flex-shrink-0" />;
  }

  return (
    <header className="h-12 flex-shrink-0 border-b border-border bg-card flex items-center gap-3 px-4 z-20">
      {/* Left: title */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <Shield size={15} style={{ color: "#F5821F" }} />
        <span className="text-sm font-semibold text-foreground">Super Admin</span>
        <span
          className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white tracking-wide"
          style={{ backgroundColor: "#F5821F" }}
        >ADMIN</span>
      </div>

      <div className="w-px h-5 bg-border mx-0.5 flex-shrink-0" />

      {/* Search */}
      <div className="flex-1 max-w-sm relative">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <input
          type="search"
          placeholder="Search projects, users, departments…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-7 pl-7 pr-3 rounded-[7px] text-xs bg-input-background border border-border
            text-foreground placeholder:text-muted-foreground/60
            focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary/50 transition-all"
        />
      </div>

      {/* Right */}
      <div className="ml-auto flex items-center gap-1">
        <button
          onClick={onToggleDark}
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
            {unreadCount > 0 && (
              <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full text-[8px] font-bold text-white flex items-center justify-center bg-red-500">
                {unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-9 w-80 bg-card border border-border rounded-[10px] shadow-[0_8px_24px_rgba(0,0,0,0.12)] overflow-hidden z-50">
              <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-foreground">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white bg-red-500">{unreadCount}</span>
                  )}
                </div>
                <button onClick={onMarkAllRead} className="text-[10px] font-medium hover:underline" style={{ color: "#F5821F" }}>
                  Mark all read
                </button>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => { onNotificationClick?.(n); setNotifOpen(false); }}
                    className={`px-3 py-2.5 border-b border-border last:border-0 flex gap-2.5 hover:bg-accent/40 cursor-pointer transition-colors
                      ${!n.read ? "bg-primary/[0.04]" : ""}`}
                  >
                    <div className="mt-0.5">{notifIcon(n.type)}</div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-foreground">{n.title}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{n.message}</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">{n.time}</p>
                    </div>
                    {!n.read && <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: "#F5821F" }} />}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* User menu */}
        <div className="relative" ref={userRef}>
          <button
            onClick={() => { setUserOpen((v) => !v); setNotifOpen(false); }}
            className="flex items-center gap-1.5 h-7 pl-1 pr-2 rounded-[7px] hover:bg-accent transition-all"
          >
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
              style={{ backgroundColor: "#F5821F" }}
            >MU</div>
            <ChevronDown size={11} className="text-muted-foreground" />
          </button>

          {userOpen && (
            <div className="absolute right-0 top-9 w-52 bg-card border border-border rounded-[10px] shadow-[0_8px_24px_rgba(0,0,0,0.12)] overflow-hidden z-50 py-1">
              <div className="px-3 py-2.5 border-b border-border">
                <p className="text-xs font-semibold text-foreground">Muhammad Usman</p>
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Shield size={9} style={{ color: "#F5821F" }} />Super Administrator
                </p>
              </div>
              {[
                { icon: User,     label: "Admin Profile"   },
                { icon: Settings, label: "System Settings" },
              ].map(({ icon: Icon, label }) => (
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
