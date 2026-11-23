"""
Phase 11 — Register customers table in Alembic history

Revision ID: 0006
Revises: 0005
Create Date: 2026-08-05

The `customers` table ALREADY EXISTS in the Supabase database with its own
schema. This migration is a no-op that simply stamps revision 0006 as applied
so the rest of the chain can proceed.

The ORM model (app/models/customer.py) maps to this pre-existing table.
"""

from alembic import op
import sqlalchemy as sa

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Table pre-exists in Supabase — no DDL needed.
    # Only add the projects.customer_id index (safe IF NOT EXISTS).
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_projects_customer_id ON projects (customer_id);"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_projects_customer_id;")
