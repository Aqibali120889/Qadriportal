import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.config import get_settings

settings = get_settings()

async def main():
    engine = create_async_engine(settings.DATABASE_URL)
    async with engine.connect() as conn:
        print("=== DEPARTMENTS ===")
        res = await conn.execute(text("SELECT id, name, code FROM public.departments;"))
        for r in res.fetchall():
            print(" ", r)

        print("\n=== ROLES ===")
        res = await conn.execute(text("SELECT id, name, is_system FROM public.roles;"))
        for r in res.fetchall():
            print(" ", r)

        print("\n=== PUBLIC USERS ===")
        res = await conn.execute(text("SELECT id, email, status, is_active, department_id, role_id FROM public.users;"))
        for r in res.fetchall():
            print(" ", r)

        print("\n=== AUTH USERS ===")
        res = await conn.execute(text("SELECT id, email, created_at FROM auth.users;"))
        for r in res.fetchall():
            print(" ", r)

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
