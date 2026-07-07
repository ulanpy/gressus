"""Ports consumed by the sessions module."""

from __future__ import annotations

from typing import Protocol
from uuid import UUID


class PatientReader(Protocol):
    async def ensure_exists(self, patient_id: UUID) -> None:
        """Raise if the patient does not exist."""
