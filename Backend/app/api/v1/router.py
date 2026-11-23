"""
app/api/v1/router.py
─────────────────────────────────────────────────────────────────────────────
Central v1 API router. Mounts all sub-routers under /api/v1.

Phase 8 additions:
  - AI Assistant (RAG n8n integration) at /api/v1/assistant/...

Phase 6 additions:
  - Excel Cost Estimation routers (sheet, reference, export) at /api/sheet,
    /api/reference, /api/export (mounted at root, NOT under /api/v1 prefix,
    to match the rfq-dashboard frontend API client paths exactly)
  - Project-RFQ bridge at /api/v1/projects/{id}/rfq

Phase 4 additions:
  - AI Drawing Processing at /api/v1/projects/{id}/drawing/...
"""

from fastapi import APIRouter

from app.api.v1 import auth, history, notifications, projects, webhooks
from app.api.v1 import rfq as rfq_bridge
from app.api.v1 import drawing as drawing_ai  # Phase 4
from app.api.v1 import assistant as ai_assistant  # Phase 8
from app.api.v1 import tasks as kanban_tasks  # Phase 10
from app.api.v1 import admin as admin_api  # Phase 11

# Phase 6 — Excel cost estimation routers
from app.excel.routers import sheet as excel_sheet
from app.excel.routers import reference as excel_reference
from app.excel.routers import export as excel_export

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth.router)
api_router.include_router(webhooks.router)
api_router.include_router(projects.router)
api_router.include_router(history.router)
api_router.include_router(rfq_bridge.router)
api_router.include_router(drawing_ai.router)      # Phase 4
api_router.include_router(ai_assistant.router)    # Phase 8
api_router.include_router(notifications.router)   # Phase 9
api_router.include_router(kanban_tasks.router)    # Phase 10
api_router.include_router(admin_api.router)       # Phase 11

# ── Phase 6: Excel routers mounted at root (not under /api/v1) ───────────────
# These must be registered on the top-level app, not the v1 sub-router,
# because the frontend api client uses /api/sheet/..., /api/reference/..., etc.
# We expose them via a separate root-level router imported in main.py.
