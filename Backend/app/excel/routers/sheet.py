"""
app/excel/routers/sheet.py
────────────────────────────────────────────────────────────────────────────
RFQ sheet CRUD endpoints.  Mounted at /api/sheet in the enterprise backend.
All imports point to app.excel.* — the enterprise module path.

Phase 2G RBAC Authorization:
  - All endpoints require RequestContext via Depends(get_request_context).
  - Foundry endpoints allow Foundry users and Super Admins.
  - Cost Estimation endpoints allow Cost Estimation users and Super Admins.
  - Read/Calculate endpoints allow both CE, Foundry, and Super Admin users.
"""
from fastapi import APIRouter, HTTPException, Depends, status
from typing import Optional, List, Any
from uuid import UUID
import time
from pydantic import BaseModel

from app.api.deps import get_request_context
from app.core.context import RequestContext
from app.excel.supabase_client import get_supabase, safe_execute
from app.excel.merge_service import merge_items, model_json_to_sections
from app.excel.calculator import calculate_rfq

router = APIRouter(prefix="/api/sheet", tags=["Cost Estimation Sheet"])

RFQ_EXTENDED_STATE: dict = {}


def _validate_uuid(val: str) -> str:
    if not val or str(val).strip().lower() in ("undefined", "null", "none") or len(str(val).strip()) < 32:
        raise HTTPException(status_code=400, detail=f"Invalid UUID parameter: '{val}'")
    return str(val).strip()


def _assert_can_edit_sheet(ctx: RequestContext) -> None:
    """
    Phase 2G Critical Business Rule:
    Cost Estimation, Foundry, and Super Admin users have FULL READ + WRITE access
    to the complete shared RFQ sheet. There are no department-based cell or section restrictions.
    """
    if ctx.is_super_admin or ctx.department_code in ("CE", "FOUNDRY"):
        return
    if (
        ctx.has_permission("projects", "edit")
        or ctx.has_permission("rfq", "edit")
        or ctx.has_permission("cost_estimation", "edit")
        or ctx.has_permission("foundry", "edit")
    ):
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail={
            "code": "PERMISSION_DENIED",
            "message": "You do not have permission to edit RFQ sheet data.",
        },
    )


# Aliases for section-level checks — all sections are editable by CE, Foundry, and Super Admin
_assert_can_edit_foundry = _assert_can_edit_sheet
_assert_can_edit_cost_estimation = _assert_can_edit_sheet


def _assert_can_view_sheet(ctx: RequestContext) -> None:
    if ctx.is_super_admin or ctx.department_code in ("CE", "FOUNDRY"):
        return
    if ctx.has_permission("projects", "view") or ctx.has_permission("rfq", "view"):
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail={
            "code": "PERMISSION_DENIED",
            "message": "You do not have permission to view RFQ sheet data.",
        },
    )


# ── Pydantic models (inline to avoid circular imports) ─────────────────────────

class RFQUpdate(BaseModel):
    customer_name: Optional[str] = None
    item_name: Optional[str] = None
    enq_ref: Optional[str] = None
    enq_date: Optional[str] = None
    drawing_number: Optional[str] = None
    req_qty: Optional[int] = None
    total_fin_wt_kg: Optional[float] = None
    notes: Optional[str] = None
    estimated_process_time: Optional[str] = None
    estimation_date: Optional[str] = None
    overhead_pct: Optional[float] = None
    pattern_var_cost: Optional[float] = None
    pattern_fixed_cost: Optional[float] = None
    pattern_division_qty: Optional[int] = None
    pattern_in_stock: Optional[bool] = None
    other_packing_enabled: Optional[bool] = None
    other_export_shipment_enabled: Optional[bool] = None
    other_agent_commission_enabled: Optional[bool] = None
    other_agent_commission_pct: Optional[float] = None
    other_fls_royalty_enabled: Optional[bool] = None
    other_fls_royalty_pct: Optional[float] = None
    other_contingency_enabled: Optional[bool] = None
    other_contingency_pct: Optional[float] = None
    other_packing_cost_per_kg: Optional[float] = None
    other_quality_testing_enabled: Optional[bool] = None
    other_quality_testing_desc: Optional[str] = None
    other_quality_testing_cost: Optional[float] = None
    solar_subsidy_per_kg: Optional[float] = None
    income_tax_pct: Optional[float] = None
    sales_tax_cycleback_enabled: Optional[bool] = None
    price_to_quote: Optional[float] = None
    currency: Optional[str] = None
    exchange_rate: Optional[float] = None
    prepared_by: Optional[str] = None
    checked_by: Optional[str] = None
    territory_holder: Optional[str] = None


class FoundryUpdate(BaseModel):
    qty: Optional[int] = None
    item_name: Optional[str] = None
    branch: Optional[str] = None
    material: Optional[str] = None
    unit_fin_wt: Optional[float] = None
    total_fin_wt: Optional[float] = None
    total_gross_wt: Optional[float] = None
    shaving_return_per_kg: Optional[float] = None
    var_cost_per_kg: Optional[float] = None
    var_cost_total: Optional[float] = None
    fixed_cost_per_kg: Optional[float] = None
    fixed_cost_total: Optional[float] = None
    total_cost_per_kg: Optional[float] = None
    total_cost: Optional[float] = None


class MachiningUpdate(BaseModel):
    qty: Optional[int] = None
    operation: Optional[str] = None
    machine_name: Optional[str] = None
    machining_hours: Optional[float] = None
    machine_category: Optional[str] = None
    var_cost_per_hr: Optional[float] = None
    var_cost_total: Optional[float] = None
    fixed_cost_per_hr: Optional[float] = None
    fixed_cost_total: Optional[float] = None
    total_cost_per_hr: Optional[float] = None
    total_cost: Optional[float] = None


class VendorUpdate(BaseModel):
    qty: Optional[int] = None
    vendor_name: Optional[str] = None
    machining_operation: Optional[str] = None
    vendor_cost: Optional[float] = None
    cost_category: Optional[str] = None
    total_cost: Optional[float] = None


class PurchaseUpdate(BaseModel):
    qty: Optional[int] = None
    description: Optional[str] = None
    type_material: Optional[str] = None
    cost_basis: Optional[str] = None
    unit_fin_wt: Optional[float] = None
    total_purchase_qty_finished: Optional[float] = None
    total_purchase_qty_gross: Optional[float] = None
    unit_cost: Optional[float] = None
    shaving_return_per_kg: Optional[float] = None
    shaving_return_total: Optional[float] = None
    total_cost: Optional[float] = None


class HeatTreatUpdate(BaseModel):
    qty: Optional[int] = None
    description: Optional[str] = None
    unit_weight_kg: Optional[float] = None
    material: Optional[str] = None
    unit_cost_per_kg: Optional[float] = None
    total_cost: Optional[float] = None


class CompetitionUpdate(BaseModel):
    supplier: Optional[str] = None
    customer: Optional[str] = None
    date: Optional[str] = None
    product_description: Optional[str] = None
    value: Optional[float] = None
    currency: Optional[str] = None
    weight: Optional[float] = None
    value_per_kg: Optional[float] = None


class ExportShipmentUpdate(BaseModel):
    incoterms: Optional[str] = None
    destination: Optional[str] = None
    shipment_type: Optional[str] = None
    num_containers: Optional[int] = None
    usd_rate: Optional[float] = None
    packing_weight_per_part: Optional[float] = None
    box_dimensions: Optional[str] = None
    box_qty: Optional[int] = None
    box_weight: Optional[float] = None
    freight_port: Optional[str] = None
    freight_country: Optional[str] = None
    freight_kg_per_cbm: Optional[float] = None
    freight_charges_per_cbm: Optional[float] = None
    freight_container_charge: Optional[float] = None
    freight_insurance_pct: Optional[float] = None
    rate_validity: Optional[str] = None
    ex_works_price_override: Optional[float] = None
    ph_charges_override: Optional[float] = None
    freight_charges_override: Optional[float] = None


class GenerateRequest(BaseModel):
    rfq_id: str
    model_output: dict


class RFQCreate(BaseModel):
    customer_name: Optional[str] = "New Customer"
    item_name: Optional[str] = "New Item"
    rfq_number: Optional[str] = None


# ── RFQ Sessions ────────────────────────────────────────────────────────────────

@router.post("/rfq")
async def create_rfq_session(
    payload: Optional[RFQCreate] = None,
    ctx: RequestContext = Depends(get_request_context),
):
    _assert_can_edit_cost_estimation(ctx)
    sb = get_supabase()
    rfq_num = (payload.rfq_number if payload and payload.rfq_number else None) or f"RFQ-2026-{int(time.time()) % 100000:05d}"
    cust = (payload.customer_name if payload and payload.customer_name else None) or "New Customer"
    item = (payload.item_name if payload and payload.item_name else None) or "New Cost Item"

    res = sb.table("rfq_sessions").insert({
        "rfq_number": rfq_num,
        "customer_name": cust,
        "item_name": item,
        "status": "draft",
        "overhead_pct": 0.05,
        "req_qty": 1,
        "exchange_rate": 280,
        "currency": "USD",
    }).execute()

    if not res.data:
        raise HTTPException(500, "Failed to create RFQ session")

    session = res.data[0]
    try:
        sb.table("foundry_items").insert({
            "rfq_id": session["id"],
            "row_order": 1,
            "qty": 1,
            "item_name": item,
            "branch": "QBL II",
            "source": "manual",
        }).execute()
    except Exception:
        pass

    return {"data": session}


@router.get("/rfq")
async def get_rfq_sessions(
    rfq_number: Optional[str] = None,
    ctx: RequestContext = Depends(get_request_context),
):
    _assert_can_view_sheet(ctx)
    sb = get_supabase()
    q = sb.table("rfq_sessions").select("*").order("created_at", desc=True)
    if rfq_number:
        q = q.ilike("rfq_number", f"%{rfq_number}%")
    res = safe_execute(q)
    data_list = []
    for item in (res.data or []):
        ext = RFQ_EXTENDED_STATE.get(str(item.get("id")), {})
        data_list.append({**item, **ext})
    return {"data": data_list}


@router.get("/rfq/{rfq_id}")
async def get_rfq(
    rfq_id: str,
    ctx: RequestContext = Depends(get_request_context),
):
    _assert_can_view_sheet(ctx)
    sb = get_supabase()
    res = sb.table("rfq_sessions").select("*").eq("id", rfq_id).single().execute()
    if not res.data:
        raise HTTPException(404, "RFQ not found")
    ext = RFQ_EXTENDED_STATE.get(rfq_id, {})
    return {"data": {**res.data, **ext}}


@router.patch("/rfq/{rfq_id}")
async def update_rfq(
    rfq_id: str,
    update: RFQUpdate,
    ctx: RequestContext = Depends(get_request_context),
):
    _assert_can_edit_cost_estimation(ctx)
    sb = get_supabase()
    data = update.model_dump(exclude_none=True)
    if not data:
        return {"data": {}}
    if rfq_id not in RFQ_EXTENDED_STATE:
        RFQ_EXTENDED_STATE[rfq_id] = {}
    for k, v in data.items():
        RFQ_EXTENDED_STATE[rfq_id][k] = v
    try:
        res = sb.table("rfq_sessions").update(data).eq("id", rfq_id).execute()
        base = res.data[0] if res.data else {}
        return {"data": {**base, **RFQ_EXTENDED_STATE[rfq_id]}}
    except Exception:
        cur = sb.table("rfq_sessions").select("*").eq("id", rfq_id).single().execute()
        base = cur.data or {}
        return {"data": {**base, **RFQ_EXTENDED_STATE[rfq_id]}}


@router.get("/rfq/{rfq_id}/full")
async def get_full_rfq(
    rfq_id: str,
    ctx: RequestContext = Depends(get_request_context),
):
    _assert_can_view_sheet(ctx)
    sb = get_supabase()
    return await _get_full_rfq_data(rfq_id, sb)


@router.get("/rfq/{rfq_id}/calculate")
async def calculate(
    rfq_id: str,
    ctx: RequestContext = Depends(get_request_context),
):
    _assert_can_view_sheet(ctx)
    sb = get_supabase()
    rfq = sb.table("rfq_sessions").select("*").eq("id", rfq_id).single().execute()
    if not rfq.data:
        raise HTTPException(404, "RFQ not found")
    merged_rfq = {**(rfq.data or {}), **(RFQ_EXTENDED_STATE.get(rfq_id) or {})}
    foundry = sb.table("foundry_items").select("*").eq("rfq_id", rfq_id).order("row_order").execute()
    machining = sb.table("machining_items").select("*").eq("rfq_id", rfq_id).order("row_order").execute()
    vendor = sb.table("vendor_items").select("*").eq("rfq_id", rfq_id).order("row_order").execute()
    purchase = sb.table("purchase_items").select("*").eq("rfq_id", rfq_id).order("row_order").execute()
    heat = sb.table("heat_treat_items").select("*").eq("rfq_id", rfq_id).order("row_order").execute()
    machines = sb.table("cost_report_machines").select("*").execute()
    materials = sb.table("cost_report_materials").select("*").execute()
    es = sb.table("export_shipment").select("*").eq("rfq_id", rfq_id).execute()
    export_data = es.data[0] if es.data else None
    result = calculate_rfq(
        rfq=merged_rfq,
        foundry_items=foundry.data or [],
        machining_items=machining.data or [],
        vendor_items=vendor.data or [],
        purchase_items=purchase.data or [],
        heat_treat_items=heat.data or [],
        export_shipment=export_data,
        machine_rates=machines.data or [],
        material_rates=materials.data or [],
    )
    return {"data": result}


# ── Foundry ────────────────────────────────────────────────────────────────────

@router.get("/rfq/{rfq_id}/foundry")
async def get_foundry(
    rfq_id: str,
    ctx: RequestContext = Depends(get_request_context),
):
    _assert_can_view_sheet(ctx)
    sb = get_supabase()
    res = sb.table("foundry_items").select("*").eq("rfq_id", rfq_id).order("row_order").execute()
    return {"data": res.data}


@router.patch("/foundry/{item_id}")
async def update_foundry(
    item_id: str,
    update: FoundryUpdate,
    ctx: RequestContext = Depends(get_request_context),
):
    _assert_can_edit_foundry(ctx)
    sb = get_supabase()
    current = sb.table("foundry_items").select("*").eq("id", item_id).single().execute()
    if not current.data:
        raise HTTPException(404, "Item not found")
    existing = current.data
    update_data = update.model_dump(exclude_none=True)
    modified_fields = list(existing.get("modified_fields") or [])
    for field in update_data:
        if field not in modified_fields:
            modified_fields.append(field)
    update_data["is_modified"] = True
    update_data["modified_fields"] = modified_fields
    _log_changes(sb, existing.get("rfq_id"), "foundry_items", item_id, existing, update_data)
    res = sb.table("foundry_items").update(update_data).eq("id", item_id).execute()
    return {"data": res.data[0] if res.data else {}}


@router.post("/rfq/{rfq_id}/foundry")
async def add_foundry(
    rfq_id: str,
    ctx: RequestContext = Depends(get_request_context),
):
    _assert_can_edit_foundry(ctx)
    rfq_id = _validate_uuid(rfq_id)
    sb = get_supabase()
    last = sb.table("foundry_items").select("row_order").eq("rfq_id", rfq_id).order("row_order", desc=True).limit(1).execute()
    next_order = (last.data[0]["row_order"] + 1) if last.data else 1
    res = sb.table("foundry_items").insert({"rfq_id": rfq_id, "row_order": next_order, "qty": 1, "item_name": "New Item", "branch": "QBL II", "source": "manual", "is_modified": False, "modified_fields": []}).execute()
    return {"data": res.data[0] if res.data else {}}


@router.delete("/foundry/{item_id}")
async def delete_foundry(
    item_id: str,
    ctx: RequestContext = Depends(get_request_context),
):
    _assert_can_edit_foundry(ctx)
    sb = get_supabase()
    sb.table("foundry_items").delete().eq("id", item_id).execute()
    return {"message": "Deleted"}


# ── Machining ──────────────────────────────────────────────────────────────────

@router.get("/rfq/{rfq_id}/machining")
async def get_machining(
    rfq_id: str,
    ctx: RequestContext = Depends(get_request_context),
):
    _assert_can_view_sheet(ctx)
    rfq_id = _validate_uuid(rfq_id)
    sb = get_supabase()
    res = sb.table("machining_items").select("*").eq("rfq_id", rfq_id).order("row_order").execute()
    return {"data": res.data}


@router.patch("/machining/{item_id}")
async def update_machining(
    item_id: str,
    update: MachiningUpdate,
    ctx: RequestContext = Depends(get_request_context),
):
    _assert_can_edit_cost_estimation(ctx)
    sb = get_supabase()
    current = sb.table("machining_items").select("*").eq("id", item_id).single().execute()
    if not current.data:
        raise HTTPException(404, "Item not found")
    existing = current.data
    update_data = update.model_dump(exclude_none=True)
    modified_fields = list(existing.get("modified_fields") or [])
    for field in update_data:
        if field not in modified_fields:
            modified_fields.append(field)
    update_data["is_modified"] = True
    update_data["modified_fields"] = modified_fields
    _log_changes(sb, existing.get("rfq_id"), "machining_items", item_id, existing, update_data)
    res = sb.table("machining_items").update(update_data).eq("id", item_id).execute()
    return {"data": res.data[0] if res.data else {}}


@router.post("/rfq/{rfq_id}/machining")
async def add_machining(
    rfq_id: str,
    ctx: RequestContext = Depends(get_request_context),
):
    _assert_can_edit_cost_estimation(ctx)
    rfq_id = _validate_uuid(rfq_id)
    sb = get_supabase()
    last = sb.table("machining_items").select("row_order").eq("rfq_id", rfq_id).order("row_order", desc=True).limit(1).execute()
    next_order = (last.data[0]["row_order"] + 1) if last.data else 1
    res = sb.table("machining_items").insert({"rfq_id": rfq_id, "row_order": next_order, "qty": 1, "operation": "New Operation", "machine_category": "Small", "machining_hours": 0, "source": "manual", "is_modified": False, "modified_fields": []}).execute()
    return {"data": res.data[0] if res.data else {}}


@router.delete("/machining/{item_id}")
async def delete_machining(
    item_id: str,
    ctx: RequestContext = Depends(get_request_context),
):
    _assert_can_edit_cost_estimation(ctx)
    sb = get_supabase()
    sb.table("machining_items").delete().eq("id", item_id).execute()
    return {"message": "Deleted"}


# ── Vendor ─────────────────────────────────────────────────────────────────────

@router.get("/rfq/{rfq_id}/vendor")
async def get_vendor(
    rfq_id: str,
    ctx: RequestContext = Depends(get_request_context),
):
    _assert_can_view_sheet(ctx)
    sb = get_supabase()
    res = sb.table("vendor_items").select("*").eq("rfq_id", rfq_id).order("row_order").execute()
    return {"data": res.data}


@router.patch("/vendor/{item_id}")
async def update_vendor(
    item_id: str,
    update: VendorUpdate,
    ctx: RequestContext = Depends(get_request_context),
):
    _assert_can_edit_cost_estimation(ctx)
    sb = get_supabase()
    current = sb.table("vendor_items").select("*").eq("id", item_id).single().execute()
    if not current.data:
        raise HTTPException(404, "Item not found")
    existing = current.data
    update_data = update.model_dump(exclude_none=True)
    modified_fields = list(existing.get("modified_fields") or [])
    for f in update_data:
        if f not in modified_fields:
            modified_fields.append(f)
    update_data["is_modified"] = True
    update_data["modified_fields"] = modified_fields
    res = sb.table("vendor_items").update(update_data).eq("id", item_id).execute()
    return {"data": res.data[0] if res.data else {}}


@router.post("/rfq/{rfq_id}/vendor")
async def add_vendor(
    rfq_id: str,
    ctx: RequestContext = Depends(get_request_context),
):
    _assert_can_edit_cost_estimation(ctx)
    rfq_id = _validate_uuid(rfq_id)
    sb = get_supabase()
    last = sb.table("vendor_items").select("row_order").eq("rfq_id", rfq_id).order("row_order", desc=True).limit(1).execute()
    next_order = (last.data[0]["row_order"] + 1) if last.data else 1
    res = sb.table("vendor_items").insert({"rfq_id": rfq_id, "row_order": next_order, "qty": 1, "source": "manual", "is_modified": False, "modified_fields": []}).execute()
    return {"data": res.data[0] if res.data else {}}


@router.delete("/vendor/{item_id}")
async def delete_vendor(
    item_id: str,
    ctx: RequestContext = Depends(get_request_context),
):
    _assert_can_edit_cost_estimation(ctx)
    sb = get_supabase()
    sb.table("vendor_items").delete().eq("id", item_id).execute()
    return {"message": "Deleted"}


# ── Purchase ───────────────────────────────────────────────────────────────────

@router.get("/rfq/{rfq_id}/purchase")
async def get_purchase(
    rfq_id: str,
    ctx: RequestContext = Depends(get_request_context),
):
    _assert_can_view_sheet(ctx)
    rfq_id = _validate_uuid(rfq_id)
    sb = get_supabase()
    res = sb.table("purchase_items").select("*").eq("rfq_id", rfq_id).order("row_order").execute()
    return {"data": res.data}


@router.patch("/purchase/{item_id}")
async def update_purchase(
    item_id: str,
    update: PurchaseUpdate,
    ctx: RequestContext = Depends(get_request_context),
):
    _assert_can_edit_cost_estimation(ctx)
    sb = get_supabase()
    current = sb.table("purchase_items").select("*").eq("id", item_id).single().execute()
    if not current.data:
        raise HTTPException(404, "Item not found")
    existing = current.data
    update_data = update.model_dump(exclude_none=True)
    modified_fields = list(existing.get("modified_fields") or [])
    for f in update_data:
        if f not in modified_fields:
            modified_fields.append(f)
    update_data["is_modified"] = True
    update_data["modified_fields"] = modified_fields
    res = sb.table("purchase_items").update(update_data).eq("id", item_id).execute()
    return {"data": res.data[0] if res.data else {}}


@router.post("/rfq/{rfq_id}/purchase")
async def add_purchase(
    rfq_id: str,
    ctx: RequestContext = Depends(get_request_context),
):
    _assert_can_edit_cost_estimation(ctx)
    rfq_id = _validate_uuid(rfq_id)
    sb = get_supabase()
    last = sb.table("purchase_items").select("row_order").eq("rfq_id", rfq_id).order("row_order", desc=True).limit(1).execute()
    next_order = (last.data[0]["row_order"] + 1) if last.data else 1
    res = sb.table("purchase_items").insert({"rfq_id": rfq_id, "row_order": next_order, "qty": 1, "source": "manual", "is_modified": False, "modified_fields": []}).execute()
    return {"data": res.data[0] if res.data else {}}


@router.delete("/purchase/{item_id}")
async def delete_purchase(
    item_id: str,
    ctx: RequestContext = Depends(get_request_context),
):
    _assert_can_edit_cost_estimation(ctx)
    sb = get_supabase()
    sb.table("purchase_items").delete().eq("id", item_id).execute()
    return {"message": "Deleted"}


# ── Heat Treatment ─────────────────────────────────────────────────────────────

@router.get("/rfq/{rfq_id}/heat-treat")
async def get_heat_treat(
    rfq_id: str,
    ctx: RequestContext = Depends(get_request_context),
):
    _assert_can_view_sheet(ctx)
    rfq_id = _validate_uuid(rfq_id)
    sb = get_supabase()
    res = sb.table("heat_treat_items").select("*").eq("rfq_id", rfq_id).order("row_order").execute()
    return {"data": res.data}


@router.patch("/heat-treat/{item_id}")
async def update_heat_treat(
    item_id: str,
    update: HeatTreatUpdate,
    ctx: RequestContext = Depends(get_request_context),
):
    _assert_can_edit_cost_estimation(ctx)
    sb = get_supabase()
    current = sb.table("heat_treat_items").select("*").eq("id", item_id).single().execute()
    if not current.data:
        raise HTTPException(404, "Item not found")
    existing = current.data
    update_data = update.model_dump(exclude_none=True)
    modified_fields = list(existing.get("modified_fields") or [])
    for f in update_data:
        if f not in modified_fields:
            modified_fields.append(f)
    update_data["is_modified"] = True
    update_data["modified_fields"] = modified_fields
    res = sb.table("heat_treat_items").update(update_data).eq("id", item_id).execute()
    return {"data": res.data[0] if res.data else {}}


@router.post("/rfq/{rfq_id}/heat-treat")
async def add_heat_treat(
    rfq_id: str,
    ctx: RequestContext = Depends(get_request_context),
):
    _assert_can_edit_cost_estimation(ctx)
    rfq_id = _validate_uuid(rfq_id)
    sb = get_supabase()
    last = sb.table("heat_treat_items").select("row_order").eq("rfq_id", rfq_id).order("row_order", desc=True).limit(1).execute()
    next_order = (last.data[0]["row_order"] + 1) if last.data else 1
    res = sb.table("heat_treat_items").insert({"rfq_id": rfq_id, "row_order": next_order, "qty": 1, "source": "manual", "is_modified": False, "modified_fields": []}).execute()
    return {"data": res.data[0] if res.data else {}}


@router.delete("/heat-treat/{item_id}")
async def delete_heat_treat(
    item_id: str,
    ctx: RequestContext = Depends(get_request_context),
):
    _assert_can_edit_cost_estimation(ctx)
    sb = get_supabase()
    sb.table("heat_treat_items").delete().eq("id", item_id).execute()
    return {"message": "Deleted"}


# ── Export Shipment ────────────────────────────────────────────────────────────

@router.get("/rfq/{rfq_id}/export-shipment")
async def get_export_shipment(
    rfq_id: str,
    ctx: RequestContext = Depends(get_request_context),
):
    _assert_can_view_sheet(ctx)
    rfq_id = _validate_uuid(rfq_id)
    sb = get_supabase()
    res = sb.table("export_shipment").select("*").eq("rfq_id", rfq_id).execute()
    if not res.data:
        new = sb.table("export_shipment").insert({"rfq_id": rfq_id, "incoterms": "FCA Karachi Warehouse", "shipment_type": "20' Container", "num_containers": 1, "usd_rate": 280, "packing_weight_per_part": 250, "box_qty": 1, "box_weight": 250, "freight_insurance_pct": 0.001525}).execute()
        return {"data": new.data[0] if new.data else {}}
    return {"data": res.data[0]}


@router.patch("/rfq/{rfq_id}/export-shipment")
async def update_export_shipment(
    rfq_id: str,
    update: ExportShipmentUpdate,
    ctx: RequestContext = Depends(get_request_context),
):
    _assert_can_edit_cost_estimation(ctx)
    rfq_id = _validate_uuid(rfq_id)
    sb = get_supabase()
    data = update.model_dump(exclude_none=True)
    if not data:
        return {"data": {}}
    existing = sb.table("export_shipment").select("id").eq("rfq_id", rfq_id).execute()
    if existing.data:
        res = sb.table("export_shipment").update(data).eq("rfq_id", rfq_id).execute()
    else:
        data["rfq_id"] = rfq_id
        res = sb.table("export_shipment").insert(data).execute()
    return {"data": res.data[0] if res.data else {}}


# ── Competition ────────────────────────────────────────────────────────────────

@router.get("/rfq/{rfq_id}/competition")
async def get_competition(
    rfq_id: str,
    ctx: RequestContext = Depends(get_request_context),
):
    _assert_can_view_sheet(ctx)
    rfq_id = _validate_uuid(rfq_id)
    sb = get_supabase()
    res = sb.table("competition_data").select("*").eq("rfq_id", rfq_id).order("row_order").execute()
    return {"data": res.data or []}


@router.post("/rfq/{rfq_id}/competition")
async def add_competition(
    rfq_id: str,
    ctx: RequestContext = Depends(get_request_context),
):
    _assert_can_edit_cost_estimation(ctx)
    rfq_id = _validate_uuid(rfq_id)
    sb = get_supabase()
    last = sb.table("competition_data").select("row_order").eq("rfq_id", rfq_id).order("row_order", desc=True).limit(1).execute()
    next_order = (last.data[0]["row_order"] + 1) if last.data else 1
    res = sb.table("competition_data").insert({"rfq_id": rfq_id, "row_order": next_order}).execute()
    return {"data": res.data[0] if res.data else {}}


@router.patch("/competition/{item_id}")
async def update_competition(
    item_id: str,
    update: CompetitionUpdate,
    ctx: RequestContext = Depends(get_request_context),
):
    _assert_can_edit_cost_estimation(ctx)
    sb = get_supabase()
    data = update.model_dump(exclude_none=True)
    res = sb.table("competition_data").update(data).eq("id", item_id).execute()
    if not res.data:
        raise HTTPException(404, "Competition row not found")
    return {"data": res.data[0]}


@router.delete("/competition/{item_id}")
async def delete_competition(
    item_id: str,
    ctx: RequestContext = Depends(get_request_context),
):
    _assert_can_edit_cost_estimation(ctx)
    sb = get_supabase()
    sb.table("competition_data").delete().eq("id", item_id).execute()
    return {"message": "Deleted"}


# ── Generate from AI ───────────────────────────────────────────────────────────

@router.post("/generate")
async def generate_from_model(
    request: GenerateRequest,
    ctx: RequestContext = Depends(get_request_context),
):
    _assert_can_edit_cost_estimation(ctx)
    sb = get_supabase()
    rfq_id = request.rfq_id
    sections = model_json_to_sections(request.model_output)
    if sections["rfq_update"]:
        sb.table("rfq_sessions").update(sections["rfq_update"]).eq("id", rfq_id).execute()
    if sections["foundry_items"]:
        existing = sb.table("foundry_items").select("*").eq("rfq_id", rfq_id).order("row_order").execute()
        merged = merge_items(existing.data or [], sections["foundry_items"])
        for item in merged:
            item_data = {k: v for k, v in item.items() if k not in ["id", "created_at", "updated_at"]}
            item_data["rfq_id"] = rfq_id
            if item.get("id"):
                sb.table("foundry_items").update(item_data).eq("id", str(item["id"])).execute()
            else:
                sb.table("foundry_items").insert(item_data).execute()
    if sections["machining_items"]:
        existing = sb.table("machining_items").select("*").eq("rfq_id", rfq_id).order("row_order").execute()
        merged = merge_items(existing.data or [], sections["machining_items"])
        for item in merged:
            item_data = {k: v for k, v in item.items() if k not in ["id", "created_at", "updated_at"]}
            item_data["rfq_id"] = rfq_id
            if item.get("id"):
                sb.table("machining_items").update(item_data).eq("id", str(item["id"])).execute()
            else:
                sb.table("machining_items").insert(item_data).execute()
    full = await _get_full_rfq_data(rfq_id, sb)
    return {"data": full, "message": "Generated and merged successfully"}


async def _get_full_rfq_data(rfq_id: str, sb):
    rfq = sb.table("rfq_sessions").select("*").eq("id", rfq_id).single().execute()
    merged_rfq = {**(rfq.data or {}), **(RFQ_EXTENDED_STATE.get(rfq_id) or {})}

    def safe_query(table, query_fn):
        try:
            return safe_execute(query_fn(sb.table(table))).data or []
        except Exception as e:
            print(f"Warning: query for {table} failed: {e}")
            return []

    foundry = safe_query("foundry_items", lambda t: t.select("*").eq("rfq_id", rfq_id).order("row_order"))
    machining = safe_query("machining_items", lambda t: t.select("*").eq("rfq_id", rfq_id).order("row_order"))
    vendor = safe_query("vendor_items", lambda t: t.select("*").eq("rfq_id", rfq_id).order("row_order"))
    purchase = safe_query("purchase_items", lambda t: t.select("*").eq("rfq_id", rfq_id).order("row_order"))
    heat = safe_query("heat_treat_items", lambda t: t.select("*").eq("rfq_id", rfq_id).order("row_order"))
    competition = safe_query("competition_data", lambda t: t.select("*").eq("rfq_id", rfq_id).order("row_order"))
    export_ship = safe_query("export_shipment", lambda t: t.select("*").eq("rfq_id", rfq_id))
    machines = safe_query("cost_report_machines", lambda t: t.select("*"))
    materials = safe_query("cost_report_materials", lambda t: t.select("*"))
    export_data = export_ship[0] if export_ship else None

    calculated = calculate_rfq(
        rfq=merged_rfq,
        foundry_items=foundry,
        machining_items=machining,
        vendor_items=vendor,
        purchase_items=purchase,
        heat_treat_items=heat,
        export_shipment=export_data,
        machine_rates=machines,
        material_rates=materials,
    )

    return {
        "rfq": merged_rfq,
        "foundry": foundry,
        "machining": machining,
        "vendor": vendor,
        "purchase": purchase,
        "heat_treat": heat,
        "competition": competition,
        "export_shipment": export_data,
        "calculated": calculated,
    }


def _log_changes(sb, rfq_id, table_name, item_id, existing, update_data):
    for field, new_val in update_data.items():
        if field in ["is_modified", "modified_fields", "updated_at"]:
            continue
        old_val = existing.get(field)
        if str(old_val) != str(new_val):
            try:
                sb.table("change_log").insert({
                    "rfq_id": str(rfq_id) if rfq_id else None,
                    "table_name": table_name,
                    "item_id": str(item_id),
                    "field_name": field,
                    "old_value": str(old_val) if old_val is not None else None,
                    "new_value": str(new_val) if new_val is not None else None,
                    "changed_by": "user",
                }).execute()
            except Exception:
                pass
