import React from "react";
import EditableCell from "./EditableCell";
import { rfqApi, RFQSession, CalculatedResult } from "@/app/services/rfq";

export interface OverheadSectionProps {
  rfq: RFQSession | null;
  onChange: React.Dispatch<React.SetStateAction<RFQSession | null>>;
  calc: CalculatedResult | null;
  onRecalc?: () => void;
}

export default function OverheadSection({ rfq, onChange, calc, onRecalc }: OverheadSectionProps) {
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

  const oh = calc?.overhead || {};

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={ts.table}>
        <thead>
          <tr>
            <th style={{ ...ts.th, width: 240, textAlign: "left" }}>DESCRIPTION</th>
            <th style={{ ...ts.th, width: 140, textAlign: "right" }}>VALUE</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ ...ts.td, fontWeight: 500 }}>Corporate Overhead %</td>
            <EditableCell
              value={rfq?.overhead_pct}
              type="number"
              align="right"
              onSave={(v) => save("overhead_pct", v)}
            />
          </tr>
          <tr>
            <td style={{ ...ts.td, color: "#6b7280" }}>Total Manufacturing Cost (Foundry + Machining + Vendor)</td>
            <td style={{ ...ts.td, textAlign: "right", background: "#eff6ff", color: "#6b7280" }}>
              Rs {fmt(oh.total_manufacturing_cost)}
            </td>
          </tr>
          <tr style={{ background: "#fafafa" }}>
            <td style={{ ...ts.td, fontWeight: 700 }}>QG Corporate Cost on Job</td>
            <td style={{ ...ts.td, textAlign: "right", color: "#ea580c", fontWeight: 700, fontSize: 14 }}>
              Rs {fmt(oh.cost)}
            </td>
          </tr>
          <tr>
            <td style={{ ...ts.td, color: "#6b7280" }}>USD Equivalent</td>
            <td style={{ ...ts.td, textAlign: "right", color: "#6b7280" }}>
              ${fmt(oh.usd)}
            </td>
          </tr>
          <tr>
            <td style={{ ...ts.td, color: "#6b7280" }}>Per kg Rate</td>
            <td style={{ ...ts.td, textAlign: "right", color: "#6b7280" }}>
              Rs {fmt(oh.per_kg)}/kg
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function fmt(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return "—";
  return Number(v).toLocaleString("en-PK", { maximumFractionDigits: 0 });
}

const ts: Record<string, React.CSSProperties> = {
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13, maxWidth: 500 },
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
};
