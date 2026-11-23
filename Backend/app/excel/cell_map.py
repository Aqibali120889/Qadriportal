"""
cell_map.py
===========
Complete mapping of every input field in the Excel template
to its exact cell address. Built from the analyzed JSON output.

Cell types:
  input        = user writes value here
  input_simple = has simple arithmetic formula, safe to overwrite
  vlookup_key  = write this, VLOOKUP auto-calculates dependent cells
  formula      = NEVER touch — Excel calculates automatically
  readonly     = calculated result we display but never write
"""

SHEET_NAME = "Cost Work Sheet#47"

# ══════════════════════════════════════════════════════════════
# HEADER SECTION (Rows 1-5)
# ══════════════════════════════════════════════════════════════
HEADER_MAP = {
    "estimation_date":        {"cell": "P1",  "type": "input"},
    "customer_name":          {"cell": "B2",  "type": "input"},
    "item_name":              {"cell": "G2",  "type": "input"},
    "enq_ref":                {"cell": "K2",  "type": "input"},
    "enq_date":               {"cell": "N2",  "type": "input"},
    "drawing_number":         {"cell": "P2",  "type": "input"},
    "req_qty":                {"cell": "B3",  "type": "input"},
    "total_fin_wt_kg":        {"cell": "G3",  "type": "input"},
    "notes":                  {"cell": "K3",  "type": "input"},
    "estimated_process_time": {"cell": "C4",  "type": "input"},
}

# ══════════════════════════════════════════════════════════════
# ELEMENT 1 — FOUNDRY COST (Row 11)
# ══════════════════════════════════════════════════════════════
# E10 = material template row (VLOOKUP source)
# Row 11 = actual data row

FOUNDRY_TEMPLATE_ROW = 10   # E10 has the material for VLOOKUP
FOUNDRY_DATA_ROW = 11

FOUNDRY_MAP = {
    "material_template":      {"cell": "E10", "type": "vlookup_key"},  # sets VLOOKUP
    "qty":                    {"cell": "A11", "type": "input"},
    "item_name":              {"cell": "B11", "type": "input"},
    "branch":                 {"cell": "D11", "type": "input"},
    "material":               {"cell": "E11", "type": "input"},        # also vlookup key
    "unit_fin_wt":            {"cell": "G11", "type": "input"},        # was simple formula
    "total_fin_wt":           {"cell": "H11", "type": "input"},        # was simple formula
    "total_gross_wt":         {"cell": "I11", "type": "input"},        # was simple formula
    "shaving_return_per_kg":  {"cell": "J11", "type": "input"},
    # K11 = var cost/kg  → VLOOKUP result, read only
    # L11 = var cost total → formula, read only
    # M11 = fixed cost/kg → formula, read only
    # N11 = fixed cost total → formula, read only
    # P11 = total cost/kg → formula, read only
    # Q11 = total cost → formula, read only
    # E12 = var rate display
    # F12 = fixed rate display
    # L13 = total variable foundry cost → formula
    # N13 = total fixed foundry cost → formula
    # P13 = total foundry cost → formula
    # P14 = per kg rate → formula
    # Q14 = % of total → formula
}

# ══════════════════════════════════════════════════════════════
# ELEMENT 2 — IN-HOUSE MACHINING (Rows 19-26)
# ══════════════════════════════════════════════════════════════
MACHINING_START_ROW = 19
MACHINING_END_ROW = 26

MACHINING_COL_MAP = {
    "qty":              {"col": "A", "type": "input"},
    "operation":        {"col": "B", "type": "input"},
    "machine_name":     {"col": "F", "type": "input"},
    "machining_hours":  {"col": "H", "type": "input"},
    "machine_category": {"col": "J", "type": "input"},   # VLOOKUP key
    # L = var cost/hr  → VLOOKUP result, read only
    # M = var cost total → formula, read only
    # N = fixed cost/hr → VLOOKUP result, read only
    # O = fixed cost total → formula, read only
    # P = total cost/hr → formula, read only
    # Q = total cost → formula, read only
}
# L27 = total var machining → formula
# N27 = total fixed machining → formula
# P27 = total machining cost → formula
# P28 = per kg rate → formula
# Q28 = % of total → formula

# ══════════════════════════════════════════════════════════════
# ELEMENT 3 — VENDOR MACHINING (Rows 33-34)
# ══════════════════════════════════════════════════════════════
VENDOR_START_ROW = 33
VENDOR_END_ROW = 34

VENDOR_COL_MAP = {
    "qty":                {"col": "A",  "type": "input"},
    "vendor_name":        {"col": "B",  "type": "input"},
    "machining_operation":{"col": "D",  "type": "input"},
    "vendor_cost":        {"col": "I",  "type": "input"},
    "cost_category":      {"col": "K",  "type": "input"},
    # P = total cost → formula
}
# P35 = total vendor cost → formula

# ══════════════════════════════════════════════════════════════
# ELEMENT 4 — CORPORATE OVERHEAD (Row 39)
# ══════════════════════════════════════════════════════════════
OVERHEAD_MAP = {
    "overhead_pct": {"cell": "D39", "type": "input"},
    # J39 = total manufacturing cost → formula
    # P39 = QG corporate cost → formula
    # P40 = USD equivalent → formula
    # P41 = per kg rate → formula
    # Q41 = % of total → formula
}

# ══════════════════════════════════════════════════════════════
# ELEMENT 5 — PATTERN COST (Row 44)
# ══════════════════════════════════════════════════════════════
PATTERN_MAP = {
    "pattern_var_cost":    {"cell": "B44", "type": "input"},
    "pattern_fixed_cost":  {"cell": "E44", "type": "input"},
    "pattern_division_qty":{"cell": "L44", "type": "input"},
    # H44 = total pattern cost → formula
    # I44 = USD equivalent → formula
    # P44 = pattern cost on job → formula
    # P45 = per kg rate → formula
    # Q45 = % of total → formula
}

# ══════════════════════════════════════════════════════════════
# ELEMENT 6 — PURCHASE COST (Rows 50-53)
# ══════════════════════════════════════════════════════════════
PURCHASE_START_ROW = 50
PURCHASE_END_ROW = 53

PURCHASE_COL_MAP = {
    "qty":                       {"col": "A",  "type": "input"},
    "description":               {"col": "B",  "type": "input"},
    "type_material":             {"col": "F",  "type": "input"},
    "cost_basis":                {"col": "H",  "type": "input"},
    "unit_fin_wt":               {"col": "I",  "type": "input"},
    "total_purchase_qty_finished":{"col": "J", "type": "input"},
    "total_purchase_qty_gross":  {"col": "K",  "type": "input"},
    "unit_cost":                 {"col": "L",  "type": "input"},
    "shaving_return_per_kg":     {"col": "N",  "type": "input"},
    # O = shaving return total → formula
    # P = total cost → formula
}
# P54 = total purchase cost → formula

# ══════════════════════════════════════════════════════════════
# ELEMENT 7 — HEAT TREATMENT (Row 60)
# ══════════════════════════════════════════════════════════════
HEAT_TREAT_START_ROW = 60
HEAT_TREAT_END_ROW = 60

HEAT_TREAT_COL_MAP = {
    "qty":              {"col": "A",  "type": "input"},
    "description":      {"col": "B",  "type": "input"},
    "unit_weight_kg":   {"col": "J",  "type": "input"},
    "material":         {"col": "L",  "type": "input"},
    "unit_cost_per_kg": {"col": "N",  "type": "input"},
    # P = total cost → formula
}
# P61 = total heat treatment → formula

# ══════════════════════════════════════════════════════════════
# ELEMENT 8 — OTHER COSTS (Rows 67-72)
# ══════════════════════════════════════════════════════════════
OTHER_COSTS_MAP = {
    # Row 67 - Packing
    "other_packing_enabled":            {"cell": "A67", "type": "input"},
    # Row 68 - Export Shipment
    "other_export_shipment_enabled":    {"cell": "A68", "type": "input"},
    # Row 69 - Agent Commission
    "other_agent_commission_enabled":   {"cell": "A69", "type": "input"},
    "other_agent_commission_pct":       {"cell": "G69", "type": "input"},
    # Row 70 - FLS Royalty
    "other_fls_royalty_enabled":        {"cell": "A70", "type": "input"},
    # Row 71 - Cost Contingency
    "other_contingency_enabled":        {"cell": "A71", "type": "input"},
    # Row 72 - Quality Testing
    "other_quality_testing_enabled":    {"cell": "A72", "type": "input"},
    "other_quality_testing_desc":       {"cell": "G72", "type": "input"},
    "other_quality_testing_cost":       {"cell": "P72", "type": "input"},
    # P74 = total other costs → formula
    # P75 = per kg rate → formula
    # Q75 = % of total → formula
}

# ══════════════════════════════════════════════════════════════
# ELEMENT 9 — SOLAR SUBSIDY (Row 78)
# ══════════════════════════════════════════════════════════════
SOLAR_MAP = {
    "solar_subsidy_per_kg": {"cell": "C78", "type": "input"},
    # J78 = total gross wt → linked from foundry
    # P78 = cost subsidy on job → formula
}

# ══════════════════════════════════════════════════════════════
# ELEMENT 10 — TAX (Row 82)
# ══════════════════════════════════════════════════════════════
TAX_MAP = {
    "income_tax_pct": {"cell": "C82", "type": "input"},
    # E82 = income tax amount → formula
    # K82 = sales tax cycle back → formula
    # P82 = income tax total → formula
}

# ══════════════════════════════════════════════════════════════
# PRICING SECTION (Rows 89-91)
# ══════════════════════════════════════════════════════════════
PRICING_MAP = {
    "price_to_quote": {"cell": "I89", "type": "input"},
    "currency":       {"cell": "M89", "type": "input"},
    "exchange_rate":  {"cell": "M90", "type": "input"},
    # D89 = formula
    # D90 = formula
    # C91 = net profit markup % → formula or input?
    # E91 = net profit value → formula
    # I91 = USD equivalent → formula
}

# ══════════════════════════════════════════════════════════════
# SIGN OFF (Row 93)
# ══════════════════════════════════════════════════════════════
SIGNOFF_MAP = {
    "prepared_by":     {"cell": "C93", "type": "input"},
    "checked_by":      {"cell": "H93", "type": "input"},
    "territory_holder":{"cell": "N93", "type": "input"},
}

# ══════════════════════════════════════════════════════════════
# COMPETITION DATA (Rows 98+)
# ══════════════════════════════════════════════════════════════
COMPETITION_START_ROW = 98
COMPETITION_END_ROW = 103

COMPETITION_COL_MAP = {
    "row_order":          {"col": "A",  "type": "input"},
    "supplier":           {"col": "B",  "type": "input"},
    "customer":           {"col": "D",  "type": "input"},
    "date":               {"col": "F",  "type": "input"},
    "product_description":{"col": "G",  "type": "input"},
    "value":              {"col": "L",  "type": "input"},
    "currency":           {"col": "N",  "type": "input"},
    "weight":             {"col": "O",  "type": "input"},
    "value_per_kg":       {"col": "Q",  "type": "input"},
}

# ══════════════════════════════════════════════════════════════
# VALID VALUES (for VLOOKUP compatibility)
# ══════════════════════════════════════════════════════════════
VALID_MACHINE_CATEGORIES = [
    "Large", "Medium", "Small",
    "Fabrication & Welding - QEN",
    "Fitter Section - QEN",
    "Fitter Section ― QEN",
    "Fabrication & Welding - Qadbros",
    "Fitter Section - Qadbros",
]

VALID_BRANCHES = ["QBL II", "QCL", "Qadbros"]

VALID_SECTORS = [
    "Cement (Local)", "Cement (FLS Export)", "Cement (Export)",
    "Paper & Board", "Fertilizer", "Chemical", "Steel",
    "Power", "Mining", "Sugar (Local)", "Sugar (Export)",
    "Engineering and Construction", "Misc.", "None"
]
