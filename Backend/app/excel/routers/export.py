"""
app/excel/routers/export.py
────────────────────────────────────────────────────────────────────────────
Excel file export endpoint.  Uses the enterprise template path.
Adapted from rfq-dashboard export.py with enterprise module imports.
"""
import os
import tempfile
from datetime import datetime
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from app.excel.supabase_client import get_supabase
from app.excel.fill_sheets import export_to_excel

router = APIRouter(prefix="/api/export", tags=["Cost Estimation Export"])

# Template lives in Backend/app/excel/templates/
TEMPLATES_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "templates",
)


@router.get("/rfq/{rfq_id}/excel")
async def download_excel(rfq_id: str):
    sb = get_supabase()

    rfq = sb.table("rfq_sessions").select("*").eq("id", rfq_id).single().execute()
    if not rfq.data:
        raise HTTPException(404, "RFQ not found")

    def safe_query(table, query_fn):
        try:
            return query_fn(sb.table(table)).execute().data or []
        except Exception:
            return []

    foundry = safe_query("foundry_items", lambda t: t.select("*").eq("rfq_id", rfq_id).order("row_order"))
    machining = safe_query("machining_items", lambda t: t.select("*").eq("rfq_id", rfq_id).order("row_order"))
    vendor = safe_query("vendor_items", lambda t: t.select("*").eq("rfq_id", rfq_id).order("row_order"))
    purchase = safe_query("purchase_items", lambda t: t.select("*").eq("rfq_id", rfq_id).order("row_order"))
    heat = safe_query("heat_treat_items", lambda t: t.select("*").eq("rfq_id", rfq_id).order("row_order"))
    competition = safe_query("competition_data", lambda t: t.select("*").eq("rfq_id", rfq_id).order("row_order"))
    export_ship = safe_query("export_shipment", lambda t: t.select("*").eq("rfq_id", rfq_id))
    export_data = export_ship[0] if export_ship else None

    # Find template — prefer .xlsm (with macros), fallback to .xlsx
    template_path = None
    for ext in [".xlsm", ".xlsx"]:
        candidate = os.path.join(TEMPLATES_DIR, f"cost_template{ext}")
        if os.path.exists(candidate):
            template_path = candidate
            break

    if not template_path:
        raise HTTPException(
            404,
            detail={
                "code": "TEMPLATE_NOT_FOUND",
                "message": (
                    "Excel template not found. "
                    "Place cost_template.xlsm (or .xlsx) in "
                    "Backend/app/excel/templates/"
                ),
            },
        )

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    rfq_number = rfq.data.get("rfq_number", "RFQ")
    file_ext = ".xlsm" if template_path.endswith(".xlsm") else ".xlsx"
    filename = f"{rfq_number}_{timestamp}{file_ext}"

    tmp_dir = tempfile.mkdtemp()
    output_path = os.path.join(tmp_dir, filename)

    export_to_excel(
        rfq_data=rfq.data,
        foundry_items=foundry,
        machining_items=machining,
        vendor_items=vendor,
        purchase_items=purchase,
        heat_treat_items=heat,
        competition_rows=competition,
        template_path=template_path,
        output_path=output_path,
        export_shipment_data=export_data,
    )

    media_type = (
        "application/vnd.ms-excel.sheet.macroEnabled.12"
        if file_ext == ".xlsm"
        else "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )

    return FileResponse(
        path=output_path,
        filename=filename,
        media_type=media_type,
    )
