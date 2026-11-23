"""
app/api/v1/rfq.py
────────────────────────────────────────────────────────────────────────────
Project ↔ RFQ Session bridge endpoint.

Architecture:
  - project.id      → internal system UUID (never shown to users)
  - project.rfq_number → user-facing identifier (from email, org-wide unique)
  - rfq_sessions.rfq_number → matches projects.rfq_number exactly

Flow:
  POST /api/v1/projects/{project_id}/rfq
    → reads project.rfq_number
    → looks up rfq_sessions WHERE rfq_number = project.rfq_number
    → if not found, creates a new rfq_session pre-populated from project data
    → returns the rfq_id so the frontend can open the Cost Estimation Sheet
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text

from app.api.deps import get_db, get_request_context
from app.core.context import RequestContext
from app.core.logging import get_logger
from app.excel.supabase_client import get_supabase

logger = get_logger(__name__)

router = APIRouter(prefix="/projects", tags=["Cost Estimation RFQ"])


@router.post(
    "/{project_id}/rfq",
    summary="Get or Create RFQ Session for Project",
    description=(
        "Looks up the rfq_session linked to this project via rfq_number. "
        "If no session exists, creates one pre-populated with project metadata. "
        "Returns the rfq_id and rfq_number so the frontend can open the sheet."
    ),
    responses={
        200: {"description": "RFQ session found or created"},
        404: {"description": "Project not found or has no rfq_number"},
    },
)
async def get_or_create_rfq(
    project_id: str,
    ctx: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Bridge: enterprise project_id → rfq_session via rfq_number.
    project.id is the internal system key — rfq_number is the user identifier.
    """
    # ── Load project from enterprise DB ──────────────────────────────────────
    result = await db.execute(
        text("""
            SELECT
                p.id,
                p.rfq_number,
                p.title,
                e.subject,
                e.sender_email,
                e.received_at,
                d.drawing_number,
                d.drawing_title
            FROM projects p
            LEFT JOIN emails e ON e.id = (
                SELECT id FROM emails WHERE project_id = p.id LIMIT 1
            )
            LEFT JOIN drawings d ON d.project_id = p.id
            WHERE p.id = :pid
            LIMIT 1
        """),
        {"pid": project_id},
    )
    row = result.mappings().first()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "PROJECT_NOT_FOUND", "message": "Project not found."},
        )

    rfq_number = row["rfq_number"]
    if not rfq_number:
        # Auto-generate rfq_number for projects that don't have one set yet
        rfq_number = f"RFQ-2026-{project_id[:6].upper()}"
        await db.execute(
            text("UPDATE projects SET rfq_number = :num WHERE id = :pid"),
            {"num": rfq_number, "pid": project_id},
        )
        await db.commit()
        logger.info("rfq_number_auto_generated", project_id=project_id, rfq_number=rfq_number)

    # ── Look up rfq_session in enterprise Supabase ───────────────────────────
    sb = get_supabase()
    existing = (
        sb.table("rfq_sessions")
        .select("id, rfq_number, status, customer_name, item_name, created_at")
        .eq("rfq_number", rfq_number)
        .limit(1)
        .execute()
    )

    if existing.data:
        session = existing.data[0]
        logger.info(
            "rfq_session_found",
            project_id=project_id,
            rfq_number=rfq_number,
            rfq_id=session["id"],
        )
        return {
            "rfq_id": session["id"],
            "rfq_number": session["rfq_number"],
            "status": session["status"],
            "customer_name": session.get("customer_name"),
            "item_name": session.get("item_name"),
            "is_new": False,
        }

    # ── Create new rfq_session pre-populated from project data ───────────────
    # IMPORTANT: customer_name must start EMPTY so the AI sync engine can write
    # the value extracted from the drawing title block (sender_email is NEVER
    # a customer name — that would violate the core business rule).
    customer_name = ""
    item_name = row.get("drawing_title") or row.get("title") or ""
    drawing_number = row.get("drawing_number") or ""
    # enq_ref defaults to rfq_number, NOT the email subject — the email subject
    # is raw email metadata, not the enquiry reference from the drawing title block.
    enq_ref = rfq_number

    created = sb.table("rfq_sessions").insert({
        "rfq_number": rfq_number,
        "customer_name": customer_name,
        "item_name": item_name,
        "drawing_number": drawing_number,
        "enq_ref": enq_ref,
        "status": "draft",
        "overhead_pct": 0.05,
        "req_qty": 1,
        "exchange_rate": 270,
        "currency": "USD",
        "income_tax_pct": 0.02,
        "other_agent_commission_pct": 0.02,
        "other_contingency_pct": 0.02,
        "pattern_division_qty": 1,
    }).execute()

    if not created.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "RFQ_CREATE_FAILED", "message": "Failed to create RFQ session."},
        )

    new_session = created.data[0]
    logger.info(
        "rfq_session_created",
        project_id=project_id,
        rfq_number=rfq_number,
        rfq_id=new_session["id"],
    )

    return {
        "rfq_id": new_session["id"],
        "rfq_number": new_session["rfq_number"],
        "status": new_session["status"],
        "customer_name": new_session.get("customer_name"),
        "item_name": new_session.get("item_name"),
        "is_new": True,
    }
