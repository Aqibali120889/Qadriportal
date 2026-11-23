import React, { useState, useEffect } from "react";
import EditableCell from "./EditableCell";
import { Trash2 } from "lucide-react";
import { rfqApi, MachiningItem, CalculatedResult } from "@/app/services/rfq";

export interface MachiningSectionProps {
  items: MachiningItem[];
  rfqId?: string | null;
  onChange: React.Dispatch<React.SetStateAction<MachiningItem[]>>;
  calc: CalculatedResult | null;
  onRecalc?: () => void;
}

export default function MachiningSection({ items, rfqId, onChange, calc, onRecalc }: MachiningSectionProps) {
  const [machines, setMachines] = useState<Array<{ machine_family: string }>>([]);
  const [machineNames, setMachineNames] = useState<string[]>([]);

  useEffect(() => {
    rfqApi.getMachines().then((res) => setMachines((res.data as Array<{ machine_family: string }>) || [])).catch(() => {});
    rfqApi.getDropdowns().then((res) => setMachineNames(res.machine_names || [])).catch(() => {});
  }, []);

  const save = async (itemId: string, field: keyof MachiningItem, value: unknown) => {
    try {
      const res = await rfqApi.updateMachining(itemId, { [field]: value });
      onChange((prev) => prev.map((i) => (i.id === itemId ? { ...i, ...res.data } : i)));
      if (onRecalc) onRecalc();
    } catch (e: unknown) {
      alert("Save failed: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  const del = async (itemId: string) => {
    if (!confirm("Delete this operation?")) return;
    await rfqApi.deleteMachining(itemId);
    onChange((prev) => prev.filter((i) => i.id !== itemId));
    if (onRecalc) onRecalc();
  };

  const machiningCalcList = calc?.machining_items || [];

  const displayItems = items.map((item) => {
    const calcItem = machiningCalcList.find((c) => c.id === item.id) || {};
    return {
      ...item,
      var_cost_per_hr: item.var_cost_per_hr ?? calcItem.var_cost_per_hr ?? 0,
      var_cost_total: calcItem.var_cost_total ?? 0,
      fixed_cost_per_hr: item.fixed_cost_per_hr ?? calcItem.fixed_cost_per_hr ?? 0,
      fixed_cost_total: calcItem.fixed_cost_total ?? 0,
      total_cost_per_hr: calcItem.total_cost_per_hr ?? 0,
      total_cost: calcItem.total_cost ?? 0,
    };
  });

  const totalVar = displayItems.reduce((s, i) => s + (Number(i.var_cost_total) || 0), 0);
  const totalFixed = displayItems.reduce((s, i) => s + (Number(i.fixed_cost_total) || 0), 0);
  const totalCost = displayItems.reduce((s, i) => s + (Number(i.total_cost) || 0), 0);

  const machineCategoryOptions = machines.map((m) => m.machine_family);

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={ts.table}>
        <thead>
          <tr>
            <th style={{ ...ts.th, width: 60, textAlign: "center" }}>QTY</th>
            <th style={{ ...ts.th, width: 180, textAlign: "left" }}>OPERATION</th>
            <th style={{ ...ts.th, width: 160, textAlign: "left" }}>MACHINE</th>
            <th style={{ ...ts.th, width: 70, textAlign: "right" }}>HOURS</th>
            <th style={{ ...ts.th, width: 180, textAlign: "left" }}>CATEGORY</th>
            <th style={{ ...ts.th, width: 100, textAlign: "right" }}>VAR (Rs/hr)</th>
            <th style={{ ...ts.th, width: 100, textAlign: "right" }}>VAR TOTAL</th>
            <th style={{ ...ts.th, width: 100, textAlign: "right" }}>FIX (Rs/hr)</th>
            <th style={{ ...ts.th, width: 100, textAlign: "right" }}>FIX TOTAL</th>
            <th style={{ ...ts.th, width: 100, textAlign: "right" }}>TOT (Rs/hr)</th>
            <th style={{ ...ts.th, width: 110, textAlign: "right" }}>TOTAL COST</th>
            <th style={{ ...ts.th, width: 36 }} />
          </tr>
        </thead>
        <tbody>
          {displayItems.length === 0 && (
            <tr>
              <td colSpan={12} style={ts.empty}>
                No machining operations added — click "+ Add Operation"
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
                  value={item.operation}
                  type="text"
                  align="left"
                  modified={mods.includes("operation")}
                  onSave={(v) => save(item.id, "operation", v)}
                />
                <EditableCell
                  value={item.machine_name}
                  type="select"
                  options={machineNames}
                  align="left"
                  modified={mods.includes("machine_name")}
                  onSave={(v) => save(item.id, "machine_name", v)}
                />
                <EditableCell
                  value={item.machining_hours}
                  type="number"
                  align="right"
                  modified={mods.includes("machining_hours")}
                  onSave={(v) => save(item.id, "machining_hours", v)}
                />
                <EditableCell
                  value={item.machine_category}
                  type="select"
                  options={machineCategoryOptions}
                  align="left"
                  modified={mods.includes("machine_category")}
                  onSave={(v) => save(item.id, "machine_category", v)}
                />

                <EditableCell
                  value={item.var_cost_per_hr}
                  type="number"
                  align="right"
                  prefix="Rs "
                  modified={mods.includes("var_cost_per_hr")}
                  onSave={(v) => save(item.id, "var_cost_per_hr", v)}
                />
                <EditableCell value={item.var_cost_total} type="number" align="right" prefix="Rs " readOnly />
                <EditableCell
                  value={item.fixed_cost_per_hr}
                  type="number"
                  align="right"
                  prefix="Rs "
                  modified={mods.includes("fixed_cost_per_hr")}
                  onSave={(v) => save(item.id, "fixed_cost_per_hr", v)}
                />
                <EditableCell value={item.fixed_cost_total} type="number" align="right" prefix="Rs " readOnly />
                <EditableCell value={item.total_cost_per_hr} type="number" align="right" prefix="Rs " readOnly />
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
        <span style={ts.totalLabel}>Total In-House Machining Cost</span>
        <span style={ts.num}>Var: Rs {totalVar.toLocaleString("en-PK")}</span>
        <span style={ts.num}>Fixed: Rs {totalFixed.toLocaleString("en-PK")}</span>
        <span style={{ ...ts.num, color: "#ea580c", fontWeight: 700 }}>
          Total: Rs {totalCost.toLocaleString("en-PK")}
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
  },
  delCell: { padding: "4px 6px", textAlign: "center" },
  delBtn: { background: "none", border: "none", color: "#d1d5db", cursor: "pointer" },
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
  num: { fontSize: 13, color: "#374151", fontWeight: 600 },
};
