import React from "react";
import EditableCell from "./EditableCell";
import { rfqApi, RFQSession, CalculatedResult } from "@/app/services/rfq";

export interface SummarySectionProps {
  rfq: RFQSession | null;
  onChange: React.Dispatch<React.SetStateAction<RFQSession | null>>;
  calc: CalculatedResult | null;
  onRecalc?: () => void;
}

export default function SummarySection({ rfq, onChange, calc, onRecalc }: SummarySectionProps) {
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

  const s = calc?.summary || {};
  const p = calc?.pricing || {};
  const elements = [
    { label: "Foundry Cost", val: calc?.foundry?.total, pct: calc?.foundry?.pct_of_total },
    { label: "In-House Machining", val: calc?.machining?.total, pct: calc?.machining?.pct_of_total },
    { label: "Vendor Machining", val: calc?.vendor?.total, pct: calc?.vendor?.pct_of_total },
    { label: "Corporate Overhead", val: calc?.overhead?.cost, pct: calc?.overhead?.pct_of_total },
    { label: "Pattern Cost", val: calc?.pattern?.on_job, pct: calc?.pattern?.pct_of_total },
    { label: "Purchase Cost", val: calc?.purchase?.total, pct: calc?.purchase?.pct_of_total },
    { label: "Heat Treatment", val: calc?.heat_treat?.total, pct: calc?.heat_treat?.pct_of_total },
    { label: "Other Costs", val: calc?.other?.total, pct: calc?.other?.pct_of_total },
    { label: "Solar Subsidy", val: calc?.solar?.cost, pct: null, isSub: true },
  ];

  return (
    <div style={{ overflowX: "auto" }}>
      {/* Cost Breakdown */}
      <table style={ts.table}>
        <thead>
          <tr>
            <th style={{ ...ts.th, width: 240, textAlign: "left" }}>COST ELEMENT</th>
            <th style={{ ...ts.th, width: 140, textAlign: "right" }}>AMOUNT (Rs)</th>
            <th style={{ ...ts.th, width: 80, textAlign: "right" }}>% OF TOTAL</th>
          </tr>
        </thead>
        <tbody>
          {elements.map((e) => (
            <tr key={e.label} style={{ background: e.isSub ? "#f0fdf4" : "#fff" }}>
              <td style={{ ...ts.td, fontWeight: 500, color: e.isSub ? "#16a34a" : "#374151" }}>
                {e.label}
              </td>
              <td style={{ ...ts.td, textAlign: "right", fontWeight: 600, color: e.isSub ? "#16a34a" : "#374151" }}>
                {e.isSub && e.val ? "(" : ""}{fmt(Math.abs(e.val || 0))}{e.isSub && e.val ? ")" : ""}
              </td>
              <td style={{ ...ts.td, textAlign: "right", color: "#9ca3af" }}>
                {e.pct != null ? (e.pct * 100).toFixed(1) + "%" : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Summary Totals */}
      <div style={ts.summaryBox}>
        <div style={ts.summaryGrid}>
          <SummaryRow label="Variable Mfg Cost" value={s.var_manf_cost} perKg={s.var_manf_per_kg} />
          <SummaryRow label="Fixed Mfg Cost" value={s.fixed_manf_cost} perKg={s.fixed_manf_per_kg} />
          <SummaryRow label="Total Mfg Cost" value={s.total_manf_cost} perKg={s.total_cost_per_kg} bold />
          <SummaryRow label="Total Cost (Incl Tax)" value={s.total_incl_tax} perKg={s.total_incl_tax_per_kg} bold accent />
        </div>
      </div>

      {/* Pricing */}
      <div style={ts.pricingBox}>
        <div style={ts.pricingTitle}>Pricing</div>
        <table style={{ ...ts.table, maxWidth: 600 }}>
          <tbody>
            <tr>
              <td style={{ ...ts.td, fontWeight: 500, width: 200 }}>Price to Quote (Rs)</td>
              <EditableCell
                value={rfq?.price_to_quote}
                type="number"
                align="right"
                onSave={(v) => save("price_to_quote", v)}
              />
            </tr>
            <tr>
              <td style={{ ...ts.td, fontWeight: 500 }}>Currency</td>
              <EditableCell
                value={rfq?.currency}
                type="select"
                options={["USD", "EUR", "GBP", "PKR"]}
                align="right"
                onSave={(v) => save("currency", v)}
              />
            </tr>
            <tr>
              <td style={{ ...ts.td, fontWeight: 500 }}>Exchange Rate</td>
              <EditableCell
                value={rfq?.exchange_rate}
                type="number"
                align="right"
                onSave={(v) => save("exchange_rate", v)}
              />
            </tr>
            <tr>
              <td style={{ ...ts.td, color: "#6b7280" }}>Price per kg (Rs)</td>
              <td style={{ ...ts.td, textAlign: "right", background: "#eff6ff", color: "#6b7280" }}>{fmt(p.price_per_kg)}</td>
            </tr>
            <tr>
              <td style={{ ...ts.td, color: "#6b7280" }}>Price (USD)</td>
              <td style={{ ...ts.td, textAlign: "right", background: "#eff6ff", color: "#6b7280" }}>${fmt(p.price_usd)}</td>
            </tr>
            <tr>
              <td style={{ ...ts.td, color: "#6b7280" }}>Price per kg (USD)</td>
              <td style={{ ...ts.td, textAlign: "right", background: "#eff6ff", color: "#6b7280" }}>${fmtD(p.price_per_kg_usd)}</td>
            </tr>
            <tr style={{ background: (p.profit_pct || 0) >= 0 ? "#f0fdf4" : "#fef2f2" }}>
              <td style={{ ...ts.td, fontWeight: 700 }}>Net Profit Markup</td>
              <td
                style={{
                  ...ts.td,
                  textAlign: "right",
                  fontWeight: 700,
                  color: (p.profit_pct || 0) >= 0 ? "#16a34a" : "#dc2626",
                }}
              >
                Rs {fmt(p.net_profit)} ({((p.profit_pct || 0) * 100).toFixed(1)}%)
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  perKg,
  bold,
  accent,
}: {
  label: string;
  value?: number | null;
  perKg?: number | null;
  bold?: boolean;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "6px 0",
        borderBottom: bold ? "2px solid #e5e7eb" : "1px solid #f3f4f6",
        fontWeight: bold ? 700 : 400,
      }}
    >
      <span style={{ color: accent ? "#ea580c" : "#374151" }}>{label}</span>
      <span style={{ display: "flex", gap: 24 }}>
        <span style={{ color: accent ? "#ea580c" : "#374151", minWidth: 120, textAlign: "right" }}>
          Rs {fmt(value)}
        </span>
        <span style={{ color: "#9ca3af", minWidth: 100, textAlign: "right" }}>
          {fmt(perKg)}/kg
        </span>
      </span>
    </div>
  );
}

function fmt(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return "—";
  return Number(v).toLocaleString("en-PK", { maximumFractionDigits: 0 });
}

function fmtD(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return "—";
  return Number(v).toLocaleString("en-PK", { maximumFractionDigits: 2 });
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
  summaryBox: {
    background: "linear-gradient(135deg, #fafafa, #f0f0f0)",
    borderRadius: 8,
    padding: "16px 20px",
    margin: "16px 0",
    border: "1px solid #e5e7eb",
  },
  summaryGrid: { maxWidth: 600 },
  pricingBox: {
    background: "#fff",
    borderRadius: 8,
    padding: "16px 20px",
    border: "1px solid #e5e7eb",
    marginTop: 12,
  },
  pricingTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: "#111827",
    marginBottom: 12,
    borderBottom: "2px solid #16a34a",
    paddingBottom: 6,
    display: "inline-block",
  },
};
