"""
Scratch script — inspect the actual customers table schema in the live DB.
Run with: .venv\Scripts\python.exe inspect_customers.py
"""
import asyncio
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "")


async def main():
    from sqlalchemy.ext.asyncio import create_async_engine
    from sqlalchemy import text

    engine = create_async_engine(DATABASE_URL, echo=False)
    async with engine.connect() as conn:
        result = await conn.execute(text("""
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name   = 'customers'
            ORDER BY ordinal_position;
        """))
        rows = result.fetchall()
        print("=== customers table columns ===")
        for r in rows:
            print(f"  {r[0]:<30} {r[1]:<20} nullable={r[2]}  default={r[3]}")

asyncio.run(main())
