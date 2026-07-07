"""Ports consumed by the analytics module."""

from __future__ import annotations

from typing import Any, Protocol

from backend.modules.sessions.models import Session


class SessionAnalytics(Protocol):
    async def claim_next_for_analytics(self) -> Session | None: ...

    async def complete_analytics(
        self,
        session_obj: Session,
        metrics: dict[str, Any] | None,
    ) -> None: ...

    async def fail_analytics(self, session_obj: Session) -> None: ...
