"""
app/excel/calculator.py
────────────────────────────────────────────────────────────────────────────
Server-side formula engine that replicates all Excel formulas.
Returns all computed/derived values so the frontend can display them.
Zero business logic changes from the original rfq-dashboard calculator.
"""
from typing import Dict, List, Optional


def calculate_rfq(
    rfq: Dict,
    foundry_items: List[Dict],
    machining_items: List[Dict],
    vendor_items: List[Dict],
    purchase_items: List[Dict],
    heat_treat_items: List[Dict],
    export_shipment: Optional[Dict] = None,
    machine_rates: Optional[List[Dict]] = None,
    material_rates: Optional[List[Dict]] = None,
) -> Dict:
    """Calculate all derived values for an RFQ, replicating Excel formulas."""

    req_qty = int(rfq.get("req_qty") or 1)
    exchange_rate = float(rfq.get("exchange_rate") or 270)

    calc_foundry_fin_wt = sum(float(f.get("qty") or 1) * float(f.get("unit_fin_wt") or 0) for f in foundry_items)
    calc_purchase_fin_wt = sum(
        float(p.get("total_purchase_qty_finished") or (float(p.get("qty") or 1) * float(p.get("unit_fin_wt") or 0)))
        for p in purchase_items
    )
    dynamic_total_fin_wt = calc_foundry_fin_wt + calc_purchase_fin_wt
    total_fin_wt = dynamic_total_fin_wt if dynamic_total_fin_wt > 0 else float(rfq.get("total_fin_wt_kg") or 0)

    rate_lookup = {}
    if machine_rates:
        for mr in machine_rates:
            rate_lookup[mr["machine_family"]] = mr

    mat_lookup = {}
    if material_rates:
        for mat in material_rates:
            mat_lookup[(mat.get("branch"), mat.get("material"))] = mat
            mat_lookup[mat.get("material")] = mat

    # ── Element 1: Foundry ──────────────────────────────────
    foundry_calc = []
    for item in foundry_items:
        qty = float(item.get("qty") or 1)
        unit_fin_wt = float(item.get("unit_fin_wt") or 0)
        gross_wt = float(item.get("total_gross_wt") or 0)
        calc_total_fin_wt = qty * unit_fin_wt
        material_name = item.get("material") or ""
        branch_name = item.get("branch") or ""
        mat = mat_lookup.get((branch_name, material_name)) or mat_lookup.get(material_name)
        if not mat:
            aliases = {
                "Plain Carbon Steel: 1030,1045": "Steel - 1030,1045",
                "Low Alloy Steel: 4140,4340,BS3100": "Steel - 4140, 8640",
                "HFF Cast Iron: General Castings": "HFF Cast Iron",
                "Bronze: General Castings": "Bronze - LG4 Bearing",
            }
            alias_target = aliases.get(material_name)
            if alias_target:
                mat = mat_lookup.get((branch_name, alias_target)) or mat_lookup.get(alias_target)
        mat = mat or {}
        db_var = item.get("var_cost_per_kg")
        db_fix = item.get("fixed_cost_per_kg")
        db_shav = item.get("shaving_return_per_kg")
        var_per_kg = float(db_var) if db_var is not None else float(mat.get("var_cost_per_kg") or 0)
        fixed_per_kg = float(db_fix) if db_fix is not None else float(mat.get("fixed_cost_per_kg") or 0)
        shaving_per_kg = float(db_shav) if db_shav is not None else float(mat.get("shaving_return_per_kg") or 0)
        shaving_total = shaving_per_kg * (gross_wt - calc_total_fin_wt) if gross_wt and calc_total_fin_wt else 0
        var_total = gross_wt * var_per_kg if gross_wt else 0
        fixed_total = gross_wt * fixed_per_kg if gross_wt else 0
        total_per_kg = var_per_kg + fixed_per_kg
        total_cost = (gross_wt * total_per_kg) - shaving_total if gross_wt else 0
        foundry_calc.append({
            "id": item.get("id"),
            "calc_total_fin_wt": calc_total_fin_wt,
            "shaving_return_per_kg": shaving_per_kg,
            "var_cost_per_kg": var_per_kg,
            "fixed_cost_per_kg": fixed_per_kg,
            "total_cost_per_kg": total_per_kg,
            "shaving_total": shaving_total,
            "var_cost_total": var_total,
            "fixed_cost_total": fixed_total,
            "total_cost": total_cost,
        })

    foundry_var_total = sum(c["var_cost_total"] for c in foundry_calc) - sum(c["shaving_total"] for c in foundry_calc)
    foundry_fixed_total = sum(c["fixed_cost_total"] for c in foundry_calc)
    foundry_total = sum(c["total_cost"] for c in foundry_calc)
    foundry_per_kg = foundry_total / total_fin_wt if total_fin_wt else 0

    # ── Element 2: Machining ────────────────────────────────
    machining_calc = []
    for item in machining_items:
        qty = float(item.get("qty") or 1)
        hours = float(item.get("machining_hours") or 0)
        category = item.get("machine_category") or "Small"
        rates = rate_lookup.get(category, {})
        var_hr = float(item.get("var_cost_per_hr") or rates.get("var_cost_per_hr") or 0)
        fixed_hr = float(item.get("fixed_cost_per_hr") or rates.get("fixed_cost_per_hr") or 0)
        var_total = qty * hours * var_hr
        fixed_total = qty * hours * fixed_hr
        total_hr = var_hr + fixed_hr
        total_cost = qty * hours * total_hr
        machining_calc.append({
            "id": item.get("id"),
            "var_cost_per_hr": var_hr,
            "var_cost_total": var_total,
            "fixed_cost_per_hr": fixed_hr,
            "fixed_cost_total": fixed_total,
            "total_cost_per_hr": total_hr,
            "total_cost": total_cost,
        })

    machining_var_total = sum(c["var_cost_total"] for c in machining_calc)
    machining_fixed_total = sum(c["fixed_cost_total"] for c in machining_calc)
    machining_total = sum(c["total_cost"] for c in machining_calc)
    machining_per_kg = machining_total / total_fin_wt if total_fin_wt else 0

    # ── Element 3: Vendor ───────────────────────────────────
    vendor_calc = []
    vendor_total = 0
    for item in vendor_items:
        qty = float(item.get("qty") or 1)
        cost = float(item.get("vendor_cost") or 0)
        item_total = qty * cost
        vendor_total += item_total
        vendor_calc.append({"id": item.get("id"), "total_cost": item_total})
    vendor_per_kg = vendor_total / total_fin_wt if total_fin_wt else 0

    # ── Element 4: Corporate Overhead ───────────────────────
    overhead_pct = float(rfq.get("overhead_pct") or 0.05)
    if overhead_pct > 1:
        overhead_pct = overhead_pct / 100.0
    total_manufacturing_cost = foundry_total + machining_total + vendor_total
    overhead_cost = overhead_pct * total_manufacturing_cost
    overhead_usd = overhead_cost / exchange_rate if exchange_rate else 0
    overhead_per_kg = overhead_cost / total_fin_wt if total_fin_wt else 0

    # ── Element 5: Pattern ──────────────────────────────────
    pattern_var = float(rfq.get("pattern_var_cost") or 0)
    pattern_fixed = float(rfq.get("pattern_fixed_cost") or 0)
    pattern_total_cost = pattern_var + pattern_fixed
    pattern_division_qty = int(rfq.get("pattern_division_qty") or 1)
    pattern_usd = pattern_total_cost / exchange_rate if exchange_rate and pattern_total_cost else 0
    pattern_in_stock = bool(rfq.get("pattern_in_stock"))
    pattern_on_job = 0 if pattern_in_stock else (pattern_total_cost / pattern_division_qty if pattern_division_qty else 0)
    pattern_per_kg = pattern_on_job / total_fin_wt if total_fin_wt else 0

    # ── Element 6: Purchase ─────────────────────────────────
    purchase_calc = []
    purchase_total = 0
    for item in purchase_items:
        qty = float(item.get("qty") or 1)
        cost_basis = (item.get("cost_basis") or "Weight").strip()
        unit_cost = float(item.get("unit_cost") or 0)
        unit_fin_wt_p = float(item.get("unit_fin_wt") or 0)
        qty_finished = float(item.get("total_purchase_qty_finished") or (qty * unit_fin_wt_p))
        qty_gross = float(item.get("total_purchase_qty_gross") or 0)
        shaving_per_kg = float(item.get("shaving_return_per_kg") or 0)
        shaving_total = (qty_gross - qty_finished) * shaving_per_kg if qty_gross and qty_finished else 0
        if cost_basis == "Weight":
            item_total = (qty_gross * unit_cost) - shaving_total
        elif cost_basis == "Qty":
            item_total = qty * unit_cost
        else:
            item_total = float(item.get("total_cost") or 0)
        purchase_total += item_total
        purchase_calc.append({
            "id": item.get("id"),
            "total_purchase_qty_finished": qty_finished,
            "shaving_return_total": shaving_total,
            "total_cost": item_total,
        })
    purchase_per_kg = purchase_total / total_fin_wt if total_fin_wt else 0

    # ── Element 7: Heat Treatment ───────────────────────────
    heat_calc = []
    heat_total = 0
    for item in heat_treat_items:
        qty = float(item.get("qty") or 1)
        unit_wt = float(item.get("unit_weight_kg") or total_fin_wt)
        unit_cost = float(item.get("unit_cost_per_kg") or 0)
        item_total = qty * unit_wt * unit_cost
        heat_total += item_total
        heat_calc.append({"id": item.get("id"), "total_cost": item_total})
    heat_per_kg = heat_total / total_fin_wt if total_fin_wt else 0

    # ── Element 8: Other Costs ──────────────────────────────
    price_to_quote = float(rfq.get("price_to_quote") or 0)
    packing_cost = 0
    if rfq.get("other_packing_enabled"):
        packing_per_kg = float(rfq.get("other_packing_cost_per_kg") or 0)
        packing_cost = total_fin_wt * packing_per_kg if packing_per_kg else 0
    export_cost = 0
    if rfq.get("other_export_shipment_enabled") and export_shipment:
        export_cost = _calc_export_shipment_total(rfq, export_shipment, total_fin_wt)
    agent_cost = 0
    if rfq.get("other_agent_commission_enabled"):
        agent_pct = float(rfq.get("other_agent_commission_pct") or 0.02)
        if agent_pct > 1:
            agent_pct = agent_pct / 100.0
        if price_to_quote > 0:
            agent_cost = agent_pct * max(0.0, price_to_quote - export_cost)
    fls_royalty_cost = 0
    if rfq.get("other_fls_royalty_enabled"):
        fls_pct = float(rfq.get("other_fls_royalty_pct") or 0)
        if fls_pct > 1:
            fls_pct = fls_pct / 100.0
        if price_to_quote > 0:
            fls_royalty_cost = fls_pct * max(0.0, price_to_quote - export_cost)
    contingency_cost = 0
    if rfq.get("other_contingency_enabled"):
        contingency_pct = float(rfq.get("other_contingency_pct") or 0.02)
        if contingency_pct > 1:
            contingency_pct = contingency_pct / 100.0
        contingency_cost = contingency_pct * (foundry_total + machining_total + vendor_total + overhead_cost + pattern_on_job + purchase_total + heat_total)
    quality_cost = float(rfq.get("other_quality_testing_cost") or 0) if rfq.get("other_quality_testing_enabled") else 0
    other_total = packing_cost + export_cost + agent_cost + fls_royalty_cost + contingency_cost + quality_cost
    other_per_kg = other_total / total_fin_wt if total_fin_wt else 0

    # ── Element 9: Solar Subsidy ────────────────────────────
    solar_per_kg = float(rfq.get("solar_subsidy_per_kg") or 0)
    total_gross_wt = sum(float(f.get("total_gross_wt") or 0) for f in foundry_items)
    solar_cost = -(solar_per_kg * total_gross_wt) if solar_per_kg else 0
    solar_per_kg_result = solar_cost / total_fin_wt if total_fin_wt else 0

    # ── Element 10: Tax ─────────────────────────────────────
    income_tax_pct = float(rfq.get("income_tax_pct") or 0.02)
    if income_tax_pct > 1:
        income_tax_pct = income_tax_pct / 100.0
    income_tax_amount = income_tax_pct * price_to_quote
    sales_tax_cycleback_enabled = bool(rfq.get("sales_tax_cycleback_enabled"))
    sales_tax_cycleback = (price_to_quote * 0.18 * 0.70) if sales_tax_cycleback_enabled else 0
    net_income_tax = income_tax_amount - sales_tax_cycleback

    # ── Summary ─────────────────────────────────────────────
    var_manf_cost = foundry_var_total + machining_var_total + vendor_total + pattern_on_job + purchase_total + heat_total + other_total + solar_cost
    fixed_manf_cost = foundry_fixed_total + machining_fixed_total + overhead_cost
    total_manf_cost = foundry_total + machining_total + vendor_total + overhead_cost + pattern_on_job + purchase_total + heat_total + other_total + solar_cost
    total_incl_tax = total_manf_cost + net_income_tax
    price_per_kg = price_to_quote / total_fin_wt if total_fin_wt and price_to_quote else 0
    price_usd = price_to_quote / exchange_rate if exchange_rate and price_to_quote else 0
    price_per_kg_usd = price_per_kg / exchange_rate if exchange_rate and price_per_kg else 0
    net_profit = price_to_quote - total_incl_tax if price_to_quote else -total_incl_tax
    profit_pct = net_profit / total_incl_tax if total_incl_tax else 0
    total_cost_per_kg = total_manf_cost / total_fin_wt if total_fin_wt else 0
    total_incl_tax_per_kg = total_incl_tax / total_fin_wt if total_fin_wt else 0
    total_cost_usd = total_manf_cost / exchange_rate if exchange_rate else 0

    return {
        "foundry_items": foundry_calc,
        "machining_items": machining_calc,
        "vendor_items": vendor_calc,
        "purchase_items": purchase_calc,
        "heat_treat_items": heat_calc,
        "foundry": {"items": foundry_calc, "var_total": foundry_var_total, "fixed_total": foundry_fixed_total, "total": foundry_total, "per_kg": foundry_per_kg, "pct_of_total": foundry_total / total_manf_cost if total_manf_cost else 0},
        "machining": {"items": machining_calc, "var_total": machining_var_total, "fixed_total": machining_fixed_total, "total": machining_total, "per_kg": machining_per_kg, "pct_of_total": machining_total / total_manf_cost if total_manf_cost else 0},
        "vendor": {"total": vendor_total, "per_kg": vendor_per_kg, "pct_of_total": vendor_total / total_manf_cost if total_manf_cost else 0},
        "overhead": {"pct": overhead_pct, "total_manufacturing_cost": total_manufacturing_cost, "cost": overhead_cost, "usd": overhead_usd, "per_kg": overhead_per_kg, "pct_of_total": overhead_cost / total_manf_cost if total_manf_cost else 0},
        "pattern": {"var_cost": pattern_var, "fixed_cost": pattern_fixed, "total_cost": pattern_total_cost, "usd": pattern_usd, "on_job": pattern_on_job, "per_kg": pattern_per_kg, "pct_of_total": pattern_on_job / total_manf_cost if total_manf_cost else 0},
        "purchase": {"total": purchase_total, "per_kg": purchase_per_kg, "pct_of_total": purchase_total / total_manf_cost if total_manf_cost else 0},
        "heat_treat": {"total": heat_total, "per_kg": heat_per_kg, "pct_of_total": heat_total / total_manf_cost if total_manf_cost else 0},
        "other": {"packing_cost": packing_cost, "export_shipment_cost": export_cost, "agent_commission_cost": agent_cost, "fls_royalty_cost": fls_royalty_cost, "contingency_cost": contingency_cost, "quality_testing_cost": quality_cost, "total": other_total, "per_kg": other_per_kg, "pct_of_total": other_total / total_manf_cost if total_manf_cost else 0},
        "solar": {"subsidy_per_kg": solar_per_kg, "total_gross_wt": total_gross_wt, "cost": solar_cost, "per_kg": solar_per_kg_result},
        "tax": {"income_tax_pct": income_tax_pct, "income_tax_amount": income_tax_amount, "sales_tax_cycleback": sales_tax_cycleback, "net_income_tax": net_income_tax},
        "summary": {"var_manf_cost": var_manf_cost, "var_manf_per_kg": var_manf_cost / total_fin_wt if total_fin_wt else 0, "var_manf_pct": var_manf_cost / total_manf_cost if total_manf_cost else 0, "fixed_manf_cost": fixed_manf_cost, "fixed_manf_per_kg": fixed_manf_cost / total_fin_wt if total_fin_wt else 0, "fixed_manf_pct": fixed_manf_cost / total_manf_cost if total_manf_cost else 0, "total_manf_cost": total_manf_cost, "total_cost_per_kg": total_cost_per_kg, "total_cost_usd": total_cost_usd, "total_incl_tax": total_incl_tax, "total_incl_tax_per_kg": total_incl_tax_per_kg},
        "pricing": {"price_to_quote": price_to_quote, "price_per_kg": price_per_kg, "price_usd": price_usd, "price_per_kg_usd": price_per_kg_usd, "currency": rfq.get("currency", "USD"), "exchange_rate": exchange_rate, "net_profit": net_profit, "net_profit_usd": net_profit / exchange_rate if exchange_rate else 0, "profit_pct": profit_pct},
    }


def _calc_export_shipment_total(rfq: Dict, es: Dict, total_fin_wt: float) -> float:
    fin_wt = total_fin_wt
    qty = float(rfq.get("req_qty") or 1)
    box_qty = float(es.get("box_qty") or 1)
    box_wt = float(es.get("box_weight") or 250)
    pack_wt_per_part = (box_wt * box_qty) / qty if qty > 0 else float(es.get("packing_weight_per_part") or 250)
    total_part_wt = fin_wt + pack_wt_per_part
    usd_rate = float(es.get("usd_rate") or 280)
    incoterms = (es.get("incoterms") or "FCA Karachi Warehouse").strip()
    shipment_type = (es.get("shipment_type") or "20' Container").strip()
    num_containers = float(es.get("num_containers") or 1)
    price_to_quote = float(rfq.get("price_to_quote") or 0)
    is_ex_works = incoterms == "Ex Works"
    is_fca = incoterms == "FCA Karachi Warehouse"
    is_20 = "20'" in shipment_type
    is_40 = "40'" in shipment_type
    container_payload_wt = 23490.0
    g8 = 0.5 * fin_wt
    g9 = 20.0 * fin_wt
    d10 = 0.0 if is_ex_works else 7.5
    g10 = d10 * total_part_wt
    d11 = 0.0 if is_ex_works else 1.0
    g11 = d11 * total_part_wt
    d12_base = 0.0 if is_ex_works else (15500.0 if is_20 else (18500.0 if is_40 else 13500.0))
    d12 = d12_base * (num_containers if (is_20 or is_40) else 1)
    g12 = (d12 / container_payload_wt) * total_part_wt
    d13_base = 0.0 if (is_ex_works or is_fca) else (35000.0 if is_20 else (45000.0 if is_40 else 8000.0))
    d13 = d13_base * (num_containers if (is_20 or is_40) else 1)
    g13 = (d13 / container_payload_wt) * total_part_wt
    d14_base = 0.0 if (is_ex_works or is_fca) else (14930.0 if is_20 else (16330.0 if is_40 else 14130.0))
    d14 = d14_base * (num_containers if (is_20 or is_40) else 1)
    g14 = (d14 / container_payload_wt) * total_part_wt
    d15_usd = 0.0 if (is_ex_works or is_fca) else (150.0 if is_20 else (200.0 if is_40 else 35000.0 / usd_rate))
    d15 = d15_usd * usd_rate * (num_containers if (is_20 or is_40) else 1)
    g15 = (d15 / container_payload_wt) * total_part_wt
    d16_usd = 0.0 if (is_ex_works or is_fca) else (200.0 if is_20 else (400.0 if is_40 else 130.0))
    d16 = d16_usd * usd_rate * (num_containers if (is_20 or is_40) else 1)
    g16 = (d16 / container_payload_wt) * total_part_wt
    d17 = 0.0 if (is_ex_works or is_fca) else ((5000.0 if is_20 else (10000.0 if is_40 else 0.0)) * num_containers)
    g17 = (d17 / container_payload_wt) * total_part_wt
    d18 = 0.0 if (is_ex_works or is_fca) else (80.0 * usd_rate)
    g18 = (d18 / container_payload_wt) * total_part_wt
    d19 = 0.0 if (is_ex_works or is_fca) else 20000.0
    g19 = (d19 / container_payload_wt) * total_part_wt
    g20 = 0.00425 * price_to_quote
    return g8 + g9 + g10 + g11 + g12 + g13 + g14 + g15 + g16 + g17 + g18 + g19 + g20
