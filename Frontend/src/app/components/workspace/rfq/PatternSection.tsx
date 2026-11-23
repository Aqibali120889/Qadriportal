import React from "react";
import EditableCell from "./EditableCell";
import { rfqApi, RFQSession, CalculatedResult } from "@/app/services/rfq";

export interface PatternSectionProps {
  rfq: RFQSession | null;
  onChange: React.Dispatch<React.SetStateAction<RFQSession | null>>;
  calc: CalculatedResult | null;
  onRecalc?: () => void;
}

export default function PatternSection({ rfq, onChange, calc, onRecalc }: PatternSectionProps) {
  const save = async (field: keyof RFQSession, value: unknown) => {
    if (!rfq?.id) return;
    try {
      const res = await rfqApi.updateRFQ(rfq.id, { [field]: value });
      onChange((prev) => (prev ? { ...prev, ...res.data } : res.data));
      if (onRecalc) onRecalc();
    } catch (e: unknown) {
      alert("Save failed: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  const patternCalc = calc?.pattern || {};
  const inStock = Boolean(rfq?.pattern_in_stock);

  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 500, color: "#374151" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={inStock}
            onChange={(e) => save("pattern_in_stock", e.target.checked)}
            style={{ width: 16, height: 16, accentColor: "#16a34a", cursor: "pointer" }}
          />
          <span>Pattern available in stock / Quoted separately (Cost on job = Rs 0)</span>
        </label>
      </div>

      <table style={ts.table}>
        <thead>
          <tr>
            <th style={{ ...ts.th, width: 200, textAlign: "left" }}>DESCRIPTION</th>
            <th style={{ ...ts.th, width: 140, textAlign: "right" }}>VARIABLE COST</th>
            <th style={{ ...ts.th, width: 140, textAlign: "right" }}>FIXED COST</th>
            <th style={{ ...ts.th, width: 140, textAlign: "right" }}>TOTAL COST</th>
            <th style={{ ...ts.th, width: 100, textAlign: "right" }}>USD</th>
            <th style={{ ...ts.th, width: 100, textAlign: "center" }}>DIV QTY</th>
            <th style={{ ...ts.th, width: 140, textAlign: "right" }}>COST ON JOB</th>
          </tr>
        </thead>
        <tbody>
          <tr style={{ opacity: inStock ? 0.6 : 1 }}>
            <td style={{ ...ts.td, fontWeight: 500 }}>Pattern / Tooling</td>
            <EditableCell
              value={rfq?.pattern_var_cost}
              type="number"
              align="right"
              onSave={(v) => save("pattern_var_cost", v)}
            />
            <EditableCell
              value={rfq?.pattern_fixed_cost}
              type="number"
              align="right"
              onSave={(v) => save("pattern_fixed_cost", v)}
            />
            <td style={{ ...ts.td, textAlign: "right", background: "#eff6ff", color: "#1d4ed8", fontWeight: 600 }}>
              {fmt(patternCalc.total_cost)}
            </td>
            <td style={{ ...ts.td, textAlign: "right", background: "#eff6ff", color: "#6b7280" }}>
              ${fmt(patternCalc.usd)}
            </td>
            <EditableCell
              value={rfq?.pattern_division_qty}
              type="number"
              align="center"
              onSave={(v) => save("pattern_division_qty", v)}
            />
            <td
              style={{
                ...ts.td,
                textAlign: "right",
                background: inStock ? "#f3f4f6" : "#eff6ff",
                color: inStock ? "#9ca3af" : "#ea580c",
                fontWeight: 700,
              }}
            >
              Rs {fmt(patternCalc.on_job)}
            </td>
          </tr>
        </tbody>
      </table>
      <div style={ts.totalRow}>
        <span style={ts.totalLabel}>Pattern Cost on Job</span>
        <span style={{ ...ts.totalNum, color: inStock ? "#6b7280" : "#ea580c", fontWeight: 700 }}>
          Rs {fmt(patternCalc.on_job)} · {((patternCalc.pct_of_total || 0) * 100).toFixed(1)}% of total
        </span>
      </div>
    </div>
  );
}

function fmt(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return "—";
  return Number(v).toLocaleString("en-PK", { maximumFractionDigits: 0 });
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
};
