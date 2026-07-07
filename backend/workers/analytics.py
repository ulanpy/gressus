"""Poll PostgreSQL for sessions pending analytics and process them."""

from __future__ import annotations

import asyncio
import logging
import signal

from backend.core.configs.config import config
import backend.core.database.models  # noqa: F401 — register all ORM mappers
from backend.core.database.manager import db_manager
from backend.modules.analytics.dependencies import build_analytics_worker_service

logger = logging.getLogger(__name__)


async def _poll_loop(stop_event: asyncio.Event) -> None:
    interval_s = config.ANALYTICS_WORKER_POLL_INTERVAL_S
    logger.info(
        "analytics worker started (poll every %.1fs, session data root=%s)",
        interval_s,
        config.GRESSUS_SESSION_DATA_ROOT,
    )

    while not stop_event.is_set():
        processed = False
        async with db_manager.async_session_maker() as session:
            worker = build_analytics_worker_service(session)
            try:
                processed = await worker.run_once()
            except Exception:
                logger.exception("analytics worker tick failed")
                await session.rollback()

        if processed:
            continue

        try:
            await asyncio.wait_for(stop_event.wait(), timeout=interval_s)
        except TimeoutError:
            continue

    await db_manager.dispose()
    logger.info("analytics worker stopped")


def _configure_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    )


def main() -> None:
    _configure_logging()

    stop_event = asyncio.Event()
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, stop_event.set)

    try:
        loop.run_until_complete(_poll_loop(stop_event))
    finally:
        loop.close()


if __name__ == "__main__":
    main()
