"""
Scratch — inspect DB for departments, users, roles, user_sessions actual columns.
Run with: .venv\Scripts\python.exe inspect_schema.py
"""
import asyncio
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "")


async def inspect(conn, table_name: str):
    from sqlalchemy import text
    result = await conn.execute(text(f"""
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = '{table_name}'
        ORDER BY ordinal_position;
    """))
    rows = result.fetchall()
    print(f"\n=== {table_name} ===")
    for r in rows:
        print(f"  {r[0]:<35} {r[1]:<25} nullable={r[2]}")


async def main():
    from sqlalchemy.ext.asyncio import create_async_engine
    engine = create_async_engine(DATABASE_URL, echo=False)
    async with engine.connect() as conn:
        for t in ["departments", "users", "roles", "user_sessions", "kanban_tasks", "entity_audit_logs", "system_events", "login_history"]:
            await inspect(conn, t)

asyncio.run(main())
