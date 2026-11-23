import { NavLink } from "react-router";
import {
  LayoutDashboard, PenTool, FileSpreadsheet,
  Mail, History, Sparkles, User, ChevronLeft, ChevronRight,
  Settings, LogOut,
} from "lucide-react";
import { ImageWithFallback } from "@/app/components/figma/ImageWithFallback";
import logoSrc from "@/imports/image003.jpg";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: "Dashboard",         to: "/dashboard",                    end: true  },
  { icon: PenTool,         label: "Drawing Workspace", to: "/dashboard/drawing-workspace",  end: false },
  { icon: FileSpreadsheet, label: "Excel Sheet",       to: "/dashboard",                    end: false },
  { icon: Mail,            label: "Email Hub",         to: "/dashboard/email-hub",          end: false },
  { icon: History,         label: "Project History",   to: "/dashboard/history",            end: false },
  { icon: Sparkles,        label: "AI Assistant",      to: "/dashboard/ai-assistant",       end: false },
];

const BOTTOM_ITEMS = [
  { icon: Settings, label: "Settings", to: "/dashboard/settings" },
  { icon: User,     label: "Profile",  to: "/dashboard"          },
];

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  return (
    <aside
      className="flex-shrink-0 h-full flex flex-col border-r border-border bg-card transition-all duration-300 ease-in-out relative z-10"
      style={{ width: collapsed ? 64 : 240 }}
    >
      {/* Brand */}
      <div className="flex items-center gap-3 px-3 h-14 border-b border-border flex-shrink-0">
        <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 ring-1 ring-border">
          <ImageWithFallback src={logoSrc} alt="Qadri Group" className="w-full h-full object-cover" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground leading-tight truncate">Qadri Group</p>
            <p className="text-[10px] text-muted-foreground leading-tight truncate">Est. Portal</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {NAV_ITEMS.map(({ icon: Icon, label, to, end }) => (
          <NavLink
            key={label}
            to={to}
            title={collapsed ? label : undefined}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-2.5 py-2 rounded-[8px] text-sm font-medium transition-all duration-150 group relative
              ${isActive
                ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-indigo-600 dark:bg-indigo-500" />
                )}
                <Icon
                  size={16}
                  className={`flex-shrink-0 transition-colors ${
                    isActive ? "text-indigo-600 dark:text-indigo-400" : "text-muted-foreground group-hover:text-foreground"
                  }`}
                />
                {!collapsed && <span className="truncate">{label}</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Divider */}
      <div className="mx-3 h-px bg-border" />

      {/* Bottom items */}
      <div className="py-2 px-2 space-y-0.5">
        {BOTTOM_ITEMS.map(({ icon: Icon, label, to }) => (
          <NavLink
            key={label}
            to={to}
            end={false}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              `flex items-center gap-3 px-2.5 py-2 rounded-[8px] text-sm font-medium transition-all duration-150 relative group
              ${isActive
                ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-indigo-600 dark:bg-indigo-500" />
                )}
                <Icon size={16} className={`flex-shrink-0 transition-colors ${isActive ? "text-indigo-600 dark:text-indigo-400" : "text-muted-foreground group-hover:text-foreground"}`} />
                {!collapsed && <span className="truncate">{label}</span>}
              </>
            )}
          </NavLink>
        ))}

        {/* Logout */}
        <button
          title={collapsed ? "Sign Out" : undefined}
          className="w-full flex items-center gap-3 px-2.5 py-2 rounded-[8px] text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all duration-150"
        >
          <LogOut size={16} className="flex-shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>

      {/* Collapse toggle */}
      <div className="p-2 border-t border-border">
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-center py-1.5 rounded-[8px] text-muted-foreground hover:bg-accent hover:text-foreground transition-all duration-150"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          {!collapsed && <span className="ml-2 text-xs">Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
