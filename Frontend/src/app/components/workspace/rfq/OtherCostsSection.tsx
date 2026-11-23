import React from "react";
import EditableCell from "./EditableCell";
import { rfqApi, RFQSession, CalculatedResult } from "@/app/services/rfq";

export interface OtherCostsSectionProps {
  rfq: RFQSession | null;
  onChange: React.Dispatch<React.SetStateAction<RFQSession | null>>;
  calc: CalculatedResult | null;
  onRecalc?: () => void;
}

export default function OtherCostsSection({ rfq, onChange, calc, onRecalc }: OtherCostsSectionProps) {
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

  const otherCalc = calc?.other || {};

  const rows = [
    {
      key: "other_packing_enabled" as keyof RFQSession,
      label: "Packing & Transportation (Local Customer)",
      detailField: "other_packing_cost_per_kg" as keyof RFQSession,
      detailLabel: "Rs/kg",
      calcField: "packing_cost",
    },
    {
      key: "other_export_shipment_enabled" as keyof RFQSession,
      label: "Export Shipment Charges",
      calcField: "export_shipment_cost",
    },
    {
      key: "other_agent_commission_enabled" as keyof RFQSession,
      label: "Agent Commission (% of PTBQ - Export Shipment Charges)",
      detailField: "other_agent_commission_pct" as keyof RFQSession,
      detailLabel: "%",
      detailType: "number",
      calcField: "agent_commission_cost",
    },
    {
      key: "other_fls_royalty_enabled" as keyof RFQSession,
      label: "FLS Royalty (% of PTBQ - Export Shipment Charges)",
      detailField: "other_fls_royalty_pct" as keyof RFQSession,
      detailLabel: "%",
      detailType: "number",
      calcField: "fls_royalty_cost",
    },
    {
      key: "other_contingency_enabled" as keyof RFQSession,
      label: "Cost Contingency",
      detailField: "other_contingency_pct" as keyof RFQSession,
      detailLabel: "%",
      detailType: "number",
      calcField: "contingency_cost",
    },
    {
      key: "other_quality_testing_enabled" as keyof RFQSession,
      label: "Additional quality testing",
      descField: "other_quality_testing_desc" as keyof RFQSession,
      detailField: "other_quality_testing_cost" as keyof RFQSession,
      detailLabel: "Cost (Rs)",
      detailType: "number",
      calcField: "quality_testing_cost",
    },
  ];

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={ts.table}>
        <thead>
          <tr>
            <th style={{ ...ts.th, width: 60, textAlign: "center" }}>YES/NO</th>
            <th style={{ ...ts.th, width: 320, textAlign: "left" }}>DESCRIPTION</th>
            <th style={{ ...ts.th, width: 200, textAlign: "left" }}>DETAIL</th>
            <th style={{ ...ts.th, width: 140, textAlign: "right" }}>TOTAL COST</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const enabled = Boolean(rfq?.[row.key]);
            const yesNoValue = enabled ? "Yes" : "No";
            const costVal = (otherCalc as Record<string, number>)[row.calcField] ?? 0;
            return (
              <tr key={row.key} style={{ background: enabled ? "#f0fdf4" : "#fff", opacity: enabled ? 1 : 0.6 }}>
                <EditableCell
                  value={yesNoValue}
                  type="select"
                  options={["Yes", "No"]}
                  align="center"
                  onSave={(v) => save(row.key, v === "Yes")}
                />
                <td style={{ ...ts.td, fontWeight: 500, color: enabled ? "#111827" : "#9ca3af" }}>
                  {row.label}
                  {row.descField && (
                    <div style={{ marginTop: 4 }}>
                      <EditableCell
                        value={rfq?.[row.descField] as string}
                        type="text"
                        align="left"
                        onSave={(v) => save(row.descField!, v)}
                      />
                    </div>
                  )}
                </td>
                <td style={ts.td}>
                  {row.detailField && (
                    <EditableCell
                      value={rfq?.[row.detailField] as number}
                      type={(row.detailType as "text" | "number") || "number"}
                      align="right"
                      suffix={row.detailLabel ? ` ${row.detailLabel}` : ""}
                      onSave={(v) => save(row.detailField!, v)}
                    />
                  )}
                </td>
                <td style={{ ...ts.td, textAlign: "right", color: enabled ? "#ea580c" : "#d1d5db", fontWeight: 600 }}>
                  {enabled ? `Rs ${fmt(costVal)}` : "—"}
                </td>
              </tr>
            );
          })}
          <tr style={{ background: "#fafafa" }}>
            <td style={ts.td}></td>
            <td style={{ ...ts.td, fontWeight: 700, color: "#111827" }}>Total Other Costs</td>
            <td style={ts.td}></td>
            <td style={{ ...ts.td, textAlign: "right", color: "#ea580c", fontWeight: 700, fontSize: 14 }}>
              Rs {fmt(otherCalc.total)}
            </td>
          </tr>
        </tbody>
      </table>
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
