"""One managed projector activity: camera calibration or tile game."""

from __future__ import annotations

import os
import signal
import subprocess
import threading
import time
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class RuntimeJobInfo:
    kind: str
    command: tuple[str, ...]
    pid: int
    started_at: float
    owner_session_id: str | None


def build_command(kind: str, params: dict[str, Any]) -> list[str]:
    """Build an allowlisted ROS launch command from validated request data."""
    if kind == "calibration":
        return [
            "ros2", "launch", "gressus_bringup", "calibrate.launch.py",
            f"camera:={params['camera']}", f"width:={params['width']}",
            f"height:={params['height']}", f"fps:={params['fps']}",
            f"display:={params['display']}", f"tag_size:={params['tagSize']}",
            f"margin:={params['margin']}", f"output_rotation:={params['outputRotation']}",
        ]
    if kind == "game":
        return [
            "ros2", "launch", "gressus_bringup", "tile_game.launch.py",
            f"mode:={params['mode']}", f"output_rotation:={params['outputRotation']}",
            f"insole_thresh_kpa:={params['insoleThresholdKpa']}",
            f"speed:={params['speed']}", f"step_time_s:={params['stepTimeS']}",
            f"display:={params['display']}",
        ]
    raise ValueError(f"unsupported runtime job: {kind}")


class RuntimeJobManager:
    """Own exactly one foreground therapy activity and stop its process group."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._proc: subprocess.Popen[str] | None = None
        self._job: RuntimeJobInfo | None = None

    def start(self, *, kind: str, params: dict[str, Any], owner_session_id: str | None = None) -> RuntimeJobInfo:
        command = build_command(kind, params)
        with self._lock:
            self._refresh_locked()
            if self._job is not None:
                raise RuntimeError(f"runtime job already running: {self._job.kind}")
            proc = subprocess.Popen(command, env=os.environ.copy(), start_new_session=True)
            self._proc = proc
            self._job = RuntimeJobInfo(
                kind=kind, command=tuple(command), pid=proc.pid, started_at=time.monotonic(),
                owner_session_id=owner_session_id,
            )
            return self._job

    def stop(self, timeout_s: float = 5.0) -> bool:
        with self._lock:
            self._refresh_locked()
            if self._proc is None:
                return False
            proc = self._proc
            self._terminate_locked(proc, timeout_s)
            self._refresh_locked(force=True)
            return True

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            self._refresh_locked()
            if self._job is None:
                return {"state": "idle", "activeJob": None}
            job = self._job
            return {"state": "running", "activeJob": {"name": job.kind, "command": list(job.command), "pid": job.pid, "uptimeS": round(max(0.0, time.monotonic() - job.started_at), 3), "ownerSessionId": job.owner_session_id}}

    def _refresh_locked(self, *, force: bool = False) -> None:
        if self._proc is None:
            return
        if self._proc.poll() is None and not force:
            return
        self._proc = None
        self._job = None

    @staticmethod
    def _terminate_locked(proc: subprocess.Popen[str], timeout_s: float) -> None:
        try:
            os.killpg(proc.pid, signal.SIGINT)
        except OSError:
            return
        deadline = time.monotonic() + timeout_s * 0.6
        while time.monotonic() < deadline and proc.poll() is None:
            time.sleep(0.05)
        if proc.poll() is not None:
            return
        try:
            os.killpg(proc.pid, signal.SIGTERM)
        except OSError:
            return
        deadline = time.monotonic() + timeout_s * 0.4
        while time.monotonic() < deadline and proc.poll() is None:
            time.sleep(0.05)
        if proc.poll() is None:
            try:
                os.killpg(proc.pid, signal.SIGKILL)
            except OSError:
                pass
