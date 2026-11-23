"""
app/services/drawing_ai_service.py
─────────────────────────────────────────────────────────────────────────────
Phase 4: AI Drawing Processing Pipeline.

Uses the existing DB tables:
  ocr_jobs          → tracks processing job (QUEUED/PROCESSING/COMPLETED/FAILED)
  ai_extractions    → stores raw Modal JSON response (extraction_json)
  extracted_entities → normalized field rows (key/value/confidence)
  human_reviews     → approve/reject decisions by engineers

Caching rule (per user requirement):
  If a COMPLETED ocr_job already exists for a drawing, return cached results.
  Do NOT call Modal again unless explicitly requested via /reprocess.

Pipeline:
  1. Check for existing completed job → return cached if found
  2. Create ocr_job (QUEUED)
  3. Fetch PDF bytes from Supabase Storage
  4. POST to Modal endpoint with multipart/form-data
  5. Validate JSON response
  6. Store raw JSON → ai_extractions
  7. Normalize → extracted_entities rows
  8. Auto-apply high-confidence values to drawings table + rfq_sessions
  9. Mark ocr_job COMPLETED
  10. Return extraction ID
"""

from __future__ import annotations

import json
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import httpx
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.logging import get_logger
from app.repositories.drawing_repository import DrawingRepository
from app.repositories.email_repository import EmailRepository
from app.repositories.project_repository import ProjectRepository
from app.services import notification_service
from app.models.notification import NotificationType
from app.services.rfq_sync_service import rfq_sync_service  # Phase 7

logger = get_logger(__name__)
settings = get_settings()

# The DataLift Modal endpoint
MODAL_ENDPOINT = "https://h6837267--rfq-drawing-extractor-extract-costing-data.modal.run"

# Confidence mapping: DataLift returns numeric 0-1, we bucket into high/medium/low
def _confidence_label(val: float) -> str:
    if val is None:
        return "medium"
    v = float(val)
    if v >= 0.8:
        return "high"
    if v >= 0.5:
        return "medium"
    return "low"


# ── Field normalizer ──────────────────────────────────────────────────────────
# Maps DataLift JSON keys to (section, display_label, unit_hint)
FIELD_MAP: Dict[str, Tuple[str, str, Optional[str]]] = {
    # General
    "drawing_number":    ("general",        "Drawing Number",   None),
    "drawing_no":        ("general",        "Drawing Number",   None),
    "component_name":    ("general",        "Component Name",   None),
    "part_name":         ("general",        "Component Name",   None),
    "product_name":      ("general",        "Component Name",   None),
    "revision":          ("general",        "Revision",         None),
    "quantity":          ("general",        "Quantity",         "pcs"),
    "customer":          ("general",        "Customer",         None),
    "customer_name":     ("general",        "Customer",         None),
    "enquiry_ref_number": ("general",       "Enquiry Ref #",    None),
    "business_sector":   ("general",        "Business Sector",  None),
    "date":              ("general",        "Date",             None),
    # Material
    "material":          ("material",       "Material",         None),
    "material_grade":    ("material",       "Grade",            None),
    "grade":             ("material",       "Grade",            None),
    "weight":            ("material",       "Weight",           "kg"),
    "net_weight":        ("material",       "Net Weight",       "kg"),
    "gross_weight":      ("material",       "Gross Weight",     "kg"),
    "unit_finished_weight_kg": ("material", "Finished Weight",  "kg"),
    "total_gross_weight_kg":   ("material", "Total Gross Weight", "kg"),
    "density":           ("material",       "Density",          "g/cm³"),
    # Dimensions
    "length":            ("dimensions",     "Length",           "mm"),
    "width":             ("dimensions",     "Width",            "mm"),
    "height":            ("dimensions",     "Height",           "mm"),
    "thickness":         ("dimensions",     "Wall Thickness",   "mm"),
    "diameter":          ("dimensions",     "Diameter",         "mm"),
    "bore_diameter":     ("dimensions",     "Bore Diameter",    "mm"),
    "outer_diameter":    ("dimensions",     "Outer Diameter",   "mm"),
    "inner_diameter":    ("dimensions",     "Inner Diameter",   "mm"),
    "overall_dimensions_mm": ("dimensions", "Overall Dimensions", "mm"),
    # Manufacturing
    "surface_finish":    ("manufacturing",  "Surface Finish",   None),
    "tolerance":         ("manufacturing",  "Tolerance",        "mm"),
    "heat_treatment":    ("manufacturing",  "Heat Treatment",   None),
    "special_heat_treatment": ("manufacturing", "Heat Treatment", None),
    "special_heat_treatment_rate_rs_kg": ("manufacturing", "Heat Treatment Rate", "Rs/kg"),
    "coating":           ("manufacturing",  "Coating",          None),
    "standard":          ("manufacturing",  "Standard",         None),
    "process":           ("manufacturing",  "Process",          None),
    "foundry_branch":    ("manufacturing",  "Foundry Branch",   None),
    "pattern_required":  ("manufacturing",  "Pattern Required", None),
    "pattern_cost_rs":   ("manufacturing",  "Pattern Cost",     "Rs"),
    "estimated_process_time_days": ("manufacturing", "Est. Process Time", "days"),
    "additional_testing": ("manufacturing", "Additional Testing", None),
    # Notes
    "notes":             ("notes",          "Notes",            None),
    "remarks":           ("notes",          "Remarks",          None),
    "special_requirements": ("notes",       "Special Requirements", None),
}
# Keys DataLift uses for machining operation lists
_MACHINING_LIST_KEYS = frozenset({
    "machining_operations", "machining_plan", "machining", "operations",
    "in_house_machining", "manufacturing_operations", "machining_process",
    "process_plan", "operation_list", "operations_list",
})

# Sub-field names within each machining operation dict
_MACHINING_OP_FIELDS = frozenset({
    "operation", "operation_name", "process", "machine", "machine_name",
    "equipment", "machining_hours", "hours", "time", "time_hours",
    "machine_category", "category", "machine_family", "machine_type",
    "qty", "quantity", "remarks", "notes",
})


def _normalize_modal_response(raw: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Convert the DataLift JSON into a flat list of entity dicts.

    MACHINING OPERATIONS — special handling:
    DataLift returns machining as a list of operation dicts, e.g.:
        {"machining_operations": [
            {"operation": "Turning", "machine_name": "NOBLE LATHE (QE)",
             "machine_category": "Large", "machining_hours": 4.0},
            ...
        ]}

    Instead of flattening each operation into separate entities (which loses
    grouping), we store EACH OPERATION as one entity:
        entity_key  = "machining_row_0", "machining_row_1", ...
        entity_value = JSON string of the complete operation dict

    This lets the sync engine INSERT one machining_items row per entity.
    """
    entities = []

    def _extract_from_dict(d: Dict[str, Any], section_override: Optional[str] = None):
        for key, val in d.items():
            if val is None or val == "":
                continue

            # Skip metadata keys
            if key in ("confidence", "status", "error", "model", "version", "timestamp"):
                continue

            # If value is a dict with a "value" key (DataLift format)
            confidence_raw = 1.0
            actual_val = val
            if isinstance(val, dict):
                if "value" in val:
                    confidence_raw = float(val.get("confidence", 0.7))
                    actual_val = val["value"]
                    if actual_val is None:
                        continue
                else:
                    # Recurse into nested sections
                    _extract_from_dict(val, section_override=key)
                    continue

            # Lookup in field map
            key_lower = key.lower().replace(" ", "_").replace("-", "_")
            if key_lower in FIELD_MAP:
                section, label, unit = FIELD_MAP[key_lower]
            else:
                section = section_override or "general"
                label = key.replace("_", " ").title()
                unit = None

            entities.append({
                "section":    section,
                "field_key":  key_lower,
                "label":      label,
                "value":      str(actual_val),
                "confidence": _confidence_label(confidence_raw),
                "confidence_raw": confidence_raw,
                "unit":       unit,
            })

    def _normalize_machining_operation(op: Dict[str, Any], row_index: int, conf_raw: float = 0.85):
        """
        Convert one machining operation dict into a single grouped entity.
        entity_key = machining_row_N
        entity_value = JSON string with all operation fields normalised.
        """
        # Normalise field names from whatever DataLift returns
        field_aliases = {
            "operation_name": "operation", "process": "operation",
            "machine": "machine_name", "equipment": "machine_name",
            "hours": "machining_hours", "time": "machining_hours",
            "time_hours": "machining_hours",
            "category": "machine_category", "machine_family": "machine_category",
            "machine_type": "machine_category",
            "quantity": "qty",
        }
        normalised: Dict[str, Any] = {}
        for k, v in op.items():
            if v is None or v == "":
                continue
            k_norm = k.lower().replace(" ", "_").replace("-", "_")
            k_norm = field_aliases.get(k_norm, k_norm)
            # Extract DataLift {value, confidence} wrapper if present
            if isinstance(v, dict) and "value" in v:
                conf_raw = min(conf_raw, float(v.get("confidence", conf_raw)))
                v = v["value"]
            if v is not None:
                normalised[k_norm] = v

        # Must have at least operation or machine_name to be useful
        if not (normalised.get("operation") or normalised.get("machine_name")):
            return None

        # Build human-readable label for the review panel
        op_label = normalised.get("operation", "?")
        machine_label = normalised.get("machine_name", "?")
        hours_label = normalised.get("machining_hours", "?")
        display = f"{op_label} | {machine_label} | {hours_label} hrs"

        normalised["row_index"] = row_index  # preserve position
        return {
            "section":       "machining",
            "field_key":     f"machining_row_{row_index}",
            "label":         f"Machining Op {row_index + 1}: {display}",
            "value":         json.dumps(normalised, ensure_ascii=False),
            "confidence":    _confidence_label(conf_raw),
            "confidence_raw": conf_raw,
            "unit":          None,
        }

    # ── Handle top-level sections ─────────────────────────────────────────────
    machining_row_counter = 0

    for top_key, top_val in raw.items():
        if top_key in ("confidence", "status", "error"):
            continue

        top_key_lower = top_key.lower().replace(" ", "_").replace("-", "_")

        # ── Machining operations list ─────────────────────────────────────────
        if isinstance(top_val, list) and top_key_lower in _MACHINING_LIST_KEYS:
            for item in top_val:
                if isinstance(item, dict):
                    ent = _normalize_machining_operation(item, machining_row_counter)
                    if ent:
                        entities.append(ent)
                        machining_row_counter += 1
            continue

        # ── Normal dict section ───────────────────────────────────────────────
        if isinstance(top_val, dict):
            # DataLift wraps scalars as {"value": ..., "confidence": ...}.
            # When the top-level key IS the field (e.g., "customer", "weight"),
            # unwrap the wrapper and store the field with its proper key.
            if "value" in top_val and top_val.get("value") is not None:
                actual_val = top_val["value"]
                conf_raw = float(top_val.get("confidence", 0.7))
                if top_key_lower in FIELD_MAP:
                    section, label, unit = FIELD_MAP[top_key_lower]
                else:
                    section = "general"
                    label = top_key.replace("_", " ").title()
                    unit = None
                if str(actual_val).strip():
                    entities.append({
                        "section":    section,
                        "field_key":  top_key_lower,
                        "label":      label,
                        "value":      str(actual_val),
                        "confidence": _confidence_label(conf_raw),
                        "confidence_raw": conf_raw,
                        "unit":       unit,
                    })
            else:
                # Genuine nested section — recurse
                _extract_from_dict(top_val, section_override=top_key_lower)

        # ── Generic list — check if it's a machining list by content ─────────
        elif isinstance(top_val, list):
            # Detect implicit machining list: list of dicts that look like ops
            if top_val and isinstance(top_val[0], dict):
                sample_keys = set(top_val[0].keys())
                is_machining = bool(sample_keys & {"operation", "machine_name", "machine",
                                                    "machining_hours", "hours", "operation_name"})
                if is_machining:
                    for item in top_val:
                        if isinstance(item, dict):
                            ent = _normalize_machining_operation(item, machining_row_counter)
                            if ent:
                                entities.append(ent)
                                machining_row_counter += 1
                    continue
            # Non-machining list: iterate and flatten
            for item in top_val:
                if isinstance(item, dict):
                    _extract_from_dict(item, section_override=top_key_lower)

        # ── Scalar top-level field ────────────────────────────────────────────
        else:
            if top_val is not None and str(top_val).strip():
                if top_key_lower in FIELD_MAP:
                    section, label, unit = FIELD_MAP[top_key_lower]
                else:
                    section, label, unit = "general", top_key.replace("_", " ").title(), None
                entities.append({
                    "section":    section,
                    "field_key":  top_key_lower,
                    "label":      label,
                    "value":      str(top_val),
                    "confidence": "medium",
                    "confidence_raw": 0.7,
                    "unit":       unit,
                })

    return entities


async def _get_pdf_bytes(storage_path: str) -> bytes:
    """Download PDF bytes from Supabase Storage."""
    from supabase import create_client
    client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
    response = client.storage.from_(settings.SUPABASE_STORAGE_BUCKET).download(storage_path)
    return response


async def check_existing_job(project_id: str, drawing_id: str, db: AsyncSession) -> Optional[Dict]:
    """
    Check if a COMPLETED processing job already exists for this drawing.
    Returns the extraction data if cached, None otherwise.
    """
    result = await db.execute(text("""
        SELECT oj.id AS job_id, oj.processing_status, oj.completed_at,
               ae.id AS extraction_id, ae.extraction_json
        FROM ocr_jobs oj
        LEFT JOIN ai_extractions ae ON ae.project_id = oj.project_id 
            AND ae.drawing_id = oj.drawing_id
        WHERE oj.project_id = :pid 
          AND oj.drawing_id = :did
          AND oj.processed_by = 'datalift'
          AND oj.processing_status = 'COMPLETED'
        ORDER BY oj.completed_at DESC
        LIMIT 1
    """), {"pid": project_id, "did": drawing_id})
    row = result.mappings().first()
    if row and row["extraction_id"]:
        return dict(row)
    return None


async def get_latest_job_status(project_id: str, db: AsyncSession) -> Dict:
    """Get the latest processing job status for a project."""
    result = await db.execute(text("""
        SELECT oj.id, oj.processing_status, oj.started_at, oj.completed_at,
               oj.error_message, oj.processed_by,
               ae.id AS extraction_id
        FROM ocr_jobs oj
        LEFT JOIN ai_extractions ae ON ae.project_id = oj.project_id
        WHERE oj.project_id = :pid AND oj.processed_by = 'datalift'
        ORDER BY oj.created_at DESC
        LIMIT 1
    """), {"pid": project_id})
    row = result.mappings().first()
    if not row:
        return {"status": "NONE", "job_id": None, "extraction_id": None}
    return dict(row)


async def get_extraction_entities(project_id: str, db: AsyncSession) -> List[Dict]:
    """Fetch all extracted entities for a project, ordered by section/field."""
    result = await db.execute(text("""
        SELECT ee.id, ee.entity_type AS section, ee.entity_key AS field_key,
               ee.entity_value AS value, ee.unit, ee.confidence,
               ee.review_status, ee.is_applied_to_rfq,
               ae.id AS extraction_id
        FROM extracted_entities ee
        JOIN ai_extractions ae ON ae.id = ee.extraction_id
        WHERE ae.project_id = :pid
        ORDER BY ee.entity_type, ee.entity_key
    """), {"pid": project_id})
    rows = result.mappings().all()
    return [dict(r) for r in rows]


async def update_entity_review(
    entity_id: str,
    review_status: str,
    new_value: Optional[str],
    reviewed_by: str,
    db: AsyncSession,
) -> bool:
    """
    Update an extracted entity's review status and optionally its value.
    On approve/reject, also records the decision in human_reviews, and on
    approve, propagates the (possibly edited) value into rfq_sessions/drawings
    — this is what makes the RFQ Spreadsheet reflect engineer-approved values.
    """
    # Record old value + enough context to propagate on approval
    cur = await db.execute(text("""
        SELECT ee.entity_value, ee.entity_type, ee.entity_key, ee.unit,
               ae.id AS extraction_id, ae.project_id, ae.drawing_id,
               p.current_department_id, p.rfq_number, p.job_number
        FROM extracted_entities ee
        JOIN ai_extractions ae ON ae.id = ee.extraction_id
        LEFT JOIN projects p ON p.id = ae.project_id
        WHERE ee.id = :id
    """), {"id": entity_id})
    row = cur.mappings().first()
    if not row:
        return False
    old_val = row["entity_value"]
    final_val = new_value if new_value is not None else old_val
    dept_id = row["current_department_id"]
    rfq_number = row["rfq_number"] or row["job_number"]

    # Update entity
    await db.execute(text("""
        UPDATE extracted_entities
        SET review_status = :status,
            entity_value = COALESCE(:new_val, entity_value)
        WHERE id = :id
    """), {"status": review_status, "new_val": new_value, "id": entity_id})

    # Log to validation_history
    await db.execute(text("""
        INSERT INTO validation_history
            (extraction_id, entity_id, old_value, new_value, changed_by, change_reason)
        SELECT extraction_id, :eid, :old, :new, :by, :reason
        FROM extracted_entities WHERE id = :eid
    """), {
        "eid": entity_id,
        "old": old_val,
        "new": final_val,
        "by": reviewed_by,
        "reason": review_status,
    })

    # Log to human_reviews — an explicit engineer decision (approve/reject)
    if review_status in ("approved", "rejected"):
        decision = "REJECTED" if review_status == "rejected" else (
            "MODIFIED" if new_value is not None else "APPROVED"
        )
        await db.execute(text("""
            INSERT INTO human_reviews (extraction_id, reviewed_by, decision, remarks)
            VALUES (:extraction_id, :reviewed_by, :decision, :remarks)
        """), {
            "extraction_id": row["extraction_id"],
            "reviewed_by": reviewed_by,
            "decision": decision,
            "remarks": f"{row['entity_type']}.{row['entity_key']} {review_status}",
        })

        try:
            await notification_service.notify(
                db,
                event_type="field_edited" if decision == "MODIFIED" else "human_review_completed",
                title=f"Field {review_status} — {rfq_number or row['project_id']}",
                message=f"{row['entity_type']}.{row['entity_key']} {review_status} by reviewer.",
                severity=NotificationType.WARNING if review_status == "rejected" else NotificationType.SUCCESS,
                project_id=row["project_id"],
                department_id=dept_id,
                rfq_number=rfq_number,
                user_id=reviewed_by,
            )
        except Exception as notif_exc:
            logger.warning("notification_emit_failed", error=str(notif_exc))

    applied = set()
    if review_status == "approved":
        synthetic = [{
            "field_key": row["entity_key"],
            "value": final_val,
            "confidence": "high",
        }]
        applied |= await _auto_apply_to_drawing(row["drawing_id"], synthetic, db)

        # Phase 7: Use dedicated sync service instead of inline _auto_apply_to_rfq()
        sync_result = await rfq_sync_service.sync_approved_field(
            project_id=row["project_id"],
            field_key=row["entity_key"],
            approved_value=final_val,
            db=db,
        )
        if sync_result["synced"]:
            applied.add(row["entity_key"])
            logger.info(
                "rfq_sync_triggered",
                project_id=row["project_id"],
                field_key=row["entity_key"],
                fields_updated=sync_result["fields_updated"],
            )
            try:
                await notification_service.notify(
                    db,
                    event_type="rfq_synchronized",
                    title=f"RFQ sheet updated — {rfq_number or row['project_id']}",
                    message=f"Synced: {', '.join(sync_result['fields_updated'])}",
                    severity=NotificationType.INFO,
                    project_id=row["project_id"],
                    department_id=dept_id,
                    rfq_number=rfq_number,
                )
            except Exception as notif_exc:
                logger.warning("notification_emit_failed", error=str(notif_exc))

    if applied:
        await db.execute(text("""
            UPDATE extracted_entities SET is_applied_to_rfq = true WHERE id = :id
        """), {"id": entity_id})

    await db.commit()
    return True


async def process_drawing(
    project_id: str,
    db: AsyncSession,
    force_reprocess: bool = False,
) -> Dict[str, Any]:
    """
    Main pipeline orchestrator.
    
    Returns:
        {"status": "CACHED"|"COMPLETED"|"FAILED", "job_id": str, "extraction_id": str, ...}
    """
    log = logger.bind(project_id=project_id)

    # ── Step 1: Find drawing ──────────────────────────────────────────────────
    drawing_repo = DrawingRepository(db)
    drawing = await drawing_repo.get_by_project_id(project_id)
    if not drawing:
        return {"status": "FAILED", "error": "No drawing found for this project"}
    if not drawing.file or not drawing.file.storage_path:
        return {"status": "FAILED", "error": "Drawing has no stored file"}

    drawing_id = drawing.id
    storage_path = drawing.file.storage_path

    # Email context (subject/body) — sent alongside the PDF so DataLift can use
    # RFQ correspondence text as additional extraction context.
    email_repo = EmailRepository(db)
    email = await email_repo.get_by_project_id(project_id)
    email_subject = email.subject or "" if email else ""
    email_body_raw = (email.body or email.body_preview or "") if email else ""

    # DataLift's deployed endpoint only accepts email_subject/email_body/drawing_pdf
    # (confirmed against its own /openapi.json) — no dedicated fields for RFQ
    # number, project id, or drawing filename. Fold that context into the body
    # text instead of dropping it; the stored emails.body column is untouched.
    # Fetch project once — reused for Modal context enrichment below AND for
    # every notify() call in this function (department_id, rfq_number).
    project_repo = ProjectRepository(db)
    project = await project_repo.get_by_id(project_id)
    dept_id = project.current_department_id if project else None
    dept_code = None  # not resolvable from Project alone; notify() falls back to CE-style routes
    rfq_number = project.rfq_number or project.job_number if project else None

    context_lines = [
        f"[RFQ Number: {rfq_number}]" if rfq_number else None,
        f"[Project ID: {project_id}]",
        f"[Drawing: {drawing.file.original_name}]" if drawing.file.original_name else None,
    ]
    context_header = " ".join(line for line in context_lines if line)
    email_body = f"{context_header}\n\n{email_body_raw}" if context_header else email_body_raw

    # ── Step 2: Check cache (unless force reprocess) ─────────────────────────
    if not force_reprocess:
        cached = await check_existing_job(project_id, drawing_id, db)
        if cached:
            log.info("drawing_processing_cached", job_id=cached["job_id"])
            try:
                await notification_service.notify(
                    db,
                    event_type="ai_cached",
                    title=f"Using cached AI extraction — {rfq_number or project_id}",
                    message="A completed AI analysis already exists for this drawing.",
                    severity=NotificationType.INFO,
                    project_id=project_id,
                    department_id=dept_id,
                    department_code=dept_code,
                    rfq_number=rfq_number,
                )
            except Exception as notif_exc:
                log.warning("notification_emit_failed", error=str(notif_exc))
            return {
                "status": "CACHED",
                "job_id": cached["job_id"],
                "extraction_id": cached["extraction_id"],
                "cached": True,
            }

    # ── Step 3: Create processing job (QUEUED) ────────────────────────────────
    start_ts = datetime.now(timezone.utc)
    job_result = await db.execute(text("""
        INSERT INTO ocr_jobs 
            (project_id, drawing_id, processing_status, processed_by, started_at)
        VALUES (:pid, :did, 'PROCESSING', 'datalift', :started)
        RETURNING id
    """), {"pid": project_id, "did": drawing_id, "started": start_ts})
    job_id = str(job_result.scalar_one())
    await db.commit()

    log.info("drawing_processing_started", job_id=job_id, storage_path=storage_path)

    try:
        await notification_service.notify(
            db,
            event_type="ai_reprocessed" if force_reprocess else "ai_processing",
            title=f"AI processing started — {rfq_number or project_id}",
            message="Sending drawing to DataLift for extraction.",
            severity=NotificationType.INFO,
            project_id=project_id,
            department_id=dept_id,
            department_code=dept_code,
            rfq_number=rfq_number,
        )
    except Exception as notif_exc:
        log.warning("notification_emit_failed", error=str(notif_exc))

    try:
        # ── Step 4: Download PDF bytes ────────────────────────────────────────
        pdf_bytes = await _get_pdf_bytes(storage_path)
        log.info("pdf_downloaded", size_bytes=len(pdf_bytes))

        # ── Step 5: Call Modal ────────────────────────────────────────────────
        # DataLift's /extract_costing_data expects multipart fields:
        #   drawing_pdf (required file), email_subject, email_body (both optional str)
        t0 = time.monotonic()
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                MODAL_ENDPOINT,
                data={"email_subject": email_subject, "email_body": email_body},
                files={"drawing_pdf": (drawing.file.original_name or "drawing.pdf", pdf_bytes, "application/pdf")},
            )
            if resp.status_code >= 400:
                raise RuntimeError(f"Modal returned {resp.status_code}: {resp.text[:500]}")

        elapsed_ms = int((time.monotonic() - t0) * 1000)
        raw_json = resp.json()
        log.info("modal_response_received", elapsed_ms=elapsed_ms, keys=list(raw_json.keys()) if isinstance(raw_json, dict) else "list")

        # ── Step 6: Store raw response → ai_extractions ───────────────────────
        # Get extraction version (increment if previous exists)
        ver_result = await db.execute(text("""
            SELECT COALESCE(MAX(extraction_version), 0) + 1 AS next_ver
            FROM ai_extractions
            WHERE project_id = :pid AND drawing_id = :did
        """), {"pid": project_id, "did": drawing_id})
        next_ver = ver_result.scalar_one()

        ext_result = await db.execute(text("""
            INSERT INTO ai_extractions 
                (project_id, drawing_id, extraction_version, extraction_json, confidence)
            VALUES (:pid, :did, :ver, :json, :conf)
            RETURNING id
        """), {
            "pid": project_id,
            "did": drawing_id,
            "ver": next_ver,
            "json": json.dumps(raw_json),
            "conf": float(raw_json.get("confidence", 0.75)) if isinstance(raw_json, dict) else 0.75,
        })
        extraction_id = str(ext_result.scalar_one())
        await db.commit()

        # ── Step 7: Normalize → extracted_entities ────────────────────────────
        entities = _normalize_modal_response(raw_json if isinstance(raw_json, dict) else {})
        log.info("entities_extracted", count=len(entities))

        entity_ids_by_key: Dict[str, str] = {}
        for ent in entities:
            row = await db.execute(text("""
                INSERT INTO extracted_entities
                    (extraction_id, entity_type, entity_key, entity_value,
                     unit, confidence, review_status, is_applied_to_rfq)
                VALUES (:ext_id, :section, :key, :val, :unit, :conf, 'pending', false)
                RETURNING id
            """), {
                "ext_id": extraction_id,
                "section": ent["section"],
                "key": ent["field_key"],
                "val": ent["value"],
                "unit": ent.get("unit"),
                "conf": ent["confidence_raw"],
            })
            entity_ids_by_key[ent["field_key"]] = str(row.scalar_one())
        await db.commit()

        # ── Step 8: Auto-apply high-confidence fields ─────────────────────────
        # _auto_apply_to_drawing fills drawing metadata (number, revision, title).
        # High-confidence weight + component name also go through the sync engine
        # so they appear in the RFQ sheet immediately, before the engineer reviews.
        applied_drawing_keys = await _auto_apply_to_drawing(drawing_id, entities, db)

        # Bulk sync high-confidence fields via the dedicated sync service (Phase 7)
        high_conf = [e for e in entities if e["confidence"] in ("high", "medium")]
        applied_rfq_keys: set = set()
        for ent in high_conf:
            res = await rfq_sync_service.sync_approved_field(
                project_id=project_id,
                field_key=ent["field_key"],
                approved_value=ent["value"],
                db=db,
            )
            if res["synced"]:
                applied_rfq_keys.add(ent["field_key"])
        applied_ids = [
            entity_ids_by_key[k] for k in (applied_drawing_keys | applied_rfq_keys)
            if k in entity_ids_by_key
        ]
        if applied_ids:
            await db.execute(text("""
                UPDATE extracted_entities SET is_applied_to_rfq = true
                WHERE id = ANY(:ids)
            """), {"ids": applied_ids})
            await db.commit()

        # ── Step 9: Mark job COMPLETED ────────────────────────────────────────
        completed_ts = datetime.now(timezone.utc)
        await db.execute(text("""
            UPDATE ocr_jobs 
            SET processing_status = 'COMPLETED',
                completed_at = :ts,
                raw_response = :raw,
                processing_metadata = :meta
            WHERE id = :jid
        """), {
            "ts": completed_ts,
            "raw": json.dumps(raw_json),
            "meta": json.dumps({"elapsed_ms": elapsed_ms, "entity_count": len(entities)}),
            "jid": job_id,
        })
        await db.commit()

        log.info("drawing_processing_complete", job_id=job_id, extraction_id=extraction_id)

        try:
            await notification_service.notify(
                db,
                event_type="ai_reprocessed" if force_reprocess else "ai_completed",
                title=f"AI extraction complete — {rfq_number or project_id}",
                message=f"{len(entities)} field(s) extracted and ready for review.",
                severity=NotificationType.SUCCESS,
                project_id=project_id,
                department_id=dept_id,
                department_code=dept_code,
                rfq_number=rfq_number,
                metadata={"entity_count": len(entities), "elapsed_ms": elapsed_ms},
            )
        except Exception as notif_exc:
            log.warning("notification_emit_failed", error=str(notif_exc))

        return {
            "status": "COMPLETED",
            "job_id": job_id,
            "extraction_id": extraction_id,
            "entity_count": len(entities),
            "cached": False,
        }

    except Exception as exc:
        log.exception("drawing_processing_failed", job_id=job_id, error=str(exc))
        await db.execute(text("""
            UPDATE ocr_jobs
            SET processing_status = 'FAILED', error_message = :err, completed_at = :ts
            WHERE id = :jid
        """), {"err": str(exc)[:1000], "ts": datetime.now(timezone.utc), "jid": job_id})
        await db.commit()

        try:
            await notification_service.notify(
                db,
                event_type="ai_failed",
                title=f"AI processing failed — {rfq_number or project_id}",
                message=str(exc)[:300],
                severity=NotificationType.ERROR,
                project_id=project_id,
                department_id=dept_id,
                department_code=dept_code,
                rfq_number=rfq_number,
            )
        except Exception as notif_exc:
            log.warning("notification_emit_failed", error=str(notif_exc))

        return {"status": "FAILED", "job_id": job_id, "error": str(exc)}


async def _auto_apply_to_drawing(drawing_id: str, entities: List[Dict], db: AsyncSession) -> set:
    """Auto-apply high/medium-confidence fields to the drawings table.

    DataLift's real output rarely exceeds ~0.7 confidence, so "high-only" would
    never fire in practice — medium is safe here since we only ever fill in
    currently-empty fields, never overwrite engineer-entered values.
    """
    good = {e["field_key"]: e["value"] for e in entities if e["confidence"] in ("high", "medium")}
    if not good:
        return set()

    current = await db.execute(text("""
        SELECT drawing_number, material, revision, drawing_title
        FROM drawings WHERE id = :drawing_id
    """), {"drawing_id": drawing_id})
    row = current.mappings().first()
    if not row:
        return set()

    updates = {}
    applied = set()
    if not row["drawing_number"] and ("drawing_number" in good or "drawing_no" in good):
        updates["drawing_number"] = good.get("drawing_number") or good.get("drawing_no")
        applied.update({"drawing_number", "drawing_no"} & good.keys())
    if not row["material"] and "material" in good:
        updates["material"] = good["material"]
        applied.add("material")
    if not row["revision"] and "revision" in good:
        updates["revision"] = good["revision"]
        applied.add("revision")
    if not row["drawing_title"] and ("component_name" in good or "part_name" in good or "product_name" in good):
        updates["drawing_title"] = good.get("component_name") or good.get("part_name") or good.get("product_name")
        applied.update({"component_name", "part_name", "product_name"} & good.keys())

    if updates:
        set_clauses = ", ".join(f"{k} = :{k}" for k in updates)
        updates["drawing_id"] = drawing_id
        await db.execute(
            text(f"UPDATE drawings SET {set_clauses} WHERE id = :drawing_id"),
            updates
        )
        await db.commit()
    return applied


async def _auto_apply_to_rfq(project_id: str, entities: List[Dict], db: AsyncSession) -> set:
    """
    Auto-apply high/medium-confidence values to rfq_sessions.
    Only sets values if the session exists and the field is currently NULL/0.
    Never overwrites engineer-entered values.
    """
    # Check if an rfq_session exists for this project
    result = await db.execute(text("""
        SELECT rs.id, rs.item_name, rs.total_fin_wt_kg
        FROM rfq_sessions rs
        JOIN projects p ON p.rfq_number = rs.rfq_number
        WHERE p.id = :pid
        LIMIT 1
    """), {"pid": project_id})
    rfq = result.mappings().first()
    if not rfq:
        return set()  # No RFQ session yet — will be applied when session is created

    good = {e["field_key"]: e["value"] for e in entities if e["confidence"] in ("high", "medium")}
    updates = {}
    applied = set()

    # Map weight → total_fin_wt_kg (only if currently 0 or null)
    weight_keys = ["unit_finished_weight_kg", "weight", "net_weight", "gross_weight"]
    for wk in weight_keys:
        if wk in good and (not rfq["total_fin_wt_kg"] or float(rfq["total_fin_wt_kg"]) == 0):
            try:
                updates["total_fin_wt_kg"] = float(good[wk])
                applied.add(wk)
                break
            except (ValueError, TypeError):
                pass

    # Map component_name → item_name
    name_keys = ("component_name", "part_name", "product_name")
    if not rfq["item_name"] and any(k in good for k in name_keys):
        for k in name_keys:
            if k in good:
                updates["item_name"] = good[k]
                applied.add(k)
                break

    if updates:
        set_clauses = ", ".join(f"{k} = :{k}" for k in updates)
        updates["rfq_id"] = rfq["id"]
        await db.execute(
            text(f"UPDATE rfq_sessions SET {set_clauses} WHERE id = :rfq_id"),
            updates
        )
        await db.commit()
    return applied
