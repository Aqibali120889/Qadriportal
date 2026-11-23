/**
 * components/kanban/StatusBadge.tsx
 * Compact status badge with colour coding.
 */
import { KANBAN_COLUMNS } from "@/app/types/kanban";
import type { TaskStatus } from "@/app/types/kanban";

interface Props { status: TaskStatus; dark?: boolean; }

export default function StatusBadge({ status, dark }: Props) {
  const col = KANBAN_COLUMNS.find((c) => c.status === status);
  if (!col) return null;
  return (
    <span
      className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-tight"
      style={{
        color:           col.accent,
        backgroundColor: dark ? col.darkBg : col.bg,
      }}
    >
      {col.label}
    </span>
  );
}
