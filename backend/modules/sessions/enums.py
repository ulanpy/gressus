"""Session enumerations."""

from __future__ import annotations

from enum import Enum


class SessionStatus(str, Enum):
    """Lifecycle state of a therapy session.

    ``active``    — currently running / not yet finished.
    ``completed`` — finished normally; data is trustworthy.
    ``failed``    — ended due to a technical problem; data may be incomplete.
    ``aborted``   — stopped early by the therapist or patient.
    """

    ACTIVE = "active"
    COMPLETED = "completed"
    FAILED = "failed"
    ABORTED = "aborted"

    @property
    def is_terminal(self) -> bool:
        """True once the session has reached a final state."""

        return self in {
            SessionStatus.COMPLETED,
            SessionStatus.FAILED,
            SessionStatus.ABORTED,
        }
