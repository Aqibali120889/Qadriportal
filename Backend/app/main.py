"""
app/main.py
─────────────────────────────────────────────────────────────────────────────
FastAPI application entry point.

Responsibilities:
- Application factory pattern
- CORS middleware configuration
- Global exception handlers
- Lifespan events (startup / shutdown)
- OpenAPI documentation metadata
- Health check endpoint
"""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import api_router
from app.config import get_settings
from app.core.exceptions import (
    DatabaseTransactionError,
    DuplicateEmailError,
    ProjectNotFoundError,
    QadriPortalError,
    ValidationError,
)
from app.core.logging import configure_logging, get_logger

# Configure structured logging before anything else
configure_logging()
logger = get_logger(__name__)
settings = get_settings()


# ── Lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown events."""
    logger.info(
        "application_starting",
        env=settings.APP_ENV,
        debug=settings.DEBUG,
    )
    yield
    logger.info("application_shutdown")


# ── Application Factory ───────────────────────────────────────────────────────

def create_app() -> FastAPI:
    app = FastAPI(
        title="Qadri Portal API",
        description=(
            "Enterprise AI-Powered Cement Cost Estimation Platform — Phase 1\n\n"
            "Provides email intake via n8n webhook and project data retrieval for the React frontend."
        ),
        version="1.0.0",
        docs_url="/docs" if settings.DEBUG else None,
        redoc_url="/redoc" if settings.DEBUG else None,
        openapi_url="/openapi.json" if settings.DEBUG else None,
        lifespan=lifespan,
    )

    # ── CORS ──────────────────────────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["*"],
    )

    # ── Routers ───────────────────────────────────────────────────────────────
    app.include_router(api_router)

    # ── Phase 6: Excel Cost Estimation Routers (root-level paths) ────────────
    # Mounted at /api/sheet, /api/reference, /api/export (NOT under /api/v1)
    # so the enterprise frontend's rfq API client works without path changes.
    from app.excel.routers.sheet import router as excel_sheet_router
    from app.excel.routers.reference import router as excel_reference_router
    from app.excel.routers.export import router as excel_export_router
    app.include_router(excel_sheet_router)
    app.include_router(excel_reference_router)
    app.include_router(excel_export_router)

    # ── Global Exception Handlers ─────────────────────────────────────────────

    @app.exception_handler(DuplicateEmailError)
    async def duplicate_email_handler(request: Request, exc: DuplicateEmailError):
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={"code": "DUPLICATE_EMAIL", "message": exc.message},
        )

    @app.exception_handler(ProjectNotFoundError)
    async def project_not_found_handler(request: Request, exc: ProjectNotFoundError):
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"code": "PROJECT_NOT_FOUND", "message": exc.message},
        )

    @app.exception_handler(ValidationError)
    async def validation_error_handler(request: Request, exc: ValidationError):
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"code": "VALIDATION_ERROR", "message": exc.message, "detail": exc.detail},
        )

    @app.exception_handler(DatabaseTransactionError)
    async def db_transaction_handler(request: Request, exc: DatabaseTransactionError):
        logger.error("database_transaction_error", message=exc.message, detail=exc.detail)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"code": "DB_ERROR", "message": "A database error occurred. Please try again."},
        )

    @app.exception_handler(QadriPortalError)
    async def general_portal_error_handler(request: Request, exc: QadriPortalError):
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"code": "INTERNAL_ERROR", "message": exc.message},
        )

    # ── Health Check ──────────────────────────────────────────────────────────

    @app.get(
        "/health",
        tags=["System"],
        summary="Health Check",
        response_description="Service is healthy",
    )
    async def health_check():
        return {
            "status": "healthy",
            "service": "qadri-portal-api",
            "version": "1.0.0",
            "environment": settings.APP_ENV,
        }

    return app


app = create_app()
