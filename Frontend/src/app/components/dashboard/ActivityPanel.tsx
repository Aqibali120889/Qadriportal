import {
  FileText, Upload, FileSpreadsheet, CheckCircle,
  Calendar, Clock, Bell, ChevronRight,
} from "lucide-react";
import type { Task } from "@/app/types/task";
import { PRIORITY_CONFIG } from "@/app/types/task";

interface ActivityPanelProps {
  tasks: Task[];
}

const RECENT_ACTIVITY = [
  {
    id: 1,
    icon: FileText,
    iconBg: "rgba(59,130,246,0.1)",
    iconColor: "#3B82F6",
    title: "New RFQ Received",
    sub: "Lucky Cement — Crusher Housing",
    time: "2m ago",
  },
  {
    id: 2,
    icon: Upload,
    iconBg: "rgba(139,92,246,0.1)",
    iconColor: "#8B5CF6",
    title: "Drawing Uploaded",
    sub: "RFQ-2026-004 — Pioneer Cement",
    time: "14m ago",
  },
  {
    id: 3,
    icon: FileSpreadsheet,
    iconBg: "rgba(34,197,94,0.1)",
    iconColor: "#22C55E",
    title: "Excel Generated",
    sub: "RFQ-2026-005 — Bestway Cement",
    time: "1h ago",
  },
  {
    id: 4,
    icon: CheckCircle,
    iconBg: "rgba(245,130,31,0.1)",
    iconColor: "#F5821F",
    title: "Approval Submitted",
    sub: "RFQ-2026-003 — Maple Leaf",
    time: "3h ago",
  },
];

const DEPT_NOTIFICATIONS = [
  { id: 1, text: "2 RFQs approaching deadline", level: "warning" },
  { id: 2, text: "Monthly report due in 3 days",  level: "info"    },
  { id: 3, text: "New cement price table uploaded", level: "info"  },
];

function formatDueDate(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0)  return { label: `${Math.abs(diff)}d overdue`, color: "#EF4444" };
  if (diff === 0) return { label: "Due today",    color: "#F97316" };
  if (diff <= 2)  return { label: `In ${diff}d`,  color: "#F59E0B" };
  return {
    label: date.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
    color: "var(--muted-foreground)",
  };
}

export default function ActivityPanel({ tasks }: ActivityPanelProps) {
  const urgentTasks = tasks
    .filter((t) => t.status !== "completed")
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 4);

  const myTasks = tasks
    .filter((t) => t.assignee.id === "e1" && t.status !== "completed")
    .slice(0, 3);

  return (
    <aside className="w-72 flex-shrink-0 border-l border-border bg-card flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
        <span className="text-sm font-semibold text-foreground">Activity</span>
        <button className="text-[11px] font-medium" style={{ color: "#F5821F" }}>
          View all
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Recent Activity */}
        <section className="px-4 pt-4 pb-3">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">
            Recent Activity
          </p>
          <div className="space-y-3">
            {RECENT_ACTIVITY.map((item) => (
              <div key={item.id} className="flex gap-2.5">
                <div
                  className="w-7 h-7 rounded-[8px] flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ backgroundColor: item.iconBg }}
                >
                  <item.icon size={13} style={{ color: item.iconColor }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-semibold text-foreground leading-tight">{item.title}</p>
                  <p className="text-[11px] text-muted-foreground truncate leading-tight mt-0.5">{item.sub}</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">{item.time}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="mx-4 h-px bg-border" />

        {/* Upcoming Deadlines */}
        <section className="px-4 pt-3.5 pb-3">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">
            Upcoming Deadlines
          </p>
          <div className="space-y-2">
            {urgentTasks.map((task) => {
              const due = formatDueDate(task.dueDate);
              const pCfg = PRIORITY_CONFIG[task.priority];
              return (
                <div
                  key={task.id}
                  className="flex items-start gap-2 p-2 rounded-[8px] border border-border hover:bg-accent/40 cursor-pointer transition-colors"
                >
                  <Calendar size={12} className="mt-0.5 flex-shrink-0" style={{ color: due.color }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold text-foreground truncate">{task.projectName}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{task.customer}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[10px] font-medium" style={{ color: due.color }}>{due.label}</span>
                      <span
                        className="text-[9px] font-semibold px-1 py-px rounded-full"
                        style={{ color: pCfg.color, backgroundColor: "transparent", border: `1px solid ${pCfg.color}33` }}
                      >
                        {task.priority}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <div className="mx-4 h-px bg-border" />

        {/* Assigned to Me */}
        <section className="px-4 pt-3.5 pb-3">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">
            Assigned to Me
          </p>
          <div className="space-y-2">
            {myTasks.length > 0 ? myTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-2 py-1.5 hover:bg-accent/30 rounded-[6px] cursor-pointer transition-colors"
              >
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[9px] font-bold text-white"
                  style={{ backgroundColor: task.assignee.color }}
                >
                  {task.assignee.initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium text-foreground truncate">{task.rfqId}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{task.projectName}</p>
                </div>
                <ChevronRight size={11} className="text-muted-foreground flex-shrink-0" />
              </div>
            )) : (
              <p className="text-xs text-muted-foreground/50">No open tasks assigned</p>
            )}
          </div>
        </section>

        <div className="mx-4 h-px bg-border" />

        {/* Department Notifications */}
        <section className="px-4 pt-3.5 pb-4">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">
            Department Notices
          </p>
          <div className="space-y-2">
            {DEPT_NOTIFICATIONS.map((n) => (
              <div
                key={n.id}
                className="flex gap-2 items-start p-2 rounded-[8px] border border-border"
                style={{
                  backgroundColor:
                    n.level === "warning" ? "rgba(245,158,11,0.05)" : "rgba(59,130,246,0.05)",
                }}
              >
                <Bell
                  size={11}
                  className="mt-0.5 flex-shrink-0"
                  style={{ color: n.level === "warning" ? "#F59E0B" : "#3B82F6" }}
                />
                <p className="text-[11px] text-foreground leading-snug">{n.text}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </aside>
  );
}
