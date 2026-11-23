/**
 * components/kanban/PriorityBadge.tsx
 * Compact priority badge with colour coding.
 */
import type { TaskPriority } from "@/app/types/kanban";
import { PRIORITY_CONFIG } from "@/app/types/kanban";

interface Props {
  priority: TaskPriority;
  dark?:    boolean;
  size?:    "xs" | "sm";
}

export default function PriorityBadge({ priority, dark, size = "xs" }: Props) {
  const cfg  = PRIORITY_CONFIG[priority];
  const font = size === "xs" ? "text-[10px]" : "text-xs";
  return (
    <span
      className={`${font} font-semibold px-1.5 py-0.5 rounded-full leading-tight flex-shrink-0`}
      style={{ color: cfg.color, backgroundColor: dark ? cfg.darkBg : cfg.bg }}
    >
      {cfg.label}
    </span>
  );
}
