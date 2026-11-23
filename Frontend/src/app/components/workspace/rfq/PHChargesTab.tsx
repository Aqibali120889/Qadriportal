import React, { useState, useEffect } from "react";
import EditableCell from "./EditableCell";
import { Plus, Trash2 } from "lucide-react";
import { rfqApi } from "@/app/services/rfq";

export interface PHChargeRow {
  id: string;
  description: string;
  lcl_cost?: string;
  container_20_cost?: string;
  container_40_cost?: string;
}

export default function PHChargesTab() {
  const [charges, setCharges] = useState<PHChargeRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    rfqApi
      .getPHCharges()
      .then((res) => setCharges((res.data as PHChargeRow[]) || []))
      .finally(() => setLoading(false));
  }, []);

  const save = async (id: string, field: keyof PHChargeRow, value: unknown) => {
    try {
      const res = await rfqApi.updatePHCharge(id, { [field]: value });
      setCharges((prev) => prev.map((c) => (c.id === id ? { ...c, ...(res.data as PHChargeRow) } : c)));
    } catch (e: unknown) {
      alert("Save failed: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  const addCharge = async () => {
    try {
      const res = await rfqApi.addPHCharge();
      if (res.data) {
        setCharges((prev) => [...prev, res.data as PHChargeRow]);
      }
    } catch (e: unknown) {
      alert("Add charge failed: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  const delCharge = async (id: string) => {
    if (!confirm("Are you sure you want to delete this charge entry?")) return;
    try {
      await rfqApi.deletePHCharge(id);
      setCharges((prev) => prev.filter((c) => c.id !== id));
    } catch (e: unknown) {
      alert("Delete failed: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Loading P&H Charges…</div>;

  return (
    <div style={{ padding: 16 }}>
      <div style={ts.topHeader}>
        <div>
          <h3 style={ts.sectionTitle}>Standard Packing & Handling Charges</h3>
          <p style={{ color: "#6b7280", fontSize: 12, marginTop: 4 }}>
            Global reference rates. Double-click any cell to edit numbers or text.
          </p>
        </div>
        <button style={ts.addBtn} onClick={addCharge}>
          <Plus size={14} /> Add Charge Row
        </button>
      </div>

      <div style={{ overflowX: "auto", marginTop: 12 }}>
        <table style={ts.table}>
          <thead>
            <tr>
              <th style={{ ...ts.th, width: 40, textAlign: "center" }}>#</th>
              <th style={{ ...ts.th, width: 340, textAlign: "left" }}>DESCRIPTION</th>
              <th style={{ ...ts.th, width: 160, textAlign: "right" }}>Less Container Load (LCL)</th>
              <th style={{ ...ts.th, width: 160, textAlign: "right" }}>20' Container</th>
              <th style={{ ...ts.th, width: 160, textAlign: "right" }}>40' Container</th>
              <th style={{ ...ts.th, width: 44, textAlign: "center" }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {charges.length === 0 && (
              <tr>
                <td colSpan={6} style={ts.empty}>
                  No packing & handling charges found — click "Add Charge Row" to add
                </td>
              </tr>
            )}
            {charges.map((c, idx) => (
              <tr key={c.id}>
                <td style={{ ...ts.td, textAlign: "center", color: "#9ca3af" }}>{idx + 1}</td>
                <EditableCell
                  value={c.description}
                  type="text"
                  align="left"
                  onSave={(v) => save(c.id, "description", v)}
                />
                <PHCostCell value={c.lcl_cost} onSave={(v) => save(c.id, "lcl_cost", v)} />
                <PHCostCell value={c.container_20_cost} onSave={(v) => save(c.id, "container_20_cost", v)} />
                <PHCostCell value={c.container_40_cost} onSave={(v) => save(c.id, "container_40_cost", v)} />
                <td style={ts.delCell}>
                  <button style={ts.delBtn} onClick={() => delCharge(c.id)} title="Delete charge entry">
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

function PHCostCell({
  value,
  onSave,
}: {
  value?: string | null;
  onSave: (value: string | null) => void;
}) {
  const rawStr = value ?? "";
  let prefix = "";
  let suffix = "";
  let displayVal = rawStr;

  if (rawStr !== "") {
    if (rawStr.includes("USD")) {
      prefix = "USD ";
      displayVal = rawStr.replace("USD", "").trim();
    } else if (rawStr.includes("Rs/kg")) {
      suffix = " Rs/kg";
      displayVal = rawStr.replace("Rs/kg", "").trim();
    } else if (rawStr.startsWith("Rs ")) {
      prefix = "Rs ";
      displayVal = rawStr.replace("Rs ", "").trim();
    } else if (!isNaN(Number(rawStr))) {
      const num = Number(rawStr);
      if (num < 100) {
        suffix = " Rs/kg";
        displayVal = num.toFixed(2);
      } else {
        prefix = "Rs ";
        displayVal = String(num);
      }
    }
  }

  return (
    <EditableCell
      value={displayVal}
      type="text"
      align="right"
      prefix={prefix}
      suffix={suffix}
      onSave={(v) => {
        if (v == null || v === "") {
          onSave(null);
        } else if (prefix || suffix) {
          onSave(`${prefix}${v}${suffix}`.trim());
        } else {
          onSave(String(v));
        }
      }}
    />
  );
}

const ts: Record<string, React.CSSProperties> = {
  topHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: "#111827",
    margin: 0,
    borderBottom: "2px solid #ea580c",
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
    background: "#ea580c",
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
  td: { padding: "8px 10px", borderBottom: "1px solid #f3f4f6" },
  delCell: { padding: "4px 6px", textAlign: "center" },
  delBtn: { background: "none", border: "none", color: "#d1d5db", cursor: "pointer", borderRadius: 4, padding: "4px" },
  empty: { padding: "20px", textAlign: "center", color: "#9ca3af", fontSize: 13 },
};
