"""
app/excel/routers/reference.py
────────────────────────────────────────────────────────────────────────────
Reference data endpoints — material rates, machine rates, P&H charges, shipping.
Adapted from rfq-dashboard with enterprise module imports.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.excel.supabase_client import get_supabase

router = APIRouter(prefix="/api/reference", tags=["Cost Reference Data"])


class CostReportMaterialUpdate(BaseModel):
    branch: Optional[str] = None
    material: Optional[str] = None
    var_cost_per_kg: Optional[float] = None
    fixed_cost_per_kg: Optional[float] = None
    total_cost_per_kg: Optional[float] = None
    shaving_return_per_kg: Optional[float] = None
    base_scrap_alloy_cost: Optional[float] = None


class CostReportMachineUpdate(BaseModel):
    machine_family: Optional[str] = None
    var_cost_per_hr: Optional[float] = None
    fixed_cost_per_hr: Optional[float] = None
    total_cost_per_hr: Optional[float] = None
    remarks: Optional[str] = None


class StandardPHChargeUpdate(BaseModel):
    description: Optional[str] = None
    lcl_cost: Optional[str] = None
    container_20_cost: Optional[str] = None
    container_40_cost: Optional[str] = None


class ShippingRouteUpdate(BaseModel):
    country: Optional[str] = None
    port: Optional[str] = None
    usd_rate: Optional[float] = None
    multiplier: Optional[float] = None
    kg_per_cbm: Optional[str] = None
    lcl_per_cbm: Optional[float] = None
    container_20_freight: Optional[float] = None
    container_40_freight: Optional[float] = None
    fcl_transit_time: Optional[str] = None
    lcl_transit_time: Optional[str] = None


# ── Materials ────────────────────────────────────────────────────────────────

@router.get("/materials")
async def get_materials():
    sb = get_supabase()
    try:
        res = sb.table("cost_report_materials").select("*").order("branch").order("row_order").execute()
        return {"data": res.data or []}
    except Exception as e:
        return {"data": []}


@router.post("/materials")
async def add_material(branch: str = "QBL II", material: str = "New Material"):
    sb = get_supabase()
    last = sb.table("cost_report_materials").select("row_order").eq("branch", branch).order("row_order", desc=True).limit(1).execute()
    next_order = (last.data[0]["row_order"] + 1) if last.data else 1
    res = sb.table("cost_report_materials").insert({
        "branch": branch, "material": material or "New Material",
        "var_cost_per_kg": 0, "fixed_cost_per_kg": 0, "total_cost_per_kg": 0,
        "shaving_return_per_kg": 0, "base_scrap_alloy_cost": 0, "row_order": next_order,
    }).execute()
    return {"data": res.data[0] if res.data else {}}


@router.patch("/materials/{material_id}")
async def update_material(material_id: str, body: CostReportMaterialUpdate):
    sb = get_supabase()
    updates = body.model_dump(exclude_none=True)
    if "var_cost_per_kg" in updates or "fixed_cost_per_kg" in updates:
        current = sb.table("cost_report_materials").select("*").eq("id", material_id).single().execute()
        if current.data:
            var_c = updates.get("var_cost_per_kg", current.data.get("var_cost_per_kg") or 0)
            fix_c = updates.get("fixed_cost_per_kg", current.data.get("fixed_cost_per_kg") or 0)
            updates["total_cost_per_kg"] = (var_c or 0) + (fix_c or 0)
    res = sb.table("cost_report_materials").update(updates).eq("id", material_id).execute()
    if not res.data:
        raise HTTPException(404, "Material not found")
    return {"data": res.data[0]}


@router.delete("/materials/{material_id}")
async def delete_material(material_id: str):
    sb = get_supabase()
    sb.table("cost_report_materials").delete().eq("id", material_id).execute()
    return {"message": "Deleted"}


# ── Machines ──────────────────────────────────────────────────────────────────

@router.get("/machines")
async def get_machines():
    sb = get_supabase()
    try:
        res = sb.table("cost_report_machines").select("*").order("row_order").execute()
        return {"data": res.data or []}
    except Exception as e:
        return {"data": []}


@router.post("/machines")
async def add_machine():
    sb = get_supabase()
    last = sb.table("cost_report_machines").select("row_order").order("row_order", desc=True).limit(1).execute()
    next_order = (last.data[0]["row_order"] + 1) if last.data else 1
    res = sb.table("cost_report_machines").insert({
        "machine_family": f"New Machine Family {next_order}",
        "var_cost_per_hr": 0, "fixed_cost_per_hr": 0, "total_cost_per_hr": 0,
        "row_order": next_order,
    }).execute()
    return {"data": res.data[0] if res.data else {}}


@router.patch("/machines/{machine_id}")
async def update_machine(machine_id: str, body: CostReportMachineUpdate):
    sb = get_supabase()
    updates = body.model_dump(exclude_none=True)
    if "var_cost_per_hr" in updates or "fixed_cost_per_hr" in updates:
        current = sb.table("cost_report_machines").select("*").eq("id", machine_id).single().execute()
        if current.data:
            var_c = updates.get("var_cost_per_hr", current.data.get("var_cost_per_hr") or 0)
            fix_c = updates.get("fixed_cost_per_hr", current.data.get("fixed_cost_per_hr") or 0)
            updates["total_cost_per_hr"] = (var_c or 0) + (fix_c or 0)
    res = sb.table("cost_report_machines").update(updates).eq("id", machine_id).execute()
    if not res.data:
        raise HTTPException(404, "Machine not found")
    return {"data": res.data[0]}


@router.delete("/machines/{machine_id}")
async def delete_machine(machine_id: str):
    sb = get_supabase()
    sb.table("cost_report_machines").delete().eq("id", machine_id).execute()
    return {"message": "Deleted"}


# ── P&H Charges ───────────────────────────────────────────────────────────────

@router.get("/ph-charges")
async def get_ph_charges():
    sb = get_supabase()
    try:
        res = sb.table("standard_ph_charges").select("*").order("row_order").execute()
        return {"data": res.data or []}
    except Exception as e:
        return {"data": []}


@router.post("/ph-charges")
async def add_ph_charge():
    sb = get_supabase()
    last = sb.table("standard_ph_charges").select("row_order").order("row_order", desc=True).limit(1).execute()
    next_order = (last.data[0]["row_order"] + 1) if last.data else 1
    res = sb.table("standard_ph_charges").insert({
        "description": "New P&H Charge", "row_order": next_order,
    }).execute()
    return {"data": res.data[0] if res.data else {}}


@router.patch("/ph-charges/{charge_id}")
async def update_ph_charge(charge_id: str, body: StandardPHChargeUpdate):
    sb = get_supabase()
    updates = body.model_dump(exclude_none=True)
    res = sb.table("standard_ph_charges").update(updates).eq("id", charge_id).execute()
    if not res.data:
        raise HTTPException(404, "Charge not found")
    return {"data": res.data[0]}


@router.delete("/ph-charges/{charge_id}")
async def delete_ph_charge(charge_id: str):
    sb = get_supabase()
    sb.table("standard_ph_charges").delete().eq("id", charge_id).execute()
    return {"message": "Deleted"}


# ── Shipping Routes ───────────────────────────────────────────────────────────

@router.get("/shipping")
async def get_shipping_routes():
    sb = get_supabase()
    try:
        res = sb.table("shipping_routes").select("*").order("row_order").execute()
        return {"data": res.data or []}
    except Exception as e:
        return {"data": []}


@router.post("/shipping")
async def add_shipping_route():
    sb = get_supabase()
    last = sb.table("shipping_routes").select("row_order").order("row_order", desc=True).limit(1).execute()
    next_order = (last.data[0]["row_order"] + 1) if last.data else 1
    res = sb.table("shipping_routes").insert({
        "country": "New Country", "port": "New Port",
        "kg_per_cbm": "1000 KG/CBM", "row_order": next_order,
    }).execute()
    return {"data": res.data[0] if res.data else {}}


@router.patch("/shipping/{route_id}")
async def update_shipping_route(route_id: str, body: ShippingRouteUpdate):
    sb = get_supabase()
    updates = body.model_dump(exclude_none=True)
    res = sb.table("shipping_routes").update(updates).eq("id", route_id).execute()
    if not res.data:
        raise HTTPException(404, "Route not found")
    return {"data": res.data[0]}


@router.delete("/shipping/{route_id}")
async def delete_shipping_route(route_id: str):
    sb = get_supabase()
    sb.table("shipping_routes").delete().eq("id", route_id).execute()
    return {"message": "Deleted"}


# ── Dropdowns ─────────────────────────────────────────────────────────────────

@router.get("/dropdowns")
async def get_dropdowns():
    sb = get_supabase()
    try:
        mats = sb.table("cost_report_materials").select("branch,material").order("branch").order("row_order").execute().data or []
    except Exception:
        mats = []
    try:
        machines = sb.table("cost_report_machines").select("machine_family").order("row_order").execute().data or []
    except Exception:
        machines = []

    machine_names = [
        "Asquith Boring", "Burtius Boring", "Butler Boring", "Ceruti", "Coulgar",
        "Craven - 1 (Lathe)", "Craven - 2 Lathe", "Craven - 3 Lathe",
        "Craven - 3 Shell Boring", "Drill Small", "DXW - 1", "DXW - 2",
        "Eustacchio Lathe", "Froriep Lathe", "G&L Boring",
        "Gear Hobbing - 90\"", "Gear Hobbing 6m", "Headman", "Heller", "Hurco",
        "Mandeli", "Niles Lathe", "Noble & Lund Shell Boring",
        "Noble & Lund Boring", "Noble & Lund Lathe", "OKK Milling",
        "Planer - 2", "Planner - 1", "Planner - 3", "Plano Milling",
        "Poreba - 1", "Poreba Lathe - 2", "Radial Drill - 2",
        "Radial Drill - 3", "Ram Shaper", "Richard - 2 Boring",
        "Schneider Floor Boring", "Shaper - 1", "Sharmen Boring",
        "Shell Boring QE", "Skoda Floor Boring", "Skoda Sut 200", "Slotter",
        "Small Lathe - 1", "Small Lathe - 2", "Stavely Boring",
        "Toss Boring", "Union", "VDF Shell Boring", "Vertical Lathe - 1",
        "Vertical Lathe - 2", "Vertical Lathe - 3", "Vertical Lathe - 4",
        "VTL Large", "VTL Schiess", "Waldrich Siegen", "Waldrich Small",
        "Zayer Milling",
    ]

    return {
        "branches": ["QBL II", "QCL", "Qadbros"],
        "materials": [{"branch": m["branch"], "material": m["material"]} for m in mats],
        "machine_categories": [m["machine_family"] for m in machines],
        "machine_names": machine_names,
        "cost_basis_options": ["Weight", "Qty"],
        "yes_no": ["Yes", "No"],
        "currencies": ["USD", "EUR", "GBP", "PKR"],
        "incoterms": ["Ex Works", "FCA Karachi Warehouse", "FOB Karachi Port", "CFR", "CIF"],
        "shipment_types": ["Less Container Load (LCL)", "20' Container", "40' Container"],
        "sectors": [
            "Cement (Local)", "Cement (FLS Export)", "Cement (Export)",
            "Paper & Board", "Fertilizer", "Chemical", "Steel",
            "Power", "Mining", "Sugar (Local)", "Sugar (Export)",
            "Engineering and Construction", "Misc.", "None",
        ],
    }
