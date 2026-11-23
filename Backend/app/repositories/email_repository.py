"""
app/repositories/email_repository.py
─────────────────────────────────────────────────────────────────────────────
Data access layer for `emails` and `email_attachments` tables.
"""

from __future__ import annotations

from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.email import Email
from app.models.email_attachment import EmailAttachment
from app.repositories.base import BaseRepository


class EmailRepository(BaseRepository[Email]):

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, Email)

    async def get_by_outlook_message_id(self, outlook_message_id: str) -> Optional[Email]:
        """
        Deduplication check — returns existing record if the Outlook message ID
        was already ingested. Used to prevent duplicate project creation.
        """
        result = await self._session.execute(
            select(Email).where(Email.outlook_message_id == outlook_message_id)
        )
        return result.scalar_one_or_none()

    async def get_by_project_id(self, project_id: str) -> Optional[Email]:
        """
        Return the first email linked to a project, with attachments loaded.
        Phase 1 assumption: one email per project (the originating RFQ email).
        """
        result = await self._session.execute(
            select(Email)
            .where(Email.project_id == project_id)
            .options(selectinload(Email.attachments))
            .order_by(Email.received_at.asc())
            .limit(1)
        )
        return result.scalar_one_or_none()


class EmailAttachmentRepository(BaseRepository[EmailAttachment]):

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, EmailAttachment)
