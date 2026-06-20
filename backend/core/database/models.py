"""Import all ORM models so they register with Base.metadata."""

from backend.core.database.base import Base  # noqa: F401
import backend.modules.patients.models  # noqa: F401
import backend.modules.sessions.models  # noqa: F401
import backend.modules.assessments.models  # noqa: F401

__all__ = ["Base"]
