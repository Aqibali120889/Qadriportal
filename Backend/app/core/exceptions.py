"""
app/core/exceptions.py
─────────────────────────────────────────────────────────────────────────────
Domain-specific exception hierarchy for the Qadri Portal backend.

All exceptions map cleanly to HTTP responses via FastAPI exception handlers
registered in main.py. Using domain exceptions (rather than raising HTTPException
directly in services) keeps business logic free of HTTP concerns.
"""

from __future__ import annotations


class QadriPortalError(Exception):
    """Base class for all application-level exceptions."""

    def __init__(self, message: str, detail: str | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.detail = detail or message


# ── 400 Bad Request ────────────────────────────────────────────────────────────
class ValidationError(QadriPortalError):
    """Raised when incoming data fails business rule validation."""


class InvalidMimeTypeError(ValidationError):
    """Raised when an attachment has an unsupported MIME type."""


class MissingAttachmentError(ValidationError):
    """Raised when a required PDF attachment is absent from the email."""


class MissingRequiredFieldError(ValidationError):
    """Raised when a required email field (subject, sender) is absent."""


# ── 409 Conflict ───────────────────────────────────────────────────────────────
class DuplicateEmailError(QadriPortalError):
    """Raised when an email with the same Outlook message ID already exists."""

    def __init__(self, outlook_message_id: str) -> None:
        super().__init__(
            message=f"Email already ingested: {outlook_message_id}",
            detail=f"A record with outlook_message_id='{outlook_message_id}' already exists.",
        )
        self.outlook_message_id = outlook_message_id


# ── 404 Not Found ──────────────────────────────────────────────────────────────
class ProjectNotFoundError(QadriPortalError):
    """Raised when a project with the given ID does not exist."""

    def __init__(self, project_id: str) -> None:
        super().__init__(
            message=f"Project not found: {project_id}",
        )


class EmailNotFoundError(QadriPortalError):
    """Raised when no email is linked to a given project."""


class DrawingNotFoundError(QadriPortalError):
    """Raised when no drawing is linked to a given project."""


# ── 500 Internal ───────────────────────────────────────────────────────────────
class StorageUploadError(QadriPortalError):
    """Raised when a Supabase Storage upload fails."""


class DatabaseTransactionError(QadriPortalError):
    """Raised when a database transaction fails and cannot be recovered."""
