import React, { useState, useEffect } from "react";
import EditableCell from "./EditableCell";
import { Plus, Trash2 } from "lucide-react";
import { rfqApi } from "@/app/services/rfq";

export interface MaterialRow {
  id: string;
  branch: string;
  material: string;
  var_cost_per_kg?: number;
  fixed_cost_per_kg?: number;
  total_cost_per_kg?: number;
  shaving_return_per_kg?: number;
  base_scrap_alloy_cost?: number;
}

export interface MachineRow {
  id: string;
  machine_family: string;
  var_cost_per_hr?: number;
  fixed_cost_per_hr?: number;
  total_cost_per_hr?: number;
}

export default function CostReportTab() {
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [machines, setMachines] = useState<MachineRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    Promise.all([rfqApi.getMaterials(), rfqApi.getMachines()])
      .then(([m, mc]) => {
        setMaterials((m.data as MaterialRow[]) || []);
        setMachines((mc.data as MachineRow[]) || []);
      })
      .finally(() => setLoading(false));
  };

  const saveMaterial = async (id: string, field: keyof MaterialRow, value: unknown) => {
    try {
      const res = await rfqApi.updateMaterial(id, { [field]: value });
      setMaterials((prev) => prev.map((m) => (m.id === id ? { ...m, ...(res.data as MaterialRow) } : m)));
    } catch (e: unknown) {
      alert("Save failed: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  const addMaterial = async (branch: string) => {
    try {
      const res = await rfqApi.addMaterial(branch);
      if (res.data) setMaterials((prev) => [...prev, res.data as MaterialRow]);
    } catch (e: unknown) {
      alert("Add material failed: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  const delMaterial = async (id: string) => {
    if (!confirm("Are you sure you want to delete this material entry?")) return;
    try {
      await rfqApi.deleteMaterial(id);
      setMaterials((prev) => prev.filter((m) => m.id !== id));
    } catch (e: unknown) {
      alert("Delete failed: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  const saveMachine = async (id: string, field: keyof MachineRow, value: unknown) => {
    try {
      const res = await rfqApi.updateMachine(id, { [field]: value });
      setMachines((prev) => prev.map((m) => (m.id === id ? { ...m, ...(res.data as MachineRow) } : m)));
    } catch (e: unknown) {
      alert("Save failed: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  const addMachine = async () => {
    try {
      const res = await rfqApi.addMachine();
      if (res.data) setMachines((prev) => [...prev, res.data as MachineRow]);
    } catch (e: unknown) {
      alert("Add machine failed: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  const delMachine = async (id: string) => {
    if (!confirm("Are you sure you want to delete this machine entry?")) return;
    try {
      await rfqApi.deleteMachine(id);
      setMachines((prev) => prev.filter((m) => m.id !== id));
    } catch (e: unknown) {
      alert("Delete failed: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Loading Cost Report…</div>;

  const qblMats = materials.filter((m) => m.branch === "QBL II");
  const qclMats = materials.filter((m) => m.branch === "QCL");

  return (
    <div style={{ padding: 16 }}>
      {/* QBL II Section */}
      <div style={ts.topHeader}>
        <h3 style={ts.sectionTitle}>Material Cost Rates — QBL II</h3>
        <button style={ts.addBtn} onClick={() => addMaterial("QBL II")}>
          <Plus size={14} /> Add Material
        </button>
      </div>
      <MaterialTable items={qblMats} onSave={saveMaterial} onDelete={delMaterial} />

      {/* QCL Section */}
      <div style={{ ...ts.topHeader, marginTop: 32 }}>
        <h3 style={ts.sectionTitle}>Material Cost Rates — QCL</h3>
        <button style={ts.addBtn} onClick={() => addMaterial("QCL")}>
          <Plus size={14} /> Add Material
        </button>
      </div>
      <MaterialTable items={qclMats} onSave={saveMaterial} onDelete={delMaterial} />

      {/* Machine Section */}
      <div style={{ ...ts.topHeader, marginTop: 32 }}>
        <h3 style={ts.sectionTitle}>Machine Hourly Rates — QEN + QE</h3>
        <button style={{ ...ts.addBtn, background: "#16a34a" }} onClick={addMachine}>
          <Plus size={14} /> Add Machine
        </button>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={ts.table}>
          <thead>
            <tr>
              <th style={{ ...ts.th, width: 280, textAlign: "left" }}>MACHINE FAMILY</th>
              <th style={{ ...ts.th, width: 140, textAlign: "right" }}>VAR COST (Rs/hr)</th>
              <th style={{ ...ts.th, width: 140, textAlign: "right" }}>FIXED COST (Rs/hr)</th>
              <th style={{ ...ts.th, width: 140, textAlign: "right" }}>TOTAL (Rs/hr)</th>
              <th style={{ ...ts.th, width: 44, textAlign: "center" }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {machines.length === 0 && (
              <tr>
                <td colSpan={5} style={ts.empty}>
                  No machines found — click "Add Machine" to add
                </td>
              </tr>
            )}
            {machines.map((m) => (
              <tr key={m.id}>
                <EditableCell
                  value={m.machine_family}
                  type="text"
                  align="left"
                  onSave={(v) => saveMachine(m.id, "machine_family", v)}
                />
                <EditableCell
                  value={m.var_cost_per_hr}
                  type="number"
                  align="right"
                  prefix="Rs "
                  onSave={(v) => saveMachine(m.id, "var_cost_per_hr", v)}
                />
                <EditableCell
                  value={m.fixed_cost_per_hr}
                  type="number"
                  align="right"
                  prefix="Rs "
                  onSave={(v) => saveMachine(m.id, "fixed_cost_per_hr", v)}
                />
                <td style={{ ...ts.td, textAlign: "right", background: "#eff6ff", fontWeight: 600 }}>
                  Rs {fmt(m.total_cost_per_hr)}
                </td>
                <td style={ts.delCell}>
                  <button style={ts.delBtn} onClick={() => delMachine(m.id)} title="Delete machine entry">
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MaterialTable({
  items,
  onSave,
  onDelete,
}: {
  items: MaterialRow[];
  onSave: (id: string, field: keyof MaterialRow, value: unknown) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={ts.table}>
        <thead>
          <tr>
            <th style={{ ...ts.th, width: 300, textAlign: "left" }}>MATERIAL</th>
            <th style={{ ...ts.th, width: 110, textAlign: "right" }}>VAR (Rs/kg)</th>
            <th style={{ ...ts.th, width: 110, textAlign: "right" }}>FIXED (Rs/kg)</th>
            <th style={{ ...ts.th, width: 110, textAlign: "right" }}>TOTAL (Rs/kg)</th>
            <th style={{ ...ts.th, width: 110, textAlign: "right" }}>SHAVING (Rs/kg)</th>
            <th style={{ ...ts.th, width: 120, textAlign: "right" }}>BASE SCRAP+ALLOY</th>
            <th style={{ ...ts.th, width: 44, textAlign: "center" }}>ACTIONS</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && (
            <tr>
              <td colSpan={7} style={ts.empty}>
                No materials found — click "Add Material" to add
              </td>
            </tr>
          )}
          {items.map((m) => (
            <tr key={m.id}>
              <EditableCell value={m.material} type="text" align="left" onSave={(v) => onSave(m.id, "material", v)} />
              <EditableCell
                value={m.var_cost_per_kg}
                type="number"
                align="right"
                prefix="Rs "
                onSave={(v) => onSave(m.id, "var_cost_per_kg", v)}
              />
              <EditableCell
                value={m.fixed_cost_per_kg}
                type="number"
                align="right"
                prefix="Rs "
                onSave={(v) => onSave(m.id, "fixed_cost_per_kg", v)}
              />
              <td style={{ ...ts.td, textAlign: "right", background: "#eff6ff", fontWeight: 600 }}>
                Rs {fmt(m.total_cost_per_kg)}
              </td>
              <EditableCell
                value={m.shaving_return_per_kg}
                type="number"
                align="right"
                prefix="Rs "
                onSave={(v) => onSave(m.id, "shaving_return_per_kg", v)}
              />
              <EditableCell
                value={m.base_scrap_alloy_cost}
                type="number"
                align="right"
                prefix="Rs "
                onSave={(v) => onSave(m.id, "base_scrap_alloy_cost", v)}
              />
              <td style={ts.delCell}>
                <button style={ts.delBtn} onClick={() => onDelete(m.id)} title="Delete material entry">
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

function fmt(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return "—";
  return Number(v).toLocaleString("en-PK", { maximumFractionDigits: 1 });
}

const ts: Record<string, React.CSSProperties> = {
  topHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: "#111827",
    margin: 0,
    borderBottom: "2px solid #1d4ed8",
    paddingBottom: 4,
    display: "inline-block",
  },
  addBtn: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 14px",
    border: "none",
    borderRadius: 6,
    background: "#1d4ed8",
    color: "#fff",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
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
  td: { padding: "6px 10px", borderBottom: "1px solid #f3f4f6" },
  delCell: { padding: "4px 6px", textAlign: "center" },
  delBtn: { background: "none", border: "none", color: "#d1d5db", cursor: "pointer", borderRadius: 4, padding: "4px" },
  empty: { padding: "20px", textAlign: "center", color: "#9ca3af", fontSize: 13 },
};
