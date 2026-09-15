"""Low-rate WebSocket preview of raw EMG frames for the therapist UI."""

from __future__ import annotations

import asyncio
import json
import logging
import threading
from urllib.parse import parse_qs, urlparse

from websockets.asyncio.server import serve
from websockets.exceptions import ConnectionClosed

from gressus_insole.emg_preview import preview_payload
from gressus_insole.emg_tcp_receiver import EmgTcpReceiver

logger = logging.getLogger(__name__)


class EmgWsServer:
    """Serve a visual-only, bounded EMG preview from the shared receiver."""

    def __init__(self, receiver: EmgTcpReceiver, *, host: str = "0.0.0.0", port: int = 8767, path: str = "/ws/emg", default_hz: float = 10.0) -> None:
        self._receiver = receiver
        self._host = host
        self._port = port
        self._path = path if path.startswith("/") else f"/{path}"
        self._default_hz = default_hz
        self._thread: threading.Thread | None = None
        self._loop: asyncio.AbstractEventLoop | None = None
        self._stop_event: asyncio.Event | None = None

    def start(self) -> None:
        if self._thread is None:
            self._thread = threading.Thread(target=self._run, name="emg-ws", daemon=True)
            self._thread.start()

    def stop(self) -> None:
        if self._loop is not None and self._stop_event is not None:
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
        async with serve(self._handler, self._host, self._port, process_request=self._process_request):
            logger.info("EMG preview WebSocket listening on ws://%s:%s%s", self._host, self._port, self._path)
            await self._stop_event.wait()

    def _process_request(self, connection, request):
        if urlparse(request.path).path != self._path:
            connection.respond(404, "Not Found")
        return None

    async def _handler(self, websocket) -> None:
        query = parse_qs(urlparse(websocket.request.path).query)
        hz = float(query.get("hz", [str(self._default_hz)])[0])
        points = int(query.get("points", ["32"])[0])
        delay = 1.0 / max(min(hz, 10.0), 1.0)
        try:
            while True:
                connected, error, _dropped = self._receiver.status()
                payload = preview_payload(self._receiver.latest_frame(), points=points)
                payload["connected"] = connected
                payload["error"] = error
                await websocket.send(json.dumps(payload))
                await asyncio.sleep(delay)
        except ConnectionClosed:
            return
