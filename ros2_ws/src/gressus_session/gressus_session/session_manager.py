"""HTTP session manager: bridge backend clinical sessions to ROS launch jobs.

Plain Python HTTP server (``ros2 run gressus_session session_manager``).

- ``POST /session/start|stop`` — spawn ``ros2 launch`` subprocesses.
- ``POST /session/pgear/*`` — call ``pgear_device_node`` services via rclpy (not CLI).
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import threading
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any
from urllib.parse import urlparse

from gressus_session.pgear_ros_client import get_pgear_client
from gressus_session.process_manager import LaunchProcessManager
from gressus_session.session_context import ClinicalSessionContext

_MANAGER = LaunchProcessManager()
_CLINICAL_CONTEXT: ClinicalSessionContext | None = None

_PGEAR_ROUTES: dict[str, str] = {
    "/session/pgear/load-profile": "load_profile",
    "/session/pgear/arm": "arm",
    "/session/pgear/disarm": "disarm",
    "/session/pgear/run": "run",
    "/session/pgear/stop-gait": "stop_gait",
    "/session/pgear/estop": "estop",
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


def _boolish(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.lower() in {"1", "true", "yes", "on"}
    return bool(value)


def _pick_launch_file(payload: dict[str, Any]) -> str:
    if _boolish(payload.get('demo', False)):
        return 'game.launch.py'
    if _boolish(payload.get('noInsole', False)):
        return 'game_camera.launch.py'
    return 'session.launch.py'


def _feedback_launch_args(payload: dict[str, Any]) -> list[str]:
    esp_host = payload.get('espHost', payload.get('esp_host', ''))
    args = [
        f"insole_thresh_kpa:={payload.get('insoleThresholdKpa', 8.0)}",
    ]
    if esp_host is not None and str(esp_host).strip():
        args.append(f"esp_host:={esp_host}")
    return args


def _game_launch_args(payload: dict[str, Any]) -> list[str]:
    demo = _boolish(payload.get('demo', False))
    no_insole = _boolish(payload.get('noInsole', False)) or demo
    launch_args = [
        f"output_rotation:={payload.get('outputRotation', 270)}",
        f"insole_thresh_kpa:={payload.get('insoleThresholdKpa', 8.0)}",
        f"speed:={payload.get('speed', 0.35)}",
        f"step_time_s:={payload.get('stepTimeS', 2.5)}",
        f"demo:={str(demo).lower()}",
        f"no_insole:={str(no_insole).lower()}",
    ]
    display = payload.get('display')
    if display is not None:
        launch_args.append(f'display:={display}')
    return launch_args


def _launch_command(payload: dict[str, Any]) -> tuple[str, list[str]]:
    job = str(payload.get('job', 'game'))
    if job == 'calibrate_apriltag':
        return job, [
            'ros2',
            'launch',
            'gressus_bringup',
            'calibrate.launch.py',
            f"output_rotation:={payload.get('outputRotation', 270)}",
        ]

    if job == 'feedback':
        return job, [
            'ros2',
            'launch',
            'gressus_bringup',
            'feedback.launch.py',
            *_feedback_launch_args(payload),
        ]

    launch_file = _pick_launch_file(payload)
    return job, [
        'ros2',
        'launch',
        'gressus_bringup',
        launch_file,
        *_game_launch_args(payload),
    ]


def _runtime_snapshot() -> dict[str, Any]:
    snap = _MANAGER.snapshot()
    if _CLINICAL_CONTEXT is not None:
        clinical = _CLINICAL_CONTEXT.to_snapshot()
        if clinical is not None:
            snap["clinicalSession"] = clinical
    return snap


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

        if path == "/session/start":
            self._handle_start(payload)
            return
        if path == "/session/stop":
            self._handle_stop(payload)
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

    def _handle_start(self, payload: dict[str, Any]) -> None:
        global _CLINICAL_CONTEXT
        try:
            job, command = _launch_command(payload)
            clinical = ClinicalSessionContext.from_payload(payload)
            launch_env = {
                "QT_QPA_PLATFORM": os.environ.get("QT_QPA_PLATFORM", "xcb"),
                **clinical.to_env(),
            }
            sys.stderr.write(
                f"[session_manager] start payload={payload}\n"
                f"[session_manager] start command={' '.join(command)}\n"
                f"[session_manager] clinical env={clinical.to_env()}\n"
            )
            started = _MANAGER.start(
                name=job,
                command=command,
                env=launch_env,
            )
            _CLINICAL_CONTEXT = clinical if clinical.to_snapshot() else None
        except RuntimeError as exc:
            _json_response(
                self,
                HTTPStatus.CONFLICT,
                {"ok": False, "error": str(exc), "runtime": _runtime_snapshot()},
            )
            return

        if not _MANAGER.wait_briefly(0.3):
            _CLINICAL_CONTEXT = None
            _json_response(
                self,
                HTTPStatus.INTERNAL_SERVER_ERROR,
                {
                    "ok": False,
                    "error": f"{job} exited immediately",
                    "runtime": _runtime_snapshot(),
                },
            )
            return

        _json_response(
            self,
            HTTPStatus.OK,
            {
                "ok": True,
                "started": {
                    "name": started.name,
                    "pid": started.pid,
                    "command": list(started.command),
                },
                "clinicalSession": clinical.to_snapshot(),
                "runtime": _runtime_snapshot(),
            },
        )

    def _handle_stop(self, payload: dict[str, Any]) -> None:
        global _CLINICAL_CONTEXT
        timeout_s = float(payload.get("timeoutS", 3.0))
        stopped = _MANAGER.stop(timeout_s=timeout_s)
        _CLINICAL_CONTEXT = None
        _json_response(
            self,
            HTTPStatus.OK,
            {"ok": True, "stopped": stopped, "runtime": _runtime_snapshot()},
        )


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
        _MANAGER.stop(timeout_s=2.0)


if __name__ == "__main__":
    main()
