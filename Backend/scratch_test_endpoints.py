import asyncio
import time
from httpx import AsyncClient, ASGITransport
from app.main import app

async def test_all():
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        print("=== 1. GET /api/v1/projects (Cost Estimation) ===")
        res = await ac.get("/api/v1/projects", headers={"X-Dev-User-Email": "cost.dev@company.local"})
        print("Projects List Status:", res.status_code)
        if res.status_code == 200:
            data = res.json()
            print("Total projects:", data.get("total"), "| Count:", len(data.get("items", [])))
            for item in data.get("items", []):
                print("  *", item.get("job_number"), "-", item.get("title"), "(Sender:", item.get("sender_email"), ")")

        print("\n=== 2. GET /api/v1/projects/stats ===")
        res = await ac.get("/api/v1/projects/stats", headers={"X-Dev-User-Email": "cost.dev@company.local"})
        print("Stats Status:", res.status_code)
        if res.status_code == 200:
            print("Stats:", res.json())

        print("\n=== 3. GET /api/v1/projects/kanban ===")
        res = await ac.get("/api/v1/projects/kanban", headers={"X-Dev-User-Email": "cost.dev@company.local"})
        print("Kanban Status:", res.status_code)
        if res.status_code == 200:
            print("Tasks count:", len(res.json().get("tasks", [])))

        print("\n=== 4. GET /api/v1/history ===")
        res = await ac.get("/api/v1/history", headers={"X-Dev-User-Email": "cost.dev@company.local"})
        print("History Status:", res.status_code)
        if res.status_code == 200:
            data = res.json()
            print("History total:", data.get("total"), "| Count:", len(data.get("items", [])))
            for item in data.get("items", [])[:5]:
                print("  *", item.get("title"), "|", item.get("created_at"))

if __name__ == "__main__":
    for attempt in range(3):
        try:
            asyncio.run(test_all())
            break
        except Exception as e:
            print(f"Attempt {attempt + 1} failed with error: {e}. Retrying...")
            time.sleep(2)
