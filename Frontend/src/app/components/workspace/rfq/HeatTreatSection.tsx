import React from "react";
import EditableCell from "./EditableCell";
import { Trash2 } from "lucide-react";
import { rfqApi, HeatTreatItem, CalculatedResult } from "@/app/services/rfq";

export interface HeatTreatSectionProps {
  items: HeatTreatItem[];
  rfqId?: string | null;
  onChange: React.Dispatch<React.SetStateAction<HeatTreatItem[]>>;
  calc: CalculatedResult | null;
  onRecalc?: () => void;
}

export default function HeatTreatSection({ items, rfqId, onChange, calc, onRecalc }: HeatTreatSectionProps) {
  const save = async (itemId: string, field: keyof HeatTreatItem, value: unknown) => {
    try {
      const res = await rfqApi.updateHeatTreat(itemId, { [field]: value });
      onChange((prev) => prev.map((i) => (i.id === itemId ? { ...i, ...res.data } : i)));
      if (onRecalc) onRecalc();
    } catch (e: unknown) {
      alert("Save failed: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  const del = async (itemId: string) => {
    if (!confirm("Delete this heat treatment row?")) return;
    await rfqApi.deleteHeatTreat(itemId);
    onChange((prev) => prev.filter((i) => i.id !== itemId));
    if (onRecalc) onRecalc();
  };

  const heatCalcList = calc?.heat_treat_items || [];

  const displayItems = items.map((item) => {
    const calcItem = heatCalcList.find((c) => c.id === item.id) || {};
    const qty = Number(item.qty) || 1;
    const wt = Number(item.unit_weight_kg) || 0;
    const cost = Number(item.unit_cost_per_kg) || 0;
    return {
      ...item,
      total_cost: calcItem.total_cost ?? qty * wt * cost,
    };
  });

  const totalCost = displayItems.reduce((s, i) => s + (Number(i.total_cost) || 0), 0);

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={ts.table}>
        <thead>
          <tr>
            <th style={{ ...ts.th, width: 60, textAlign: "center" }}>QTY</th>
            <th style={{ ...ts.th, width: 260, textAlign: "left" }}>DESCRIPTION</th>
            <th style={{ ...ts.th, width: 110, textAlign: "right" }}>UNIT WT (kg)</th>
            <th style={{ ...ts.th, width: 180, textAlign: "left" }}>MATERIAL</th>
            <th style={{ ...ts.th, width: 110, textAlign: "right" }}>COST (Rs/kg)</th>
            <th style={{ ...ts.th, width: 120, textAlign: "right" }}>TOTAL COST</th>
            <th style={{ ...ts.th, width: 36 }} />
          </tr>
        </thead>
        <tbody>
          {displayItems.length === 0 && (
            <tr>
              <td colSpan={7} style={ts.empty}>
                No heat treatment items — click "Add Heat Treat Row" to add
              </td>
            </tr>
          )}
          {displayItems.map((item) => {
            const mods = item.modified_fields || [];
            return (
              <tr key={item.id} style={{ background: item.is_modified ? "#fefce8" : "#fff" }}>
                <EditableCell
                  value={item.qty}
                  type="number"
                  align="center"
                  modified={mods.includes("qty")}
                  onSave={(v) => save(item.id, "qty", v)}
                />
                <EditableCell
                  value={item.description}
                  type="text"
                  align="left"
                  modified={mods.includes("description")}
                  onSave={(v) => save(item.id, "description", v)}
                />
                <EditableCell
                  value={item.unit_weight_kg}
                  type="number"
                  align="right"
                  modified={mods.includes("unit_weight_kg")}
                  onSave={(v) => save(item.id, "unit_weight_kg", v)}
                />
                <EditableCell
                  value={item.material}
                  type="text"
                  align="left"
                  modified={mods.includes("material")}
                  onSave={(v) => save(item.id, "material", v)}
                />
                <EditableCell
                  value={item.unit_cost_per_kg}
                  type="number"
                  align="right"
                  prefix="Rs "
                  modified={mods.includes("unit_cost_per_kg")}
                  onSave={(v) => save(item.id, "unit_cost_per_kg", v)}
                />
                <EditableCell
                  value={item.total_cost}
                  type="number"
                  align="right"
                  prefix="Rs "
                  readOnly
                  style={{ fontWeight: 700, color: "#111827" }}
                />
                <td style={ts.delCell}>
                  <button style={ts.delBtn} onClick={() => del(item.id)}>
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div style={ts.totalRow}>
        <span style={ts.totalLabel}>Total Heat Treatment Cost</span>
        <span style={{ ...ts.totalNum, color: "#ea580c", fontWeight: 700 }}>
          Rs {totalCost.toLocaleString("en-PK")}
        </span>
      </div>
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
  delCell: { padding: "4px 6px", textAlign: "center" },
  delBtn: { background: "none", border: "none", color: "#d1d5db", cursor: "pointer", borderRadius: 4, padding: "2px 4px" },
  totalRow: {
    display: "flex",
    gap: 24,
    alignItems: "center",
    padding: "10px 16px",
    borderTop: "2px solid #e5e7eb",
    background: "#f9fafb",
    flexWrap: "wrap",
  },
  totalLabel: { fontWeight: 700, color: "#111827", marginRight: "auto" },
  totalNum: { fontSize: 13, color: "#374151", fontWeight: 600 },
  empty: { padding: "20px", textAlign: "center", color: "#9ca3af", fontSize: 13 },
};
