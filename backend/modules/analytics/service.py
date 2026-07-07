"""Analytics worker use cases."""

from __future__ import annotations

import logging

from sqlalchemy.ext.asyncio import AsyncSession

from backend.modules.analytics.processor import process_session
from backend.modules.sessions.enums import AnalyticsStatus
from backend.modules.sessions.repository import SessionRepository

logger = logging.getLogger(__name__)


class AnalyticsWorkerService:
    def __init__(self, db: AsyncSession) -> None:
        self._sessions = SessionRepository(db)
        self._db = db

    async def run_once(self) -> bool:
        """Claim and process one pending session. Returns True if work was done."""

        session_obj = await self._sessions.claim_next_for_analytics()
        if session_obj is None:
            return False

        session_id = session_obj.id
        logger.info("processing analytics for session %s", session_id)
        try:
            metrics = await process_session(session_obj)
        except Exception:
            logger.exception("analytics failed for session %s", session_id)
            session_obj.analytics_status = AnalyticsStatus.FAILED
            session_obj.analytics_metrics = None
            await self._db.commit()
            return True

        session_obj.analytics_status = AnalyticsStatus.READY
        session_obj.analytics_metrics = metrics
        await self._db.commit()
        logger.info("analytics ready for session %s", session_id)
        return True
