"""HTTP session manager: bridge backend clinical sessions to ROS services.

Plain Python HTTP server (``ros2 run gressus_session session_manager``).

- ``POST /session/pgear/*`` — call ``pgear_device_node`` services via rclpy (not CLI).
- ``POST /session/rosbag/*`` — optional rosbag recording for gait sessions.

Start ``pgear_device_node`` manually, e.g.
``ros2 launch gressus_bringup pgear.launch.py``.
"""

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

from gressus_session.pgear_ros_client import get_pgear_client
from gressus_session.rosbag_recorder import RosbagRecorder
from gressus_session.runtime_status import build_runtime_snapshot, probe_pgear_status
from gressus_session.session_context import ClinicalSessionContext

_ROSBAG = RosbagRecorder()


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


_PGEAR_ROUTES: dict[str, str] = {
    "/session/pgear/load-profile": "load_profile",
    "/session/pgear/arm": "arm",
    "/session/pgear/disarm": "disarm",
    "/session/pgear/run": "run",
    "/session/pgear/stop-gait": "stop_gait",
    "/session/pgear/estop": "estop",
    "/session/pgear/estop-reset": "estop_reset",
    "/session/pgear/full-cal": "full_cal",
    "/session/pgear/calibrate-baseline": "calibrate_baseline",
    "/session/pgear/cancel-calibrate": "cancel_calibrate",
}


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
    pgear = probe_pgear_status(get_pgear_client())
    return build_runtime_snapshot(rosbag=rosbag, pgear=pgear)


class SessionHandler(BaseHTTPRequestHandler):
    server_version = "gressus-session/0.1"

    def log_message(self, fmt: str, *args: Any) -> None:
        sys.stderr.write("[session_manager] " + (fmt % args) + "\n")

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if path == "/session/status":
            _json_response(self, HTTPStatus.OK, {"ok": True, "runtime": _runtime_snapshot()})
            return
        if path == "/session/pgear/calibration-status":
            try:
                result = get_pgear_client().calibration_status()
            except Exception as exc:
                _json_response(
                    self,
                    HTTPStatus.INTERNAL_SERVER_ERROR,
                    {"ok": False, "error": str(exc)},
                )
                return
            _json_response(self, HTTPStatus.OK, result)
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
        pgear_action = _PGEAR_ROUTES.get(path)
        if pgear_action is not None:
            self._handle_pgear(pgear_action, payload)
            return
        _json_response(self, HTTPStatus.NOT_FOUND, {"ok": False, "error": "not found"})

    def _handle_pgear(self, action: str, payload: dict[str, Any]) -> None:
        try:
            client = get_pgear_client()
            if action == "load_profile":
                profile_json = str(payload.get("profileJson", "")).strip()
                if not profile_json:
                    _json_response(
                        self,
                        HTTPStatus.BAD_REQUEST,
                        {"ok": False, "error": "profileJson required"},
                    )
                    return
                result = client.load_profile(profile_json)
            elif action == "arm":
                result = client.arm()
            elif action == "disarm":
                result = client.disarm()
            elif action == "run":
                result = client.run()
            elif action == "stop_gait":
                result = client.stop_gait()
            elif action == "estop":
                result = client.estop()
            elif action == "estop_reset":
                result = client.estop_reset()
            elif action == "full_cal":
                result = client.full_cal()
            elif action == "calibrate_baseline":
                duration_s = float(payload.get("durationS", payload.get("duration_s", 0)) or 0)
                result = client.calibrate_baseline(duration_s=duration_s)
            elif action == "cancel_calibrate":
                result = client.cancel_calibrate()
            else:
                _json_response(self, HTTPStatus.NOT_FOUND, {"ok": False, "error": "unknown action"})
                return
        except Exception as exc:
            _json_response(
                self,
                HTTPStatus.INTERNAL_SERVER_ERROR,
                {"ok": False, "success": False, "message": str(exc)},
            )
            return

        status = HTTPStatus.OK if result.get("ok") else HTTPStatus.SERVICE_UNAVAILABLE
        _json_response(self, status, result)

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
            # A recording is already running (single active bag).
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
        stopped = _ROSBAG.stop(timeout_s=timeout_s)  # SIGINT → bag closes cleanly
        _json_response(self, HTTPStatus.OK, {"ok": True, "stopped": stopped})


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
        _ROSBAG.stop(timeout_s=2.0)


if __name__ == "__main__":
    main()
