"""HTTP session manager: rosbag recording and runtime status."""

from __future__ import annotations

import argparse
import json
import os
import sys
import threading
import time
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any
from urllib.parse import urlparse

from gressus_session.pgear_ros_client import get_pgear_probe
from gressus_session.rosbag_recorder import RosbagRecorder
from gressus_session.runtime_jobs import RuntimeJobManager
from gressus_session.runtime_status import build_runtime_snapshot, probe_pgear_status
from gressus_session.session_context import ClinicalSessionContext

_ROSBAG = RosbagRecorder()
_RUNTIME_JOB = RuntimeJobManager()


def _rosbag_target_dir(ctx: ClinicalSessionContext) -> str:
    """Where to write the bag: ``<data_dir>/rosbag`` (unique if it already exists)."""
    base = ctx.data_dir or os.path.join(
        os.environ.get("GRESSUS_ROSBAG_ROOT", "/data/sessions"),
        ctx.patient_id or "unknown",
        ctx.session_id or "session",
    )
    out = os.path.join(base, "rosbag")
    if os.path.exists(out):
        out = f"{out}_{int(time.time())}"
    return out


def _json_response(handler: BaseHTTPRequestHandler, status: int, payload: dict[str, Any]) -> None:
    body = json.dumps(payload).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def _read_json(handler: BaseHTTPRequestHandler) -> dict[str, Any]:
    length = int(handler.headers.get("Content-Length", "0"))
    if length <= 0:
        return {}
    raw = handler.rfile.read(length)
    if not raw:
        return {}
    data = json.loads(raw.decode("utf-8"))
    if not isinstance(data, dict):
        raise ValueError("JSON body must be an object")
    return data


def _runtime_snapshot() -> dict[str, Any]:
    rosbag = _ROSBAG.snapshot()
    pgear = probe_pgear_status(get_pgear_probe())
    return build_runtime_snapshot(rosbag=rosbag, activity=_RUNTIME_JOB.snapshot(), pgear=pgear)


class SessionHandler(BaseHTTPRequestHandler):
    server_version = "gressus-session/0.1"

    def log_message(self, fmt: str, *args: Any) -> None:
        sys.stderr.write("[session_manager] " + (fmt % args) + "\n")

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if path == "/session/status":
            _json_response(self, HTTPStatus.OK, {"ok": True, "runtime": _runtime_snapshot()})
            return
        _json_response(self, HTTPStatus.NOT_FOUND, {"ok": False, "error": "not found"})

    def do_POST(self) -> None:
        path = urlparse(self.path).path
        try:
            payload = _read_json(self)
        except (json.JSONDecodeError, ValueError) as exc:
            _json_response(self, HTTPStatus.BAD_REQUEST, {"ok": False, "error": str(exc)})
            return

        if path == "/session/rosbag/start":
            self._handle_rosbag_start(payload)
            return
        if path == "/session/rosbag/stop":
            self._handle_rosbag_stop(payload)
            return
        if path == "/runtime/activity/start":
            self._handle_runtime_start(payload)
            return
        if path == "/runtime/activity/stop":
            self._handle_runtime_stop(payload)
            return
        _json_response(self, HTTPStatus.NOT_FOUND, {"ok": False, "error": "not found"})

    def _handle_rosbag_start(self, payload: dict[str, Any]) -> None:
        ctx = ClinicalSessionContext.from_payload(payload)
        if not ctx.session_id:
            _json_response(
                self, HTTPStatus.BAD_REQUEST, {"ok": False, "error": "sessionId required"}
            )
            return
        out_dir = _rosbag_target_dir(ctx)
        try:
            os.makedirs(os.path.dirname(out_dir), exist_ok=True)
            started = _ROSBAG.start(out_dir=out_dir, session_id=ctx.session_id)
        except RuntimeError as exc:
            _json_response(self, HTTPStatus.CONFLICT, {"ok": False, "error": str(exc)})
            return
        except OSError as exc:
            _json_response(
                self, HTTPStatus.INTERNAL_SERVER_ERROR, {"ok": False, "error": str(exc)}
            )
            return

        if not _ROSBAG.wait_started(0.4):
            _json_response(
                self,
                HTTPStatus.INTERNAL_SERVER_ERROR,
                {"ok": False, "error": "ros2 bag record exited immediately", "dir": out_dir},
            )
            return
        _json_response(self, HTTPStatus.OK, {"ok": True, "dir": out_dir, "pid": started.pid})

    def _handle_rosbag_stop(self, payload: dict[str, Any]) -> None:
        timeout_s = float(payload.get("timeoutS", 5.0))
        stopped = _ROSBAG.stop(timeout_s=timeout_s)
        _json_response(self, HTTPStatus.OK, {"ok": True, "stopped": stopped})

    def _handle_runtime_start(self, payload: dict[str, Any]) -> None:
        kind = payload.get("kind")
        params = payload.get("params")
        if kind not in {"calibration", "game"} or not isinstance(params, dict):
            _json_response(self, HTTPStatus.BAD_REQUEST, {"ok": False, "error": "kind and params required"})
            return
        try:
            owner_session_id = payload.get("ownerSessionId")
            if owner_session_id is not None and not isinstance(owner_session_id, str):
                _json_response(self, HTTPStatus.BAD_REQUEST, {"ok": False, "error": "ownerSessionId must be a string"})
                return
            started = _RUNTIME_JOB.start(kind=kind, params=params, owner_session_id=owner_session_id)
        except (RuntimeError, ValueError, KeyError) as exc:
            _json_response(self, HTTPStatus.CONFLICT, {"ok": False, "error": str(exc)})
            return
        _json_response(self, HTTPStatus.OK, {"ok": True, "pid": started.pid, "kind": kind})

    def _handle_runtime_stop(self, payload: dict[str, Any]) -> None:
        _json_response(self, HTTPStatus.OK, {"ok": True, "stopped": _RUNTIME_JOB.stop()})


def main(args: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Gressus HTTP session manager")
    parser.add_argument("--host", default=os.environ.get("GRESSUS_SESSION_HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=int(os.environ.get("GRESSUS_SESSION_PORT", "9090")))
    ns = parser.parse_args(args)

    server = ThreadingHTTPServer((ns.host, ns.port), SessionHandler)
    sys.stderr.write(f"[session_manager] listening on http://{ns.host}:{ns.port}\n")

    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    try:
        thread.join()
    except KeyboardInterrupt:
        pass
    finally:
        server.shutdown()
        _RUNTIME_JOB.stop(timeout_s=2.0)
        _ROSBAG.stop(timeout_s=2.0)


if __name__ == "__main__":
    main()
