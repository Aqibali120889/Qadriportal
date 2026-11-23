"""
app/schemas/webhook.py
─────────────────────────────────────────────────────────────────────────────
Pydantic v2 schemas for the POST /webhooks/outlook endpoint.

This is the contract between n8n and FastAPI.
n8n sends this payload after:
  1. Receiving the Outlook email
  2. Uploading PDFs to Supabase Storage
  3. Building the structured payload

FastAPI receives, validates, and writes to PostgreSQL inside a single transaction.
"""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import EmailStr, Field, field_validator

from app.schemas.common import BaseSchema


# ── Attachment Payload ────────────────────────────────────────────────────────

class AttachmentPayload(BaseSchema):
    """
    Metadata for a single email attachment.
    The binary file is already in Supabase Storage when this arrives.
    """
    original_filename: str = Field(..., description="Original file name from the email")
    mime_type: str = Field(..., description="MIME type e.g. application/pdf")
    file_size_bytes: int = Field(..., ge=0, description="File size in bytes")
    storage_path: str = Field(..., description="Path inside the Supabase Storage bucket")
    storage_provider: str = Field(default="supabase", description="Storage backend identifier")
    checksum: Optional[str] = Field(default=None, description="SHA-256 hex digest for integrity")


# ── Email Recipient ───────────────────────────────────────────────────────────

class RecipientPayload(BaseSchema):
    email: str = Field(..., description="Recipient email address")
    name: Optional[str] = Field(default=None, description="Display name of recipient")


# ── Main Webhook Payload ──────────────────────────────────────────────────────

class OutlookWebhookPayload(BaseSchema):
    """
    Full payload POSTed by n8n to POST /api/v1/webhooks/outlook.

    All string fields that are required must be non-empty.
    PDF-only enforcement is applied at validation time.
    """

    # Outlook message identifiers (used for deduplication)
    outlook_message_id: str = Field(..., description="Microsoft Graph message ID (globally unique)")
    internet_message_id: Optional[str] = Field(default=None, description="RFC 2822 Message-ID header")
    conversation_id: Optional[str] = Field(default=None, description="Outlook conversation/thread ID")

    # Business identity — the RFQ number IS the project number. n8n parses this
    # from the subject; FastAPI never invents one. Required: an email that can't
    # be tied to an RFQ number should fail loudly, not silently get a fake number.
    rfq_number: str = Field(..., min_length=1, description="RFQ number parsed by n8n from the subject, e.g. 'RFQ-108'")

    # Email content
    subject: str = Field(..., min_length=1, description="Email subject line")
    body: str = Field(..., description="Full HTML or plain text email body")
    body_preview: Optional[str] = Field(default=None, description="First ~255 chars of body")

    # Sender info
    sender_email: str = Field(..., description="Sender's email address")
    sender_name: Optional[str] = Field(default=None, description="Sender's display name")

    # Recipients
    recipients: List[RecipientPayload] = Field(default_factory=list)

    # Timing
    received_at: datetime = Field(..., description="UTC timestamp when email was received")

    # Attachments (already uploaded to Supabase Storage by n8n)
    attachments: List[AttachmentPayload] = Field(..., min_length=1)

    @field_validator("attachments")
    @classmethod
    def must_contain_pdf(cls, v: List[AttachmentPayload]) -> List[AttachmentPayload]:
        """Reject payloads with no PDF attachments — core business rule."""
        pdf_mimes = {"application/pdf", "application/x-pdf"}
        has_pdf = any(
            a.mime_type.lower() in pdf_mimes or a.original_filename.lower().endswith(".pdf")
            for a in v
        )
        if not has_pdf:
            raise ValueError(
                "At least one PDF attachment is required. "
                "Emails without engineering drawings are not accepted."
            )
        return v

    @field_validator("rfq_number")
    @classmethod
    def validate_rfq_number(cls, v: str) -> str:
        """Normalize whitespace only — n8n has already parsed the real value."""
        v = v.strip()
        if not v:
            raise ValueError("rfq_number must not be blank")
        return v

    @field_validator("sender_email")
    @classmethod
    def validate_sender_email(cls, v: str) -> str:
        """Basic format check — pydantic EmailStr would be stricter but requires email-validator."""
        if "@" not in v or "." not in v.split("@")[-1]:
            raise ValueError(f"Invalid sender email address: {v!r}")
        return v.lower().strip()


# ── Response ──────────────────────────────────────────────────────────────────

class WebhookResponse(BaseSchema):
    """
    Response returned to n8n after successful ingestion.
    n8n should log these values for audit purposes.
    """
    project_id: str
    project_number: str
    email_id: str
    conversation_id: str
    files_ingested: int
    drawings_created: int
    message: str = "Email ingested and project created successfully."
