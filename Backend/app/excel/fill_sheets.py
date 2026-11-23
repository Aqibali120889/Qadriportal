"""
app/excel/fill_sheets.py
────────────────────────────────────────────────────────────────────────────
Uses cell_map.py to write data from the database into the Excel template.
Every write goes through safe_write() to protect formulas.

Adapted from rfq-dashboard fill_sheets.py — only the import paths changed.
"""
import openpyxl
import os
from datetime import datetime, date
from typing import List, Dict, Optional

from app.excel.cell_map import (
    SHEET_NAME,
    HEADER_MAP, FOUNDRY_MAP,
    MACHINING_START_ROW, MACHINING_END_ROW, MACHINING_COL_MAP,
    VENDOR_START_ROW, VENDOR_END_ROW, VENDOR_COL_MAP,
    OVERHEAD_MAP, PATTERN_MAP,
    PURCHASE_START_ROW, PURCHASE_END_ROW, PURCHASE_COL_MAP,
    HEAT_TREAT_START_ROW, HEAT_TREAT_END_ROW, HEAT_TREAT_COL_MAP,
    OTHER_COSTS_MAP, SOLAR_MAP, TAX_MAP,
    PRICING_MAP, SIGNOFF_MAP,
    COMPETITION_START_ROW, COMPETITION_END_ROW, COMPETITION_COL_MAP,
    VALID_MACHINE_CATEGORIES,
)


def safe_write(ws, cell_ref: str, value, label: str = "") -> bool:
    """Never overwrite a complex formula. Safe to overwrite simple values."""
    try:
        cell = ws[cell_ref]
        current = cell.value
        if isinstance(current, str) and current.startswith("="):
            complex_fns = ["VLOOKUP", "SUM", "IFERROR", "IF(", "INDEX",
                           "MATCH", "SUMIF", "COUNTIF", "AVERAGE", "ROUND",
                           "INDIRECT", "OFFSET", "COUNTA"]
            upper = current.upper()
            if any(fn in upper for fn in complex_fns):
                return False
        cell.value = value
        return True
    except Exception as e:
        print(f"  ERROR {cell_ref}: {e}")
        return False


def safe_write_bool_as_text(ws, cell_ref: str, value: bool, label: str = "") -> bool:
    text = "Yes" if value else "No"
    return safe_write(ws, cell_ref, text, label)


def validate_machine_category(category: str) -> str:
    if category in VALID_MACHINE_CATEGORIES:
        return category
    cat_lower = (category or "").lower()
    if "large" in cat_lower: return "Large"
    if "medium" in cat_lower: return "Medium"
    if "fitter" in cat_lower: return "Fitter Section — QEN"
    if "weld" in cat_lower or "fab" in cat_lower: return "Fabrication & Welding - QEN"
    return "Small"


def export_to_excel(
    rfq_data: Dict,
    foundry_items: List[Dict],
    machining_items: List[Dict],
    vendor_items: List[Dict],
    purchase_items: List[Dict],
    heat_treat_items: List[Dict],
    competition_rows: List[Dict],
    template_path: str,
    output_path: str,
    export_shipment_data: Optional[Dict] = None,
) -> str:
    if not os.path.exists(template_path):
        raise FileNotFoundError(
            f"Template not found: {template_path}\n"
            "Place cost_template.xlsm in Backend/app/excel/templates/"
        )

    is_xlsm = template_path.endswith(".xlsm")
    wb = openpyxl.load_workbook(template_path, keep_vba=is_xlsm)

    ws = None
    for name in wb.sheetnames:
        if "cost work" in name.lower() or "47" in name:
            ws = wb[name]
            break
    if ws is None:
        ws = wb.active

    _write_header(ws, rfq_data)
    _write_foundry(ws, foundry_items)
    _write_machining(ws, machining_items, rfq_data.get("req_qty", 1))
    _write_vendor(ws, vendor_items, rfq_data.get("req_qty", 1))
    _write_overhead(ws, rfq_data)
    _write_pattern(ws, rfq_data, wb)
    _write_purchase(ws, purchase_items)
    _write_heat_treat(ws, heat_treat_items)
    _write_other_costs(ws, rfq_data)
    _write_solar(ws, rfq_data)
    _write_tax(ws, rfq_data, wb)
    _write_pricing(ws, rfq_data)
    _write_signoff(ws, rfq_data)
    _write_competition(ws, competition_rows)

    if export_shipment_data:
        _write_export_shipment(wb, export_shipment_data)

    wb.save(output_path)
    wb.close()
    return output_path


def _write_export_shipment(wb, es: Dict):
    ws_exp = None
    for name in wb.sheetnames:
        if "export shipment" in name.lower():
            ws_exp = wb[name]
            break
    if not ws_exp:
        return
    if es.get("incoterms"): safe_write(ws_exp, "F1", es["incoterms"], "incoterms")
    if es.get("destination"): safe_write(ws_exp, "E2", es["destination"], "destination")
    if es.get("shipment_type"): safe_write(ws_exp, "F3", es["shipment_type"], "shipment_type")
    if es.get("num_containers") is not None: safe_write(ws_exp, "F4", es["num_containers"], "num_containers")
    if es.get("usd_rate") is not None: safe_write(ws_exp, "F5", es["usd_rate"], "usd_rate")
    if es.get("box_dimensions"): safe_write(ws_exp, "D2", es["box_dimensions"], "box_dimensions")
    if es.get("box_qty") is not None: safe_write(ws_exp, "D3", es["box_qty"], "box_qty")
    if es.get("box_weight") is not None: safe_write(ws_exp, "D4", es["box_weight"], "box_weight")
    if es.get("freight_port"): safe_write(ws_exp, "B26", es["freight_port"], "freight_port")
    if es.get("freight_insurance_pct") is not None: safe_write(ws_exp, "F30", es["freight_insurance_pct"], "freight_insurance_pct")
    if es.get("rate_validity"): safe_write(ws_exp, "B33", es["rate_validity"], "rate_validity")


def _write_header(ws, rfq: Dict):
    field_map = {
        "customer_name": "B2", "item_name": "G2", "enq_ref": "K2",
        "drawing_number": "P2", "req_qty": "B3", "total_fin_wt_kg": "G3",
        "estimated_process_time": "C4",
    }
    for field, cell in field_map.items():
        if rfq.get(field) is not None:
            safe_write(ws, cell, rfq[field], field)
    if rfq.get("notes"):
        lines = str(rfq["notes"]).split("\n")
        note_cells = ["K3", "K4", "K5", "K6"]
        for idx, line in enumerate(lines):
            if idx < len(note_cells):
                safe_write(ws, note_cells[idx], line.strip(), f"notes_line_{idx+1}")
    if rfq.get("estimation_date"):
        safe_write(ws, "P1", str(rfq["estimation_date"]), "estimation_date")
    if rfq.get("enq_date"):
        safe_write(ws, "N2", str(rfq["enq_date"]), "enq_date")


def _write_foundry(ws, items: List[Dict]):
    if not items:
        return
    item = items[0]
    if item.get("material"): safe_write(ws, "E10", item["material"], "material_template")
    if item.get("qty") is not None: safe_write(ws, "A11", item["qty"], "qty")
    if item.get("item_name"): safe_write(ws, "B11", item["item_name"], "item_name")
    if item.get("branch"): safe_write(ws, "D11", item["branch"], "branch")
    if item.get("material"): safe_write(ws, "E11", item["material"], "material")
    if item.get("unit_fin_wt") is not None: safe_write(ws, "G11", item["unit_fin_wt"], "unit_fin_wt")
    if item.get("total_fin_wt") is not None: safe_write(ws, "H11", item["total_fin_wt"], "total_fin_wt")
    if item.get("total_gross_wt") is not None: safe_write(ws, "I11", item["total_gross_wt"], "total_gross_wt")
    if item.get("shaving_return_per_kg") is not None: safe_write(ws, "J11", item["shaving_return_per_kg"], "shaving_return")


def _write_machining(ws, items: List[Dict], default_qty: int = 1):
    if not items:
        return
    for row in range(MACHINING_START_ROW, MACHINING_END_ROW + 1):
        for col_key, col_info in MACHINING_COL_MAP.items():
            cell_ref = f"{col_info['col']}{row}"
            cell = ws[cell_ref]
            if cell.value is not None:
                current = cell.value
                if not (isinstance(current, str) and current.startswith("=")):
                    cell.value = None
    for i, item in enumerate(items[:8]):
        row = MACHINING_START_ROW + i
        qty = item.get("qty", default_qty) or default_qty
        safe_write(ws, f"A{row}", qty, "qty")
        if item.get("operation"): safe_write(ws, f"B{row}", item["operation"], "operation")
        if item.get("machine_name"): safe_write(ws, f"F{row}", item["machine_name"], "machine")
        if item.get("machining_hours") is not None: safe_write(ws, f"H{row}", item["machining_hours"], "hours")
        if item.get("machine_category"):
            cat = validate_machine_category(item["machine_category"])
            safe_write(ws, f"J{row}", cat, "category")


def _write_vendor(ws, items: List[Dict], default_qty: int = 1):
    if not items:
        return
    for i, item in enumerate(items[:2]):
        row = VENDOR_START_ROW + i
        if item.get("qty"): safe_write(ws, f"A{row}", item["qty"], "qty")
        if item.get("vendor_name"): safe_write(ws, f"B{row}", item["vendor_name"], "vendor")
        if item.get("machining_operation"): safe_write(ws, f"D{row}", item["machining_operation"], "operation")
        if item.get("vendor_cost") is not None: safe_write(ws, f"I{row}", item["vendor_cost"], "cost")
        if item.get("cost_category"): safe_write(ws, f"K{row}", item["cost_category"], "category")


def _write_overhead(ws, rfq: Dict):
    if rfq.get("overhead_pct") is not None:
        safe_write(ws, "D39", rfq["overhead_pct"], "overhead_pct")


def _write_pattern(ws, rfq: Dict, wb=None):
    if rfq.get("pattern_var_cost") is not None: safe_write(ws, "B44", rfq["pattern_var_cost"], "var_cost")
    if rfq.get("pattern_fixed_cost") is not None: safe_write(ws, "E44", rfq["pattern_fixed_cost"], "fixed_cost")
    if rfq.get("pattern_division_qty") is not None: safe_write(ws, "L44", rfq["pattern_division_qty"], "division_qty")
    if wb and "Dropdown List" in wb.sheetnames:
        wb["Dropdown List"]["J2"].value = bool(rfq.get("pattern_in_stock"))


def _write_purchase(ws, items: List[Dict]):
    if not items:
        return
    for i, item in enumerate(items[:4]):
        row = PURCHASE_START_ROW + i
        if item.get("qty"): safe_write(ws, f"A{row}", item["qty"], "qty")
        if item.get("description"): safe_write(ws, f"B{row}", item["description"], "desc")
        if item.get("type_material"): safe_write(ws, f"F{row}", item["type_material"], "material")
        if item.get("cost_basis"): safe_write(ws, f"H{row}", item["cost_basis"], "cost_basis")
        if item.get("unit_fin_wt"): safe_write(ws, f"I{row}", item["unit_fin_wt"], "unit_fin_wt")
        if item.get("unit_cost"): safe_write(ws, f"L{row}", item["unit_cost"], "unit_cost")


def _write_heat_treat(ws, items: List[Dict]):
    if not items:
        return
    item = items[0]
    if item.get("qty"): safe_write(ws, "A60", item["qty"], "qty")
    if item.get("description"): safe_write(ws, "B60", item["description"], "desc")
    if item.get("unit_weight_kg"): safe_write(ws, "J60", item["unit_weight_kg"], "unit_weight")
    if item.get("material"): safe_write(ws, "L60", item["material"], "material")
    if item.get("unit_cost_per_kg"): safe_write(ws, "N60", item["unit_cost_per_kg"], "unit_cost")


def _write_other_costs(ws, rfq: Dict):
    safe_write_bool_as_text(ws, "A67", rfq.get("other_packing_enabled", False), "packing")
    safe_write_bool_as_text(ws, "A68", rfq.get("other_export_shipment_enabled", False), "export_shipment")
    safe_write_bool_as_text(ws, "A69", rfq.get("other_agent_commission_enabled", False), "agent_comm")
    if rfq.get("other_agent_commission_pct") is not None:
        safe_write(ws, "G69", rfq["other_agent_commission_pct"], "agent_pct")
    safe_write_bool_as_text(ws, "A70", rfq.get("other_fls_royalty_enabled", False), "fls_royalty")
    safe_write_bool_as_text(ws, "A71", rfq.get("other_contingency_enabled", False), "contingency")
    safe_write_bool_as_text(ws, "A72", rfq.get("other_quality_testing_enabled", False), "quality_testing")
    if rfq.get("other_quality_testing_desc"):
        safe_write(ws, "G72", rfq["other_quality_testing_desc"], "testing_desc")
    if rfq.get("other_quality_testing_cost") is not None:
        safe_write(ws, "P72", rfq["other_quality_testing_cost"], "testing_cost")


def _write_solar(ws, rfq: Dict):
    if rfq.get("solar_subsidy_per_kg") is not None:
        safe_write(ws, "C78", rfq["solar_subsidy_per_kg"], "solar_subsidy")


def _write_tax(ws, rfq: Dict, wb=None):
    if rfq.get("income_tax_pct") is not None:
        safe_write(ws, "C82", rfq["income_tax_pct"], "income_tax_pct")
    if wb and "Dropdown List" in wb.sheetnames:
        wb["Dropdown List"]["I2"].value = bool(rfq.get("sales_tax_cycleback_enabled"))


def _write_pricing(ws, rfq: Dict):
    if rfq.get("price_to_quote") is not None: safe_write(ws, "I89", rfq["price_to_quote"], "price_to_quote")
    if rfq.get("currency"): safe_write(ws, "M89", rfq["currency"], "currency")
    if rfq.get("exchange_rate") is not None: safe_write(ws, "M90", rfq["exchange_rate"], "exchange_rate")


def _write_signoff(ws, rfq: Dict):
    if rfq.get("prepared_by"): safe_write(ws, "C93", rfq["prepared_by"], "prepared_by")
    if rfq.get("checked_by"): safe_write(ws, "H93", rfq["checked_by"], "checked_by")
    if rfq.get("territory_holder"): safe_write(ws, "N93", rfq["territory_holder"], "territory_holder")


def _write_competition(ws, rows: List[Dict]):
    if not rows:
        return
    for i, row_data in enumerate(rows[:6]):
        row = COMPETITION_START_ROW + i
        if row_data.get("supplier"): safe_write(ws, f"B{row}", row_data["supplier"], "supplier")
        if row_data.get("customer"): safe_write(ws, f"D{row}", row_data["customer"], "customer")
        if row_data.get("date"): safe_write(ws, f"F{row}", row_data["date"], "date")
        if row_data.get("product_description"): safe_write(ws, f"G{row}", row_data["product_description"], "desc")
        if row_data.get("value"): safe_write(ws, f"L{row}", row_data["value"], "value")
        if row_data.get("currency"): safe_write(ws, f"N{row}", row_data["currency"], "currency")
        if row_data.get("weight"): safe_write(ws, f"O{row}", row_data["weight"], "weight")
        if row_data.get("value_per_kg"): safe_write(ws, f"Q{row}", row_data["value_per_kg"], "val_per_kg")
