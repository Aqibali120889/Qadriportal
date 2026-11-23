import React from "react";
import { rfqApi, RFQSession, CalculatedResult } from "@/app/services/rfq";

export interface HeaderSectionProps {
  rfq: RFQSession | null;
  onChange: React.Dispatch<React.SetStateAction<RFQSession | null>>;
  calc: CalculatedResult | null;
  onRecalc?: () => void;
}

export default function HeaderSection({ rfq, onChange, calc, onRecalc }: HeaderSectionProps) {
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

  const calculatedFinWt = calc?.summary?.total_fin_wt ?? rfq?.total_fin_wt_kg;

  const Field = ({
    label,
    field,
    value,
    type = "text",
    readOnly = false,
  }: {
    label: string;
    field: keyof RFQSession;
    value: unknown;
    type?: string;
    readOnly?: boolean;
  }) => (
    <div style={s.field}>
      <label style={s.label}>{label}</label>
      <input
        style={{
          ...s.input,
          background: readOnly ? "#eff6ff" : "#fff",
          color: readOnly ? "#1e40af" : "#111827",
          fontWeight: readOnly ? 600 : 400,
        }}
        defaultValue={String(value ?? "")}
        type={type}
        readOnly={readOnly}
        onBlur={(e) => {
          if (readOnly) return;
          const v = type === "number" ? parseFloat(e.target.value) : e.target.value;
          if (String(v) !== String(value)) save(field, v);
        }}
      />
    </div>
  );

  return (
    <div style={s.grid}>
      <Field label="Customer" field="customer_name" value={rfq?.customer_name} />
      <Field label="Item Name" field="item_name" value={rfq?.item_name} />
      <Field label="Enquiry Ref #" field="enq_ref" value={rfq?.enq_ref} />
      <Field label="Enquiry Date" field="enq_date" value={rfq?.enq_date} type="date" />
      <Field label="Drawing #" field="drawing_number" value={rfq?.drawing_number} />
      <Field label="Required Qty" field="req_qty" value={rfq?.req_qty} type="number" />
      <Field
        label="Total Fin Wt (kg) [Formula]"
        field="total_fin_wt_kg"
        value={
          calculatedFinWt
            ? Number(calculatedFinWt).toLocaleString("en-PK", { maximumFractionDigits: 2 })
            : ""
        }
        readOnly
      />
      <Field label="Process Time" field="estimated_process_time" value={rfq?.estimated_process_time} />
      <Field label="Estimation Date" field="estimation_date" value={rfq?.estimation_date} type="date" />
      <div style={{ ...s.field, gridColumn: "1/-1" }}>
        <label style={s.label}>Notes (Press Enter for new line / next Excel cell)</label>
        <textarea
          style={{ ...s.input, minHeight: 75, resize: "vertical", fontFamily: "inherit", lineHeight: "1.5" }}
          defaultValue={rfq?.notes ?? ""}
          placeholder="e.g.&#10;Pattern rate from Mr.M.Haroon 24/10/2025&#10;Material rate from M.Huraira 18/2/2026&#10;Machining hour from Mr.Imran Butt 27/10/2025"
          onBlur={(e) => {
            if (e.target.value !== rfq?.notes) save("notes", e.target.value);
          }}
        />
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))",
    gap: 12,
    padding: 16,
  },
  field: { display: "flex", flexDirection: "column", gap: 4 },
  label: {
    fontSize: 11,
    fontWeight: 700,
    color: "#6b7280",
    letterSpacing: "0.05em",
    textTransform: "uppercase",
  },
  input: {
    padding: "7px 10px",
    border: "1px solid #d1d5db",
    borderRadius: 6,
    fontSize: 13,
    color: "#111827",
    outline: "none",
  },
};
