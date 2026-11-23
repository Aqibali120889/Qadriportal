import React from "react";
import EditableCell from "./EditableCell";
import { rfqApi, RFQSession, CalculatedResult } from "@/app/services/rfq";

export interface TaxSectionProps {
  rfq: RFQSession | null;
  onChange: React.Dispatch<React.SetStateAction<RFQSession | null>>;
  calc: CalculatedResult | null;
  onRecalc?: () => void;
}

export default function TaxSection({ rfq, onChange, calc, onRecalc }: TaxSectionProps) {
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

  const taxCalc = calc?.tax || {};
  const cyclebackEnabled = Boolean(rfq?.sales_tax_cycleback_enabled);

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={ts.table}>
        <thead>
          <tr>
            <th style={{ ...ts.th, width: 260, textAlign: "left" }}>DESCRIPTION</th>
            <th style={{ ...ts.th, width: 140, textAlign: "right" }}>RATE / %</th>
            <th style={{ ...ts.th, width: 160, textAlign: "right" }}>AMOUNT (Rs)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ ...ts.td, fontWeight: 500 }}>Income Tax</td>
            <EditableCell
              value={rfq?.income_tax_pct}
              type="select"
              options={["0", "0.02", "0.0518", "0.174"]}
              align="right"
              onSave={(v) => save("income_tax_pct", parseFloat(String(v)))}
            />
            <td style={{ ...ts.td, textAlign: "right", background: "#eff6ff", color: "#6b7280" }}>
              {fmt(taxCalc.income_tax_amount)}
            </td>
          </tr>
          <tr>
            <td style={{ ...ts.td, fontWeight: 500 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={cyclebackEnabled}
                  onChange={(e) => save("sales_tax_cycleback_enabled", e.target.checked)}
                  style={{ width: 15, height: 15, accentColor: "#16a34a", cursor: "pointer" }}
                />
                <span>Sales Tax Cycle Back (18% × 70%)</span>
              </label>
            </td>
            <td style={{ ...ts.td, textAlign: "right", color: "#6b7280" }}>
              {cyclebackEnabled ? "12.6%" : "Disabled"}
            </td>
            <td
              style={{
                ...ts.td,
                textAlign: "right",
                background: cyclebackEnabled ? "#f0fdf4" : "#eff6ff",
                color: cyclebackEnabled ? "#16a34a" : "#6b7280",
                fontWeight: cyclebackEnabled ? 600 : 400,
              }}
            >
              {fmt(taxCalc.sales_tax_cycleback)}
            </td>
          </tr>
          <tr style={{ background: "#fafafa" }}>
            <td style={{ ...ts.td, fontWeight: 700 }}>Net Income Tax</td>
            <td style={ts.td}></td>
            <td style={{ ...ts.td, textAlign: "right", color: "#ea580c", fontWeight: 700 }}>
              Rs {fmt(taxCalc.net_income_tax)}
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
