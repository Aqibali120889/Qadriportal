"""
Phase 10 — Kanban & Task Management tables

Revision ID: 0005
Revises: 0004
Create Date: 2026-08-03

Adds three new tables:
  - kanban_tasks   : core task entities linked to projects
  - task_comments  : threaded comments per task
  - task_history   : immutable audit log of all task mutations

Also adds:
  - projects.auto_tasks_enabled (per-project AI auto-task setting, default TRUE)
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── kanban_tasks ──────────────────────────────────────────────────────────
    op.create_table(
        "kanban_tasks",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=False),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "project_id",
            postgresql.UUID(as_uuid=False),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "department_id",
            postgresql.UUID(as_uuid=False),
            sa.ForeignKey("departments.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("title",       sa.String(500), nullable=False),
        sa.Column("description", sa.Text,        nullable=True),
        sa.Column("status",      sa.String(50),  nullable=False, server_default="todo"),
        sa.Column("priority",    sa.String(50),  nullable=False, server_default="medium"),
        sa.Column("task_type",   sa.String(100), nullable=True),
        sa.Column(
            "assigned_to",
            postgresql.UUID(as_uuid=False),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "assigned_by",
            postgresql.UUID(as_uuid=False),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_by",
            postgresql.UUID(as_uuid=False),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("due_date",         sa.Date,                   nullable=True),
        sa.Column("estimated_hours",  sa.Numeric(6, 2),          nullable=True),
        sa.Column("completed_at",     sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_ai_generated",  sa.Boolean, nullable=False, server_default="false"),
        sa.Column("sort_order",       sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )
    op.create_index("idx_kanban_tasks_project",     "kanban_tasks", ["project_id"])
    op.create_index("idx_kanban_tasks_department",  "kanban_tasks", ["department_id"])
    op.create_index("idx_kanban_tasks_assigned_to", "kanban_tasks", ["assigned_to"])
    op.create_index("idx_kanban_tasks_status",      "kanban_tasks", ["status"])

    # ── task_comments ─────────────────────────────────────────────────────────
    op.create_table(
        "task_comments",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=False),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "task_id",
            postgresql.UUID(as_uuid=False),
            sa.ForeignKey("kanban_tasks.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=False),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "department_id",
            postgresql.UUID(as_uuid=False),
            sa.ForeignKey("departments.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("content",    sa.Text, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )
    op.create_index("idx_task_comments_task", "task_comments", ["task_id"])

    # ── task_history ──────────────────────────────────────────────────────────
    op.create_table(
        "task_history",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=False),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "task_id",
            postgresql.UUID(as_uuid=False),
            sa.ForeignKey("kanban_tasks.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=False),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("event_type", sa.String(100), nullable=False),
        sa.Column("old_value",  sa.Text,        nullable=True),
        sa.Column("new_value",  sa.Text,        nullable=True),
        sa.Column("metadata",   postgresql.JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )
    op.create_index("idx_task_history_task", "task_history", ["task_id"])

    # ── per-project auto-task setting ─────────────────────────────────────────
    op.add_column(
        "projects",
        sa.Column("auto_tasks_enabled", sa.Boolean, nullable=False, server_default="true"),
    )


def downgrade() -> None:
    op.drop_column("projects", "auto_tasks_enabled")
    op.drop_index("idx_task_history_task", table_name="task_history")
    op.drop_table("task_history")
    op.drop_index("idx_task_comments_task", table_name="task_comments")
    op.drop_table("task_comments")
    op.drop_index("idx_kanban_tasks_status",      table_name="kanban_tasks")
    op.drop_index("idx_kanban_tasks_assigned_to", table_name="kanban_tasks")
    op.drop_index("idx_kanban_tasks_department",  table_name="kanban_tasks")
    op.drop_index("idx_kanban_tasks_project",     table_name="kanban_tasks")
    op.drop_table("kanban_tasks")
