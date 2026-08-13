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
from gressus_session.process_manager import LaunchProcessManager
from gressus_session.rosbag_recorder import RosbagRecorder
from gressus_session.runtime_status import build_runtime_snapshot, probe_pgear_status
from gressus_session.session_context import ClinicalSessionContext

_ROSBAG = RosbagRecorder()
_LAUNCH = LaunchProcessManager()


def _boolish(value: Any) -> bool:
    return value if isinstance(value, bool) else str(value).lower() in {"1", "true", "yes", "on"}


def _launch_command(payload: dict[str, Any]) -> tuple[str, list[str]]:
    job = str(payload.get("job", "game"))
    rotation = payload.get("outputRotation", 270)
    if job == "calibrate_apriltag":
        return job, ["ros2", "launch", "gressus_bringup", "calibrate.launch.py", f"output_rotation:={rotation}"]
    demo = _boolish(payload.get("demo", False))
    no_insole = _boolish(payload.get("noInsole", False)) or demo
    launch_file = "game.launch.py" if demo else "game_camera.launch.py" if no_insole else "session.launch.py"
    args = [
        f"output_rotation:={rotation}",
        f"insole_thresh_kpa:={payload.get('insoleThresholdKpa', 8)}",
        f"speed:={payload.get('speed', .35)}", f"step_time_s:={payload.get('stepTimeS', 2.5)}",
        f"demo:={str(demo).lower()}", f"no_insole:={str(no_insole).lower()}",
    ]
    if payload.get("display") is not None:
        args.append(f"display:={payload['display']}")
    return job, ["ros2", "launch", "gressus_bringup", launch_file, *args]


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
    launch = _LAUNCH.snapshot()
    pgear = probe_pgear_status(get_pgear_probe())
    return build_runtime_snapshot(rosbag=launch, pgear=pgear)


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
        if path == "/session/start":
            self._handle_start(payload)
            return
        if path == "/session/stop":
            self._handle_stop(payload)
            return
        if path == "/session/rosbag/stop":
            self._handle_rosbag_stop(payload)
            return
        _json_response(self, HTTPStatus.NOT_FOUND, {"ok": False, "error": "not found"})

    def _handle_start(self, payload: dict[str, Any]) -> None:
        try:
            job, command = _launch_command(payload)
            started = _LAUNCH.start(job, command, {"QT_QPA_PLATFORM": os.environ.get("QT_QPA_PLATFORM", "xcb")})
        except RuntimeError as exc:
            _json_response(self, HTTPStatus.CONFLICT, {"ok": False, "error": str(exc)})
            return
        if not _LAUNCH.wait_briefly(.3):
            _json_response(self, HTTPStatus.INTERNAL_SERVER_ERROR, {"ok": False, "error": f"{job} exited immediately"})
            return
        _json_response(self, HTTPStatus.OK, {"ok": True, "started": started, "runtime": _runtime_snapshot()})

    def _handle_stop(self, payload: dict[str, Any]) -> None:
        stopped = _LAUNCH.stop(float(payload.get("timeoutS", 3)))
        _json_response(self, HTTPStatus.OK, {"ok": True, "stopped": stopped, "runtime": _runtime_snapshot()})

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
        _LAUNCH.stop(timeout_s=2.0)


if __name__ == "__main__":
    main()
