"""
One-shot migration script for ai_chat_messages table.
Run: python migrate_phase8.py
"""
import asyncio
from sqlalchemy import text
from app.database import engine


async def run():
    async with engine.begin() as conn:
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS ai_chat_messages (
                id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
                conversation_id UUID        NOT NULL
                                REFERENCES conversations(id) ON DELETE CASCADE,
                role            TEXT        NOT NULL CHECK (role IN ('user', 'assistant')),
                content         TEXT        NOT NULL,
                metadata        JSONB       NOT NULL DEFAULT '{}',
                created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
            )
        """))

        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_conversation_id
            ON ai_chat_messages(conversation_id)
        """))

        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_created_at
            ON ai_chat_messages(created_at DESC)
        """))

        # Record migration in alembic_version if not already there
        await conn.execute(text("""
            INSERT INTO alembic_version (version_num)
            SELECT '0003'
            WHERE NOT EXISTS (
                SELECT 1 FROM alembic_version WHERE version_num = '0003'
            )
        """))

    print("Phase 8 migration complete: ai_chat_messages table created OK")


if __name__ == "__main__":
    asyncio.run(run())
