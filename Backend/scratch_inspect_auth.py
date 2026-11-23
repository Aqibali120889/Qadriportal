import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.config import get_settings

settings = get_settings()

async def main():
    engine = create_async_engine(settings.DATABASE_URL)
    async with engine.connect() as conn:
        res = await conn.execute(text("SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema='auth' AND table_name='users';"))
        print("=== AUTH.USERS COLUMNS ===")
        for r in res.fetchall():
            print(f" {r[0]}: {r[1]} (nullable={r[2]}, default={r[3]})")

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
