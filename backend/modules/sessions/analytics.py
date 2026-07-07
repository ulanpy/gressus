"""Helpers for queueing post-session analytics."""

from __future__ import annotations

from backend.modules.sessions.enums import AnalyticsStatus
from backend.modules.sessions.models import Session


def queue_session_analytics(session_obj: Session) -> None:
    """Mark a finished session as waiting for analytics processing."""

    if session_obj.status.is_terminal:
        session_obj.analytics_status = AnalyticsStatus.PENDING
