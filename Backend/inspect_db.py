import asyncio
import sys
import httpx
from dotenv import load_dotenv

sys.path.insert(0, r"d:\SEmester 6\Qaudri Internship\Qadriportal\Backend")
load_dotenv(r"d:\SEmester 6\Qaudri Internship\Qadriportal\Backend\.env")

from sqlalchemy import text
from app.database import AsyncSessionLocal
from app.config import get_settings

settings = get_settings()

async def inspect_users():
    print("Connecting to DB...")
    async with AsyncSessionLocal() as db:
        res1 = await db.execute(text("SELECT id, email, first_name, last_name, status, is_active, deleted_at FROM users WHERE lower(email) IN ('aqibalicarlinok@gmail.com', 'voiceages@gmail.com')"))
        print("--- DB public.users ---")
        for r in res1.fetchall():
            print(dict(r._mapping))

    print(f"Connecting to Supabase at {settings.SUPABASE_URL}...")
    headers = {
        "apikey": settings.SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
    }
    url = f"{settings.SUPABASE_URL}/auth/v1/admin/users"
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, headers=headers)
        if resp.status_code == 200:
            auth_users = resp.json().get("users", [])
            print("--- Supabase auth.users ---")
            for u in auth_users:
                if u.get("email") in ["aqibalicarlinok@gmail.com", "voiceages@gmail.com"]:
                    print("Auth user:", u.get("email"), u.get("id"), "invited_at:", u.get("invited_at"), "confirmed_at:", u.get("email_confirmed_at"))
        else:
            print("Failed to fetch Supabase users:", resp.status_code, resp.text)

if __name__ == "__main__":
    asyncio.run(inspect_users())
