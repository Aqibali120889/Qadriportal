import React, { useState, useEffect } from "react";
import EditableCell from "./EditableCell";
import { rfqApi, RFQSession, ExportShipment, ShippingRoute } from "@/app/services/rfq";

const INCOTERMS_OPTIONS = [
  "Ex Works",
  "FCA Karachi Warehouse",
  "FOB Karachi Port",
  "CFR",
  "CIF",
];

const SHIPMENT_TYPE_OPTIONS = [
  "Less Container Load (LCL)",
  "20' Container",
  "40' Container",
];

export interface ExportShipmentTabProps {
  rfq: RFQSession | null;
  exportShipment: ExportShipment | null;
  onUpdate: React.Dispatch<React.SetStateAction<ExportShipment | null>>;
}

export default function ExportShipmentTab({ rfq, exportShipment, onUpdate }: ExportShipmentTabProps) {
  const [shippingRoutes, setShippingRoutes] = useState<ShippingRoute[]>([]);

  useEffect(() => {
    rfqApi.getShipping().then((res) => setShippingRoutes((res.data as ShippingRoute[]) || [])).catch(() => {});
  }, []);

  const save = async (field: keyof ExportShipment, value: unknown) => {
    if (!rfq?.id) return;
    try {
      const res = await rfqApi.updateExportShipment(rfq.id, { [field]: value });
      onUpdate(res.data);
    } catch (e: unknown) {
      alert("Save failed: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  const es = exportShipment || {};
  const finWt = Number(rfq?.total_fin_wt_kg) || 0;
  const qty = Number(rfq?.req_qty) || 1;
  const priceToQuote = Number(rfq?.price_to_quote) || 0;

  const boxQty = Number(es.box_qty) || 1;
  const boxWt = Number(es.box_weight) || 250;
  const packWtPerPart = qty > 0 ? (boxWt * boxQty) / qty : Number(es.packing_weight_per_part || 250);
  const totalPartWt = finWt + packWtPerPart;
  const numContainers = Number(es.num_containers) || 1;
  const usdRate = Number(es.usd_rate) || 280;

  const incoterm = es.incoterms || "FCA Karachi Warehouse";
  const shipType = es.shipment_type || "20' Container";
  const isExWorks = incoterm === "Ex Works";
  const isFCA = incoterm === "FCA Karachi Warehouse";

  const selectedPort = es.freight_port || "";
  const selectedRoute = selectedPort ? shippingRoutes.find((r) => r.port === selectedPort) : null;

  const is20 = shipType === "20' Container";
  const is40 = shipType === "40' Container";

  const c1_paint_unit = 0.5;
  const c1_paint = c1_paint_unit * finWt;

  const c2_pack_unit = 20.0;
  const c2_pack = c2_pack_unit * finWt;

  const c3_truck_unit = isExWorks ? 0 : 7.5;
  const c3_truck = c3_truck_unit * totalPartWt;

  const c4_load_unit = isExWorks ? 0 : 1.0;
  const c4_load = c4_load_unit * totalPartWt;

  const c5_fum_base = isExWorks ? 0 : is20 ? 15500 : is40 ? 18500 : 13500;
  const c5_fum = c5_fum_base * (is20 || is40 ? numContainers : 1);
  const containerPayloadWt = 23490;
  const c5_fum_per_piece = containerPayloadWt > 0 ? (c5_fum / containerPayloadWt) * totalPartWt : 0;

  const c6_truck_port_base = isExWorks || isFCA ? 0 : is20 ? 35000 : is40 ? 45000 : 8000;
  const c6_truck_port = c6_truck_port_base * (is20 || is40 ? numContainers : 1);
  const c6_truck_port_per_piece = containerPayloadWt > 0 ? (c6_truck_port / containerPayloadWt) * totalPartWt : 0;

  const c7_clear_base = isExWorks || isFCA ? 0 : is20 ? 14930 : is40 ? 16330 : 14130;
  const c7_clear = c7_clear_base * (is20 || is40 ? numContainers : 1);
  const c7_clear_per_piece = containerPayloadWt > 0 ? (c7_clear / containerPayloadWt) * totalPartWt : 0;

  const c8_wharf_usd = isExWorks || isFCA ? 0 : is20 ? 150 : is40 ? 200 : 35000 / usdRate;
  const c8_wharf = c8_wharf_usd * usdRate * (is20 || is40 ? numContainers : 1);
  const c8_wharf_per_piece = containerPayloadWt > 0 ? (c8_wharf / containerPayloadWt) * totalPartWt : 0;

  const c9_thc_usd = isExWorks || isFCA ? 0 : is20 ? 200 : is40 ? 400 : 130;
  const c9_thc = c9_thc_usd * usdRate * (is20 || is40 ? numContainers : 1);
  const c9_thc_per_piece = containerPayloadWt > 0 ? (c9_thc / containerPayloadWt) * totalPartWt : 0;

  const c10_lash_in = (isExWorks || isFCA ? 0 : is20 ? 5000 : is40 ? 10000 : 0) * numContainers;
  const c10_lash_in_per_piece = containerPayloadWt > 0 ? (c10_lash_in / containerPayloadWt) * totalPartWt : 0;

  const c11_lash_out = 0;

  const c12_bl_usd = isExWorks || isFCA ? 0 : 80;
  const c12_bl = c12_bl_usd * usdRate;
  const c12_bl_per_piece = containerPayloadWt > 0 ? (c12_bl / containerPayloadWt) * totalPartWt : 0;

  const c13_dhl = isExWorks || isFCA ? 0 : 20000;
  const c13_dhl_per_piece = containerPayloadWt > 0 ? (c13_dhl / containerPayloadWt) * totalPartWt : 0;

  const c14_bank_eds = (0.00175 + 0.0025) * priceToQuote;

  const calculatedPHPerPiecePkr =
    c1_paint +
    c2_pack +
    c3_truck +
    c4_load +
    c5_fum_per_piece +
    c6_truck_port_per_piece +
    c7_clear_per_piece +
    c8_wharf_per_piece +
    c9_thc_per_piece +
    c10_lash_in_per_piece +
    c11_lash_out +
    c12_bl_per_piece +
    c13_dhl_per_piece +
    c14_bank_eds;

  const calculatedPHAllPartsPkr = calculatedPHPerPiecePkr * qty;

  const exWorksPrice =
    es.ex_works_price_override !== null && es.ex_works_price_override !== undefined
      ? Number(es.ex_works_price_override)
      : priceToQuote;

  const totalPHAllPartsPkr =
    es.ph_charges_override !== null && es.ph_charges_override !== undefined
      ? Number(es.ph_charges_override)
      : calculatedPHAllPartsPkr;

  const totalPHPerPiecePkr = qty > 0 ? totalPHAllPartsPkr / qty : 0;
  const totalPHPerPieceUsd = usdRate > 0 ? totalPHPerPiecePkr / usdRate : 0;
  const totalPHPkrPerKg = finWt > 0 ? totalPHPerPiecePkr / finWt : 0;
  const totalPHUsdPerKg = finWt > 0 ? totalPHPerPieceUsd / finWt : 0;
  const totalPHAllPartsUsd = totalPHPerPieceUsd * qty;

  const lclPerCbm = Number(selectedRoute?.lcl_per_cbm || 0);
  const c20Freight = Number(selectedRoute?.container_20_freight || 0);
  const c40Freight = Number(selectedRoute?.container_40_freight || 0);
  const calculatedFreightUsd = selectedRoute
    ? is20
      ? c20Freight * numContainers
      : is40
      ? c40Freight * numContainers
      : lclPerCbm
    : 0;
  const calculatedFreightPkr = calculatedFreightUsd * usdRate;

  const freightPkr =
    es.freight_charges_override !== null && es.freight_charges_override !== undefined
      ? Number(es.freight_charges_override)
      : calculatedFreightPkr;

  const freightUsd = usdRate > 0 ? freightPkr / usdRate : calculatedFreightUsd;

  const totalPriceInclFreight = exWorksPrice + totalPHAllPartsPkr + freightPkr;
  const insurancePct = Number(es.freight_insurance_pct || 0.001525);
  const insurancePkr = totalPriceInclFreight * insurancePct;

  const portOptions = [
    { label: "None (No Port Selected)", value: "" },
    ...shippingRoutes.map((r) => ({ label: `${r.port} (${r.country})`, value: r.port })),
  ];

  return (
    <div style={{ padding: 16 }}>
      {/* Top Controls Grid */}
      <div style={ts.headerGrid}>
        <div style={ts.headerBlock}>
          <div style={ts.headerRow}>
            <span style={ts.label}>Customer:</span>
            <span style={ts.valBold}>{rfq?.customer_name || "—"}</span>
          </div>
          <div style={ts.headerRow}>
            <span style={ts.label}>Ref #:</span>
            <span>{rfq?.enq_ref || "—"}</span>
          </div>
          <div style={ts.headerRow}>
            <span style={ts.label}>Finished Weight (kg):</span>
            <span>{fmt(finWt)} kg</span>
          </div>
          <div style={ts.headerRow}>
            <span style={ts.label}>Part Qty:</span>
            <span>{qty}</span>
          </div>
          <div style={ts.headerRow}>
            <span style={ts.label}>Price To Be Quoted:</span>
            <span style={{ color: "#16a34a", fontWeight: 700 }}>Rs {fmt(priceToQuote)}</span>
          </div>
        </div>

        <div style={ts.headerBlock}>
          <div style={ts.headerRow}>
            <span style={ts.label}>Incoterms:</span>
            <EditableCell
              value={incoterm}
              type="select"
              options={INCOTERMS_OPTIONS}
              align="left"
              onSave={(v) => save("incoterms", v)}
            />
          </div>
          <div style={ts.headerRow}>
            <span style={ts.label}>Destination:</span>
            <EditableCell
              value={es.destination}
              type="text"
              align="left"
              onSave={(v) => save("destination", v)}
            />
          </div>
          <div style={ts.headerRow}>
            <span style={ts.label}>Shipment Type:</span>
            <EditableCell
              value={shipType}
              type="select"
              options={SHIPMENT_TYPE_OPTIONS}
              align="left"
              onSave={(v) => save("shipment_type", v)}
            />
          </div>
          <div style={ts.headerRow}>
            <span style={ts.label}>Number of containers:</span>
            <EditableCell
              value={es.num_containers || 1}
              type="number"
              align="right"
              onSave={(v) => save("num_containers", v)}
            />
          </div>
          <div style={ts.headerRow}>
            <span style={ts.label}>USD Rate (PKR):</span>
            <EditableCell
              value={usdRate}
              type="number"
              align="right"
              prefix="Rs "
              onSave={(v) => save("usd_rate", v)}
            />
          </div>
        </div>

        <div style={ts.headerBlock}>
          <div style={ts.headerRow}>
            <span style={ts.label}>Box Dimensions:</span>
            <EditableCell
              value={es.box_dimensions || "L 5.5' x W 5.5' x H 1.5'"}
              type="text"
              align="left"
              onSave={(v) => save("box_dimensions", v)}
            />
          </div>
          <div style={ts.headerRow}>
            <span style={ts.label}>Box Quantity:</span>
            <EditableCell
              value={es.box_qty || 1}
              type="number"
              align="right"
              onSave={(v) => save("box_qty", v)}
            />
          </div>
          <div style={ts.headerRow}>
            <span style={ts.label}>Box Weight (kg):</span>
            <EditableCell
              value={es.box_weight || 250}
              type="number"
              align="right"
              suffix=" kg"
              onSave={(v) => save("box_weight", v)}
            />
          </div>
          <div style={ts.headerRow}>
            <span style={ts.label}>Est Packing Wt/Part:</span>
            <span style={{ fontWeight: 600, color: "#1d4ed8" }}>{packWtPerPart.toFixed(0)} kg</span>
          </div>
        </div>
      </div>

      {/* Packing & Handling Charges Table */}
      <div style={{ overflowX: "auto", marginTop: 16 }}>
        <table style={ts.table}>
          <thead>
            <tr>
              <th style={ts.thYellow} colSpan={2}>
                Packing & Handling Charges
              </th>
              <th style={ts.thHeader}>Cost Basis</th>
              <th style={ts.thHeaderRight}>Unit Cost</th>
              <th style={ts.thHeaderRight}>Weight — kg</th>
              <th style={ts.thHeaderRight}>Cost per kg</th>
              <th style={ts.thHeaderRight}>Cost per piece</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ ...ts.tdBold, width: 260 }} colSpan={2}>
                Painting / Greasing / Anti-rust
              </td>
              <td style={ts.tdBasis}>Finished weight of part</td>
              <td style={ts.tdRight}>0.50 Rs/kg</td>
              <td style={ts.tdRight}>{fmt(finWt)}</td>
              <td style={ts.tdRight}>Rs 0.50</td>
              <td style={ts.tdRightBold}>Rs {fmt(c1_paint)}</td>
            </tr>
            <tr>
              <td style={ts.tdBold} colSpan={2}>
                Packing
              </td>
              <td style={ts.tdBasis}>Finished weight of part</td>
              <td style={ts.tdRight}>20.00 Rs/kg</td>
              <td style={ts.tdRight}>{fmt(finWt)}</td>
              <td style={ts.tdRight}>Rs 20.00</td>
              <td style={ts.tdRightBold}>Rs {fmt(c2_pack)}</td>
            </tr>
            <tr>
              <td style={ts.tdBold} colSpan={2}>
                Truck Freight Lahore - Karachi
              </td>
              <td style={ts.tdBasis}>Finished weight of part + Packing Weight</td>
              <td style={ts.tdRight}>7.50 Rs/kg</td>
              <td style={ts.tdRight}>{fmt(totalPartWt)}</td>
              <td style={ts.tdRight}>Rs {c3_truck_unit.toFixed(2)}</td>
              <td style={ts.tdRightBold}>Rs {fmt(c3_truck)}</td>
            </tr>
            <tr>
              <td style={ts.tdBold} colSpan={2}>
                Loading & Unloading (QFL)
              </td>
              <td style={ts.tdBasis}>Finished weight of part + Packing Weight</td>
              <td style={ts.tdRight}>1.00 Rs/kg</td>
              <td style={ts.tdRight}>{fmt(totalPartWt)}</td>
              <td style={ts.tdRight}>Rs {c4_load_unit.toFixed(2)}</td>
              <td style={ts.tdRightBold}>Rs {fmt(c4_load)}</td>
            </tr>

            <tr>
              <td style={ts.tdBold} colSpan={2}>
                Fumigation (Phyto Sanitary / Fumigation Certificate)
              </td>
              <td style={ts.tdBasis} rowSpan={8}>
                Fixed cost per contaner
              </td>
              <td style={ts.tdRight}>Rs {fmt(c5_fum_base)}</td>
              <td style={ts.tdOrange} rowSpan={8}>
                23490
              </td>
              <td style={ts.tdRight}>Rs {(c5_fum / containerPayloadWt).toFixed(2)}</td>
              <td style={ts.tdRightBold}>Rs {fmt(c5_fum_per_piece)}</td>
            </tr>
            <tr>
              <td style={ts.tdBold} colSpan={2}>
                Truck Freight (Terminal ― QFL ― Port)
              </td>
              <td style={ts.tdRight}>Rs {fmt(c6_truck_port_base)}</td>
              <td style={ts.tdRight}>Rs {(c6_truck_port / containerPayloadWt).toFixed(2)}</td>
              <td style={ts.tdRightBold}>Rs {fmt(c6_truck_port_per_piece)}</td>
            </tr>
            <tr>
              <td style={ts.tdBold} colSpan={2}>
                Clearing Agent
              </td>
              <td style={ts.tdRight}>Rs {fmt(c7_clear_base)}</td>
              <td style={ts.tdRight}>Rs {(c7_clear / containerPayloadWt).toFixed(2)}</td>
              <td style={ts.tdRightBold}>Rs {fmt(c7_clear_per_piece)}</td>
            </tr>
            <tr>
              <td style={ts.tdBold} colSpan={2}>
                Wharfage
              </td>
              <td style={ts.tdRight}>Rs {fmt(c8_wharf_usd * usdRate)}</td>
              <td style={ts.tdRight}>Rs {(c8_wharf / containerPayloadWt).toFixed(2)}</td>
              <td style={ts.tdRightBold}>Rs {fmt(c8_wharf_per_piece)}</td>
            </tr>
            <tr>
              <td style={ts.tdBold}>Terminal Handling Charges</td>
              <td style={{ ...ts.td, color: "#6b7280", fontSize: 11 }}>USD {c9_thc_usd}</td>
              <td style={ts.tdRight}>Rs {fmt(c9_thc_usd * usdRate)}</td>
              <td style={ts.tdRight}>Rs {(c9_thc / containerPayloadWt).toFixed(2)}</td>
              <td style={ts.tdRightBold}>Rs {fmt(c9_thc_per_piece)}</td>
            </tr>
            <tr>
              <td style={ts.tdBold} colSpan={2}>
                Lashing
              </td>
              <td style={ts.tdRight}>Rs {fmt(c10_lash_in)}</td>
              <td style={ts.tdRight}>Rs {(c10_lash_in / containerPayloadWt).toFixed(2)}</td>
              <td style={ts.tdRightBold}>Rs {fmt(c10_lash_in_per_piece)}</td>
            </tr>
            <tr>
              <td style={ts.tdBold}>BL Charges</td>
              <td style={{ ...ts.td, color: "#6b7280", fontSize: 11 }}>USD {c12_bl_usd}</td>
              <td style={ts.tdRight}>Rs {fmt(c12_bl_usd * usdRate)}</td>
              <td style={ts.tdRight}>Rs {(c12_bl / containerPayloadWt).toFixed(2)}</td>
              <td style={ts.tdRightBold}>Rs {fmt(c12_bl_per_piece)}</td>
            </tr>
            <tr>
              <td style={ts.tdBold} colSpan={2}>
                DHL Courier Charges
              </td>
              <td style={ts.tdRight}>Rs {fmt(c13_dhl)}</td>
              <td style={ts.tdRight}>Rs {(c13_dhl / containerPayloadWt).toFixed(2)}</td>
              <td style={ts.tdRightBold}>Rs {fmt(c13_dhl_per_piece)}</td>
            </tr>

            <tr>
              <td style={ts.tdBold} colSpan={2}>
                Bank 0.175% + EDS 0.25%
              </td>
              <td style={ts.tdBasis}>% of quoted FOB value</td>
              <td style={ts.tdRight}>0.43%</td>
              <td style={ts.tdHashed} />
              <td style={ts.tdHashed} />
              <td style={ts.tdRightBold}>Rs {fmt(c14_bank_eds)}</td>
            </tr>

            <tr>
              <td style={ts.tdSummaryLabel} colSpan={5}>
                Packing & Handling Charges ― Per Piece
              </td>
              <td style={ts.tdYellowBold}>{totalPHPkrPerKg.toFixed(0)} Rs/kg</td>
              <td style={ts.tdYellowBold}>Rs {fmt(totalPHPerPiecePkr)} /piece</td>
            </tr>
            <tr>
              <td style={ts.tdSummaryLabel} colSpan={5}></td>
              <td style={ts.tdRight}>${totalPHUsdPerKg.toFixed(2)}/kg</td>
              <td style={ts.tdRightBold}>${Math.round(totalPHPerPieceUsd)} /piece</td>
            </tr>
            <tr>
              <td style={ts.tdSummaryLabel} colSpan={6}>
                Total Packing & Handling Charges
              </td>
              <td style={{ ...ts.tdYellowBold, fontSize: 15 }}>${Math.round(totalPHAllPartsUsd)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Sea Freight & Freight Insurance Block */}
      <div style={ts.seaGrid}>
        <div style={ts.tableContainer}>
          <table style={ts.table}>
            <thead>
              <tr>
                <th style={ts.thYellow} colSpan={2}>
                  Sea Freight
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ ...ts.tdBold, width: 180 }}>Port :</td>
                <EditableCell
                  value={selectedPort}
                  type="select"
                  options={portOptions}
                  align="left"
                  onSave={(v) => save("freight_port", v)}
                />
              </tr>
              <tr>
                <td style={ts.tdBold}>Country :</td>
                <td style={ts.tdVal}>{selectedRoute?.country || "—"}</td>
              </tr>
              <tr>
                <td style={ts.tdBold}>kg per CBM :</td>
                <td style={ts.tdVal}>{selectedRoute?.kg_per_cbm || "—"}</td>
              </tr>
              <tr>
                <td style={ts.tdBold}>Charges per CBM :</td>
                <td style={ts.tdVal}>{selectedRoute ? `USD ${selectedRoute.lcl_per_cbm || 0}` : "—"}</td>
              </tr>
              <tr>
                <td style={ts.tdBold}>Charges per 20' container :</td>
                <td style={ts.tdVal}>{selectedRoute ? `USD ${selectedRoute.container_20_freight || 0}` : "—"}</td>
              </tr>
              <tr>
                <td style={ts.tdBold}>Charges per 40' container :</td>
                <td style={ts.tdVal}>{selectedRoute ? `USD ${selectedRoute.container_40_freight || 0}` : "—"}</td>
              </tr>
              <tr>
                <td style={ts.tdBold}>Transit Time :</td>
                <td style={ts.tdVal}>
                  {selectedRoute
                    ? `FCL: ${selectedRoute.fcl_transit_time || "—"} d / LCL: ${selectedRoute.lcl_transit_time || "—"} d`
                    : "—"}
                </td>
              </tr>
              <tr>
                <td style={ts.tdBold}>Rate validity :</td>
                <EditableCell
                  value={es.rate_validity || "30 days"}
                  type="text"
                  align="left"
                  onSave={(v) => save("rate_validity", v)}
                />
              </tr>
            </tbody>
          </table>
        </div>

        <div style={ts.tableContainer}>
          <table style={ts.table}>
            <thead>
              <tr>
                <th style={ts.thYellow} colSpan={2}>
                  Freight Insurance
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ ...ts.tdBold, width: 240 }}>Total Ex-Works Price</td>
                <EditableCell
                  value={exWorksPrice}
                  type="number"
                  align="right"
                  prefix="Rs "
                  onSave={(v) => save("ex_works_price_override", v)}
                />
              </tr>
              <tr>
                <td style={ts.tdBold}>Packing & Handling Charges</td>
                <EditableCell
                  value={totalPHAllPartsPkr}
                  type="number"
                  align="right"
                  prefix="Rs "
                  onSave={(v) => save("ph_charges_override", v)}
                />
              </tr>
              <tr>
                <td style={ts.tdBold}>Freight Charges ({Math.round(freightUsd)} USD)</td>
                <EditableCell
                  value={freightPkr}
                  type="number"
                  align="right"
                  prefix="Rs "
                  onSave={(v) => save("freight_charges_override", v)}
                />
              </tr>
              <tr style={{ background: "#f9fafb", fontWeight: 700 }}>
                <td style={ts.tdBold}>Total Price (Incl of Packing +Freight Charges)</td>
                <td style={{ ...ts.tdRightBold, color: "#1d4ed8" }}>Rs {fmt(totalPriceInclFreight)}</td>
              </tr>
              <tr>
                <td style={ts.tdBold}>Freight Insurance</td>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10 }}>
                  <EditableCell
                    value={insurancePct}
                    type="number"
                    align="right"
                    onSave={(v) => save("freight_insurance_pct", v)}
                  />
                  <span style={ts.tdRightBold}>Rs {fmt(insurancePkr)}</span>
                </div>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function fmt(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return "0";
  return Number(v).toLocaleString("en-PK", { maximumFractionDigits: 0 });
}

const ts: Record<string, React.CSSProperties> = {
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 13,
    background: "#fff",
    borderRadius: 6,
    overflow: "hidden",
    border: "1px solid #e5e7eb",
  },
  thYellow: {
    padding: "8px 12px",
    fontSize: 13,
    fontWeight: 700,
    color: "#000",
    background: "#facc15",
    textAlign: "left",
    letterSpacing: "0.02em",
  },
  thHeader: {
    padding: "8px 10px",
    fontSize: 11,
    fontWeight: 700,
    color: "#374151",
    background: "#f9fafb",
    borderBottom: "2px solid #e5e7eb",
    textAlign: "left",
  },
  thHeaderRight: {
    padding: "8px 10px",
    fontSize: 11,
    fontWeight: 700,
    color: "#374151",
    background: "#f9fafb",
    borderBottom: "2px solid #e5e7eb",
    textAlign: "right",
  },
  td: { padding: "7px 10px", borderBottom: "1px solid #e5e7eb", verticalAlign: "middle" },
  tdBold: { padding: "7px 10px", borderBottom: "1px solid #e5e7eb", fontWeight: 600, color: "#111827", verticalAlign: "middle" },
  tdVal: { padding: "7px 10px", borderBottom: "1px solid #e5e7eb", color: "#374151", verticalAlign: "middle" },
  tdBasis: { padding: "7px 10px", borderBottom: "1px solid #e5e7eb", color: "#6b7280", fontSize: 12, verticalAlign: "middle" },
  tdRight: { padding: "7px 10px", borderBottom: "1px solid #e5e7eb", textAlign: "right", color: "#374151", verticalAlign: "middle" },
  tdRightBold: { padding: "7px 10px", borderBottom: "1px solid #e5e7eb", textAlign: "right", fontWeight: 700, color: "#111827", verticalAlign: "middle" },
  tdOrange: {
    padding: "7px 10px",
    background: "#ffedd5",
    color: "#9a3412",
    fontWeight: 700,
    textAlign: "center",
    verticalAlign: "middle",
    border: "1px solid #fed7aa",
  },
  tdHashed: {
    padding: "7px 10px",
    background: "repeating-linear-gradient(45deg, #e5e7eb, #e5e7eb 5px, #f3f4f6 5px, #f3f4f6 10px)",
    borderBottom: "1px solid #e5e7eb",
  },
  tdSummaryLabel: { padding: "8px 10px", fontWeight: 700, color: "#111827", borderBottom: "1px solid #e5e7eb", textAlign: "left" },
  tdYellowBold: {
    padding: "8px 10px",
    background: "#fef08a",
    fontWeight: 700,
    color: "#111827",
    textAlign: "right",
    borderBottom: "1px solid #e5e7eb",
  },
  headerGrid: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 },
  headerBlock: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    background: "#fff",
    padding: 14,
    borderRadius: 6,
    border: "1px solid #e5e7eb",
  },
  headerRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 13 },
  label: { color: "#6b7280", fontWeight: 600, fontSize: 12 },
  valBold: { fontWeight: 600, color: "#111827" },
  seaGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 20 },
  tableContainer: { display: "flex", flexDirection: "column" },
};
