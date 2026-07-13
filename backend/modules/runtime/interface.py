"""Ports consumed by the runtime module."""

from __future__ import annotations

from typing import Any, Protocol
from uuid import UUID

from backend.modules.sessions.models import Session


class PatientReader(Protocol):
    async def ensure_exists(self, patient_id: UUID) -> None:
        """Raise if the patient does not exist."""


class SessionRecording(Protocol):
    async def get_open_recording_session(self) -> Session | None: ...

    async def start_recording_session(
        self,
        patient_id: UUID,
        exo_profile: dict[str, Any] | None,
        anthropometrics: dict[str, Any] | None = None,
    ) -> Session: ...

    async def stop_recording_session(self) -> Session | None: ...
