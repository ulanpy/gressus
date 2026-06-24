"""WebSocket fanout for live exoskeleton telemetry."""

from __future__ import annotations

import asyncio
import json
import logging
import threading
from urllib.parse import parse_qs, urlparse

from websockets.asyncio.server import serve
from websockets.exceptions import ConnectionClosed

from gressus_pgear.telemetry_hub import TelemetryHub

logger = logging.getLogger(__name__)


class PgearWsServer:
    """Serve ``/ws/exoskeleton`` JSON frames from a shared telemetry hub."""

    def __init__(
        self,
        hub: TelemetryHub,
        *,
        host: str = "0.0.0.0",
        port: int = 8766,
        path: str = "/ws/exoskeleton",
        default_hz: float = 20.0,
    ) -> None:
        self._hub = hub
        self._host = host
        self._port = port
        self._path = path if path.startswith("/") else f"/{path}"
        self._default_hz = default_hz
        self._thread: threading.Thread | None = None
        self._loop: asyncio.AbstractEventLoop | None = None
        self._stop_event: asyncio.Event | None = None

    def start(self) -> None:
        if self._thread is not None:
            return
        self._thread = threading.Thread(target=self._run, name="pgear-ws", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        if self._loop is None or self._stop_event is None:
            return
        self._loop.call_soon_threadsafe(self._stop_event.set)
        if self._thread is not None:
            self._thread.join(timeout=2.0)
            self._thread = None
        self._loop = None
        self._stop_event = None

    def _run(self) -> None:
        loop = asyncio.new_event_loop()
        self._loop = loop
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(self._serve())
        finally:
            loop.close()

    async def _serve(self) -> None:
        self._stop_event = asyncio.Event()
        async with serve(
            self._handler,
            self._host,
            self._port,
            process_request=self._process_request,
        ):
            logger.info("WebSocket listening on ws://%s:%s%s", self._host, self._port, self._path)
            await self._stop_event.wait()

    def _process_request(self, connection, request):
        parsed = urlparse(request.path)
        if parsed.path != self._path:
            connection.respond(404, "Not Found")
            return None
        return None

    async def _handler(self, websocket) -> None:
        parsed = urlparse(websocket.request.path)
        query = parse_qs(parsed.query)
        hz = float(query.get("hz", [str(self._default_hz)])[0])
        delay = 1.0 / max(min(hz, 60.0), 1.0)

        try:
            while True:
                payload = self._hub.snapshot()
                await websocket.send(json.dumps(payload))
                await asyncio.sleep(delay)
        except ConnectionClosed:
            return
