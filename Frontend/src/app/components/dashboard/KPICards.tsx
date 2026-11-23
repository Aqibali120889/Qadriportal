import { Clock, Zap, CheckCircle2, AlertCircle, TrendingUp, TrendingDown } from "lucide-react";
import type { Task } from "@/app/types/task";

interface KPICardsProps {
  tasks: Task[];
}

export default function KPICards({ tasks }: KPICardsProps) {
  const pending     = tasks.filter((t) => t.status === "pending").length;
  const inProgress  = tasks.filter((t) => t.status === "in-progress").length;
  const review      = tasks.filter((t) => t.status === "review").length;
  const completed   = tasks.filter((t) => t.status === "completed").length;

  const cards = [
    {
      label:   "Pending Jobs",
      value:   pending,
      icon:    Clock,
      trend:   "+2",
      up:      false,
      accent:  "#64748B",
      bg:      "rgba(100,116,139,0.08)",
    },
    {
      label:   "In Progress",
      value:   inProgress,
      icon:    Zap,
      trend:   "+1",
      up:      true,
      accent:  "#3B82F6",
      bg:      "rgba(59,130,246,0.08)",
    },
    {
      label:   "Waiting Approval",
      value:   review,
      icon:    AlertCircle,
      trend:   "–1",
      up:      false,
      accent:  "#F59E0B",
      bg:      "rgba(245,158,11,0.08)",
    },
    {
      label:   "Completed Today",
      value:   completed,
      icon:    CheckCircle2,
      trend:   "+3",
      up:      true,
      accent:  "#22C55E",
      bg:      "rgba(34,197,94,0.08)",
    },
  ];

  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
      {cards.map(({ label, value, icon: Icon, trend, up, accent, bg }) => (
        <div
          key={label}
          className="bg-card border border-border rounded-[12px] px-4 py-3.5 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3"
        >
          {/* Icon */}
          <div
            className="w-9 h-9 rounded-[10px] flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: bg }}
          >
            <Icon size={17} style={{ color: accent }} />
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide leading-tight truncate">
              {label}
            </p>
            <div className="flex items-end gap-2 mt-0.5">
              <span className="text-2xl font-bold text-foreground leading-none">{value}</span>
              <span
                className={`flex items-center gap-0.5 text-[11px] font-medium mb-0.5 ${
                  up ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500"
                }`}
              >
                {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                {trend}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
