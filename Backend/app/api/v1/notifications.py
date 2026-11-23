"""
app/api/v1/notifications.py
─────────────────────────────────────────────────────────────────────────────
Notification Center — Bell dropdown + live SSE stream.

Endpoints:
  GET   /notifications                — paginated, department-scoped list
  GET   /notifications/unread-count   — cheap unread counter for the Bell badge
  PATCH /notifications/{id}/read      — mark one notification read
  PATCH /notifications/read-all       — mark every visible notification read
  GET   /notifications/stream         — SSE live feed (auth via ?token=, see
                                         get_request_context_sse — browser
                                         EventSource cannot send headers)

Department isolation is enforced with the same authorization_service.filter_by_department
helper used by GET /history — no new isolation logic.
"""

from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_request_context, get_request_context_sse
from app.core.context import RequestContext
from app.core.logging import get_logger
from app.repositories.notification_repository import NotificationRepository
from app.schemas.notification import (
    MarkReadResponse,
    NotificationResponse,
    PaginatedNotifications,
    UnreadCountResponse,
)
from app.services.authorization_service import authorization_service
from app.services.notification_broker import notification_broker

logger = get_logger(__name__)

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("", response_model=PaginatedNotifications, summary="List Notifications")
async def list_notifications(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    unread_only: bool = Query(default=False),
    ctx: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
) -> PaginatedNotifications:
    dept_filter = authorization_service.filter_by_department(ctx)
    skip = (page - 1) * page_size

    repo = NotificationRepository(db)
    items_raw, total = await repo.get_paginated(
        department_id=dept_filter,
        user_id=ctx.user_id,
        skip=skip,
        limit=page_size,
        unread_only=unread_only,
    )

    return PaginatedNotifications(
        items=[NotificationResponse(**item) for item in items_raw],
        total=total,
        page=page,
        page_size=page_size,
        has_next=(page * page_size) < total,
    )


@router.get("/unread-count", response_model=UnreadCountResponse, summary="Unread Notification Count")
async def unread_count(
    ctx: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
) -> UnreadCountResponse:
    dept_filter = authorization_service.filter_by_department(ctx)
    repo = NotificationRepository(db)
    count = await repo.count_unread(department_id=dept_filter, user_id=ctx.user_id)
    return UnreadCountResponse(unread_count=count)


@router.patch("/{notification_id}/read", response_model=MarkReadResponse, summary="Mark One Notification Read")
async def mark_read(
    notification_id: str,
    ctx: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
) -> MarkReadResponse:
    dept_filter = authorization_service.filter_by_department(ctx)
    repo = NotificationRepository(db)
    notif = await repo.mark_read(notification_id, department_id=dept_filter, user_id=ctx.user_id)
    if notif is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    return MarkReadResponse(id=notif.id, is_read=notif.is_read, read_at=notif.read_at)


@router.patch("/read-all", summary="Mark All Notifications Read")
async def mark_all_read(
    ctx: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
) -> dict:
    dept_filter = authorization_service.filter_by_department(ctx)
    repo = NotificationRepository(db)
    updated = await repo.mark_all_read(department_id=dept_filter, user_id=ctx.user_id)
    return {"updated": updated}


@router.get("/stream", summary="Live Notification Stream (SSE)")
async def stream_notifications(
    request: Request,
    ctx: RequestContext = Depends(get_request_context_sse),
) -> StreamingResponse:
    """
    Server-Sent Events stream. One event per new notification for this
    connection's department (or every department, for Super Admins).
    Heartbeats every ~20s keep the connection alive through proxies.
    """
    queue = notification_broker.subscribe(ctx.department_id, ctx.is_super_admin)

    async def event_generator():
        try:
            yield ": connected\n\n"
            while True:
                if await request.is_disconnected():
                    break
                try:
                    payload = await asyncio.wait_for(queue.get(), timeout=20.0)
                    yield f"data: {json.dumps(payload)}\n\n"
                except asyncio.TimeoutError:
                    yield ": keep-alive\n\n"
        finally:
            notification_broker.unsubscribe(ctx.department_id, ctx.is_super_admin, queue)
            logger.info("notification_stream_closed", user_id=ctx.user_id)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # disable nginx buffering, if fronted by one
        },
    )
