"""Rosbag → dashboard metrics extraction (not implemented yet)."""

from __future__ import annotations

from typing import Any

from backend.modules.sessions.models import Session


async def process_session(session: Session) -> dict[str, Any] | None:
    """Compute analytics metrics for one finished session."""

    pass
    return None
