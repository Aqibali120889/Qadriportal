import React, { useState } from "react";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";

export interface SectionCardProps {
  title: string;
  elementNum: string | number;
  children: React.ReactNode;
  onAdd?: () => void;
  addLabel?: string;
}

export default function SectionCard({
  title,
  elementNum,
  children,
  onAdd,
  addLabel,
}: SectionCardProps) {
  const [open, setOpen] = useState(true);

  return (
    <div style={s.card}>
      <div style={s.header} onClick={() => setOpen((o) => !o)}>
        <div style={s.left}>
          <span style={s.elemBadge}>Element #{elementNum}</span>
          <span style={s.title}>{title}</span>
        </div>
        <div style={s.right}>
          {onAdd && open && (
            <button
              style={s.addBtn}
              onClick={(e) => {
                e.stopPropagation();
                onAdd();
              }}
            >
              <Plus size={13} /> {addLabel || "Add Row"}
            </button>
          )}
          {open ? <ChevronDown size={16} color="#9ca3af" /> : <ChevronRight size={16} color="#9ca3af" />}
        </div>
      </div>
      {open && <div style={s.body}>{children}</div>}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  card: {
    background: "#fff",
    borderRadius: 8,
    border: "1px solid #e5e7eb",
    marginBottom: 16,
    overflow: "hidden",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 16px",
    cursor: "pointer",
    userSelect: "none",
    borderBottom: "1px solid #f3f4f6",
    background: "#fafafa",
  },
  left: { display: "flex", alignItems: "center", gap: 10 },
  right: { display: "flex", alignItems: "center", gap: 8 },
  elemBadge: {
    background: "#dbeafe",
    color: "#1d4ed8",
    borderRadius: 20,
    padding: "2px 10px",
    fontSize: 11,
    fontWeight: 700,
  },
  title: { fontWeight: 600, fontSize: 14, color: "#111827" },
  addBtn: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    padding: "4px 10px",
    border: "1px solid #d1d5db",
    borderRadius: 6,
    background: "#fff",
    color: "#374151",
    fontSize: 12,
    cursor: "pointer",
  },
  body: { padding: "0 0 8px 0", overflowX: "auto" },
};
