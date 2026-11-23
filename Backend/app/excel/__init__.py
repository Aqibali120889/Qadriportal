"""
app/excel/
──────────────────────────────────────────────────────────────────────────────
Self-contained Excel Cost Estimation submodule.

Uses the enterprise Supabase credentials (SUPABASE_URL + SUPABASE_SERVICE_KEY)
from the enterprise .env. No separate credential file needed.

Tables in enterprise DB (applied via migration):
  rfq_sessions, foundry_items, machining_items, vendor_items,
  purchase_items, heat_treat_items, competition_data, change_log,
  export_shipment, cost_report_materials, cost_report_machines,
  standard_ph_charges, shipping_routes
"""
