"""
app/api/v1/webhooks.py
─────────────────────────────────────────────────────────────────────────────
POST /api/v1/webhooks/outlook

Called by the n8n workflow after:
  1. The Microsoft Outlook Trigger fires on a new email
  2. n8n has validated the email (no duplicates, has PDF attachments)
  3. n8n has uploaded all PDF attachments to Supabase Storage
  4. n8n has assembled the structured payload

This endpoint is protected by X-Internal-Key header authentication.
"""

from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, verify_internal_key
from app.core.exceptions import (
    DatabaseTransactionError,
    DuplicateEmailError,
    ValidationError,
)
from app.core.logging import get_logger
from app.database import AsyncSessionLocal
from app.schemas.webhook import OutlookWebhookPayload, WebhookResponse
from app.services.drawing_ai_service import process_drawing
from app.services.webhook_service import ingest_outlook_email

logger = get_logger(__name__)


async def _run_ai_processing(project_id: str) -> None:
    """
    Background task: process the just-ingested drawing with DataLift.

    Runs after the webhook response has already been sent to n8n — the request-
    scoped DB session is closed by then, so this opens its own. Failures are
    logged and swallowed: process_drawing() already records FAILED on the
    ocr_jobs row itself, and n8n has nothing to retry here (the email was
    already ingested successfully).
    """
    async with AsyncSessionLocal() as db:
        try:
            result = await process_drawing(project_id=project_id, db=db, force_reprocess=False)
            logger.info("background_ai_processing_done", project_id=project_id, status=result.get("status"))
        except Exception as exc:
            logger.exception("background_ai_processing_failed", project_id=project_id, error=str(exc))

router = APIRouter(
    prefix="/webhooks",
    tags=["Webhooks"],
)


@router.post(
    "/outlook",
    response_model=WebhookResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(verify_internal_key)],
    summary="Ingest Outlook Email from n8n",
    description=(
        "Receives a structured email payload from the n8n workflow. "
        "Creates a Project, Conversation, Email, File, Drawing, and FileVersion records "
        "inside a single atomic database transaction. "
        "Protected by X-Internal-Key header."
    ),
    responses={
        201: {"description": "Email ingested and project created successfully"},
        400: {"description": "Validation error — missing subject, no PDF, invalid MIME type"},
        401: {"description": "Invalid or missing X-Internal-Key"},
        409: {"description": "Duplicate email — already ingested"},
        500: {"description": "Database transaction failed"},
    },
)
async def ingest_outlook_webhook(
    payload: OutlookWebhookPayload,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> WebhookResponse:
    """
    n8n calls this endpoint once per new Outlook email.
    The binary PDF files must already be uploaded to Supabase Storage
    before this endpoint is called.

    AI processing is queued automatically (in the background, after this
    response is sent) whenever a new drawing was ingested — no manual
    "Process Drawing" click required. A follow-up email on an existing RFQ
    thread with no new attachment does not re-trigger it.
    """
    log = logger.bind(
        outlook_message_id=payload.outlook_message_id,
        sender=payload.sender_email,
    )

    try:
        response = await ingest_outlook_email(payload=payload, session=db)
        log.info(
            "webhook_processed",
            project_id=response.project_id,
            project_number=response.project_number,
        )

        if response.drawings_created > 0:
            background_tasks.add_task(_run_ai_processing, response.project_id)
            log.info("ai_processing_queued", project_id=response.project_id)

        return response

    except DuplicateEmailError as exc:
        log.warning("webhook_duplicate", message=exc.message)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "DUPLICATE_EMAIL", "message": exc.message},
        )

    except ValidationError as exc:
        log.warning("webhook_validation_error", message=exc.message)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "VALIDATION_ERROR", "message": exc.message},
        )

    except DatabaseTransactionError as exc:
        log.error("webhook_db_error", message=exc.message, detail=exc.detail)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "DB_ERROR", "message": exc.message},
        )
