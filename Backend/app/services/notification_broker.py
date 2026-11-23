"""
app/services/notification_broker.py
─────────────────────────────────────────────────────────────────────────────
In-process pub/sub for real-time notification delivery over SSE.

Design:
  - Per-connection asyncio.Queue, registered under the subscriber's
    department_id (or a wildcard channel for Super Admins).
  - publish() fans a notification out to every queue registered for its
    department, plus every wildcard (Super Admin) subscriber.
  - This is in-process only — correct for this app's current single-worker
    uvicorn deployment (no Redis/message broker exists in this stack). If the
    app is ever scaled to multiple worker processes, this registry would need
    to move to a shared broker (e.g. Redis pub/sub) since each worker would
    otherwise only see its own subscribers.
"""

from __future__ import annotations

import asyncio
from collections import defaultdict
from typing import Any, Dict, Set

from app.core.logging import get_logger

logger = get_logger(__name__)

# Sentinel channel Super Admin connections subscribe to — publish() always
# fans out to this channel in addition to the specific department channel.
WILDCARD_CHANNEL = "__all__"


class NotificationBroker:
    """Stateless-ish singleton: holds only the in-memory subscriber registry."""

    def __init__(self) -> None:
        self._channels: Dict[str, Set[asyncio.Queue]] = defaultdict(set)

    def subscribe(self, department_id: str | None, is_super_admin: bool) -> asyncio.Queue:
        """
        Register a new SSE connection. Returns the queue to read events from.
        Super Admins subscribe to the wildcard channel and see every
        department's notifications; normal users subscribe to their own
        department_id channel only — mirrors authorization_service.filter_by_department.
        """
        channel = WILDCARD_CHANNEL if is_super_admin else (department_id or WILDCARD_CHANNEL)
        queue: asyncio.Queue = asyncio.Queue(maxsize=100)
        self._channels[channel].add(queue)
        logger.info("notification_stream_subscribed", channel=channel, subscriber_count=len(self._channels[channel]))
        return queue

    def unsubscribe(self, department_id: str | None, is_super_admin: bool, queue: asyncio.Queue) -> None:
        """Deregister a connection on disconnect. Safe to call even if already removed."""
        channel = WILDCARD_CHANNEL if is_super_admin else (department_id or WILDCARD_CHANNEL)
        self._channels[channel].discard(queue)
        logger.info("notification_stream_unsubscribed", channel=channel, subscriber_count=len(self._channels[channel]))

    async def publish(self, department_id: str | None, payload: Dict[str, Any]) -> None:
        """
        Push a notification payload to every subscriber of its department,
        plus every Super Admin (wildcard) subscriber.
        Never raises — a full/broken queue must not break the caller
        (NotificationService.notify() should succeed even if delivery fails).
        """
        targets: Set[asyncio.Queue] = set()
        if department_id:
            targets |= self._channels.get(department_id, set())
        targets |= self._channels.get(WILDCARD_CHANNEL, set())

        for queue in targets:
            try:
                queue.put_nowait(payload)
            except asyncio.QueueFull:
                logger.warning("notification_stream_queue_full", department_id=department_id)
            except Exception as exc:
                logger.warning("notification_stream_publish_failed", error=str(exc))


# Module-level singleton — the registry must be shared across every request,
# so this must not be re-instantiated per-request like a repository.
notification_broker = NotificationBroker()
