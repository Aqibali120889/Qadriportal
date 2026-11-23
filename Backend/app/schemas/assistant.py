"""
app/schemas/assistant.py
─────────────────────────────────────────────────────────────────────────────
Pydantic schemas for the Phase 8 AI Assistant module.
"""
from __future__ import annotations
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


# ── Inbound ───────────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message:         str           = Field(..., min_length=1, max_length=8000)
    conversation_id: Optional[str] = None   # None → auto-create
    rfq_number:      Optional[str] = None   # None → global mode
    project_id:      Optional[str] = None   # resolved by backend if omitted
    session_id:      Optional[str] = None   # client-side session UUID
    global_mode:     bool          = False


class ConversationCreate(BaseModel):
    rfq_number: Optional[str] = None
    title:      Optional[str] = None


# ── Outbound ──────────────────────────────────────────────────────────────────

class MessageOut(BaseModel):
    id:         str
    role:       str                   # "user" | "assistant"
    content:    str
    metadata:   Dict[str, Any] = {}
    created_at: str


class ConversationOut(BaseModel):
    id:              str
    title:           Optional[str]
    rfq_number:      Optional[str]
    project_id:      Optional[str]
    message_count:   int = 0
    last_message_at: Optional[str]
    created_at:      str


class ChatResponse(BaseModel):
    conversation_id: str
    message:         MessageOut
    rfq_number:      Optional[str]
    global_mode:     bool


class RFQItem(BaseModel):
    rfq_number: str
    project_id: str
    title:      Optional[str]
    status:     str


class DocumentIngestResponse(BaseModel):
    success:    bool
    message:    str
    filename:   str
    size_mb:    Optional[float] = None
    rfq_number: Optional[str]  = None
    project_id: Optional[str]  = None
