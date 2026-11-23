"""
app/repositories/drawing_repository.py
─────────────────────────────────────────────────────────────────────────────
Data access layer for the `drawings` table.
"""

from __future__ import annotations

from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.drawing import Drawing
from app.models.file import File
from app.repositories.base import BaseRepository


class DrawingRepository(BaseRepository[Drawing]):

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, Drawing)

    async def get_by_project_id(self, project_id: str) -> Optional[Drawing]:
        """
        Return the primary drawing for a project — the most recently uploaded
        PDF. A project can accumulate more than one drawing (e.g. a follow-up
        email on the same RFQ thread with a revised drawing), so this always
        picks the latest rather than the first ever uploaded.
        Eagerly loads the linked File record so signed URL can be generated.
        """
        result = await self._session.execute(
            select(Drawing)
            .where(Drawing.project_id == project_id)
            .options(selectinload(Drawing.file))
            .order_by(Drawing.created_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()
