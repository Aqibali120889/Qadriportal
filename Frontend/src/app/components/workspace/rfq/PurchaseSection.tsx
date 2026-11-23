import React from "react";
import EditableCell from "./EditableCell";
import { Trash2 } from "lucide-react";
import { rfqApi, PurchaseItem, CalculatedResult } from "@/app/services/rfq";

const COST_BASIS_OPTIONS = ["Weight", "Qty"];

export interface PurchaseSectionProps {
  items: PurchaseItem[];
  rfqId?: string | null;
  onChange: React.Dispatch<React.SetStateAction<PurchaseItem[]>>;
  calc: CalculatedResult | null;
  onRecalc?: () => void;
}

export default function PurchaseSection({ items, rfqId, onChange, calc, onRecalc }: PurchaseSectionProps) {
  const save = async (itemId: string, field: keyof PurchaseItem, value: unknown) => {
    try {
      const res = await rfqApi.updatePurchase(itemId, { [field]: value });
      onChange((prev) => prev.map((i) => (i.id === itemId ? { ...i, ...res.data } : i)));
      if (onRecalc) onRecalc();
    } catch (e: unknown) {
      alert("Save failed: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  const del = async (itemId: string) => {
    if (!confirm("Delete this purchase row?")) return;
    await rfqApi.deletePurchase(itemId);
    onChange((prev) => prev.filter((i) => i.id !== itemId));
    if (onRecalc) onRecalc();
  };

  const purchaseCalcList = calc?.purchase_items || [];

  const displayItems = items.map((item) => {
    const c = purchaseCalcList.find((x) => x.id === item.id) || {};
    return {
      ...item,
      total_purchase_qty_finished: c.total_purchase_qty_finished ?? item.total_purchase_qty_finished ?? 0,
      shaving_return_total: c.shaving_return_total ?? 0,
      total_cost: c.total_cost ?? 0,
    };
  });

  const totalCost = displayItems.reduce((s, i) => s + (Number(i.total_cost) || 0), 0);

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={ts.table}>
        <thead>
          <tr>
            <th style={{ ...ts.th, width: 50, textAlign: "center" }}>QTY</th>
            <th style={{ ...ts.th, width: 200, textAlign: "left" }}>DESCRIPTION</th>
            <th style={{ ...ts.th, width: 140, textAlign: "left" }}>TYPE / MATERIAL</th>
            <th style={{ ...ts.th, width: 90, textAlign: "left" }}>COST BASIS</th>
            <th style={{ ...ts.th, width: 90, textAlign: "right" }}>UNIT FIN WT</th>
            <th style={{ ...ts.th, width: 80, textAlign: "right" }} colSpan={2}>
              TOTAL PURCHASE QTY
            </th>
            <th style={{ ...ts.th, width: 100, textAlign: "right" }}>UNIT COST</th>
            <th style={{ ...ts.th, width: 80, textAlign: "right" }} colSpan={2}>
              SHAVING RETURN
            </th>
            <th style={{ ...ts.th, width: 120, textAlign: "right" }}>TOTAL COST</th>
            <th style={{ ...ts.th, width: 30 }} />
          </tr>
          <tr>
            <th style={ts.subTh} colSpan={5}></th>
            <th style={ts.subTh}>Finished</th>
            <th style={ts.subTh}>Gross</th>
            <th style={ts.subTh}></th>
            <th style={ts.subTh}>Rs/kg</th>
            <th style={ts.subTh}>Total</th>
            <th style={ts.subTh}></th>
            <th style={ts.subTh}></th>
          </tr>
        </thead>
        <tbody>
          {displayItems.length === 0 && (
            <tr>
              <td colSpan={12} style={ts.empty}>
                No purchase items — click "+ Add Purchase Row"
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
                  value={item.type_material}
                  type="text"
                  align="left"
                  modified={mods.includes("type_material")}
                  onSave={(v) => save(item.id, "type_material", v)}
                />
                <EditableCell
                  value={item.cost_basis || "Weight"}
                  type="select"
                  options={COST_BASIS_OPTIONS}
                  align="left"
                  modified={mods.includes("cost_basis")}
                  onSave={(v) => save(item.id, "cost_basis", v)}
                />
                <EditableCell
                  value={item.unit_fin_wt}
                  type="number"
                  align="right"
                  modified={mods.includes("unit_fin_wt")}
                  onSave={(v) => save(item.id, "unit_fin_wt", v)}
                />
                <EditableCell value={item.total_purchase_qty_finished} type="number" align="right" readOnly />
                <EditableCell
                  value={item.total_purchase_qty_gross}
                  type="number"
                  align="right"
                  modified={mods.includes("total_purchase_qty_gross")}
                  onSave={(v) => save(item.id, "total_purchase_qty_gross", v)}
                />
                <EditableCell
                  value={item.unit_cost}
                  type="number"
                  align="right"
                  modified={mods.includes("unit_cost")}
                  onSave={(v) => save(item.id, "unit_cost", v)}
                />
                <EditableCell
                  value={item.shaving_return_per_kg}
                  type="number"
                  align="right"
                  modified={mods.includes("shaving_return_per_kg")}
                  onSave={(v) => save(item.id, "shaving_return_per_kg", v)}
                />
                <EditableCell value={item.shaving_return_total} type="number" align="right" readOnly />
                <EditableCell
                  value={item.total_cost}
                  type="number"
                  align="right"
                  readOnly
                  style={{ fontWeight: 700 }}
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
        <span style={ts.totalLabel}>Total Cost Of Purchase Items</span>
        <span style={{ ...ts.totalNum, color: "#ea580c", fontWeight: 700 }}>
          Rs {fmt(totalCost)}
        </span>
      </div>
    </div>
  );
}

function fmt(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return "0";
  return Number(v).toLocaleString("en-PK", { maximumFractionDigits: 0 });
}

const ts: Record<string, React.CSSProperties> = {
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: {
    padding: "6px 8px",
    fontSize: 10,
    fontWeight: 700,
    color: "#6b7280",
    borderBottom: "2px solid #e5e7eb",
    background: "#f9fafb",
    whiteSpace: "nowrap",
    letterSpacing: "0.04em",
  },
  subTh: {
    padding: "3px 8px",
    fontSize: 9,
    fontWeight: 600,
    color: "#9ca3af",
    borderBottom: "1px solid #e5e7eb",
    background: "#f9fafb",
    textAlign: "right",
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
