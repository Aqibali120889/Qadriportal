"""
app/api/v1/drawing.py
─────────────────────────────────────────────────────────────────────────────
Phase 4: AI Drawing Processing API endpoints.

All routes are under /api/v1/projects/{project_id}/drawing/

Endpoints:
  POST   /projects/{project_id}/drawing/process    — trigger pipeline
  GET    /projects/{project_id}/drawing/status     — job status
  GET    /projects/{project_id}/drawing/extraction — get extraction data
  PATCH  /projects/{project_id}/drawing/extraction/{entity_id} — approve/reject/edit field
  POST   /projects/{project_id}/drawing/reprocess  — force reprocess

Caching: Already-processed drawings return cached data without calling Modal.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_request_context
from app.core.context import RequestContext
from app.core.logging import get_logger
from app.services.drawing_ai_service import (
    check_existing_job,
    get_extraction_entities,
    get_latest_job_status,
    process_drawing,
    update_entity_review,
)
from app.services.rfq_sync_service import rfq_sync_service  # Phase 7
from app.repositories.drawing_repository import DrawingRepository

logger = get_logger(__name__)

router = APIRouter(prefix="/projects", tags=["AI Drawing Processing"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class ProcessResponse(BaseModel):
    project_id: str
    job_id: Optional[str] = None
    extraction_id: Optional[str] = None
    status: str
    cached: bool = False
    entity_count: Optional[int] = None
    error: Optional[str] = None


class StatusResponse(BaseModel):
    project_id: str
    status: str
    job_id: Optional[str] = None
    extraction_id: Optional[str] = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    error_message: Optional[str] = None


class ExtractionField(BaseModel):
    id: str
    section: str
    field_key: str
    label: Optional[str] = None
    value: Optional[str] = None
    unit: Optional[str] = None
    confidence: str
    review_status: str
    is_applied_to_rfq: bool = False


class FieldReviewUpdate(BaseModel):
    review_status: str  # approved | rejected | pending
    value: Optional[str] = None  # override value (optional)


# ── Helper: build FieldSection list from entities ─────────────────────────────

def _build_sections(entities: list) -> list:
    """Group flat entity list into sections for the frontend AIExtractionPanel."""
    from collections import defaultdict
    sections: dict = defaultdict(list)
    section_order = ["general", "material", "dimensions", "manufacturing", "notes"]

    SECTION_LABELS = {
        "general":       "General Information",
        "material":      "Material Information",
        "dimensions":    "Dimensions",
        "manufacturing": "Manufacturing Information",
        "notes":         "Notes & Remarks",
    }

    for ent in entities:
        sec = ent.get("section", "general")
        conf_raw = float(ent.get("confidence", 0.7))
        if conf_raw >= 0.8:
            conf = "high"
        elif conf_raw >= 0.5:
            conf = "medium"
        else:
            conf = "low"

        sections[sec].append({
            "id":            str(ent["id"]),
            "label":         ent.get("field_key", "").replace("_", " ").title(),
            "value":         ent.get("value") or "",
            "originalValue": ent.get("value") or "",
            "confidence":    conf,
            "reviewStatus":  ent.get("review_status", "pending"),
            "isEdited":      False,
            "unit":          ent.get("unit"),
        })

    result = []
    for sec_key in section_order:
        if sec_key in sections:
            result.append({
                "id":     sec_key,
                "title":  SECTION_LABELS.get(sec_key, sec_key.title()),
                "fields": sections[sec_key],
            })
    # Any unknown sections go last
    for sec_key, fields in sections.items():
        if sec_key not in section_order:
            result.append({"id": sec_key, "title": sec_key.title(), "fields": fields})

    return result


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post(
    "/{project_id}/drawing/process",
    response_model=ProcessResponse,
    summary="Process Drawing with AI",
    description=(
        "Sends the project's drawing PDF to the DataLift Modal endpoint. "
        "If a completed job already exists for this drawing, returns the cached result immediately. "
        "Call /reprocess to force a new run."
    ),
)
async def trigger_process(
    project_id: str,
    ctx: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
) -> ProcessResponse:
    logger.info("drawing_process_requested", project_id=project_id, user=ctx.user_id)

    result = await process_drawing(project_id=project_id, db=db, force_reprocess=False)

    return ProcessResponse(
        project_id=project_id,
        job_id=result.get("job_id"),
        extraction_id=result.get("extraction_id"),
        status=result.get("status", "FAILED"),
        cached=result.get("cached", False),
        entity_count=result.get("entity_count"),
        error=result.get("error"),
    )


@router.get(
    "/{project_id}/drawing/status",
    response_model=StatusResponse,
    summary="Get Drawing Processing Status",
    description="Returns the status of the latest AI processing job for this project.",
)
async def get_status(
    project_id: str,
    ctx: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
) -> StatusResponse:
    job = await get_latest_job_status(project_id, db)

    def _fmt(dt) -> Optional[str]:
        return dt.isoformat() if dt else None

    return StatusResponse(
        project_id=project_id,
        status=job.get("processing_status", job.get("status", "NONE")),
        job_id=str(job["id"]) if job.get("id") else None,
        extraction_id=str(job["extraction_id"]) if job.get("extraction_id") else None,
        started_at=_fmt(job.get("started_at")),
        completed_at=_fmt(job.get("completed_at")),
        error_message=job.get("error_message"),
    )


@router.get(
    "/{project_id}/drawing/extraction",
    summary="Get AI Extraction Data",
    description=(
        "Returns the extracted fields from the latest completed AI job. "
        "Grouped into sections for the AIExtractionPanel. "
        "Returns empty sections if no completed job exists."
    ),
)
async def get_extraction(
    project_id: str,
    ctx: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
) -> dict:
    entities = await get_extraction_entities(project_id, db)
    sections = _build_sections(entities)

    total = len(entities)
    reviewed = sum(1 for e in entities if e.get("review_status") in ("approved", "rejected"))

    return {
        "project_id":    project_id,
        "total_fields":  total,
        "reviewed_count": reviewed,
        "sections":      sections,
        "has_extraction": total > 0,
    }


@router.patch(
    "/{project_id}/drawing/extraction/{entity_id}",
    summary="Approve / Reject / Edit Extracted Field",
    description=(
        "Update the review status of an extracted field. "
        "Optionally provide a corrected value. Logs to validation_history."
    ),
)
async def review_field(
    project_id: str,
    entity_id: str,
    body: FieldReviewUpdate,
    ctx: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
) -> dict:
    valid_statuses = {"approved", "rejected", "pending"}
    if body.review_status not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"review_status must be one of: {valid_statuses}",
        )

    ok = await update_entity_review(
        entity_id=entity_id,
        review_status=body.review_status,
        new_value=body.value,
        reviewed_by=ctx.user_id,
        db=db,
    )
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entity not found")

    logger.info(
        "field_reviewed",
        entity_id=entity_id,
        status=body.review_status,
        user=ctx.user_id,
    )
    return {
        "id": entity_id,
        "review_status": body.review_status,
        "value": body.value,
        # Phase 7: sync info is now embedded in update_entity_review via rfq_sync_service
        # The frontend listens for this to trigger a worksheet refresh
        "rfq_synced": body.review_status == "approved",
    }


@router.post(
    "/{project_id}/drawing/reprocess",
    response_model=ProcessResponse,
    summary="Force Reprocess Drawing",
    description=(
        "Creates a new AI processing job even if a completed one already exists. "
        "Use this when a new revision of the drawing has been uploaded "
        "or when the engineer wants a fresh AI analysis."
    ),
)
async def force_reprocess(
    project_id: str,
    ctx: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
) -> ProcessResponse:
    logger.info("drawing_reprocess_requested", project_id=project_id, user=ctx.user_id)

    result = await process_drawing(project_id=project_id, db=db, force_reprocess=True)

    return ProcessResponse(
        project_id=project_id,
        job_id=result.get("job_id"),
        extraction_id=result.get("extraction_id"),
        status=result.get("status", "FAILED"),
        cached=False,
        entity_count=result.get("entity_count"),
        error=result.get("error"),
    )


@router.post(
    "/{project_id}/drawing/sync",
    summary="Bulk Sync Approved Fields to RFQ Worksheet",
    description=(
        "Pushes all currently-approved AI extraction fields into the linked "
        "rfq_sessions, foundry_items, and heat_treat_items rows. "
        "Safe to call multiple times — only empty fields are written. "
        "Used when the RFQ session was created after AI processing completed."
    ),
)
async def sync_to_rfq(
    project_id: str,
    ctx: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
) -> dict:
    logger.info("drawing_sync_requested", project_id=project_id, user=ctx.user_id)

    result = await rfq_sync_service.sync_all_approved(
        project_id=project_id,
        db=db,
    )

    return {
        "project_id": project_id,
        "synced": result["synced"],
        "fields_updated": result["fields_updated"],
        "rfq_id": result["rfq_id"],
    }


# ── Diagnostic endpoints ──────────────────────────────────────────────────────

@router.get(
    "/{project_id}/drawing/sync/mapping",
    summary="Inspect AI → Excel → DB Field Mapping Table",
    description="Returns the workbook-driven mapping table derived from analyze_output.txt.",
)
async def get_sync_mapping(
    project_id: str,
    ctx: RequestContext = Depends(get_request_context),
) -> dict:
    """Return the complete AI→Excel→DB mapping for admin diagnostics."""
    mapping = rfq_sync_service.describe_mapping()
    return {
        "project_id": project_id,
        "mapping_source": "analyze_output.txt (Cost Work Sheet#47)",
        "total_mappings": len(mapping),
        "mapping": mapping,
    }


@router.get(
    "/{project_id}/drawing/sync/trace",
    summary="Trace One AI Field Through the Sync Chain",
    description=(
        "Given field_key (e.g. 'weight', 'component_name'), shows "
        "Excel cell → DB table.column + current DB value. Use to debug broken sync."
    ),
)
async def trace_field_sync(
    project_id: str,
    field_key: str,
    ctx: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Trace one AI field through Excel→DB chain for debugging."""
    from app.services.rfq_sync_service import get_mappings_for_key, _get_rfq_id_for_project
    from sqlalchemy import text as _text

    mappings = get_mappings_for_key(field_key)
    rfq_id = await _get_rfq_id_for_project(project_id, db)

    trace = []
    for fm in mappings:
        db_value = None
        if rfq_id:
            try:
                tbl_map = {
                    "rfq_sessions":   f"SELECT {fm.db_column} FROM rfq_sessions WHERE id = :id",
                    "foundry_items":  f"SELECT {fm.db_column} FROM foundry_items WHERE rfq_id = :id ORDER BY row_order LIMIT 1",
                    "heat_treat_items": f"SELECT {fm.db_column} FROM heat_treat_items WHERE rfq_id = :id ORDER BY row_order LIMIT 1",
                }
                sql = tbl_map.get(fm.db_table)
                if sql:
                    r = await db.execute(_text(sql), {"id": rfq_id})
                    row = r.mappings().first()
                    db_value = row[fm.db_column] if row else None
            except Exception as exc:
                db_value = f"ERROR: {exc}"

        trace.append({
            "ai_key": fm.ai_key,
            "excel_sheet": fm.excel_sheet,
            "excel_cell": fm.excel_cell,
            "editable_in_excel": fm.editable,
            "db_table": fm.db_table,
            "db_column": fm.db_column,
            "coerce_type": fm.coerce.__name__,
            "current_db_value": str(db_value) if db_value is not None else None,
            "rfq_id": rfq_id,
        })

    return {
        "project_id": project_id,
        "field_key": field_key,
        "rfq_id": rfq_id,
        "mappings_found": len(trace),
        "trace": trace,
    }


# ── Audit Report Endpoint ─────────────────────────────────────────────────────

@router.get(
    "/{project_id}/drawing/sync/audit",
    summary="End-to-End Sync Verification Report",
    description=(
        "Generates a complete per-field verification report for all approved AI entities. "
        "For every approved field shows: AI field → approved value → target table.column "
        "→ current DB value → SUCCESS / NOT_WRITTEN / UNMAPPED. "
        "Includes verification of every machining operation row. "
        "Use this to confirm the full approval→sync→RFQ-sheet pipeline is working."
    ),
)
async def sync_audit_report(
    project_id: str,
    ctx: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Generate a complete field-level sync verification report."""
    logger.info("sync_audit_requested", project_id=project_id, user=ctx.user_id)
    return await rfq_sync_service.generate_audit_report(project_id=project_id, db=db)
