/**
 * components/kanban/AssigneeAvatar.tsx
 * Circular avatar showing user initials with tooltip.
 */

interface Props {
  name?:  string | null;
  email?: string | null;
  size?:  number;
}

const COLORS = [
  "#3B82F6","#8B5CF6","#EC4899","#10B981","#F59E0B",
  "#EF4444","#14B8A6","#F97316","#6366F1","#84CC16",
];

function getColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return COLORS[Math.abs(h) % COLORS.length];
}

function initials(name: string | null | undefined, email: string | null | undefined): string {
  const n = name?.trim();
  if (n) {
    const parts = n.split(" ");
    return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
  }
  return (email?.[0] ?? "?").toUpperCase();
}

export default function AssigneeAvatar({ name, email, size = 22 }: Props) {
  const label = name || email || "?";
  const bg    = getColor(label);
  const ini   = initials(name, email);
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 select-none cursor-default"
      title={name ?? email ?? "Unassigned"}
      style={{ width: size, height: size, fontSize: size * 0.38, backgroundColor: bg }}
    >
      {ini}
    </div>
  );
}
