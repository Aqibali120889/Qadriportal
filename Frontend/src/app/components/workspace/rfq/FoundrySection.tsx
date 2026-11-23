import React, { useState, useEffect } from "react";
import EditableCell from "./EditableCell";
import MaterialSelect, { MaterialItem } from "./MaterialSelect";
import { Trash2 } from "lucide-react";
import { rfqApi, FoundryItem, CalculatedResult } from "@/app/services/rfq";

const BRANCH_OPTIONS = ["QBL II", "QCL"];

export interface FoundrySectionProps {
  items: FoundryItem[];
  rfqId?: string | null;
  onChange: React.Dispatch<React.SetStateAction<FoundryItem[]>>;
  calc: CalculatedResult | null;
  onRecalc?: () => void;
}

export default function FoundrySection({ items, rfqId, onChange, calc, onRecalc }: FoundrySectionProps) {
  const [materials, setMaterials] = useState<MaterialItem[]>([]);

  useEffect(() => {
    rfqApi.getMaterials().then((res) => setMaterials((res.data as MaterialItem[]) || [])).catch(() => {});
  }, []);

  const handleAddMaterial = async (branchName: string, newMatName: string) => {
    try {
      const res = await rfqApi.addMaterial(branchName, newMatName);
      if (res.data) {
        setMaterials((prev) => [...prev, res.data as MaterialItem]);
      }
    } catch (e: unknown) {
      alert("Add material failed: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  const handleDeleteMaterial = async (matId: string) => {
    try {
      await rfqApi.deleteMaterial(matId);
      setMaterials((prev) => prev.filter((m) => m.id !== matId));
    } catch (e: unknown) {
      alert("Delete material failed: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  const save = async (itemId: string, field: keyof FoundryItem, value: unknown) => {
    try {
      const res = await rfqApi.updateFoundry(itemId, { [field]: value });
      onChange((prev) => prev.map((i) => (i.id === itemId ? { ...i, ...res.data } : i)));
      if (onRecalc) onRecalc();
    } catch (e: unknown) {
      alert("Save failed: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  const del = async (itemId: string) => {
    if (!confirm("Delete this foundry row?")) return;
    await rfqApi.deleteFoundry(itemId);
    onChange((prev) => prev.filter((i) => i.id !== itemId));
    if (onRecalc) onRecalc();
  };

  const foundryCalcList = calc?.foundry_items || [];

  const displayItems = items.map((item) => {
    const c = foundryCalcList.find((x) => x.id === item.id) || {};
    return {
      ...item,
      calc_total_fin_wt: c.calc_total_fin_wt ?? Number(item.qty || 1) * Number(item.unit_fin_wt || 0),
      shaving_return_per_kg: item.shaving_return_per_kg ?? c.shaving_return_per_kg ?? 0,
      var_cost_per_kg: item.var_cost_per_kg ?? c.var_cost_per_kg ?? 0,
      var_cost_total: c.var_cost_total ?? 0,
      fixed_cost_per_kg: item.fixed_cost_per_kg ?? c.fixed_cost_per_kg ?? 0,
      fixed_cost_total: c.fixed_cost_total ?? 0,
      total_cost_per_kg: c.total_cost_per_kg ?? 0,
      shaving_total: c.shaving_total ?? 0,
      total_cost: c.total_cost ?? 0,
    };
  });

  const totalVar = displayItems.reduce((s, i) => s + (Number(i.var_cost_total) || 0), 0);
  const totalShav = displayItems.reduce((s, i) => s + (Number(i.shaving_total) || 0), 0);
  const totalFixed = displayItems.reduce((s, i) => s + (Number(i.fixed_cost_total) || 0), 0);
  const totalCost = displayItems.reduce((s, i) => s + (Number(i.total_cost) || 0), 0);

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={ts.table}>
        <thead>
          <tr>
            <th style={{ ...ts.th, width: 50, textAlign: "center" }}>QTY</th>
            <th style={{ ...ts.th, width: 150, textAlign: "left" }}>ITEM NAME</th>
            <th style={{ ...ts.th, width: 90, textAlign: "left" }}>BRANCH</th>
            <th style={{ ...ts.th, width: 200, textAlign: "left" }}>MATERIAL</th>
            <th style={{ ...ts.th, width: 90, textAlign: "right" }}>UNIT FIN WT</th>
            <th style={{ ...ts.th, width: 90, textAlign: "right" }}>TOTAL FIN WT</th>
            <th style={{ ...ts.th, width: 100, textAlign: "right" }}>TOTAL GROSS WT</th>
            <th style={{ ...ts.th, width: 80, textAlign: "right" }} colSpan={2}>
              SHAVING RETURN
            </th>
            <th style={{ ...ts.th, width: 80, textAlign: "right" }} colSpan={2}>
              VARIABLE COST
            </th>
            <th style={{ ...ts.th, width: 80, textAlign: "right" }} colSpan={2}>
              FIXED COST
            </th>
            <th style={{ ...ts.th, width: 80, textAlign: "right" }} colSpan={2}>
              TOTAL COST
            </th>
            <th style={{ ...ts.th, width: 30 }} />
          </tr>
          <tr>
            <th style={ts.subTh} colSpan={7}></th>
            <th style={ts.subTh}>Rs/kg</th>
            <th style={ts.subTh}>Total</th>
            <th style={ts.subTh}>Rs/kg</th>
            <th style={ts.subTh}>Total</th>
            <th style={ts.subTh}>Rs/kg</th>
            <th style={ts.subTh}>Total</th>
            <th style={ts.subTh}>Rs/kg</th>
            <th style={ts.subTh}>Total</th>
            <th style={ts.subTh}></th>
          </tr>
        </thead>
        <tbody>
          {displayItems.length === 0 && (
            <tr>
              <td colSpan={16} style={ts.empty}>
                No foundry items — click "+ Add Foundry Row"
              </td>
            </tr>
          )}
          {displayItems.map((item) => {
            const mods = item.modified_fields || [];
            const branch = item.branch || "QBL II";

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
                  value={item.item_name}
                  type="text"
                  align="left"
                  modified={mods.includes("item_name")}
                  onSave={(v) => save(item.id, "item_name", v)}
                />
                <EditableCell
                  value={branch}
                  type="select"
                  options={BRANCH_OPTIONS}
                  align="left"
                  modified={mods.includes("branch")}
                  onSave={(v) => save(item.id, "branch", v)}
                />
                <MaterialSelect
                  value={item.material}
                  materials={materials}
                  branch={branch}
                  modified={mods.includes("material")}
                  onSave={(v) => save(item.id, "material", v)}
                  onAddMaterial={handleAddMaterial}
                  onDeleteMaterial={handleDeleteMaterial}
                />
                <EditableCell
                  value={item.unit_fin_wt}
                  type="number"
                  align="right"
                  modified={mods.includes("unit_fin_wt")}
                  onSave={(v) => save(item.id, "unit_fin_wt", v)}
                />
                <EditableCell value={item.calc_total_fin_wt} type="number" align="right" readOnly />
                <EditableCell
                  value={item.total_gross_wt}
                  type="number"
                  align="right"
                  modified={mods.includes("total_gross_wt")}
                  onSave={(v) => save(item.id, "total_gross_wt", v)}
                />
                <EditableCell
                  value={item.shaving_return_per_kg}
                  type="number"
                  align="right"
                  modified={mods.includes("shaving_return_per_kg")}
                  onSave={(v) => save(item.id, "shaving_return_per_kg", v)}
                />
                <EditableCell value={item.shaving_total} type="number" align="right" readOnly />
                <EditableCell
                  value={item.var_cost_per_kg}
                  type="number"
                  align="right"
                  modified={mods.includes("var_cost_per_kg")}
                  onSave={(v) => save(item.id, "var_cost_per_kg", v)}
                />
                <EditableCell value={item.var_cost_total} type="number" align="right" readOnly />
                <EditableCell
                  value={item.fixed_cost_per_kg}
                  type="number"
                  align="right"
                  modified={mods.includes("fixed_cost_per_kg")}
                  onSave={(v) => save(item.id, "fixed_cost_per_kg", v)}
                />
                <EditableCell value={item.fixed_cost_total} type="number" align="right" readOnly />
                <EditableCell value={item.total_cost_per_kg} type="number" align="right" readOnly />
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
        <span style={ts.totalLabel}>Total Foundry Cost</span>
        <span style={ts.totalNum}>Var: Rs {fmt(totalVar - totalShav)}</span>
        <span style={ts.totalNum}>Fixed: Rs {fmt(totalFixed)}</span>
        <span style={{ ...ts.totalNum, color: "#ea580c", fontWeight: 700 }}>Total: Rs {fmt(totalCost)}</span>
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
  delBtn: {
    background: "none",
    border: "none",
    color: "#d1d5db",
    cursor: "pointer",
    borderRadius: 4,
    padding: "2px 4px",
  },
  empty: { padding: "20px", textAlign: "center", color: "#9ca3af", fontSize: 13 },
  totalRow: {
    display: "flex",
    gap: 24,
    alignItems: "center",
    padding: "10px 16px",
    borderTop: "2px solid #e5e7eb",
    background: "#f9fafb",
  },
  totalLabel: { fontWeight: 700, color: "#111827" },
  totalNum: { fontSize: 13, color: "#374151", fontWeight: 600 },
};
