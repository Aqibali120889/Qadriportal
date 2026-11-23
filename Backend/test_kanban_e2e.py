"""
test_kanban_e2e.py
─────────────────────────────────────────────────────────────
End-to-end Kanban API test. Runs against the live server.

Tests:
  1. GET /api/v1/tasks/board
  2. GET /api/v1/tasks/meta/projects
  3. GET /api/v1/tasks/meta/users
  4. POST /api/v1/tasks/  (create task)
  5. PATCH /api/v1/tasks/{id}/status  (drag)
  6. POST /api/v1/tasks/{id}/comment
  7. GET /api/v1/tasks/{id}  (full detail with history + comments)
  8. DELETE /api/v1/tasks/{id}  (soft-cancel)
"""
import asyncio
import json
import os
import sys

sys.path.insert(0, ".")
from dotenv import load_dotenv; load_dotenv()

try:
    import httpx
except ImportError:
    os.system(".venv\\Scripts\\pip install httpx -q")
    import httpx

BASE = "http://localhost:8000"
# Use dev bypass headers matching DEV_MODE backend
HEADERS = {
    "Authorization": "Bearer dev-bypass-token",
    "Content-Type":  "application/json",
    "ngrok-skip-browser-warning": "true",
}

# Try to read the dev email from .env
DEV_EMAIL = os.environ.get("DEV_USER_EMAIL") or None
if not DEV_EMAIL:
    # Try reading frontend .env.local for VITE_DEV_USER_EMAIL
    try:
        with open("../Frontend/.env.local") as f:
            for line in f:
                if "VITE_DEV_USER_EMAIL" in line:
                    DEV_EMAIL = line.split("=", 1)[1].strip().strip('"').strip("'")
    except Exception:
        pass

if DEV_EMAIL:
    HEADERS["X-Dev-User-Email"] = DEV_EMAIL
    print(f"Using dev user: {DEV_EMAIL}")
else:
    print("No DEV_EMAIL found — using default dev-bypass context")


def _ok(label: str, r: httpx.Response) -> dict:
    if r.status_code not in (200, 201):
        print(f"  FAIL [{label}]: HTTP {r.status_code}")
        try: print(f"    {json.dumps(r.json(), indent=2)[:300]}")
        except: print(f"    {r.text[:200]}")
        return {}
    data = r.json()
    print(f"  PASS [{label}]: HTTP {r.status_code}")
    return data


async def main():
    print("=" * 60)
    print("  Phase 10 Kanban E2E Test")
    print("=" * 60)

    async with httpx.AsyncClient(base_url=BASE, headers=HEADERS, timeout=30) as c:

        # 1. Board
        r = await c.get("/api/v1/tasks/board")
        board = _ok("GET /board", r)
        if board:
            cols = board.get("columns", [])
            col_summary = [f"{col['status']}:{col['count']}" for col in cols]
            print(f"    columns={col_summary}")
            print(f"    total={board.get('total')}")

        # 2. Projects for dropdown
        r = await c.get("/api/v1/tasks/meta/projects")
        projs = _ok("GET /meta/projects", r)
        if isinstance(projs, list):
            print(f"    {len(projs)} projects returned")
            for p in projs[:3]:
                print(f"    {p.get('rfq_number')} — {p.get('title')}")
            proj_id = projs[0]["id"] if projs else None
        else:
            proj_id = None

        # 3. Users
        r = await c.get("/api/v1/tasks/meta/users")
        users = _ok("GET /meta/users", r)
        if isinstance(users, list):
            print(f"    {len(users)} users returned")
            user_id = users[0]["id"] if users else None
        else:
            user_id = None

        if not proj_id:
            print("\n  SKIP: no projects available — cannot test task creation")
            return

        # 4. Create task
        payload = {
            "project_id":  proj_id,
            "title":       "E2E Test Task",
            "description": "Created by phase10 e2e test",
            "priority":    "high",
            "task_type":   "initial_review",
        }
        if user_id:
            payload["assigned_to"] = user_id
        r = await c.post("/api/v1/tasks/", content=json.dumps(payload))
        task = _ok("POST /tasks/", r)
        task_id = task.get("id")
        if task_id:
            print(f"    task_id={task_id}  status={task.get('status')}  priority={task.get('priority')}")

        if not task_id:
            print("\n  SKIP: task creation failed")
            return

        # 5. Move status (DnD)
        r = await c.patch(f"/api/v1/tasks/{task_id}/status", content=json.dumps({"status": "in_progress"}))
        moved = _ok("PATCH /{id}/status", r)
        if moved:
            print(f"    new_status={moved.get('status')}")

        # 6. Add comment
        r = await c.post(f"/api/v1/tasks/{task_id}/comment", content=json.dumps({"content": "E2E test comment"}))
        comment = _ok("POST /{id}/comment", r)
        if comment:
            print(f"    comment_id={comment.get('id')}  content={comment.get('content')}")

        # 7. Get task detail
        r = await c.get(f"/api/v1/tasks/{task_id}")
        detail = _ok("GET /{id}", r)
        if detail:
            t = detail.get("task", {})
            print(f"    status={t.get('status')}  comments={len(detail.get('comments', []))}  history={len(detail.get('history', []))}")

        # 8. Cancel (soft delete)
        r = await c.delete(f"/api/v1/tasks/{task_id}")
        _ok("DELETE /{id}", r)

        # 9. Verify board is unchanged total (cancelled excluded by default)
        r2 = await c.get("/api/v1/tasks/board")
        board2 = _ok("GET /board (post-cancel)", r2)
        if board2:
            print(f"    total after cancel (excluded)={board2.get('total')}")

    print("\n" + "=" * 60)
    print("  All Kanban E2E tests complete")
    print("=" * 60)


asyncio.run(main())
