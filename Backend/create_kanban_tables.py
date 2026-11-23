"""
Script: create_kanban_tables.py
Creates kanban_tasks and task_history tables (task_comments already exists).
Run once: python create_kanban_tables.py
"""
import asyncio
import os
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

load_dotenv()


CREATE_KANBAN_TASKS = """
CREATE TABLE IF NOT EXISTS kanban_tasks (
    id          UUID        NOT NULL DEFAULT gen_random_uuid(),
    project_id  UUID        NOT NULL REFERENCES projects(id)    ON DELETE CASCADE,
    department_id UUID      NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
    title       VARCHAR(500) NOT NULL,
    description TEXT,
    task_type   VARCHAR(100),
    status      VARCHAR(50) NOT NULL DEFAULT 'todo',
    priority    VARCHAR(50) NOT NULL DEFAULT 'medium',
    sort_order  INTEGER     NOT NULL DEFAULT 0,
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
    due_date    DATE,
    estimated_hours NUMERIC(6,2),
    completed_at TIMESTAMPTZ,
    is_ai_generated BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id)
);
"""

CREATE_TASK_HISTORY = """
CREATE TABLE IF NOT EXISTS task_history (
    id          UUID        NOT NULL DEFAULT gen_random_uuid(),
    task_id     UUID        NOT NULL REFERENCES kanban_tasks(id) ON DELETE CASCADE,
    user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
    event_type  VARCHAR(100) NOT NULL,
    old_value   TEXT,
    new_value   TEXT,
    metadata    JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id)
);
"""

CREATE_INDEXES = [
    "CREATE INDEX IF NOT EXISTS idx_kanban_tasks_project     ON kanban_tasks(project_id);",
    "CREATE INDEX IF NOT EXISTS idx_kanban_tasks_department  ON kanban_tasks(department_id);",
    "CREATE INDEX IF NOT EXISTS idx_kanban_tasks_assigned_to ON kanban_tasks(assigned_to);",
    "CREATE INDEX IF NOT EXISTS idx_kanban_tasks_status      ON kanban_tasks(status);",
    "CREATE INDEX IF NOT EXISTS idx_task_history_task        ON task_history(task_id);",
    "CREATE INDEX IF NOT EXISTS idx_task_comments_task       ON task_comments(task_id);",
]


async def main():
    url = os.getenv("DATABASE_URL")
    if not url:
        print("ERROR: DATABASE_URL not set")
        return

    engine = create_async_engine(url)

    async with engine.begin() as conn:
        print("Creating kanban_tasks…")
        await conn.execute(text(CREATE_KANBAN_TASKS))
        print("OK: kanban_tasks created.")

        print("Creating task_history…")
        await conn.execute(text(CREATE_TASK_HISTORY))
        print("OK: task_history created.")

        print("Creating indexes…")
        for idx in CREATE_INDEXES:
            await conn.execute(text(idx))
        print("OK: Indexes created.")

        # Verify all three tables
        for tbl in ("kanban_tasks", "task_comments", "task_history"):
            r = await conn.execute(text(
                f"SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='{tbl}')"
            ))
            print(f"  {tbl}: {'EXISTS' if r.scalar() else 'MISSING'}")

    await engine.dispose()
    print("\nAll Phase 10 tables ready.")


asyncio.run(main())
