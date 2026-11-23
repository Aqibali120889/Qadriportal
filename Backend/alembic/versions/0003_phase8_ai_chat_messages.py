"""
Phase 8 — AI Chat Messages Table

Revision ID: 0003
Revises:     0002
Create Date: 2026-07-31

Creates the ai_chat_messages table to persist chat turns between users
and the n8n RAG assistant. Each row represents one message (user OR assistant).

Reuses the existing `conversations` table (conversation_type=INTERNAL) for
conversation grouping — no new conversation parent table needed.

Schema:
  ai_chat_messages
    id              UUID PK
    conversation_id UUID FK → conversations.id CASCADE DELETE
    role            TEXT CHECK IN ('user', 'assistant')
    content         TEXT NOT NULL
    metadata        JSONB DEFAULT '{}'
    created_at      TIMESTAMPTZ DEFAULT now()
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

# revision identifiers
revision: str = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Create ai_chat_messages table.
    Uses IF NOT EXISTS — idempotent, safe to run multiple times.
    """
    op.execute("""
        CREATE TABLE IF NOT EXISTS ai_chat_messages (
            id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            conversation_id UUID        NOT NULL
                            REFERENCES conversations(id) ON DELETE CASCADE,
            role            TEXT        NOT NULL CHECK (role IN ('user', 'assistant')),
            content         TEXT        NOT NULL,
            metadata        JSONB       NOT NULL DEFAULT '{}',
            created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
        );
    """)

    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_conversation_id
        ON ai_chat_messages(conversation_id);
    """)

    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_created_at
        ON ai_chat_messages(created_at DESC);
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS ai_chat_messages;")
