import asyncio, os, sys
sys.path.insert(0, ".")
from dotenv import load_dotenv; load_dotenv()
import asyncpg

async def main():
    url = os.environ["DATABASE_URL"].replace("postgresql+asyncpg://", "postgresql://")
    conn = await asyncpg.connect(url)
    
    # Check alembic version
    ver = await conn.fetchval("SELECT version_num FROM alembic_version")
    print(f"Alembic version: {ver}")
    
    # Check task_comments exact columns
    cols = await conn.fetch(
        "SELECT column_name, data_type, is_nullable FROM information_schema.columns "
        "WHERE table_schema='public' AND table_name='task_comments' ORDER BY ordinal_position"
    )
    print("task_comments columns:")
    for c in cols:
        null_str = "NULL" if c["is_nullable"] == "YES" else "NOT NULL"
        print(f"  {c['column_name']}  {c['data_type']}  {null_str}")
    
    # Check indexes on kanban tables
    idxs = await conn.fetch(
        "SELECT indexname, tablename FROM pg_indexes WHERE tablename IN ('kanban_tasks','task_comments','task_history') ORDER BY tablename, indexname"
    )
    print("\nKanban indexes:")
    for r in idxs:
        print(f"  {r['tablename']}.{r['indexname']}")
    
    await conn.close()

asyncio.run(main())
