import React from "react";
import EditableCell from "./EditableCell";
import { rfqApi, RFQSession, CalculatedResult } from "@/app/services/rfq";

export interface SolarSubsidySectionProps {
  rfq: RFQSession | null;
  onChange: React.Dispatch<React.SetStateAction<RFQSession | null>>;
  calc: CalculatedResult | null;
  onRecalc?: () => void;
}

export default function SolarSubsidySection({ rfq, onChange, calc, onRecalc }: SolarSubsidySectionProps) {
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

  const solarCalc = calc?.solar || {};

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={ts.table}>
        <thead>
          <tr>
            <th style={{ ...ts.th, width: 220, textAlign: "left" }}>DESCRIPTION</th>
            <th style={{ ...ts.th, width: 140, textAlign: "right" }}>SUBSIDY (Rs/kg)</th>
            <th style={{ ...ts.th, width: 140, textAlign: "right" }}>TOTAL GROSS WT (kg)</th>
            <th style={{ ...ts.th, width: 160, textAlign: "right" }}>COST SUBSIDY ON JOB</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ ...ts.td, fontWeight: 500 }}>Solar Cost Subsidy</td>
            <EditableCell
              value={rfq?.solar_subsidy_per_kg}
              type="number"
              align="right"
              onSave={(v) => save("solar_subsidy_per_kg", v)}
            />
            <td style={{ ...ts.td, textAlign: "right", background: "#eff6ff", color: "#6b7280" }}>
              {fmt(solarCalc.total_gross_wt)}
            </td>
            <td style={{ ...ts.td, textAlign: "right", background: "#eff6ff", color: "#16a34a", fontWeight: 700 }}>
              Rs {fmt(solarCalc.cost)} (credit)
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
};
