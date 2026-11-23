"""
app/excel/merge_service.py
────────────────────────────────────────────────────────────────────────────
User edits always win. AI output fills only unlocked fields.
Copied from rfq-dashboard merge_service.py — zero logic changes.
"""
from typing import List, Dict


def merge_items(existing: List[Dict], model_items: List[Dict]) -> List[Dict]:
    existing_map = {item["row_order"]: item for item in existing}
    result = []

    for model_item in model_items:
        row = model_item.get("row_order", 0)
        ex = existing_map.get(row)

        if ex is None:
            model_item["source"] = "ai"
            model_item["is_modified"] = False
            model_item["modified_fields"] = []
            result.append(model_item)
        else:
            locked = ex.get("modified_fields") or []
            merged = dict(ex)
            for field, val in model_item.items():
                if field not in locked and val is not None:
                    if field not in ["id", "rfq_id", "created_at", "updated_at",
                                     "is_modified", "modified_fields", "source"]:
                        merged[field] = val
            merged["source"] = "ai"
            result.append(merged)

    model_rows = {m.get("row_order") for m in model_items}
    for ex_item in existing:
        if ex_item["row_order"] not in model_rows:
            result.append(ex_item)

    result.sort(key=lambda x: x.get("row_order", 0))
    return result


def model_json_to_sections(model_output: Dict) -> Dict:
    """Convert AI model JSON to all section data."""
    sections = {
        "rfq_update": {},
        "foundry_items": [],
        "machining_items": [],
        "vendor_items": [],
        "purchase_items": [],
        "heat_treat_items": [],
    }

    header_map = {
        "customer_name": "customer_name",
        "product_name": "item_name",
        "drawing_number": "drawing_number",
        "quantity": "req_qty",
        "unit_finished_weight_kg": "total_fin_wt_kg",
    }
    for model_field, db_field in header_map.items():
        if db_field and model_output.get(model_field) is not None:
            sections["rfq_update"][db_field] = model_output[model_field]

    if model_output.get("product_name") or model_output.get("material_grade"):
        sections["foundry_items"].append({
            "row_order": 1,
            "qty": model_output.get("quantity", 1),
            "item_name": model_output.get("product_name", ""),
            "branch": "QBL II",
            "material": model_output.get("material_grade", ""),
            "unit_fin_wt": model_output.get("unit_finished_weight_kg", 0),
            "total_fin_wt": model_output.get("unit_finished_weight_kg", 0),
            "total_gross_wt": model_output.get("total_gross_weight_kg", 0),
            "source": "ai",
        })

    for i, op in enumerate(model_output.get("machining_operations", [])):
        sections["machining_items"].append({
            "row_order": i + 1,
            "qty": model_output.get("quantity", 1),
            "operation": op.get("operation", ""),
            "machine_name": op.get("machine_name", ""),
            "machining_hours": op.get("hours", 0),
            "machine_category": op.get("machine_category", "Small"),
            "source": "ai",
        })

    return sections
