"""Analytics worker use cases."""

from __future__ import annotations

import logging

from sqlalchemy.ext.asyncio import AsyncSession

from backend.modules.analytics.interface import SessionAnalytics
from backend.modules.analytics.processor import process_session

logger = logging.getLogger(__name__)


class AnalyticsWorkerService:
    def __init__(self, db: AsyncSession, sessions: SessionAnalytics) -> None:
        self._db = db
        self._sessions = sessions

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
            await self._sessions.fail_analytics(session_obj)
            await self._db.commit()
            return True

        await self._sessions.complete_analytics(session_obj, metrics)
        await self._db.commit()
        logger.info("analytics ready for session %s", session_id)
        return True
