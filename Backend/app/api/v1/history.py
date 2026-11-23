"""
app/api/v1/history.py
─────────────────────────────────────────────────────────────────────────────
Department-scoped activity feed endpoint.

Merges notifications + project lifecycle events into a single reverse-
chronological feed scoped to the authenticated user's department.

Endpoints:
  GET /history   — paginated activity feed for the current department
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_request_context
from app.core.context import RequestContext
from app.core.logging import get_logger
from app.repositories.history_repository import HistoryRepository
from app.schemas.history import HistoryItemResponse, PaginatedHistory
from app.services.authorization_service import authorization_service

logger = get_logger(__name__)

router = APIRouter(
    prefix="/history",
    tags=["History"],
)


@router.get(
    "",
    response_model=PaginatedHistory,
    summary="Department Activity Feed",
    description=(
        "Returns a reverse-chronological activity feed for the authenticated user's department. "
        "Merges system notifications and project lifecycle events (created, status changed). "
        "Results are paginated."
    ),
    responses={
        200: {"description": "Paginated activity feed"},
        401: {"description": "Missing or invalid JWT"},
    },
)
async def list_history(
    page: int = Query(default=1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(default=20, ge=1, le=100, description="Items per page"),
    ctx: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
) -> PaginatedHistory:
    dept_filter = authorization_service.filter_by_department(ctx)
    skip = (page - 1) * page_size

    repo = HistoryRepository(db)
    items_raw, total = await repo.get_department_feed(
        department_id=dept_filter,
        skip=skip,
        limit=page_size,
    )

    logger.info(
        "history_feed_requested",
        user_id=ctx.user_id,
        department=ctx.department_code,
        page=page,
        total=total,
    )

    items = [HistoryItemResponse(**item) for item in items_raw]

    return PaginatedHistory(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        has_next=(page * page_size) < total,
    )
