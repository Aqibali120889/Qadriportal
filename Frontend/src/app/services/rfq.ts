/**
 * Frontend/src/app/services/rfq.ts
 * ──────────────────────────────────────────────────────────────────────────
 * API service for the Excel Cost Estimation Sheet.
 *
 * Routes to /api/sheet/..., /api/reference/..., /api/export/...
 * All authenticated via the enterprise auth header (same as api.ts).
 *
 * Key design: project.id is the internal key; rfq_number is the user key.
 * The bridge endpoint POST /api/v1/projects/{project_id}/rfq resolves
 * project → rfq_session via rfq_number automatically.
 */



// ── Bridge ────────────────────────────────────────────────────────────────────

export interface RFQBridgeResponse {
  rfq_id: string;
  rfq_number: string;
  status: string;
  customer_name: string | null;
  item_name: string | null;
  is_new: boolean;
}

// ── RFQ Sessions ──────────────────────────────────────────────────────────────

export interface RFQSession {
  id: string;
  rfq_number: string;
  customer_name?: string;
  item_name?: string;
  enq_ref?: string;
  enq_date?: string;
  drawing_number?: string;
  req_qty?: number;
  total_fin_wt_kg?: number;
  notes?: string;
  estimated_process_time?: string;
  estimation_date?: string;
  overhead_pct?: number;
  pattern_var_cost?: number;
  pattern_fixed_cost?: number;
  pattern_division_qty?: number;
  pattern_in_stock?: boolean;
  other_packing_enabled?: boolean;
  other_export_shipment_enabled?: boolean;
  other_agent_commission_enabled?: boolean;
  other_agent_commission_pct?: number;
  other_fls_royalty_enabled?: boolean;
  other_fls_royalty_pct?: number;
  other_contingency_enabled?: boolean;
  other_contingency_pct?: number;
  other_packing_cost_per_kg?: number;
  other_quality_testing_enabled?: boolean;
  other_quality_testing_desc?: string;
  other_quality_testing_cost?: number;
  solar_subsidy_per_kg?: number;
  income_tax_pct?: number;
  sales_tax_cycleback_enabled?: boolean;
  price_to_quote?: number;
  currency?: string;
  exchange_rate?: number;
  prepared_by?: string;
  checked_by?: string;
  territory_holder?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

export interface FoundryItem {
  id: string;
  rfq_id: string;
  row_order: number;
  qty?: number;
  item_name?: string;
  branch?: string;
  material?: string;
  unit_fin_wt?: number;
  total_fin_wt?: number;
  total_gross_wt?: number;
  shaving_return_per_kg?: number;
  var_cost_per_kg?: number;
  fixed_cost_per_kg?: number;
  total_cost_per_kg?: number;
  total_cost?: number;
  source?: string;
  is_modified?: boolean;
  modified_fields?: string[];
}

export interface MachiningItem {
  id: string;
  rfq_id: string;
  row_order: number;
  qty?: number;
  operation?: string;
  machine_name?: string;
  machining_hours?: number;
  machine_category?: string;
  var_cost_per_hr?: number;
  var_cost_total?: number;
  fixed_cost_per_hr?: number;
  fixed_cost_total?: number;
  total_cost_per_hr?: number;
  total_cost?: number;
  source?: string;
  is_modified?: boolean;
  modified_fields?: string[];
}

export interface VendorItem {
  id: string;
  rfq_id: string;
  row_order: number;
  qty?: number;
  vendor_name?: string;
  machining_operation?: string;
  vendor_cost?: number;
  cost_category?: string;
  total_cost?: number;
}

export interface PurchaseItem {
  id: string;
  rfq_id: string;
  row_order: number;
  qty?: number;
  description?: string;
  type_material?: string;
  cost_basis?: string;
  unit_fin_wt?: number;
  unit_cost?: number;
  shaving_return_per_kg?: number;
  total_cost?: number;
}

export interface HeatTreatItem {
  id: string;
  rfq_id: string;
  row_order: number;
  qty?: number;
  description?: string;
  unit_weight_kg?: number;
  material?: string;
  unit_cost_per_kg?: number;
  total_cost?: number;
}

export interface CompetitionRow {
  id: string;
  rfq_id: string;
  row_order: number;
  supplier?: string;
  customer?: string;
  date?: string;
  product_description?: string;
  value?: number;
  currency?: string;
  weight?: number;
  value_per_kg?: number;
}

export interface ExportShipment {
  id?: string;
  rfq_id?: string;
  incoterms?: string;
  destination?: string;
  shipment_type?: string;
  num_containers?: number;
  usd_rate?: number;
  box_qty?: number;
  box_weight?: number;
  packing_weight_per_part?: number;
  box_dimensions?: string;
  freight_port?: string;
  freight_country?: string;
  freight_kg_per_cbm?: number;
  freight_charges_per_cbm?: number;
  freight_container_charge?: number;
  freight_insurance_pct?: number;
  rate_validity?: string;
  ex_works_price_override?: number;
  ph_charges_override?: number;
  freight_charges_override?: number;
}

export interface ShippingRoute {
  id: string;
  country: string;
  port: string;
  usd_rate?: number;
  multiplier?: number;
  kg_per_cbm?: string;
  lcl_per_cbm?: number;
  container_20_freight?: number;
  container_40_freight?: number;
  fcl_transit_time?: string;
  lcl_transit_time?: string;
}

export interface PHChargeRow {
  id: string;
  description: string;
  lcl_cost?: string;
  container_20_cost?: string;
  container_40_cost?: string;
}

export interface CalculatedResult {
  foundry_items?: Record<string, number>[];
  machining_items?: Record<string, number>[];
  vendor_items?: Record<string, number>[];
  purchase_items?: Record<string, number>[];
  heat_treat_items?: Record<string, number>[];
  foundry: { total: number; per_kg: number; pct_of_total: number; var_total?: number; fixed_total?: number };
  machining: { total: number; per_kg: number; pct_of_total: number; var_total?: number; fixed_total?: number };
  vendor: { total: number; per_kg: number; pct_of_total: number };
  overhead: { cost: number; pct: number; per_kg: number; pct_of_total?: number; usd?: number; total_manufacturing_cost?: number };
  pattern: { on_job: number; per_kg: number; pct_of_total?: number; var_cost?: number; fixed_cost?: number; total_cost?: number; usd?: number };
  purchase: { total: number; per_kg: number; pct_of_total?: number };
  heat_treat: { total: number; per_kg: number; pct_of_total?: number };
  other: {
    total: number; per_kg: number; pct_of_total?: number;
    packing_cost?: number; export_shipment_cost?: number;
    agent_commission_cost?: number; fls_royalty_cost?: number;
    contingency_cost?: number; quality_testing_cost?: number;
  };
  solar: { cost: number; per_kg: number; subsidy_per_kg?: number; total_gross_wt?: number };
  tax: { income_tax_pct?: number; income_tax_amount: number; sales_tax_cycleback?: number; net_income_tax: number };
  summary: {
    var_manf_cost?: number; var_manf_per_kg?: number; var_manf_pct?: number;
    fixed_manf_cost?: number; fixed_manf_per_kg?: number; fixed_manf_pct?: number;
    total_manf_cost: number; total_cost_per_kg: number; total_cost_usd: number;
    total_incl_tax: number; total_incl_tax_per_kg?: number;
  };
  pricing: {
    price_to_quote: number; price_per_kg: number; price_usd: number;
    price_per_kg_usd?: number; currency?: string; exchange_rate?: number;
    net_profit: number; net_profit_usd?: number; profit_pct: number;
  };
}

export interface FullRFQ {
  rfq: RFQSession;
  foundry: FoundryItem[];
  machining: MachiningItem[];
  vendor: VendorItem[];
  purchase: PurchaseItem[];
  heat_treat: HeatTreatItem[];
  competition: CompetitionRow[];
  export_shipment: ExportShipment | null;
  calculated: CalculatedResult;
}

export interface Dropdowns {
  branches: string[];
  materials: { branch: string; material: string }[];
  machine_categories: string[];
  machine_names: string[];
  cost_basis_options: string[];
  currencies: string[];
  incoterms: string[];
  shipment_types: string[];
  sectors: string[];
}

// ── RFQ API ───────────────────────────────────────────────────────────────────

const BASE = (import.meta.env.VITE_API_BASE_URL as string) || "";

async function rfqRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
    ...(init?.headers as Record<string, string> ?? {}),
  };
  const { supabase } = await import("@/app/lib/supabase");
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  // No dev bypass — unauthenticated requests return 401 from the backend

  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.message ?? err.detail ?? `HTTP ${res.status}`);
  }
  return res.json();
}

async function getOrCreateRFQ(projectId: string): Promise<{ rfq_id: string; rfq_number: string }> {
  return rfqRequest<{ rfq_id: string; rfq_number: string }>(
    `/api/v1/projects/${projectId}/rfq`,
    { method: "POST", body: JSON.stringify({}) }
  );
}

export const rfqApi = {
  // Bridge: resolve project → RFQ session (creates one if none exists)
  getOrCreateForProject: getOrCreateRFQ,

  // Create new RFQ session
  createSession: (data?: { customer_name?: string; item_name?: string; rfq_number?: string }) =>
    rfqRequest<{ data: RFQSession }>("/api/sheet/rfq", {
      method: "POST",
      body: JSON.stringify(data ?? {}),
    }),

  // RFQ session list (used by session picker)
  getSessions: (rfqNumber?: string) =>
    rfqRequest<{ data: RFQSession[] }>(`/api/sheet/rfq${rfqNumber ? `?rfq_number=${encodeURIComponent(rfqNumber)}` : ""}`),

  getFullRFQ: (rfqId: string) =>
    rfqRequest<FullRFQ>(`/api/sheet/rfq/${rfqId}/full`),

  // RFQ header
  updateRFQ: (rfqId: string, data: Partial<RFQSession>) =>
    rfqRequest<{ data: RFQSession }>(`/api/sheet/rfq/${rfqId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  calculate: (rfqId: string) =>
    rfqRequest<{ data: CalculatedResult }>(`/api/sheet/rfq/${rfqId}/calculate`),

  // Foundry
  getFoundry: (rfqId: string) =>
    rfqRequest<{ data: FoundryItem[] }>(`/api/sheet/rfq/${rfqId}/foundry`),
  updateFoundry: (id: string, data: Partial<FoundryItem>) =>
    rfqRequest<{ data: FoundryItem }>(`/api/sheet/foundry/${id}`, {
      method: "PATCH", body: JSON.stringify(data),
    }),
  addFoundry: (rfqId: string) =>
    rfqRequest<{ data: FoundryItem }>(`/api/sheet/rfq/${rfqId}/foundry`, { method: "POST" }),
  deleteFoundry: (id: string) =>
    rfqRequest<{ message: string }>(`/api/sheet/foundry/${id}`, { method: "DELETE" }),

  // Machining
  getMachining: (rfqId: string) =>
    rfqRequest<{ data: MachiningItem[] }>(`/api/sheet/rfq/${rfqId}/machining`),
  updateMachining: (id: string, data: Partial<MachiningItem>) =>
    rfqRequest<{ data: MachiningItem }>(`/api/sheet/machining/${id}`, {
      method: "PATCH", body: JSON.stringify(data),
    }),
  addMachining: (rfqId: string) =>
    rfqRequest<{ data: MachiningItem }>(`/api/sheet/rfq/${rfqId}/machining`, { method: "POST" }),
  deleteMachining: (id: string) =>
    rfqRequest<{ message: string }>(`/api/sheet/machining/${id}`, { method: "DELETE" }),

  // Vendor
  getVendor: (rfqId: string) =>
    rfqRequest<{ data: VendorItem[] }>(`/api/sheet/rfq/${rfqId}/vendor`),
  updateVendor: (id: string, data: Partial<VendorItem>) =>
    rfqRequest<{ data: VendorItem }>(`/api/sheet/vendor/${id}`, {
      method: "PATCH", body: JSON.stringify(data),
    }),
  addVendor: (rfqId: string) =>
    rfqRequest<{ data: VendorItem }>(`/api/sheet/rfq/${rfqId}/vendor`, { method: "POST" }),
  deleteVendor: (id: string) =>
    rfqRequest<{ message: string }>(`/api/sheet/vendor/${id}`, { method: "DELETE" }),

  // Purchase
  getPurchase: (rfqId: string) =>
    rfqRequest<{ data: PurchaseItem[] }>(`/api/sheet/rfq/${rfqId}/purchase`),
  updatePurchase: (id: string, data: Partial<PurchaseItem>) =>
    rfqRequest<{ data: PurchaseItem }>(`/api/sheet/purchase/${id}`, {
      method: "PATCH", body: JSON.stringify(data),
    }),
  addPurchase: (rfqId: string) =>
    rfqRequest<{ data: PurchaseItem }>(`/api/sheet/rfq/${rfqId}/purchase`, { method: "POST" }),
  deletePurchase: (id: string) =>
    rfqRequest<{ message: string }>(`/api/sheet/purchase/${id}`, { method: "DELETE" }),

  // Heat Treatment
  getHeatTreat: (rfqId: string) =>
    rfqRequest<{ data: HeatTreatItem[] }>(`/api/sheet/rfq/${rfqId}/heat-treat`),
  updateHeatTreat: (id: string, data: Partial<HeatTreatItem>) =>
    rfqRequest<{ data: HeatTreatItem }>(`/api/sheet/heat-treat/${id}`, {
      method: "PATCH", body: JSON.stringify(data),
    }),
  addHeatTreat: (rfqId: string) =>
    rfqRequest<{ data: HeatTreatItem }>(`/api/sheet/rfq/${rfqId}/heat-treat`, { method: "POST" }),
  deleteHeatTreat: (id: string) =>
    rfqRequest<{ message: string }>(`/api/sheet/heat-treat/${id}`, { method: "DELETE" }),

  // Competition
  getCompetition: (rfqId: string) =>
    rfqRequest<{ data: CompetitionRow[] }>(`/api/sheet/rfq/${rfqId}/competition`),
  addCompetition: (rfqId: string) =>
    rfqRequest<{ data: CompetitionRow }>(`/api/sheet/rfq/${rfqId}/competition`, { method: "POST" }),
  updateCompetition: (id: string, data: Partial<CompetitionRow>) =>
    rfqRequest<{ data: CompetitionRow }>(`/api/sheet/competition/${id}`, {
      method: "PATCH", body: JSON.stringify(data),
    }),
  deleteCompetition: (id: string) =>
    rfqRequest<{ message: string }>(`/api/sheet/competition/${id}`, { method: "DELETE" }),

  // Export Shipment
  getExportShipment: (rfqId: string) =>
    rfqRequest<{ data: ExportShipment }>(`/api/sheet/rfq/${rfqId}/export-shipment`),
  updateExportShipment: (rfqId: string, data: Partial<ExportShipment>) =>
    rfqRequest<{ data: ExportShipment }>(`/api/sheet/rfq/${rfqId}/export-shipment`, {
      method: "PATCH", body: JSON.stringify(data),
    }),

  // Reference Data
  getDropdowns: () =>
    rfqRequest<Dropdowns>("/api/reference/dropdowns"),
  getMaterials: () =>
    rfqRequest<{ data: unknown[] }>("/api/reference/materials"),
  addMaterial: (branch: string = "QBL II") =>
    rfqRequest<{ data: unknown }>("/api/reference/materials", {
      method: "POST", body: JSON.stringify({ branch }),
    }),
  updateMaterial: (id: string, data: Record<string, unknown>) =>
    rfqRequest<{ data: unknown }>(`/api/reference/materials/${id}`, {
      method: "PATCH", body: JSON.stringify(data),
    }),
  deleteMaterial: (id: string) =>
    rfqRequest<{ message: string }>(`/api/reference/materials/${id}`, { method: "DELETE" }),

  getMachines: () =>
    rfqRequest<{ data: unknown[] }>("/api/reference/machines"),
  addMachine: () =>
    rfqRequest<{ data: unknown }>("/api/reference/machines", { method: "POST" }),
  updateMachine: (id: string, data: Record<string, unknown>) =>
    rfqRequest<{ data: unknown }>(`/api/reference/machines/${id}`, {
      method: "PATCH", body: JSON.stringify(data),
    }),
  deleteMachine: (id: string) =>
    rfqRequest<{ message: string }>(`/api/reference/machines/${id}`, { method: "DELETE" }),

  getPHCharges: () =>
    rfqRequest<{ data: PHChargeRow[] }>("/api/reference/ph-charges"),
  addPHCharge: () =>
    rfqRequest<{ data: PHChargeRow }>("/api/reference/ph-charges", { method: "POST" }),
  updatePHCharge: (id: string, data: Partial<PHChargeRow>) =>
    rfqRequest<{ data: PHChargeRow }>(`/api/reference/ph-charges/${id}`, {
      method: "PATCH", body: JSON.stringify(data),
    }),
  deletePHCharge: (id: string) =>
    rfqRequest<{ message: string }>(`/api/reference/ph-charges/${id}`, { method: "DELETE" }),

  getShipping: () =>
    rfqRequest<{ data: ShippingRoute[] }>("/api/reference/shipping"),
  addShipping: () =>
    rfqRequest<{ data: ShippingRoute }>("/api/reference/shipping", { method: "POST" }),
  updateShipping: (id: string, data: Partial<ShippingRoute>) =>
    rfqRequest<{ data: ShippingRoute }>(`/api/reference/shipping/${id}`, {
      method: "PATCH", body: JSON.stringify(data),
    }),
  deleteShipping: (id: string) =>
    rfqRequest<{ message: string }>(`/api/reference/shipping/${id}`, { method: "DELETE" }),

  // Excel Export
  downloadExcel: async (rfqId: string, rfqNumber: string): Promise<void> => {
    const headers: Record<string, string> = {
      "ngrok-skip-browser-warning": "true",
    };
    const { supabase } = await import("@/app/lib/supabase");
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    // No dev bypass — unauthenticated requests return 401 from the backend

    const r = await fetch(`${BASE}/api/export/rfq/${rfqId}/excel`, { headers });
    if (!r.ok) throw new Error("Export failed");
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${rfqNumber}_cost_estimation.xlsm`;
    a.click();
    URL.revokeObjectURL(url);
  },
};
