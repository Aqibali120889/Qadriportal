"""
app/services/webhook_service.py
─────────────────────────────────────────────────────────────────────────────
Core business logic for Phase 1: Email Intake & Project Creation.

This service is called by POST /api/v1/webhooks/outlook and orchestrates the
complete database write sequence inside a single atomic transaction:

    Projects → Conversations → Emails → Files → Drawings → FileVersions

Error handling:
- DuplicateEmailError:   409 Conflict (n8n should log and skip)
- ValidationError:       400 Bad Request
- Any other exception:   rolls back the entire transaction, returns 500

Design decisions:
- All DB operations go through repositories (never direct session.execute in here)
- The session is passed in from the API layer — this service does NOT own the session
- commit() is called exactly once, at the very end, if ALL operations succeed
- Supabase Storage is NOT called here — n8n uploads BEFORE calling this endpoint
"""

from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import DatabaseTransactionError, DuplicateEmailError
from app.core.logging import get_logger
from app.models.conversation import Conversation, ConversationType
from app.models.drawing import Drawing
from app.models.email import Email, EmailStatus
from app.models.email_attachment import EmailAttachment
from app.models.file import File, FileStatus, FileType
from app.models.file_version import FileVersion
from app.models.project import Project, ProjectStatus
from app.repositories.drawing_repository import DrawingRepository
from app.repositories.email_repository import EmailAttachmentRepository, EmailRepository
from app.repositories.file_repository import FileRepository, FileVersionRepository
from app.repositories.project_repository import ProjectRepository
from app.schemas.webhook import AttachmentPayload, OutlookWebhookPayload, WebhookResponse
from app.services import notification_service
from app.models.notification import NotificationType

logger = get_logger(__name__)


def _to_naive_utc(dt: Optional[datetime]) -> Optional[datetime]:
    """
    Normalize any datetime to naive UTC for TIMESTAMP WITHOUT TIME ZONE columns.

    asyncpg raises DataError when mixing timezone-aware and timezone-naive
    datetimes in the same INSERT. n8n sends ISO 8601 timestamps with 'Z'
    (timezone-aware), while datetime.utcnow() returns naive — this helper
    makes all datetimes consistent (naive UTC) before they reach the DB.
    """
    if dt is None:
        return None
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def _infer_file_type(mime_type: str, filename: str) -> FileType:
    """Map MIME type or file extension to the FileType enum."""
    mime_lower = mime_type.lower()
    name_lower = filename.lower()

    if "pdf" in mime_lower or name_lower.endswith(".pdf"):
        return FileType.PDF
    if "dwg" in name_lower or "autocad" in mime_lower:
        return FileType.DWG
    if name_lower.endswith(".dxf"):
        return FileType.DXF
    if "step" in name_lower or "stp" in name_lower:
        return FileType.STEP
    if "image" in mime_lower or any(name_lower.endswith(ext) for ext in [".jpg", ".jpeg", ".png", ".tiff"]):
        return FileType.IMAGE
    if "excel" in mime_lower or "spreadsheet" in mime_lower or name_lower.endswith(".xlsx"):
        return FileType.XLSX
    if "word" in mime_lower or "document" in mime_lower or name_lower.endswith(".docx"):
        return FileType.DOCX
    if "zip" in mime_lower or name_lower.endswith(".zip"):
        return FileType.ZIP
    return FileType.OTHER


async def ingest_outlook_email(
    payload: OutlookWebhookPayload,
    session: AsyncSession,
) -> WebhookResponse:
    """
    Ingest an email from n8n and create a linked project record.

    Transaction sequence:
      1. Deduplication check
      2. Create Project
      3. Create Conversation
      4. Create Email
      5. For each attachment:
         a. Create File (metadata only — binary already in Supabase Storage)
         b. Create FileVersion (v1)
         c. Create Drawing (for PDFs only)
         d. Create EmailAttachment
      6. Commit

    Raises:
      DuplicateEmailError: if outlook_message_id already exists
      DatabaseTransactionError: on unexpected DB failure (rolls back automatically)
    """
    email_repo = EmailRepository(session)
    project_repo = ProjectRepository(session)
    file_repo = FileRepository(session)
    file_version_repo = FileVersionRepository(session)
    drawing_repo = DrawingRepository(session)
    attachment_repo = EmailAttachmentRepository(session)

    log = logger.bind(outlook_message_id=payload.outlook_message_id)
    log.info("email_ingestion_started", sender=payload.sender_email, subject=payload.subject)

    # ── Step 1: Deduplication ─────────────────────────────────────────────────
    existing = await email_repo.get_by_outlook_message_id(payload.outlook_message_id)
    if existing:
        log.warning("email_already_ingested", email_id=existing.id)
        raise DuplicateEmailError(payload.outlook_message_id)

    try:
        # ── Step 2: Find-or-create Project by RFQ number ──────────────────────
        # The RFQ number IS the business identifier (never auto-generated). A
        # second email on the same RFQ thread must reuse the existing project,
        # not collide with the job_number UNIQUE constraint or create a duplicate.
        job_number = payload.rfq_number
        project = await project_repo.get_by_job_number(job_number)
        is_new_project = project is None

        if project is None:
            project = Project(
                job_number=job_number,
                rfq_number=job_number,
                title=payload.subject[:500] if payload.subject else "Untitled RFQ",
                status=ProjectStatus.DRAFT,
                priority="MEDIUM",
            )
            await project_repo.add(project)
            await session.flush()  # Obtain project.id without committing
            log.info("project_created", project_id=project.id, job_number=job_number)
        else:
            log.info("project_reused", project_id=project.id, job_number=job_number)

        # ── Step 3: Create Conversation ───────────────────────────────────────
        conversation = Conversation(
            project_id=project.id,
            conversation_type=ConversationType.CUSTOMER,
            subject=payload.subject[:1000] if payload.subject else None,
            is_closed=False,
        )
        session.add(conversation)
        await session.flush()  # Obtain conversation.id

        # ── Step 4: Create Email ──────────────────────────────────────────────
        email = Email(
            project_id=project.id,
            conversation_id=conversation.id,
            outlook_message_id=payload.outlook_message_id,
            internet_message_id=payload.internet_message_id,
            subject=payload.subject,
            body=payload.body,
            body_preview=payload.body_preview or (payload.body[:255] if payload.body else None),
            sender_email=payload.sender_email,
            status=EmailStatus.RECEIVED,
            received_at=_to_naive_utc(payload.received_at),
            synced_at=_to_naive_utc(datetime.now(timezone.utc)),
            # folder left NULL — email_folder enum values are not guaranteed across
            # environments; the column is nullable and unused by Phase 1 queries.
        )
        await email_repo.add(email)
        await session.flush()  # Obtain email.id

        # ── Step 5: Process Each Attachment ───────────────────────────────────
        files_ingested = 0
        drawings_created = 0

        for att_payload in payload.attachments:
            file_type = _infer_file_type(att_payload.mime_type, att_payload.original_filename)

            # Step 5a: Create File record
            file_record = File(
                project_id=project.id,
                original_name=att_payload.original_filename,
                file_name=att_payload.original_filename,
                file_type=file_type,
                mime_type=att_payload.mime_type,
                file_size=att_payload.file_size_bytes,
                storage_provider=att_payload.storage_provider,
                storage_path=att_payload.storage_path,
                checksum=att_payload.checksum,
                current_version=1,
                status=FileStatus.AVAILABLE,  # Already uploaded by n8n
            )
            await file_repo.add(file_record)
            await session.flush()  # Obtain file_record.id

            # Step 5b: Create FileVersion (always v1 on first ingest)
            file_version = FileVersion(
                file_id=file_record.id,
                version=1,
                storage_path=att_payload.storage_path,
                checksum=att_payload.checksum,
                remarks="Initial version — ingested from email attachment",
            )
            await file_version_repo.add(file_version)

            # Step 5c: If this is a PDF, create a Drawing record
            if file_type == FileType.PDF:
                drawing = Drawing(
                    project_id=project.id,
                    file_id=file_record.id,
                    drawing_title=att_payload.original_filename.removesuffix(".pdf").removesuffix(".PDF"),
                    drawing_number=None,  # AI extraction populates this in Phase 2
                )
                await drawing_repo.add(drawing)
                drawings_created += 1

            # Step 5d: Create EmailAttachment link
            email_attachment = EmailAttachment(
                email_id=email.id,
                file_id=file_record.id,
                attachment_name=att_payload.original_filename,
                attachment_size=att_payload.file_size_bytes,
            )
            await attachment_repo.add(email_attachment)
            files_ingested += 1

        # ── Step 6: Commit entire transaction ─────────────────────────────────
        await session.commit()

        log.info(
            "email_ingestion_complete",
            project_id=project.id,
            job_number=job_number,
            is_new_project=is_new_project,
            files_ingested=files_ingested,
            drawings_created=drawings_created,
        )

        # ── Notifications (best-effort — never block ingestion on this) ──────
        try:
            if is_new_project:
                await notification_service.notify(
                    session,
                    event_type="new_rfq_email",
                    title=f"New RFQ received: {job_number}",
                    message=payload.subject,
                    severity=NotificationType.SUCCESS,
                    project_id=project.id,
                    department_id=project.current_department_id,
                    rfq_number=job_number,
                )
            else:
                await notification_service.notify(
                    session,
                    event_type="email_received",
                    title=f"New email on {job_number}",
                    message=payload.subject,
                    severity=NotificationType.INFO,
                    project_id=project.id,
                    department_id=project.current_department_id,
                    rfq_number=job_number,
                )
            if drawings_created > 0:
                await notification_service.notify(
                    session,
                    event_type="drawing_uploaded",
                    title=f"Drawing uploaded — {job_number}",
                    message=f"{drawings_created} drawing(s) received, AI processing will start automatically.",
                    severity=NotificationType.INFO,
                    project_id=project.id,
                    department_id=project.current_department_id,
                    rfq_number=job_number,
                )
        except Exception as notif_exc:
            log.warning("notification_emit_failed", error=str(notif_exc))

        return WebhookResponse(
            project_id=project.id,
            project_number=job_number,
            email_id=email.id,
            conversation_id=conversation.id,
            files_ingested=files_ingested,
            drawings_created=drawings_created,
        )

    except DuplicateEmailError:
        await session.rollback()
        raise

    except Exception as exc:
        await session.rollback()
        log.exception("email_ingestion_failed", error=str(exc))
        raise DatabaseTransactionError(
            message="Failed to ingest email — transaction rolled back.",
            detail=str(exc),
        ) from exc
