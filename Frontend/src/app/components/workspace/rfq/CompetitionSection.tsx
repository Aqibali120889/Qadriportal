import React from "react";
import EditableCell from "./EditableCell";
import { Trash2 } from "lucide-react";
import { rfqApi, CompetitionRow } from "@/app/services/rfq";

const COLS: Array<{
  key: keyof CompetitionRow;
  label: string;
  type: "text" | "number";
  align: "left" | "center" | "right";
  w: number;
}> = [
  { key: "supplier", label: "SUPPLIER", type: "text", align: "left", w: 150 },
  { key: "customer", label: "CUSTOMER", type: "text", align: "left", w: 150 },
  { key: "date", label: "DATE", type: "text", align: "center", w: 100 },
  { key: "product_description", label: "PRODUCT DESC.", type: "text", align: "left", w: 220 },
  { key: "value", label: "VALUE", type: "number", align: "right", w: 110 },
  { key: "currency", label: "CURRENCY", type: "text", align: "center", w: 80 },
  { key: "weight", label: "WEIGHT (kg)", type: "number", align: "right", w: 100 },
  { key: "value_per_kg", label: "VALUE/kg", type: "number", align: "right", w: 100 },
];

export interface CompetitionSectionProps {
  items: CompetitionRow[];
  rfqId?: string | null;
  onChange: React.Dispatch<React.SetStateAction<CompetitionRow[]>>;
}

export default function CompetitionSection({ items, rfqId, onChange }: CompetitionSectionProps) {
  const save = async (itemId: string, field: keyof CompetitionRow, value: unknown) => {
    try {
      const res = await rfqApi.updateCompetition(itemId, { [field]: value });
      onChange((prev) => prev.map((i) => (i.id === itemId ? { ...i, ...res.data } : i)));
    } catch (e: unknown) {
      alert("Save failed: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  const del = async (itemId: string) => {
    if (!confirm("Delete this competition row?")) return;
    await rfqApi.deleteCompetition(itemId);
    onChange((prev) => prev.filter((i) => i.id !== itemId));
  };

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={ts.table}>
        <thead>
          <tr>
            <th style={{ ...ts.th, width: 40, textAlign: "center" }}>Sr#</th>
            {COLS.map((c) => (
              <th key={String(c.key)} style={{ ...ts.th, width: c.w, textAlign: c.align }}>
                {c.label}
              </th>
            ))}
            <th style={{ ...ts.th, width: 36 }} />
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && (
            <tr>
              <td colSpan={COLS.length + 2} style={ts.empty}>
                No competition data — click "Add Row" to add
              </td>
            </tr>
          )}
          {items.map((item, idx) => (
            <tr key={item.id} style={{ background: "#fff" }}>
              <td style={{ ...ts.td, textAlign: "center", color: "#9ca3af" }}>{idx + 1}</td>
              {COLS.map((c) => (
                <EditableCell
                  key={String(c.key)}
                  value={item[c.key]}
                  type={c.type}
                  align={c.align}
                  onSave={(v) => save(item.id, c.key, v)}
                />
              ))}
              <td style={ts.delCell}>
                <button style={ts.delBtn} onClick={() => del(item.id)}>
                  <Trash2 size={13} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const ts: Record<string, React.CSSProperties> = {
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: {
    padding: "8px 10px",
    fontSize: 11,
    fontWeight: 700,
    color: "#6b7280",
    borderBottom: "2px solid #e5e7eb",
    background: "#f9fafb",
    whiteSpace: "nowrap",
    letterSpacing: "0.04em",
  },
  td: { padding: "8px 10px", borderBottom: "1px solid #f3f4f6" },
  delCell: { padding: "4px 6px", textAlign: "center" },
  delBtn: { background: "none", border: "none", color: "#d1d5db", cursor: "pointer", borderRadius: 4, padding: "2px 4px" },
  empty: { padding: "20px", textAlign: "center", color: "#9ca3af", fontSize: 13 },
};
