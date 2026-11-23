import { NavLink } from "react-router";
import {
  LayoutDashboard, FolderOpen, Building2, Users, Settings,
  History, ChevronLeft, ChevronRight, Shield, LogOut, CheckSquare,
} from "lucide-react";
import { ImageWithFallback } from "@/app/components/figma/ImageWithFallback";
import logoSrc from "@/imports/image003.jpg";

interface AdminSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: "Dashboard",   to: "/admin",             end: true  },
  { icon: FolderOpen,      label: "Projects",    to: "/admin/projects",    end: false },
  { icon: Building2,       label: "Departments", to: "/admin/departments", end: false },
  { icon: Users,           label: "Users",       to: "/admin/users",       end: false },
  { icon: CheckSquare,     label: "Global Kanban", to: "/admin/kanban",    end: false },
  { icon: History,         label: "History",     to: "/admin/history",     end: false },
  { icon: Settings,        label: "Settings",    to: "/admin/settings",    end: false },
];

export default function AdminSidebar({ collapsed, onToggle }: AdminSidebarProps) {
  return (
    <aside
      className="flex-shrink-0 h-full flex flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300 ease-in-out"
      style={{ width: collapsed ? 64 : 240 }}
    >
      {/* Brand */}
      <div className="flex items-center gap-3 px-3 h-14 border-b border-sidebar-border flex-shrink-0">
        <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 ring-1 ring-sidebar-border">
          <ImageWithFallback src={logoSrc} alt="Qadri Group" className="w-full h-full object-cover" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-sm font-semibold text-sidebar-foreground leading-tight truncate">Qadri Group</p>
            <p className="text-[10px] leading-tight flex items-center gap-1" style={{ color: "#F5821F" }}>
              <Shield size={9} />Super Admin
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {NAV_ITEMS.map(({ icon: Icon, label, to, end }) => (
          <NavLink
            key={label}
            to={to}
            end={end}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              `flex items-center gap-3 px-2.5 py-2 rounded-[8px] text-sm font-medium transition-all duration-150 group relative
               ${isActive
                 ? "text-white"
                 : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
               }`
            }
            style={({ isActive }) => isActive ? { backgroundColor: "#F5821F" } : {}}
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-white/40" />
                )}
                <Icon
                  size={16}
                  className={`flex-shrink-0 ${isActive ? "text-white" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground"}`}
                />
                {!collapsed && <span className="truncate">{label}</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mx-3 h-px bg-sidebar-border" />

      {/* Sign out */}
      <div className="py-2 px-2">
        <button
          title={collapsed ? "Sign Out" : undefined}
          className="w-full flex items-center gap-3 px-2.5 py-2 rounded-[8px] text-sm font-medium text-red-400 hover:bg-red-950/30 transition-all"
        >
          <LogOut size={16} className="flex-shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>

      {/* Collapse toggle */}
      <div className="p-2 border-t border-sidebar-border">
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-center py-1.5 rounded-[8px] text-sidebar-foreground/40 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          {!collapsed && <span className="ml-2 text-xs">Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
