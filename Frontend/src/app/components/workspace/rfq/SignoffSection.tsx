import React from "react";
import EditableCell from "./EditableCell";
import { rfqApi, RFQSession } from "@/app/services/rfq";

export interface SignoffSectionProps {
  rfq: RFQSession | null;
  onChange: React.Dispatch<React.SetStateAction<RFQSession | null>>;
}

export default function SignoffSection({ rfq, onChange }: SignoffSectionProps) {
  const save = async (field: keyof RFQSession, value: unknown) => {
    if (!rfq?.id) return;
    try {
      const res = await rfqApi.updateRFQ(rfq.id, { [field]: value });
      onChange((prev) => (prev ? { ...prev, ...res.data } : res.data));
    } catch (e: unknown) {
      alert("Save failed: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={ts.table}>
        <thead>
          <tr>
            <th style={{ ...ts.th, width: 200, textAlign: "left" }}>ROLE</th>
            <th style={{ ...ts.th, width: 300, textAlign: "left" }}>NAME</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ ...ts.td, fontWeight: 500, color: "#374151" }}>Prepared by</td>
            <EditableCell
              value={rfq?.prepared_by}
              type="text"
              align="left"
              onSave={(v) => save("prepared_by", v)}
            />
          </tr>
          <tr>
            <td style={{ ...ts.td, fontWeight: 500, color: "#374151" }}>Checked by</td>
            <EditableCell
              value={rfq?.checked_by}
              type="text"
              align="left"
              onSave={(v) => save("checked_by", v)}
            />
          </tr>
          <tr>
            <td style={{ ...ts.td, fontWeight: 500, color: "#374151" }}>Territory Holder</td>
            <EditableCell
              value={rfq?.territory_holder}
              type="text"
              align="left"
              onSave={(v) => save("territory_holder", v)}
            />
          </tr>
        </tbody>
      </table>
    </div>
  );
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
