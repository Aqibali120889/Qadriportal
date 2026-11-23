"""
0007_fix_task_comments_schema.py
─────────────────────────────────────────────────────────────────────────────
Revision: 0007
Revises:  0006

The task_comments table was created before Phase 10 and uses different
column names than the Phase 10 ORM model expects:

  Live DB schema:     comment (TEXT), parent_comment_id (UUID)
  ORM model expects:  content (TEXT), department_id (UUID)

Since task_comments is empty (0 rows, verified 2026-08-10),
we can safely alter the schema to match the ORM model:

  1. Add content TEXT column (NOT NULL DEFAULT '')
  2. Add department_id UUID column (nullable, FK to departments)
  3. Rename old comment → comment_old (keep for safety)
  4. Drop parent_comment_id (not in ORM)
  5. Stamp alembic so future migrations chain correctly

All operations are idempotent (IF NOT EXISTS / IF EXISTS).
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Add content column (maps to ORM TaskComment.content)
    op.execute("""
        ALTER TABLE task_comments
        ADD COLUMN IF NOT EXISTS content TEXT NOT NULL DEFAULT ''
    """)

    # 2. Copy existing comment data into content (safe migration of data)
    op.execute("""
        UPDATE task_comments
        SET content = COALESCE(comment, '')
        WHERE content = ''
    """)

    # 3. Add department_id column (FK to departments, nullable)
    op.execute("""
        ALTER TABLE task_comments
        ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id) ON DELETE SET NULL
    """)

    # 4. Drop parent_comment_id (not needed in Phase 10 model)
    op.execute("""
        ALTER TABLE task_comments
        DROP COLUMN IF EXISTS parent_comment_id
    """)

    # 5. Drop old comment column (data already copied to content above)
    op.execute("""
        ALTER TABLE task_comments
        DROP COLUMN IF EXISTS comment
    """)

    # 6. Make task_id NOT NULL to match ORM model
    op.execute("""
        ALTER TABLE task_comments
        ALTER COLUMN task_id SET NOT NULL
    """)

    # 7. Add index on department_id for filtering
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_task_comments_dept
        ON task_comments(department_id)
    """)


def downgrade() -> None:
    # Restore old structure (data loss — only safe on empty table)
    op.execute("DROP INDEX IF EXISTS idx_task_comments_dept")
    op.execute("ALTER TABLE task_comments ADD COLUMN IF NOT EXISTS parent_comment_id UUID")
    op.execute("ALTER TABLE task_comments ADD COLUMN IF NOT EXISTS comment TEXT")
    op.execute("UPDATE task_comments SET comment = content")
    op.execute("ALTER TABLE task_comments DROP COLUMN IF EXISTS content")
    op.execute("ALTER TABLE task_comments DROP COLUMN IF EXISTS department_id")
    op.execute("ALTER TABLE task_comments ALTER COLUMN task_id DROP NOT NULL")
