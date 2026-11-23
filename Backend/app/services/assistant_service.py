"""
app/services/assistant_service.py
─────────────────────────────────────────────────────────────────────────────
Phase 8: Enterprise AI Assistant — n8n RAG Webhook Integration

Responsibilities:
  1. Resolve RFQ number → project_id (department-scoped via existing ProjectRepository)
  2. Load/create AI chat conversations (reusing `conversations` table)
  3. Persist messages in `ai_chat_messages`
  4. Proxy user message to n8n RAG webhook
  5. Return structured response

Business Rules:
  • Department isolation: non-super-admin users can only query their own
    department's RFQs (enforced by project query — same rule as Phase 3)
  • Customer never sees project_id — they work with rfq_number only
  • global_mode=True → rfq_number and project_id are omitted from webhook
  • Webhook timeout: 60 s (n8n can be slow on cold start)
  • If webhook fails → return a graceful error message (no 500 to UI)
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx
from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import RequestContext
from app.core.logging import get_logger

logger = get_logger(__name__)

# ── n8n Webhooks ──────────────────────────────────────────────────────────────
# Single n8n workflow handles both chat (JSON) and document ingestion (multipart).
N8N_WEBHOOK_URL = (
    "https://abdullah66500.app.n8n.cloud/webhook/"
    "d8494dd1-62d8-499b-855f-406a3b094cef"
)
# Document ingestion uses the SAME webhook URL — n8n distinguishes requests
# by content-type: chat uses application/json, files use multipart/form-data.
import os as _os
N8N_DOC_WEBHOOK_URL: str = _os.environ.get(
    "N8N_DOCUMENT_WEBHOOK_URL",
    "https://abdullah66500.app.n8n.cloud/webhook/d8494dd1-62d8-499b-855f-406a3b094cef",
)
WEBHOOK_TIMEOUT_S = 60.0
DOC_UPLOAD_TIMEOUT_S = 120.0   # large files can take time
ALLOWED_DOC_MIMETYPES = {
    # Documents
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
    "text/plain",
    # Images
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "image/gif",
    "image/bmp",
    "image/tiff",
    "image/svg+xml",
}
MAX_DOC_SIZE_MB = 50


# ══════════════════════════════════════════════════════════════════════════════
# RFQ RESOLUTION
# ══════════════════════════════════════════════════════════════════════════════

async def list_rfqs_for_user(ctx: RequestContext, db: AsyncSession) -> List[Dict]:
    """
    Return all RFQ numbers visible to the current user (department-scoped).
    Super Admin sees everything. Uses current_department_id column on projects.
    """
    if ctx.is_super_admin:
        result = await db.execute(text("""
            SELECT
                p.id         AS project_id,
                p.job_number AS rfq_number,
                p.title,
                p.status
            FROM projects p
            WHERE p.deleted_at IS NULL
            ORDER BY p.created_at DESC
            LIMIT 500
        """))
    else:
        result = await db.execute(text("""
            SELECT
                p.id         AS project_id,
                p.job_number AS rfq_number,
                p.title,
                p.status
            FROM projects p
            WHERE p.deleted_at IS NULL
              AND (
                  p.current_department_id = :dept_id
                  OR p.current_department_id IS NULL
              )
            ORDER BY p.created_at DESC
            LIMIT 500
        """), {"dept_id": ctx.department_id})

    rows = result.mappings().all()
    return [
        {
            "rfq_number": r["rfq_number"],
            "project_id": str(r["project_id"]),
            "title":      r["title"],
            "status":     r["status"],
        }
        for r in rows
    ]


async def resolve_rfq_to_project(
    rfq_number: str, ctx: RequestContext, db: AsyncSession
) -> Optional[str]:
    """
    Resolve a job_number (RFQ identifier) to project_id, respecting dept isolation.
    Returns None if not found or not accessible.
    """
    if ctx.is_super_admin:
        result = await db.execute(text("""
            SELECT id FROM projects
            WHERE job_number = :rfq AND deleted_at IS NULL
            LIMIT 1
        """), {"rfq": rfq_number})
    else:
        result = await db.execute(text("""
            SELECT id FROM projects
            WHERE job_number = :rfq
              AND deleted_at IS NULL
              AND (
                  current_department_id = :dept_id
                  OR current_department_id IS NULL
              )
            LIMIT 1
        """), {"rfq": rfq_number, "dept_id": ctx.department_id})

    row = result.first()
    return str(row[0]) if row else None


# ══════════════════════════════════════════════════════════════════════════════
# CONVERSATION MANAGEMENT
# ══════════════════════════════════════════════════════════════════════════════

async def list_conversations(ctx: RequestContext, db: AsyncSession) -> List[Dict]:
    """
    Return AI chat conversations for the current user, newest first.
    Only conversations where initiated_by = current user_id.
    """
    result = await db.execute(text("""
        SELECT
            c.id,
            c.subject AS title,
            c.project_id,
            p.job_number AS rfq_number,
            c.created_at,
            c.updated_at,
            COUNT(m.id) AS message_count,
            MAX(m.created_at) AS last_message_at
        FROM conversations c
        LEFT JOIN projects p ON p.id = c.project_id
        LEFT JOIN ai_chat_messages m ON m.conversation_id = c.id
        WHERE c.initiated_by = :user_id
          AND c.conversation_type = 'INTERNAL'
          AND c.is_closed = false
        GROUP BY c.id, c.subject, c.project_id, p.job_number, c.created_at, c.updated_at
        ORDER BY COALESCE(MAX(m.created_at), c.created_at) DESC
        LIMIT 100
    """), {"user_id": ctx.user_id})
    rows = result.mappings().all()
    return [
        {
            "id": str(r["id"]),
            "title": r["title"],
            "rfq_number": r["rfq_number"],
            "project_id": str(r["project_id"]) if r["project_id"] else None,
            "message_count": r["message_count"] or 0,
            "last_message_at": r["last_message_at"].isoformat() if r["last_message_at"] else None,
            "created_at": r["created_at"].isoformat(),
        }
        for r in rows
    ]


async def create_conversation(
    ctx: RequestContext,
    db: AsyncSession,
    project_id: Optional[str],
    rfq_number: Optional[str],
    title: Optional[str],
) -> Dict:
    """Create a new AI chat conversation."""
    conv_id = str(uuid.uuid4())
    subject = title or (f"Chat — {rfq_number}" if rfq_number else "Global Chat")
    now = datetime.now(timezone.utc)

    await db.execute(text("""
        INSERT INTO conversations
            (id, project_id, conversation_type, subject, initiated_by,
             is_closed, created_at, updated_at)
        VALUES
            (:id, :project_id, 'INTERNAL', :subject, :user_id,
             false, :now, :now)
    """), {
        "id": conv_id,
        "project_id": project_id,
        "subject": subject,
        "user_id": ctx.user_id,
        "now": now,
    })
    await db.commit()
    logger.info("ai_conversation_created", conv_id=conv_id, user=ctx.user_id, rfq=rfq_number)

    return {
        "id": conv_id,
        "title": subject,
        "rfq_number": rfq_number,
        "project_id": project_id,
        "message_count": 0,
        "last_message_at": None,
        "created_at": now.isoformat(),
    }


async def get_conversation_messages(
    conversation_id: str, ctx: RequestContext, db: AsyncSession
) -> List[Dict]:
    """Load all messages for a conversation, oldest first."""
    # Verify ownership
    check = await db.execute(text("""
        SELECT id FROM conversations
        WHERE id = :cid AND initiated_by = :uid AND is_closed = false
    """), {"cid": conversation_id, "uid": ctx.user_id})
    if not check.first():
        return []

    result = await db.execute(text("""
        SELECT id, role, content, metadata, created_at
        FROM ai_chat_messages
        WHERE conversation_id = :cid
        ORDER BY created_at ASC
    """), {"cid": conversation_id})
    rows = result.mappings().all()
    return [
        {
            "id": str(r["id"]),
            "role": r["role"],
            "content": r["content"],
            "metadata": r["metadata"] or {},
            "created_at": r["created_at"].isoformat(),
        }
        for r in rows
    ]


async def delete_conversation(
    conversation_id: str, ctx: RequestContext, db: AsyncSession
) -> bool:
    """Soft-close (is_closed=true) an AI conversation for the current user."""
    result = await db.execute(text("""
        UPDATE conversations
        SET is_closed = true, updated_at = now()
        WHERE id = :cid AND initiated_by = :uid
        RETURNING id
    """), {"cid": conversation_id, "uid": ctx.user_id})
    deleted = result.first() is not None
    if deleted:
        await db.commit()
    return deleted


async def _save_message(
    conversation_id: str, role: str, content: str,
    metadata: Dict, db: AsyncSession
) -> Dict:
    """Persist one message and return it."""
    import json
    msg_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    # NOTE: asyncpg does not allow mixing ::cast syntax with named parameters.
    # Use CAST(:param AS jsonb) instead of :param::jsonb.
    await db.execute(text("""
        INSERT INTO ai_chat_messages (id, conversation_id, role, content, metadata, created_at)
        VALUES (:id, :cid, :role, :content, CAST(:meta AS jsonb), :now)
    """), {
        "id": msg_id,
        "cid": conversation_id,
        "role": role,
        "content": content,
        "meta": json.dumps(metadata),
        "now": now,
    })
    # Bump conversation.updated_at
    await db.execute(text("""
        UPDATE conversations SET updated_at = :now WHERE id = :cid
    """), {"now": now, "cid": conversation_id})
    await db.commit()
    return {
        "id": msg_id,
        "role": role,
        "content": content,
        "metadata": metadata,
        "created_at": now.isoformat(),
    }


# ══════════════════════════════════════════════════════════════════════════════
# WEBHOOK PROXY
# ══════════════════════════════════════════════════════════════════════════════

async def _call_n8n_webhook(payload: Dict) -> str:
    """
    POST the payload to the n8n RAG agent webhook.
    Returns the assistant's text response.
    Handles timeouts and errors gracefully.
    """
    try:
        async with httpx.AsyncClient(timeout=WEBHOOK_TIMEOUT_S) as client:
            resp = await client.post(N8N_WEBHOOK_URL, json=payload)
            resp.raise_for_status()
    except httpx.TimeoutException:
        logger.warning("n8n_webhook_timeout", url=N8N_WEBHOOK_URL)
        return (
            "⚠️ The AI assistant is taking longer than expected. "
            "Please try again in a moment."
        )
    except httpx.HTTPStatusError as e:
        logger.error("n8n_webhook_http_error", status=e.response.status_code, url=N8N_WEBHOOK_URL)
        return (
            f"⚠️ The AI assistant returned an error (HTTP {e.response.status_code}). "
            "Please try again or contact support."
        )
    except Exception as e:
        logger.error("n8n_webhook_unexpected_error", error=str(e))
        return (
            "⚠️ Unable to reach the AI assistant right now. "
            "Please check your connection and try again."
        )

    # Parse response — n8n can return many shapes
    try:
        data = resp.json()
    except Exception:
        return resp.text.strip() or "⚠️ The AI assistant returned an empty response."

    # Common n8n response shapes:
    # {"output": "..."} | {"response": "..."} | {"message": "..."} | "plain string"
    if isinstance(data, str):
        return data.strip()
    if isinstance(data, list) and data:
        first = data[0]
        if isinstance(first, dict):
            return (
                first.get("output")
                or first.get("response")
                or first.get("message")
                or first.get("text")
                or str(first)
            )
        return str(first)
    if isinstance(data, dict):
        return (
            data.get("output")
            or data.get("response")
            or data.get("message")
            or data.get("text")
            or data.get("answer")
            or "⚠️ No response from AI assistant."
        )
    return str(data)


# ══════════════════════════════════════════════════════════════════════════════
# MAIN CHAT HANDLER
# ══════════════════════════════════════════════════════════════════════════════

async def handle_chat(
    user_message: str,
    conversation_id: Optional[str],
    rfq_number: Optional[str],
    global_mode: bool,
    ctx: RequestContext,
    db: AsyncSession,
    session_id: Optional[str] = None,
    project_id_hint: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Orchestrate one user chat turn:
      1. Resolve conversation (create if needed)
      2. Resolve project_id from rfq_number (or None for global mode)
      3. Save user message
      4. Call n8n webhook
      5. Save assistant message
      6. Return structured response
    """
    log = logger.bind(user_id=ctx.user_id, rfq=rfq_number, global_mode=global_mode)

    # ── 1. Resolve project_id ─────────────────────────────────────────────────
    project_id: Optional[str] = None
    if rfq_number and not global_mode:
        project_id = await resolve_rfq_to_project(rfq_number, ctx, db)
        if not project_id:
            log.warning("rfq_not_found_for_user", rfq=rfq_number)
            # Don't hard-fail — proceed in global mode
            rfq_number = None
            global_mode = True

    # ── 2. Resolve conversation ───────────────────────────────────────────────
    if not conversation_id:
        conv_data = await create_conversation(ctx, db, project_id, rfq_number, title=None)
        conversation_id = conv_data["id"]
    else:
        # Verify it belongs to this user
        check = await db.execute(text("""
            SELECT id FROM conversations
            WHERE id = :cid AND initiated_by = :uid AND is_closed = false
        """), {"cid": conversation_id, "uid": ctx.user_id})
        if not check.first():
            conv_data = await create_conversation(ctx, db, project_id, rfq_number, title=None)
            conversation_id = conv_data["id"]
            log.warning("invalid_conv_id_created_new", new_conv=conversation_id)

    # ── 3. Save user message ──────────────────────────────────────────────────
    await _save_message(conversation_id, "user", user_message, {}, db)

    # ── 4. Build and send webhook payload ───────────────────────────────────────────────
    # n8n expects: question, project_id, rfq_number, department,
    #              user_id, session_id, conversation_id, timestamp
    timestamp = datetime.now(timezone.utc).isoformat()
    webhook_payload: Dict[str, Any] = {
        # Primary question field (n8n uses 'question')
        "question":         user_message,
        "message":          user_message,    # backwards-compat alias
        # Conversation / session tracking
        "conversation_id": conversation_id,
        "session_id":       session_id or conversation_id,
        "timestamp":        timestamp,
        # User identity
        "user_id":          ctx.user_id,
        # Department (human-readable for n8n prompt context)
        "department":       ctx.department_name or "Unknown",
        "department_id":    ctx.department_id,
        # Mode flag
        "global_mode":      global_mode or (rfq_number is None),
    }
    if project_id:
        webhook_payload["project_id"] = project_id
    if rfq_number:
        webhook_payload["rfq_number"] = rfq_number

    log.info("n8n_webhook_calling", conv_id=conversation_id, payload_keys=list(webhook_payload.keys()))
    assistant_text = await _call_n8n_webhook(webhook_payload)
    log.info("n8n_webhook_responded", response_len=len(assistant_text))

    # ── 5. Save assistant message ─────────────────────────────────────────────
    assistant_msg = await _save_message(
        conversation_id, "assistant", assistant_text,
        {"rfq_number": rfq_number, "project_id": project_id, "global_mode": global_mode},
        db,
    )

    return {
        "conversation_id": conversation_id,
        "message": assistant_msg,
        "rfq_number": rfq_number,
        "global_mode": global_mode or (rfq_number is None),
    }


# ══════════════════════════════════════════════════════════════════════════════
# CHAT WITH FILE — send message + file bytes together to n8n
# ══════════════════════════════════════════════════════════════════════════════

async def handle_chat_with_file(
    user_message: str,
    file_bytes: bytes,
    filename: str,
    content_type: str,
    conversation_id: Optional[str],
    rfq_number: Optional[str],
    global_mode: bool,
    ctx: RequestContext,
    db: AsyncSession,
    session_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Send a user message AND a file together to the n8n webhook in one multipart call.
    n8n receives:
      - file     : the binary file bytes
      - message  : the user's text question / instruction
      - metadata : JSON with conversation context, RFQ, user, department info

    Steps:
      1. Resolve project_id from rfq_number (dept-scoped, same as handle_chat)
      2. Get/create conversation
      3. Save user message (text mentions the filename)
      4. POST multipart to n8n (file + message + metadata)
      5. Save assistant response
      6. Return ChatResponse
    """
    import json as _json

    log = logger.bind(user_id=ctx.user_id, rfq=rfq_number, filename=filename)

    # ── 1. Resolve project_id ──────────────────────────────────────────────────
    project_id: Optional[str] = None
    if rfq_number and not global_mode:
        project_id = await resolve_rfq_to_project(rfq_number, ctx, db)
        if not project_id:
            log.warning("rfq_not_found_for_user_chat_with_file", rfq=rfq_number)
            rfq_number = None
            global_mode = True

    # ── 2. Resolve conversation ────────────────────────────────────────────────
    if not conversation_id:
        conv_data = await create_conversation(ctx, db, project_id, rfq_number, title=None)
        conversation_id = conv_data["id"]
    else:
        check = await db.execute(text("""
            SELECT id FROM conversations
            WHERE id = :cid AND initiated_by = :uid AND is_closed = false
        """), {"cid": conversation_id, "uid": ctx.user_id})
        if not check.first():
            conv_data = await create_conversation(ctx, db, project_id, rfq_number, title=None)
            conversation_id = conv_data["id"]

    # ── 3. Save user message (text + file mention) ────────────────────────────
    display_content = f"{user_message}\n\n📎 _{filename}_"
    await _save_message(conversation_id, "user", display_content, {"filename": filename}, db)

    # ── 4. Build multipart payload and call n8n ────────────────────────────────
    timestamp = datetime.now(timezone.utc).isoformat()
    meta = {
        # Primary question field — matches chat endpoint payload shape
        "question":        user_message,
        "message":         user_message,
        # Conversation / session tracking
        "conversation_id": conversation_id,
        "session_id":      session_id or conversation_id,
        "timestamp":       timestamp,
        # User identity
        "user_id":         ctx.user_id,
        # Department
        "department":      ctx.department_name or "Unknown",
        "department_id":   ctx.department_id,
        # File info
        "filename":        filename,
        "global_mode":     global_mode or (rfq_number is None),
    }
    if project_id:
        meta["project_id"] = project_id
    if rfq_number:
        meta["rfq_number"] = rfq_number

    log.info(
        "n8n_chat_with_file_calling",
        conv_id=conversation_id,
        filename=filename,
        size_kb=round(len(file_bytes) / 1024, 1),
    )

    assistant_text: str
    try:
        async with httpx.AsyncClient(timeout=DOC_UPLOAD_TIMEOUT_S) as client:
            resp = await client.post(
                N8N_DOC_WEBHOOK_URL,
                files={"file": (filename, file_bytes, content_type)},
                data={
                    "message":  user_message,
                    "metadata": _json.dumps(meta),
                },
            )
            resp.raise_for_status()
        assistant_text = _parse_n8n_response(resp)
    except httpx.TimeoutException:
        log.warning("n8n_chat_with_file_timeout")
        assistant_text = (
            "⚠️ The AI assistant took too long to process your file. "
            "Please try again — large files may take a moment."
        )
    except httpx.HTTPStatusError as e:
        log.error("n8n_chat_with_file_http_error", status=e.response.status_code)
        assistant_text = (
            f"⚠️ The AI assistant returned HTTP {e.response.status_code} while "
            "processing your file. Please try again."
        )
    except Exception as e:
        log.error("n8n_chat_with_file_error", error=str(e))
        assistant_text = "⚠️ Unable to process your file right now. Please try again."

    # ── 5. Save assistant response ─────────────────────────────────────────────
    assistant_msg = await _save_message(
        conversation_id, "assistant", assistant_text,
        {"rfq_number": rfq_number, "project_id": project_id, "filename": filename},
        db,
    )

    return {
        "conversation_id": conversation_id,
        "message":         assistant_msg,
        "rfq_number":      rfq_number,
        "global_mode":     global_mode or (rfq_number is None),
    }


# ══════════════════════════════════════════════════════════════════════════════
# DOCUMENT INGESTION — forward file bytes to n8n vector webhook
# ══════════════════════════════════════════════════════════════════════════════

async def ingest_document(
    file_bytes: bytes,
    filename: str,
    content_type: str,
    rfq_number: Optional[str],
    description: Optional[str],
    ctx: RequestContext,
    db: AsyncSession,
) -> Dict[str, Any]:
    """
    Forward an uploaded PDF/doc to the n8n document ingestion webhook so that
    n8n can embed it into the vector store.

    Rules:
      • File bytes are sent directly as multipart/form-data — nothing is stored
        in Supabase Storage or in any DB table.
      • If rfq_number is provided, project_id is resolved (department-scoped)
        and passed as metadata so n8n can tag the embedding correctly.
      • n8n is responsible for all chunking, embedding, and vector upsert.
      • Timeout: 120 s (large PDFs can take time to process).
    """
    import json as _json

    # Validate file size
    size_mb = len(file_bytes) / (1024 * 1024)
    if size_mb > MAX_DOC_SIZE_MB:
        return {
            "success": False,
            "message": f"File too large ({size_mb:.1f} MB). Maximum allowed: {MAX_DOC_SIZE_MB} MB.",
            "filename": filename,
        }

    # Validate MIME type
    if content_type not in ALLOWED_DOC_MIMETYPES:
        return {
            "success": False,
            "message": (
                f"Unsupported file type '{content_type}'. "
                "Supported: PDF, DOCX, DOC, TXT, PNG, JPG, WEBP, GIF, BMP, TIFF."
            ),
            "filename": filename,
        }

    # Resolve project_id if RFQ number given (still respects dept isolation)
    project_id: Optional[str] = None
    if rfq_number:
        project_id = await resolve_rfq_to_project(rfq_number, ctx, db)
        if not project_id:
            logger.warning("doc_ingest_rfq_not_found", rfq=rfq_number, user=ctx.user_id)
            rfq_number = None   # proceed without RFQ context

    # Build metadata JSON (sent as a form field alongside the file)
    meta = {
        "filename":        filename,
        "user_id":         ctx.user_id,
        "department_id":   ctx.department_id,
        "department_name": ctx.department_name,
        "description":     description or "",
    }
    if rfq_number:
        meta["rfq_number"] = rfq_number
    if project_id:
        meta["project_id"] = project_id

    logger.info(
        "doc_ingest_webhook_calling",
        filename=filename,
        size_mb=round(size_mb, 2),
        rfq=rfq_number,
        user=ctx.user_id,
        webhook=N8N_DOC_WEBHOOK_URL,
    )

    try:
        async with httpx.AsyncClient(timeout=DOC_UPLOAD_TIMEOUT_S) as client:
            resp = await client.post(
                N8N_DOC_WEBHOOK_URL,
                files={"file": (filename, file_bytes, content_type)},
                data={"metadata": _json.dumps(meta)},
            )
            resp.raise_for_status()

    except httpx.TimeoutException:
        logger.warning("doc_ingest_webhook_timeout", filename=filename)
        return {
            "success": False,
            "message": (
                "The document was received but the ingestion service is taking too long. "
                "It may still be processed — please check again in a few minutes."
            ),
            "filename": filename,
        }
    except httpx.HTTPStatusError as e:
        logger.error("doc_ingest_webhook_http_error", status=e.response.status_code, filename=filename)
        return {
            "success": False,
            "message": f"Ingestion service returned HTTP {e.response.status_code}. Please try again.",
            "filename": filename,
        }
    except Exception as e:
        logger.error("doc_ingest_webhook_unexpected_error", error=str(e), filename=filename)
        return {
            "success": False,
            "message": "Unable to reach the document ingestion service. Please try again.",
            "filename": filename,
        }

    # Parse n8n acknowledgement (shape varies by n8n version)
    try:
        ack = resp.json()
        if isinstance(ack, list) and ack:
            ack = ack[0]
        ack_message = (
            (ack.get("message") or ack.get("output") or ack.get("status") or "")
            if isinstance(ack, dict) else str(ack)
        )
    except Exception:
        ack_message = resp.text.strip() or "Document received by ingestion service."

    logger.info("doc_ingest_webhook_success", filename=filename, ack=ack_message[:120])
    return {
        "success":     True,
        "message":     ack_message or "Document sent to ingestion service successfully.",
        "filename":    filename,
        "size_mb":     round(size_mb, 2),
        "rfq_number":  rfq_number,
        "project_id":  project_id,
    }
