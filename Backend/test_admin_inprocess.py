"""
test_admin_inprocess.py
─────────────────────────────────────────────────────────────
In-process async test runner using httpx.AsyncClient with ASGITransport.
Executes all Phase 11 Super Admin endpoints directly against the app.
"""

import asyncio
import sys

sys.path.insert(0, ".")
from dotenv import load_dotenv; load_dotenv()

import httpx
from httpx import ASGITransport
from app.main import app

HEADERS = {
    "Authorization": "Bearer dev-bypass-token",
    "X-Dev-User-Email": "admin.dev@company.local",
    "Content-Type": "application/json",
}

async def check(client: httpx.AsyncClient, label: str, path: str, method: str = "GET"):
    try:
        if method == "GET":
            r = await client.get(path)
        else:
            r = await client.post(path)

        if r.status_code in (200, 201):
            print(f"[PASS] {label}: HTTP {r.status_code}")
            data = r.json()
            if isinstance(data, dict):
                for k in list(data.keys())[:4]:
                    v = data[k]
                    cnt = len(v) if isinstance(v, (list, dict)) else v
                    print(f"       - {k}: {cnt}")
        else:
            print(f"[FAIL] {label}: HTTP {r.status_code}")
            print(f"       Detail: {r.text[:200]}")
    except Exception as e:
        print(f"[ERROR] {label}: {e}")

async def main():
    print("=" * 60)
    print("  PHASE 11 ASGI IN-PROCESS SUPER ADMIN TEST")
    print("=" * 60)

    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver", headers=HEADERS, timeout=60.0) as client:
        # 1. Dashboard
        await check(client, "GET /admin/dashboard", "/api/v1/admin/dashboard")

        # 2. Projects
        await check(client, "GET /admin/projects", "/api/v1/admin/projects?page=1&page_size=10")

        # 3. Departments
        await check(client, "GET /admin/departments", "/api/v1/admin/departments")

        # 4. Users
        await check(client, "GET /admin/users", "/api/v1/admin/users")

        # 5. Roles
        await check(client, "GET /admin/roles", "/api/v1/admin/roles")

        # 6. Global History
        await check(client, "GET /admin/history", "/api/v1/admin/history?page=1&page_size=10")

        # 7. Settings
        await check(client, "GET /admin/settings", "/api/v1/admin/settings")

        # 8. Global Kanban
        await check(client, "GET /tasks/board (Super Admin)", "/api/v1/tasks/board")

        # 9. Integration Tests
        await check(client, "POST /admin/settings/test-email", "/api/v1/admin/settings/test-email", "POST")
        await check(client, "POST /admin/settings/test-ai", "/api/v1/admin/settings/test-ai", "POST")
        await check(client, "POST /admin/settings/test-storage", "/api/v1/admin/settings/test-storage", "POST")
        await check(client, "POST /admin/settings/test-webhook", "/api/v1/admin/settings/test-webhook", "POST")

    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(main())
