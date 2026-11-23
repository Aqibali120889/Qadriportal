"""
app/models/__init__.py
─────────────────────────────────────────────────────────────────────────────
Export all ORM models so Alembic's env.py can discover them via `Base.metadata`.
Import order matters — referenced models must be imported before dependents.
"""

# ── Phase 1: Core Domain ──────────────────────────────────────────────────────
from app.models.base import Base  # noqa: F401
from app.models.project import Project, ProjectStatus  # noqa: F401
from app.models.conversation import Conversation, ConversationType  # noqa: F401
from app.models.email import Email, EmailStatus  # noqa: F401
from app.models.email_attachment import EmailAttachment  # noqa: F401
from app.models.file import File, FileStatus, FileType  # noqa: F401
from app.models.drawing import Drawing  # noqa: F401
from app.models.file_version import FileVersion  # noqa: F401

# ── Phase 2: Identity & Authorization ────────────────────────────────────────
from app.models.department import Department  # noqa: F401
from app.models.role import Role, Permission, RolePermission  # noqa: F401
from app.models.user import User, UserStatus  # noqa: F401
from app.models.user_session import UserSession, SessionStatus  # noqa: F401
from app.models.notification import Notification, NotificationType  # noqa: F401

# ── Phase 11: Customers, History & Settings ──────────────────────────────
from app.models.customer import Customer  # noqa: F401
from app.models.login_history import LoginHistory  # noqa: F401
from app.models.system_setting import SystemSetting  # noqa: F401

# ── Phase 10: Kanban & Task Management ───────────────────────────────────
from app.models.kanban_task import (  # noqa: F401
    KanbanTask, TaskComment, TaskHistory,
    TaskStatus, TaskPriority, TaskEventType,
)

__all__ = [
    # Phase 1
    "Base",
    "Project",
    "ProjectStatus",
    "Conversation",
    "ConversationType",
    "Email",
    "EmailStatus",
    "EmailAttachment",
    "File",
    "FileStatus",
    "FileType",
    "Drawing",
    "FileVersion",
    # Phase 2
    "Department",
    "Role",
    "Permission",
    "RolePermission",
    "User",
    "UserStatus",
    "UserSession",
    "SessionStatus",
    "Notification",
    "NotificationType",
    # Phase 11
    "Customer",
    "LoginHistory",
    "SystemSetting",
    # Phase 10
    "KanbanTask",
    "TaskComment",
    "TaskHistory",
    "TaskStatus",
    "TaskPriority",
    "TaskEventType",
]
