"""
Script: add_auto_tasks_column.py
Adds auto_tasks_enabled column to projects table if it doesn't exist.
Run once: python add_auto_tasks_column.py
"""
import asyncio
import os
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

load_dotenv()


async def main():
    url = os.getenv("DATABASE_URL")
    if not url:
        print("ERROR: DATABASE_URL not set in .env")
        return

    engine = create_async_engine(url)

    async with engine.begin() as conn:
        # Check if column exists
        result = await conn.execute(text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name='projects' AND column_name='auto_tasks_enabled'"
        ))
        exists = result.fetchone() is not None

        if exists:
            print("OK: projects.auto_tasks_enabled already exists.")
        else:
            await conn.execute(text(
                "ALTER TABLE projects ADD COLUMN auto_tasks_enabled BOOLEAN NOT NULL DEFAULT TRUE"
            ))
            print("OK: Added auto_tasks_enabled column to projects.")

        # Verify kanban tables
        for tbl in ("kanban_tasks", "task_comments", "task_history"):
            r = await conn.execute(text(
                f"SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='{tbl}')"
            ))
            exists = r.scalar()
            print(f"  {tbl}: {'EXISTS' if exists else 'MISSING'}")

    await engine.dispose()
    print("\nDone.")


asyncio.run(main())
