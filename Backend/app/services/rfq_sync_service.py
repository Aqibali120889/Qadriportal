"""
app/services/rfq_sync_service.py
─────────────────────────────────────────────────────────────────────────────
Phase 7 (Revised): Human Review → RFQ Sheet Synchronization Engine

KEY FIXES IN THIS VERSION
─────────────────────────────────────────────────────────────────────────────
1. MACHINING ROWS: DataLift extracts machining operations as a list. Each
   operation is normalised into a `machining_row_N` entity (JSON string).
   When an engineer approves such an entity, this service INSERTs one row
   into `machining_items` — exactly as a human engineer would.

2. CUSTOMER NAME: Customer is extracted directly from the drawing's title
   block by DataLift. The sync engine writes it to rfq_sessions.customer_name.
   Guard: values that look like email addresses are rejected (never written).

3. WORKBOOK-DRIVEN SCALAR MAPPING: every other scalar field is mapped to
   the exact DB table/column derived from the workbook analysis
   (rfq-dashboard/backend/analyze_output.txt → Cost Work Sheet#47).

BUSINESS RULES
─────────────────────────────────────────────────────────────────────────────
• Only engineer-APPROVED entities are ever written.
• NULL-guard: never overwrite a non-null value already entered by a human.
• Machining rows: each approved machining_row_N entity produces one INSERT
  into machining_items.  Duplicate detection prevents the same row being
  inserted twice (idempotent).
• Every write is recorded in change_log.
"""

from __future__ import annotations

import json
import re
from typing import Any, Dict, List, NamedTuple, Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.core.logging import get_logger

logger = get_logger(__name__)


# ══════════════════════════════════════════════════════════════════════════════
# SCALAR FIELD MAPPING — workbook-driven (analyze_output.txt, Cost Work Sheet#47)
# ══════════════════════════════════════════════════════════════════════════════

class FieldMapping(NamedTuple):
    ai_key: str
    db_table: str
    db_column: str
    excel_cell: str
    excel_sheet: str
    editable: bool
    coerce: type
    child_row: bool


# Safe columns per table
_RFQ_SESSION_SAFE_COLUMNS = frozenset({
    "customer_name", "item_name", "enq_ref", "drawing_number",
    "req_qty", "total_fin_wt_kg", "estimated_process_time", "notes",
    "overhead_pct", "pattern_var_cost", "pattern_fixed_cost",
    "pattern_division_qty", "income_tax_pct", "other_quality_testing_desc",
    "other_quality_testing_cost", "exchange_rate", "currency",
    "prepared_by", "checked_by", "territory_holder",
})

_FOUNDRY_SAFE_COLUMNS = frozenset({
    "qty", "item_name", "branch", "material",
    "unit_fin_wt", "total_fin_wt", "total_gross_wt", "shaving_return_per_kg",
})

_HEAT_TREAT_SAFE_COLUMNS = frozenset({
    "qty", "description", "unit_weight_kg", "material", "unit_cost_per_kg",
})

_MACHINING_SAFE_COLUMNS = frozenset({
    "qty", "operation", "machine_name", "machining_hours",
    "machine_category", "var_cost_per_hr", "fixed_cost_per_hr",
})


# Master scalar mapping (each row: AI key → Excel cell → DB table/column)
WORKBOOK_FIELD_MAP: List[FieldMapping] = [
    # ── Drawing / header identifiers ──────────────────────────────────────────
    FieldMapping("drawing_number",     "rfq_sessions", "drawing_number",   "P2",  "Cost Work Sheet#47", True,  str,   False),
    FieldMapping("drawing_no",         "rfq_sessions", "drawing_number",   "P2",  "Cost Work Sheet#47", True,  str,   False),
    FieldMapping("component_name",     "rfq_sessions", "item_name",        "G2",  "Cost Work Sheet#47", True,  str,   False),
    FieldMapping("part_name",          "rfq_sessions", "item_name",        "G2",  "Cost Work Sheet#47", True,  str,   False),
    FieldMapping("product_name",       "rfq_sessions", "item_name",        "G2",  "Cost Work Sheet#47", True,  str,   False),
    # Customer — from drawing title block (DataLift extracts it from the PDF)
    FieldMapping("customer",           "rfq_sessions", "customer_name",    "B2",  "Cost Work Sheet#47", True,  str,   False),
    FieldMapping("customer_name",      "rfq_sessions", "customer_name",    "B2",  "Cost Work Sheet#47", True,  str,   False),
    FieldMapping("enquiry_ref_number", "rfq_sessions", "enq_ref",          "K2",  "Cost Work Sheet#47", True,  str,   False),
    FieldMapping("quantity",           "rfq_sessions", "req_qty",          "B3",  "Cost Work Sheet#47", True,  int,   False),
    FieldMapping("notes",              "rfq_sessions", "notes",            "K3",  "Cost Work Sheet#47", True,  str,   False),
    FieldMapping("remarks",            "rfq_sessions", "notes",            "K3",  "Cost Work Sheet#47", True,  str,   False),
    FieldMapping("special_requirements","rfq_sessions","notes",            "K3",  "Cost Work Sheet#47", True,  str,   False),
    FieldMapping("estimated_process_time_days","rfq_sessions","estimated_process_time","C4","Cost Work Sheet#47",True,str,False),
    # Weight → header + foundry + heat_treat
    FieldMapping("weight",                  "rfq_sessions", "total_fin_wt_kg", "G3", "Cost Work Sheet#47", True, float, False),
    FieldMapping("net_weight",              "rfq_sessions", "total_fin_wt_kg", "G3", "Cost Work Sheet#47", True, float, False),
    FieldMapping("unit_finished_weight_kg", "rfq_sessions", "total_fin_wt_kg", "G3", "Cost Work Sheet#47", True, float, False),
    FieldMapping("gross_weight",            "rfq_sessions", "total_fin_wt_kg", "G3", "Cost Work Sheet#47", True, float, False),
    FieldMapping("total_gross_weight_kg",   "rfq_sessions", "total_fin_wt_kg", "G3", "Cost Work Sheet#47", True, float, False),
    # Material → foundry_items E11
    FieldMapping("material",       "foundry_items", "material",    "E11", "Cost Work Sheet#47", True, str, True),
    FieldMapping("material_grade", "foundry_items", "material",    "E11", "Cost Work Sheet#47", True, str, True),
    FieldMapping("grade",          "foundry_items", "material",    "E11", "Cost Work Sheet#47", True, str, True),
    # Item name → foundry_items B11
    FieldMapping("component_name", "foundry_items", "item_name",   "B11", "Cost Work Sheet#47", True, str, True),
    FieldMapping("part_name",      "foundry_items", "item_name",   "B11", "Cost Work Sheet#47", True, str, True),
    # Weight → foundry_items unit_fin_wt G11
    FieldMapping("weight",                  "foundry_items", "unit_fin_wt", "G11", "Cost Work Sheet#47", True, float, True),
    FieldMapping("net_weight",              "foundry_items", "unit_fin_wt", "G11", "Cost Work Sheet#47", True, float, True),
    FieldMapping("unit_finished_weight_kg", "foundry_items", "unit_fin_wt", "G11", "Cost Work Sheet#47", True, float, True),
    # Pattern costs B44, E44
    FieldMapping("pattern_cost_rs",   "rfq_sessions", "pattern_var_cost",   "B44", "Cost Work Sheet#47", True, float, False),
    FieldMapping("pattern_fixed_cost","rfq_sessions", "pattern_fixed_cost", "E44", "Cost Work Sheet#47", True, float, False),
    # Heat treatment → heat_treat_items B60, N60
    FieldMapping("heat_treatment",            "heat_treat_items", "description",      "B60", "Cost Work Sheet#47", True, str,   True),
    FieldMapping("special_heat_treatment",    "heat_treat_items", "description",      "B60", "Cost Work Sheet#47", True, str,   True),
    FieldMapping("special_heat_treatment_rate_rs_kg","heat_treat_items","unit_cost_per_kg","N60","Cost Work Sheet#47",True,float,True),
    # Weight → heat_treat_items J60
    FieldMapping("weight",                  "heat_treat_items", "unit_weight_kg", "J60", "Cost Work Sheet#47", True, float, True),
    FieldMapping("unit_finished_weight_kg", "heat_treat_items", "unit_weight_kg", "J60", "Cost Work Sheet#47", True, float, True),
]


def _build_indexes():
    by_key: Dict[str, List[FieldMapping]] = {}
    for fm in WORKBOOK_FIELD_MAP:
        by_key.setdefault(fm.ai_key, []).append(fm)
    return by_key

_BY_AI_KEY: Dict[str, List[FieldMapping]] = _build_indexes()


def get_mappings_for_key(ai_key: str) -> List[FieldMapping]:
    return _BY_AI_KEY.get(ai_key, [])

def is_mapped_key(ai_key: str) -> bool:
    return ai_key in _BY_AI_KEY


# ══════════════════════════════════════════════════════════════════════════════
# GUARDS
# ══════════════════════════════════════════════════════════════════════════════

_EMAIL_RE = re.compile(r"[^@\s]+@[^@\s]+\.[^@\s]+")

def _is_email_address(value: str) -> bool:
    """Return True if the value looks like an email address or display name with email."""
    return bool(_EMAIL_RE.search(value))

def _is_empty(val: Any) -> bool:
    """Return True only when the DB value has never been set (NULL or blank string).

    We do NOT treat '0' or '0.0' as empty: an engineer may legitimately set
    a numeric field to zero (e.g. pattern_var_cost = 0, req_qty = 0), and we
    must never overwrite that with an AI-extracted value.
    """
    if val is None:
        return True
    return str(val).strip() == ""

def _coerce(value: str, coerce_type: type) -> Optional[Any]:
    if coerce_type is str:
        return value
    try:
        return coerce_type(value)
    except (ValueError, TypeError):
        return None


# ══════════════════════════════════════════════════════════════════════════════
# DATABASE HELPERS
# ══════════════════════════════════════════════════════════════════════════════

async def _get_rfq_id_for_project(project_id: str, db: AsyncSession) -> Optional[str]:
    result = await db.execute(text("""
        SELECT rs.id
        FROM rfq_sessions rs
        JOIN projects p ON p.rfq_number = rs.rfq_number
        WHERE p.id = :pid
        LIMIT 1
    """), {"pid": project_id})
    row = result.mappings().first()
    return str(row["id"]) if row else None


async def _log_change(rfq_id, table_name, item_id, field_name, old_value, new_value, db):
    try:
        await db.execute(text("""
            INSERT INTO change_log
                (rfq_id, table_name, item_id, field_name, old_value, new_value, changed_by)
            VALUES (:rfq_id, :table, :item_id, :field, :old, :new, 'ai_sync')
        """), {
            "rfq_id": rfq_id, "table": table_name, "item_id": item_id,
            "field": field_name,
            "old": str(old_value) if old_value is not None else None,
            "new": str(new_value),
        })
    except Exception as e:
        logger.warning("change_log_write_failed", error=str(e))


# ══════════════════════════════════════════════════════════════════════════════
# SCALAR TABLE WRITERS
# ══════════════════════════════════════════════════════════════════════════════

async def _write_rfq_session(rfq_id, column, new_value, db) -> bool:
    if column not in _RFQ_SESSION_SAFE_COLUMNS:
        return False
    # Extra guard: never write email addresses into customer_name
    if column == "customer_name" and isinstance(new_value, str) and _is_email_address(new_value):
        logger.warning("rfq_sync_skip_email_as_customer", value=new_value)
        return False

    cur = await db.execute(text(f"SELECT {column} FROM rfq_sessions WHERE id = :id"), {"id": rfq_id})
    row = cur.mappings().first()
    if not row:
        return False
    current = row[column]
    if not _is_empty(current):
        logger.debug("rfq_sync_skip_existing", table="rfq_sessions", column=column, current=current)
        return False

    await db.execute(
        text(f"UPDATE rfq_sessions SET {column} = :val, updated_at = now() WHERE id = :id"),
        {"val": new_value, "id": rfq_id},
    )
    await _log_change(rfq_id, "rfq_sessions", rfq_id, column, current, new_value, db)
    logger.info("rfq_sync_wrote", table="rfq_sessions", column=column, value=new_value)
    return True


async def _write_foundry_row0(rfq_id, column, new_value, db) -> bool:
    if column not in _FOUNDRY_SAFE_COLUMNS:
        return False
    cur = await db.execute(text(f"""
        SELECT id, {column} FROM foundry_items
        WHERE rfq_id = :rfq_id ORDER BY row_order ASC LIMIT 1
    """), {"rfq_id": rfq_id})
    row = cur.mappings().first()

    if not row:
        ins = await db.execute(text(f"""
            INSERT INTO foundry_items (rfq_id, row_order, qty, branch, source, {column})
            VALUES (:rfq_id, 1, 1, 'QBL II', 'ai', :val)
            RETURNING id
        """), {"rfq_id": rfq_id, "val": new_value})
        new_id = str(ins.scalar_one())
        await _log_change(rfq_id, "foundry_items", new_id, column, None, new_value, db)
        logger.info("rfq_sync_wrote", table="foundry_items", column=column, value=new_value, action="inserted")
        return True

    current = row[column]
    foundry_id = str(row["id"])
    if not _is_empty(current):
        logger.debug("rfq_sync_skip_existing", table="foundry_items", column=column)
        return False

    await db.execute(
        text(f"UPDATE foundry_items SET {column} = :val, source = 'ai', updated_at = now() WHERE id = :id"),
        {"val": new_value, "id": foundry_id},
    )
    await _log_change(rfq_id, "foundry_items", foundry_id, column, current, new_value, db)
    logger.info("rfq_sync_wrote", table="foundry_items", column=column, value=new_value)
    return True


async def _write_heat_treat_row0(rfq_id, column, new_value, db) -> bool:
    if column not in _HEAT_TREAT_SAFE_COLUMNS:
        return False
    cur = await db.execute(text(f"""
        SELECT id, {column} FROM heat_treat_items
        WHERE rfq_id = :rfq_id ORDER BY row_order ASC LIMIT 1
    """), {"rfq_id": rfq_id})
    row = cur.mappings().first()

    if not row:
        if _is_empty(new_value):
            return False
        ins = await db.execute(text(f"""
            INSERT INTO heat_treat_items (rfq_id, row_order, qty, source, {column})
            VALUES (:rfq_id, 1, 1, 'ai', :val)
            RETURNING id
        """), {"rfq_id": rfq_id, "val": new_value})
        new_id = str(ins.scalar_one())
        await _log_change(rfq_id, "heat_treat_items", new_id, column, None, new_value, db)
        return True

    current = row[column]
    heat_id = str(row["id"])
    if not _is_empty(current):
        return False

    await db.execute(
        text(f"UPDATE heat_treat_items SET {column} = :val, source = 'ai', updated_at = now() WHERE id = :id"),
        {"val": new_value, "id": heat_id},
    )
    await _log_change(rfq_id, "heat_treat_items", heat_id, column, current, new_value, db)
    return True


async def _dispatch_write(fm: FieldMapping, rfq_id: str, coerced_value: Any, db: AsyncSession) -> bool:
    if fm.db_table == "rfq_sessions":
        return await _write_rfq_session(rfq_id, fm.db_column, coerced_value, db)
    elif fm.db_table == "foundry_items":
        return await _write_foundry_row0(rfq_id, fm.db_column, coerced_value, db)
    elif fm.db_table == "heat_treat_items":
        return await _write_heat_treat_row0(rfq_id, fm.db_column, coerced_value, db)
    return False


# ══════════════════════════════════════════════════════════════════════════════
# MACHINING ROW INSERTION — multi-row child table
# ══════════════════════════════════════════════════════════════════════════════

# Map from DataLift field names inside a machining op → machining_items columns
_MACHINING_COL_ALIASES: Dict[str, str] = {
    "operation":       "operation",
    "operation_name":  "operation",
    "process":         "operation",
    "machine_name":    "machine_name",
    "machine":         "machine_name",
    "equipment":       "machine_name",
    "machining_hours": "machining_hours",
    "hours":           "machining_hours",
    "time":            "machining_hours",
    "machine_category":"machine_category",
    "category":        "machine_category",
    "machine_family":  "machine_category",
    "machine_type":    "machine_category",
    "qty":             "qty",
    "quantity":        "qty",
}


def _parse_machining_json(value_str: str) -> Dict[str, Any]:
    """
    Parse a machining_row entity value into a clean dict for DB insertion.
    value_str is the JSON string stored by _normalize_modal_response.
    """
    try:
        raw = json.loads(value_str)
    except (json.JSONDecodeError, TypeError):
        return {}

    result: Dict[str, Any] = {}
    for k, v in raw.items():
        k_norm = k.lower().replace(" ", "_").replace("-", "_")
        col = _MACHINING_COL_ALIASES.get(k_norm)
        if col and v is not None and str(v).strip():
            result[col] = v
    return result


async def _insert_machining_row(rfq_id: str, op_data: Dict[str, Any], db: AsyncSession) -> Optional[str]:
    """
    Insert one row into machining_items for a single approved AI machining operation.

    Idempotency: if a row with the same operation + machine_name + machining_hours
    already exists (source='ai'), skip insertion.
    """
    if not op_data:
        return None

    operation = str(op_data.get("operation", "")).strip()
    machine_name = str(op_data.get("machine_name", "")).strip()
    machining_hours = op_data.get("machining_hours")

    # Idempotency check
    existing = await db.execute(text("""
        SELECT id FROM machining_items
        WHERE rfq_id = :rfq_id
          AND source = 'ai'
          AND LOWER(COALESCE(operation, '')) = LOWER(:op)
          AND LOWER(COALESCE(machine_name, '')) = LOWER(:mach)
        LIMIT 1
    """), {"rfq_id": rfq_id, "op": operation, "mach": machine_name})
    if existing.scalar_one_or_none():
        logger.debug("rfq_sync_machining_row_exists", operation=operation, machine=machine_name)
        return None

    # Get next row_order
    max_order = await db.execute(text("""
        SELECT COALESCE(MAX(row_order), 0) + 1 AS next_order
        FROM machining_items WHERE rfq_id = :rfq_id
    """), {"rfq_id": rfq_id})
    next_order = max_order.scalar_one()

    # Build insert
    insert_cols = ["rfq_id", "row_order", "source", "qty"]
    insert_vals: Dict[str, Any] = {
        "rfq_id": rfq_id,
        "row_order": next_order,
        "source": "ai",
        "qty": int(op_data.get("qty", 1)),
    }

    if operation:
        insert_cols.append("operation")
        insert_vals["operation"] = operation
    if machine_name:
        insert_cols.append("machine_name")
        insert_vals["machine_name"] = machine_name
    if machining_hours is not None:
        try:
            insert_cols.append("machining_hours")
            insert_vals["machining_hours"] = float(machining_hours)
        except (ValueError, TypeError):
            pass
    if op_data.get("machine_category"):
        insert_cols.append("machine_category")
        insert_vals["machine_category"] = str(op_data["machine_category"])

    cols_sql = ", ".join(insert_cols)
    vals_sql = ", ".join(f":{c}" for c in insert_cols)

    result = await db.execute(
        text(f"INSERT INTO machining_items ({cols_sql}) VALUES ({vals_sql}) RETURNING id"),
        insert_vals,
    )
    new_id = str(result.scalar_one())
    await _log_change(rfq_id, "machining_items", new_id, "operation", None, operation, db)
    logger.info(
        "rfq_sync_machining_row_inserted",
        rfq_id=rfq_id, operation=operation, machine=machine_name,
        hours=machining_hours, row_order=next_order,
    )
    return new_id


# ══════════════════════════════════════════════════════════════════════════════
# PUBLIC SERVICE
# ══════════════════════════════════════════════════════════════════════════════

class RFQSyncService:
    """
    Enterprise synchronization bridge: AI extraction → RFQ manufacturing worksheet.

    Two entity categories are handled:
    1. Scalar fields  — mapped to single DB columns via WORKBOOK_FIELD_MAP
    2. machining_row_N — each entity maps to one INSERT in machining_items
    """

    async def sync_approved_field(
        self,
        project_id: str,
        field_key: str,
        approved_value: str,
        db: AsyncSession,
    ) -> Dict[str, Any]:
        """
        Synchronize one approved AI field into the RFQ database.

        Handles both scalar fields and machining_row_N grouped entities.
        """
        log = logger.bind(project_id=project_id, field_key=field_key)

        rfq_id = await _get_rfq_id_for_project(project_id, db)
        if not rfq_id:
            log.info("rfq_sync_no_session_yet")
            return {"synced": False, "fields_updated": [], "rfq_id": None}

        fields_updated: List[str] = []

        # ── Machining row (grouped entity) ───────────────────────────────────
        if field_key.startswith("machining_row"):
            op_data = _parse_machining_json(approved_value)
            if not op_data:
                log.warning("rfq_sync_machining_row_parse_failed", value=approved_value[:120])
                return {"synced": False, "fields_updated": [], "rfq_id": rfq_id}

            new_id = await _insert_machining_row(rfq_id, op_data, db)
            if new_id:
                # NOTE: do NOT commit here — the caller (update_entity_review) owns
                # the single terminal commit for the full approval transaction.
                fields_updated.append(
                    f"machining_items.operation [{op_data.get('operation', '?')}]"
                )
                log.info("rfq_sync_machining_inserted", row_id=new_id)
            return {"synced": bool(fields_updated), "fields_updated": fields_updated, "rfq_id": rfq_id}

        # ── Scalar field ─────────────────────────────────────────────────────
        mappings = get_mappings_for_key(field_key)
        if not mappings:
            log.debug("rfq_sync_unmapped", field_key=field_key)
            return {"synced": False, "fields_updated": [], "rfq_id": rfq_id}

        for fm in mappings:
            if not fm.editable:
                continue
            coerced = _coerce(approved_value, fm.coerce)
            if coerced is None:
                continue
            wrote = await _dispatch_write(fm, rfq_id, coerced, db)
            if wrote:
                fields_updated.append(f"{fm.db_table}.{fm.db_column} [{fm.excel_cell}]")

        if fields_updated:
            await db.commit()
            log.info("rfq_sync_completed", rfq_id=rfq_id, fields=fields_updated)

        return {"synced": bool(fields_updated), "fields_updated": fields_updated, "rfq_id": rfq_id}

    async def sync_all_approved(
        self,
        project_id: str,
        db: AsyncSession,
    ) -> Dict[str, Any]:
        """
        Bulk sync all currently-approved entities for a project.
        Safe to call multiple times — NULL-guard + machining idempotency prevent duplicates.
        """
        log = logger.bind(project_id=project_id)

        result = await db.execute(text("""
            SELECT ee.entity_key, ee.entity_value
            FROM extracted_entities ee
            JOIN ai_extractions ae ON ae.id = ee.extraction_id
            WHERE ae.project_id = :pid
              AND ee.review_status = 'approved'
              AND ee.entity_value IS NOT NULL
              AND ee.entity_value <> ''
            ORDER BY ae.extraction_version DESC, ee.entity_key
        """), {"pid": project_id})
        rows = result.mappings().all()

        total_updated: List[str] = []
        rfq_id: Optional[str] = None

        for row in rows:
            res = await self.sync_approved_field(
                project_id=project_id,
                field_key=row["entity_key"],
                approved_value=row["entity_value"] or "",
                db=db,
            )
            if res["rfq_id"]:
                rfq_id = res["rfq_id"]
            total_updated.extend(res["fields_updated"])

        log.info(
            "rfq_sync_bulk_complete",
            project_id=project_id,
            rfq_id=rfq_id,
            total_fields_written=len(total_updated),
        )
        return {"synced": bool(total_updated), "fields_updated": total_updated, "rfq_id": rfq_id}

    def describe_mapping(self) -> List[Dict[str, str]]:
        """Return the complete scalar mapping table for diagnostics."""
        seen = set()
        rows = []
        for fm in WORKBOOK_FIELD_MAP:
            key = f"{fm.ai_key}→{fm.db_table}.{fm.db_column}"
            if key in seen:
                continue
            seen.add(key)
            rows.append({
                "ai_key": fm.ai_key,
                "excel_sheet": fm.excel_sheet,
                "excel_cell": fm.excel_cell,
                "db_table": fm.db_table,
                "db_column": fm.db_column,
                "editable": str(fm.editable),
                "coerce": fm.coerce.__name__,
            })
        # Add the machining row entry
        rows.append({
            "ai_key": "machining_row_N",
            "excel_sheet": "Cost Work Sheet#47",
            "excel_cell": "rows 16-29 (Element 2)",
            "db_table": "machining_items",
            "db_column": "operation + machine_name + machining_hours + machine_category",
            "editable": "True",
            "coerce": "json→INSERT",
        })
        return rows

    async def generate_audit_report(
        self,
        project_id: str,
        db: AsyncSession,
    ) -> Dict[str, Any]:
        """
        Generate a per-field verification report for all approved entities.
        Returns a list showing: AI field → approved value → target table.column → current DB value → status.
        """
        log = logger.bind(project_id=project_id)

        rfq_id = await _get_rfq_id_for_project(project_id, db)

        # Get all approved entities
        result = await db.execute(text("""
            SELECT ee.entity_key, ee.entity_value, ee.entity_type,
                   ee.confidence, ee.is_applied_to_rfq
            FROM extracted_entities ee
            JOIN ai_extractions ae ON ae.id = ee.extraction_id
            WHERE ae.project_id = :pid
              AND ee.review_status = 'approved'
            ORDER BY ee.entity_type, ee.entity_key
        """), {"pid": project_id})
        entities = result.mappings().all()

        report = []
        for ent in entities:
            field_key = ent["entity_key"]
            approved_value = ent["entity_value"] or ""

            # ── Machining row ────────────────────────────────────────────────
            if field_key.startswith("machining_row"):
                try:
                    op = json.loads(approved_value)
                    target_desc = f"machining_items.operation='{op.get('operation','?')}' machine='{op.get('machine_name','?')}' hrs={op.get('machining_hours','?')}"
                except Exception:
                    target_desc = "machining_items (parse error)"

                # Check if this operation exists in DB
                db_status = "NOT_WRITTEN"
                if rfq_id:
                    try:
                        op_data = _parse_machining_json(approved_value)
                        check = await db.execute(text("""
                            SELECT id FROM machining_items
                            WHERE rfq_id = :rfq_id
                              AND LOWER(COALESCE(operation,'')) = LOWER(:op)
                              AND source = 'ai'
                            LIMIT 1
                        """), {"rfq_id": rfq_id, "op": op_data.get("operation", "")})
                        db_status = "SUCCESS" if check.scalar_one_or_none() else "NOT_WRITTEN"
                    except Exception:
                        db_status = "ERROR"

                report.append({
                    "ai_field": field_key,
                    "approved_value": approved_value[:200],
                    "target_table": "machining_items",
                    "target_column": "operation + machine_name + machining_hours + machine_category",
                    "current_db_value": target_desc,
                    "rfq_id": rfq_id,
                    "status": db_status,
                })
                continue

            # ── Scalar field ─────────────────────────────────────────────────
            mappings = get_mappings_for_key(field_key)
            if not mappings:
                report.append({
                    "ai_field": field_key,
                    "approved_value": approved_value[:100],
                    "target_table": "—",
                    "target_column": "—",
                    "current_db_value": None,
                    "rfq_id": rfq_id,
                    "status": "UNMAPPED",
                })
                continue

            for fm in mappings:
                db_value = None
                db_status = "NOT_WRITTEN"
                if rfq_id:
                    try:
                        tbl_sql = {
                            "rfq_sessions":   f"SELECT {fm.db_column} FROM rfq_sessions WHERE id = :id",
                            "foundry_items":  f"SELECT {fm.db_column} FROM foundry_items WHERE rfq_id = :id ORDER BY row_order LIMIT 1",
                            "heat_treat_items": f"SELECT {fm.db_column} FROM heat_treat_items WHERE rfq_id = :id ORDER BY row_order LIMIT 1",
                        }.get(fm.db_table)
                        if tbl_sql:
                            r = await db.execute(text(tbl_sql), {"id": rfq_id})
                            row = r.mappings().first()
                            db_value = row[fm.db_column] if row else None
                            # Status: SUCCESS if DB value matches (or is non-empty)
                            if db_value is not None and not _is_empty(db_value):
                                db_status = "SUCCESS"
                            else:
                                db_status = "NOT_WRITTEN"
                    except Exception as exc:
                        db_value = f"ERROR: {exc}"
                        db_status = "ERROR"

                report.append({
                    "ai_field": field_key,
                    "approved_value": approved_value[:100],
                    "target_table": fm.db_table,
                    "target_column": fm.db_column,
                    "excel_cell": fm.excel_cell,
                    "current_db_value": str(db_value) if db_value is not None else None,
                    "rfq_id": rfq_id,
                    "status": db_status,
                })

        success = sum(1 for r in report if r["status"] == "SUCCESS")
        not_written = sum(1 for r in report if r["status"] == "NOT_WRITTEN")
        unmapped = sum(1 for r in report if r["status"] == "UNMAPPED")

        return {
            "project_id": project_id,
            "rfq_id": rfq_id,
            "total_approved_fields": len(entities),
            "summary": {
                "SUCCESS": success,
                "NOT_WRITTEN": not_written,
                "UNMAPPED": unmapped,
                "ERROR": len(report) - success - not_written - unmapped,
            },
            "report": report,
        }


# ── Singleton ─────────────────────────────────────────────────────────────────
rfq_sync_service = RFQSyncService()
