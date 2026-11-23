import React, { useState, useEffect } from "react";
import EditableCell from "./EditableCell";
import { Plus, Trash2 } from "lucide-react";
import { rfqApi, ShippingRoute } from "@/app/services/rfq";

export default function ShippingTab() {
  const [routes, setRoutes] = useState<ShippingRoute[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    rfqApi
      .getShipping()
      .then((res) => setRoutes((res.data as ShippingRoute[]) || []))
      .finally(() => setLoading(false));
  }, []);

  const save = async (id: string, field: keyof ShippingRoute, value: unknown) => {
    try {
      const res = await rfqApi.updateShipping(id, { [field]: value });
      setRoutes((prev) => prev.map((r) => (r.id === id ? { ...r, ...(res.data as ShippingRoute) } : r)));
    } catch (e: unknown) {
      alert("Save failed: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  const addRoute = async () => {
    try {
      const res = await rfqApi.addShipping();
      if (res.data) {
        setRoutes((prev) => [...prev, res.data as ShippingRoute]);
      }
    } catch (e: unknown) {
      alert("Add route failed: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  const delRoute = async (id: string) => {
    if (!confirm("Are you sure you want to delete this shipping route?")) return;
    try {
      await rfqApi.deleteShipping(id);
      setRoutes((prev) => prev.filter((r) => r.id !== id));
    } catch (e: unknown) {
      alert("Delete failed: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Loading Shipping Routes…</div>;

  return (
    <div style={{ padding: 16 }}>
      <div style={ts.topHeader}>
        <div>
          <h3 style={ts.sectionTitle}>Shipping Time & Cost</h3>
          <p style={{ color: "#6b7280", fontSize: 12, marginTop: 4 }}>
            Global shipping route reference data. Double-click any cell to edit.
          </p>
        </div>
        <button style={ts.addBtn} onClick={addRoute}>
          <Plus size={14} /> Add Shipping Data
        </button>
      </div>

      <div style={{ overflowX: "auto", marginTop: 12 }}>
        <table style={ts.table}>
          <thead>
            <tr>
              <th style={{ ...ts.th, width: 140, textAlign: "left" }}>COUNTRY NAME</th>
              <th style={{ ...ts.th, width: 140, textAlign: "left" }}>NAME OF PORT</th>
              <th style={{ ...ts.th, width: 130, textAlign: "center" }}>Kg per CBM</th>
              <th style={{ ...ts.th, width: 140, textAlign: "right" }}>$ per CBM - Less Container Load</th>
              <th style={{ ...ts.th, width: 140, textAlign: "right" }}>20' Container Sea Freight</th>
              <th style={{ ...ts.th, width: 140, textAlign: "right" }}>40' Container Sea Freight</th>
              <th style={{ ...ts.th, width: 120, textAlign: "center" }}>FCL Transit Time (Tentative)</th>
              <th style={{ ...ts.th, width: 120, textAlign: "center" }}>LCL Transit Time (Tentative)</th>
              <th style={{ ...ts.th, width: 44, textAlign: "center" }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {routes.length === 0 && (
              <tr>
                <td colSpan={9} style={ts.empty}>
                  No shipping routes found — click "Add Shipping Data" to add
                </td>
              </tr>
            )}
            {routes.map((r) => (
              <tr key={r.id}>
                <EditableCell
                  value={r.country}
                  type="text"
                  align="left"
                  onSave={(v) => save(r.id, "country", v)}
                />
                <EditableCell
                  value={r.port}
                  type="text"
                  align="left"
                  onSave={(v) => save(r.id, "port", v)}
                />
                <EditableCell
                  value={r.kg_per_cbm ? String(r.kg_per_cbm).replace(/[^0-9.-]/g, "") : "1000"}
                  type="number"
                  align="center"
                  suffix=" KG/CBM"
                  onSave={(v) => save(r.id, "kg_per_cbm", v ? `${v} KG/CBM` : "1000 KG/CBM")}
                />
                <EditableCell
                  value={r.lcl_per_cbm}
                  type="number"
                  align="right"
                  prefix="USD "
                  onSave={(v) => save(r.id, "lcl_per_cbm", v)}
                />
                <EditableCell
                  value={r.container_20_freight}
                  type="number"
                  align="right"
                  prefix="USD "
                  onSave={(v) => save(r.id, "container_20_freight", v)}
                />
                <EditableCell
                  value={r.container_40_freight}
                  type="number"
                  align="right"
                  prefix="USD "
                  onSave={(v) => save(r.id, "container_40_freight", v)}
                />
                <EditableCell
                  value={r.fcl_transit_time}
                  type="text"
                  align="center"
                  onSave={(v) => save(r.id, "fcl_transit_time", v)}
                />
                <EditableCell
                  value={r.lcl_transit_time}
                  type="text"
                  align="center"
                  onSave={(v) => save(r.id, "lcl_transit_time", v)}
                />
                <td style={ts.delCell}>
                  <button style={ts.delBtn} onClick={() => delRoute(r.id)} title="Delete shipping route">
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

const ts: Record<string, React.CSSProperties> = {
  topHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: "#111827",
    margin: 0,
    borderBottom: "2px solid #8b5cf6",
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
    background: "#8b5cf6",
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
  delCell: { padding: "4px 6px", textAlign: "center" },
  delBtn: { background: "none", border: "none", color: "#d1d5db", cursor: "pointer", borderRadius: 4, padding: "4px" },
  empty: { padding: "20px", textAlign: "center", color: "#9ca3af", fontSize: 13 },
};
