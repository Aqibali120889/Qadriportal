"""
test_admin_phase11.py
─────────────────────────────────────────────────────────────
Comprehensive diagnostic test for Phase 11 Super Admin endpoints.
Checks live DB queries and API responses for:
  1. Super Admin Auth & Context resolution
  2. GET /api/v1/admin/dashboard
  3. GET /api/v1/admin/projects
  4. GET /api/v1/admin/departments
  5. GET /api/v1/admin/users
  6. GET /api/v1/admin/roles
  7. GET /api/v1/admin/history
  8. GET /api/v1/admin/settings
  9. GET /api/v1/tasks/board (Super Admin global view)
"""

import asyncio
import json
import os
import sys

sys.path.insert(0, ".")
from dotenv import load_dotenv; load_dotenv()

import httpx

BASE = "http://localhost:8000"
# Headers with dev super admin email
HEADERS = {
    "Authorization": "Bearer dev-bypass-token",
    "X-Dev-User-Email": "admin.dev@company.local",
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
}

def _check(name: str, res: httpx.Response):
    if res.status_code == 200 or res.status_code == 201:
        data = res.json()
        print(f"[PASS] {name}: HTTP {res.status_code}")
        if isinstance(data, dict):
            for k in list(data.keys())[:5]:
                val = data[k]
                if isinstance(val, list):
                    print(f"   - {k}: list of {len(val)} items")
                elif isinstance(val, dict):
                    print(f"   - {k}: dict with {len(val)} keys")
                else:
                    print(f"   - {k}: {val}")
        elif isinstance(data, list):
            print(f"   - List of {len(data)} items")
        return data
    else:
        print(f"[FAIL] {name}: HTTP {res.status_code}")
        try:
            print(f"   Error: {res.json()}")
        except Exception:
            print(f"   Body: {res.text[:300]}")
        return None

async def main():
    print("=" * 70)
    print("PHASE 11 SUPER ADMIN DIAGNOSTIC TEST")
    print("=" * 70)

    async with httpx.AsyncClient(base_url=BASE, headers=HEADERS, timeout=60.0) as client:
        # 1. Dashboard
        res = await client.get("/api/v1/admin/dashboard")
        _check("Dashboard", res)

        # 2. Projects
        res = await client.get("/api/v1/admin/projects?page=1&page_size=10")
        projs = _check("Projects", res)

        # 3. Departments
        res = await client.get("/api/v1/admin/departments")
        depts = _check("Departments", res)

        # 4. Users
        res = await client.get("/api/v1/admin/users")
        users = _check("Users", res)

        # 5. Roles
        res = await client.get("/api/v1/admin/roles")
        _check("Roles", res)

        # 6. Global History
        res = await client.get("/api/v1/admin/history?page=1&page_size=10")
        hist = _check("Global History", res)

        # 7. Settings
        res = await client.get("/api/v1/admin/settings")
        _check("Settings", res)

        # 8. Global Kanban (tasks board without dept filter)
        res = await client.get("/api/v1/tasks/board")
        _check("Global Kanban Tasks", res)

        # 9. Test Integration Endpoints
        res = await client.post("/api/v1/admin/settings/test-email")
        _check("Integration Test: Email", res)

        res = await client.post("/api/v1/admin/settings/test-ai")
        _check("Integration Test: AI", res)

        res = await client.post("/api/v1/admin/settings/test-storage")
        _check("Integration Test: Storage", res)

        res = await client.post("/api/v1/admin/settings/test-webhook")
        _check("Integration Test: Webhook", res)

    print("=" * 70)

if __name__ == "__main__":
    asyncio.run(main())
