"""WebSocket fanout for live insole pressure frames."""

from __future__ import annotations

import asyncio
import json
import logging
import threading
from typing import Literal
from urllib.parse import parse_qs, urlparse

from websockets.asyncio.server import serve
from websockets.exceptions import ConnectionClosed

from gressus_insole.tcp_receiver import InsoleTcpReceiver
from gressus_common.insole_frame_payload import InsoleSize, frame_from_snapshot

logger = logging.getLogger(__name__)


class InsoleWsServer:
    """Serve `/ws/insole` JSON frames from a shared TCP receiver."""

    def __init__(
        self,
        receiver: InsoleTcpReceiver,
        *,
        host: str = "0.0.0.0",
        port: int = 8765,
        path: str = "/ws/insole",
        default_hz: float = 50.0,
    ) -> None:
        self._receiver = receiver
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
        self._thread = threading.Thread(target=self._run, name="insole-ws", daemon=True)
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
        size_raw = query.get("size", ["m"])[0]
        size: InsoleSize = "s" if size_raw == "s" else "m"
        threshold_kpa = float(query.get("threshold_kpa", ["8"])[0])
        hz = float(query.get("hz", [str(self._default_hz)])[0])
        delay = 1.0 / max(min(hz, 60.0), 1.0)

        try:
            while True:
                snapshot = self._receiver.latest_snapshot(threshold_kpa)
                payload = frame_from_snapshot(
                    snapshot,
                    size=size,
                    threshold_kpa=threshold_kpa,
                )
                await websocket.send(json.dumps(payload))
                await asyncio.sleep(delay)
        except ConnectionClosed:
            return
