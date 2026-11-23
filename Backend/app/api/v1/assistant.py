"""
app/api/v1/assistant.py
─────────────────────────────────────────────────────────────────────────────
Phase 8: Enterprise AI Assistant API endpoints

Routes:
  GET    /api/v1/assistant/rfqs                         — department-scoped RFQ list
  GET    /api/v1/assistant/conversations                — list user's AI conversations
  POST   /api/v1/assistant/conversations                — create new conversation
  GET    /api/v1/assistant/conversations/{id}/messages  — load message history
  DELETE /api/v1/assistant/conversations/{id}           — delete conversation
  POST   /api/v1/assistant/chat                         — send message → n8n → response
  POST   /api/v1/assistant/documents/ingest             — upload PDF/doc → n8n vector store

Department Isolation: fully inherited from get_request_context.
"""
from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_request_context
from app.core.context import RequestContext
from app.core.logging import get_logger
from app.schemas.assistant import (
    ChatRequest, ChatResponse, ConversationCreate, ConversationOut,
    DocumentIngestResponse, MessageOut, RFQItem,
)
from app.services import assistant_service

logger = get_logger(__name__)

router = APIRouter(prefix="/assistant", tags=["AI Assistant"])


# ── RFQ List ──────────────────────────────────────────────────────────────────

@router.get(
    "/rfqs",
    response_model=List[RFQItem],
    summary="List accessible RFQ numbers",
    description=(
        "Returns all RFQ numbers visible to the current user. "
        "Department-scoped: regular users see only their department's RFQs. "
        "Super Admin sees all."
    ),
)
async def list_rfqs(
    ctx: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
) -> List[RFQItem]:
    rfqs = await assistant_service.list_rfqs_for_user(ctx, db)
    return [RFQItem(**r) for r in rfqs]


# ── Conversations ─────────────────────────────────────────────────────────────

@router.get(
    "/conversations",
    response_model=List[ConversationOut],
    summary="List AI conversations",
)
async def list_conversations(
    ctx: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
) -> List[ConversationOut]:
    convs = await assistant_service.list_conversations(ctx, db)
    return [ConversationOut(**c) for c in convs]


@router.post(
    "/conversations",
    response_model=ConversationOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create new AI conversation",
)
async def create_conversation(
    body: ConversationCreate,
    ctx: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
) -> ConversationOut:
    project_id = None
    if body.rfq_number:
        project_id = await assistant_service.resolve_rfq_to_project(body.rfq_number, ctx, db)
        if not project_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"RFQ '{body.rfq_number}' not found or not accessible.",
            )
    conv = await assistant_service.create_conversation(
        ctx, db, project_id, body.rfq_number, body.title
    )
    return ConversationOut(**conv)


@router.get(
    "/conversations/{conversation_id}/messages",
    response_model=List[MessageOut],
    summary="Load conversation message history",
)
async def get_messages(
    conversation_id: str,
    ctx: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
) -> List[MessageOut]:
    messages = await assistant_service.get_conversation_messages(conversation_id, ctx, db)
    return [MessageOut(**m) for m in messages]


@router.delete(
    "/conversations/{conversation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an AI conversation",
    response_model=None,
)
async def delete_conversation(
    conversation_id: str,
    ctx: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
):
    deleted = await assistant_service.delete_conversation(conversation_id, ctx, db)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found or already deleted.",
        )


# ── Chat ──────────────────────────────────────────────────────────────────────

@router.post(
    "/chat",
    response_model=ChatResponse,
    summary="Send message to RAG AI assistant",
    description=(
        "Sends a user message through FastAPI → n8n webhook → RAG agent. "
        "If rfq_number is provided, the message is answered in the context of that RFQ. "
        "If rfq_number is omitted or global_mode=true, the full enterprise knowledge base is queried."
    ),
)
async def chat(
    body: ChatRequest,
    ctx: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
) -> ChatResponse:
    logger.info(
        "assistant_chat_request",
        user=ctx.user_id,
        rfq=body.rfq_number,
        global_mode=body.global_mode,
        conv=body.conversation_id,
    )

    result = await assistant_service.handle_chat(
        user_message=body.message,
        conversation_id=body.conversation_id,
        rfq_number=body.rfq_number,
        global_mode=body.global_mode,
        ctx=ctx,
        db=db,
        session_id=body.session_id,
        project_id_hint=body.project_id,
    )

    return ChatResponse(
        conversation_id=result["conversation_id"],
        message=MessageOut(**result["message"]),
        rfq_number=result["rfq_number"],
        global_mode=result["global_mode"],
    )


# ── Chat with File ────────────────────────────────────────────────────────────

@router.post(
    "/chat-with-file",
    response_model=ChatResponse,
    summary="Send message + file to AI assistant (combined)",
    description=(
        "Accepts a multipart/form-data request containing both the user's text message "
        "AND a file attachment (PDF, DOCX, image, etc.). Both are forwarded together "
        "to the n8n RAG webhook so the AI can answer questions about the specific file. "
        "The file is NOT stored anywhere — it goes directly to n8n in memory."
    ),
)
async def chat_with_file(
    message:         str        = Form(..., description="The user's text question or instruction"),
    file:            UploadFile = File(..., description="PDF, DOCX, image, or TXT file"),
    conversation_id: Optional[str] = Form(default=None),
    rfq_number:      Optional[str] = Form(default=None),
    global_mode:     bool          = Form(default=False),
    session_id:      Optional[str] = Form(default=None),
    ctx: RequestContext = Depends(get_request_context),
    db:  AsyncSession   = Depends(get_db),
) -> ChatResponse:
    logger.info(
        "assistant_chat_with_file_request",
        user=ctx.user_id,
        filename=file.filename,
        content_type=file.content_type,
        rfq=rfq_number,
        global_mode=global_mode,
    )

    # Read file into memory
    try:
        file_bytes = await file.read()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to read uploaded file: {e}",
        )
    finally:
        await file.close()

    result = await assistant_service.handle_chat_with_file(
        user_message=message,
        file_bytes=file_bytes,
        filename=file.filename or "attachment",
        content_type=file.content_type or "application/octet-stream",
        conversation_id=conversation_id,
        rfq_number=rfq_number,
        global_mode=global_mode,
        ctx=ctx,
        db=db,
        session_id=session_id,
    )

    return ChatResponse(
        conversation_id=result["conversation_id"],
        message=MessageOut(**result["message"]),
        rfq_number=result["rfq_number"],
        global_mode=result["global_mode"],
    )


# ── Document Ingestion ────────────────────────────────────────────────────────

@router.post(
    "/documents/ingest",
    response_model=DocumentIngestResponse,
    summary="Upload a PDF, image, or doc to the AI knowledge base",
    description=(
        "Accepts PDF, DOCX, DOC, TXT, or any image file (PNG, JPG, WEBP, GIF…) as multipart/form-data. "
        "The file is read into memory and forwarded directly to the n8n RAG webhook — "
        "nothing is written to Supabase Storage or any DB table. "
        "n8n handles chunking, embedding, and vector upsert. "
        "If rfq_number is provided, the document is tagged with that RFQ so future "
        "RAG queries can scope results to that project."
    ),
)
async def ingest_document(
    file: UploadFile = File(..., description="PDF, DOCX, DOC, TXT, or image file (max 50 MB)"),
    rfq_number: Optional[str] = Form(default=None, description="Optional RFQ context for tagging"),
    description: Optional[str] = Form(default=None, description="Optional description of this document"),
    ctx: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
) -> DocumentIngestResponse:
    logger.info(
        "document_ingest_request",
        user=ctx.user_id,
        filename=file.filename,
        content_type=file.content_type,
        rfq=rfq_number,
    )

    # Read file into memory
    try:
        file_bytes = await file.read()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to read uploaded file: {e}",
        )
    finally:
        await file.close()

    result = await assistant_service.ingest_document(
        file_bytes=file_bytes,
        filename=file.filename or "document",
        content_type=file.content_type or "application/octet-stream",
        rfq_number=rfq_number,
        description=description,
        ctx=ctx,
        db=db,
    )

    return DocumentIngestResponse(**result)
