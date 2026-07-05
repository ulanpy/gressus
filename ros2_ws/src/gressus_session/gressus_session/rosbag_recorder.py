"""Single active ``ros2 bag record`` subprocess for clinical sessions."""

from __future__ import annotations

import os
import signal
import subprocess
import threading
import time
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class RecordingInfo:
    session_id: str
    out_dir: str
    command: tuple[str, ...]
    pid: int
    started_at: float


def _record_command(out_dir: str) -> list[str]:
    topics = os.environ.get("GRESSUS_ROSBAG_TOPICS", "").split()
    record_args = topics if topics else ["-a"]
    return ["ros2", "bag", "record", "-o", out_dir, *record_args]


class RosbagRecorder:
    """Start/stop one rosbag recording at a time."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._proc: subprocess.Popen[str] | None = None
        self._recording: RecordingInfo | None = None
        self._last_exit: dict[str, Any] | None = None

    def start(self, *, out_dir: str, session_id: str) -> RecordingInfo:
        command = _record_command(out_dir)
        with self._lock:
            self._refresh_locked()
            if self._proc is not None and self._recording is not None:
                raise RuntimeError(f"rosbag already recording: {self._recording.session_id}")

            proc = subprocess.Popen(
                command,
                env=os.environ.copy(),
                stdin=subprocess.DEVNULL,
                start_new_session=True,
            )
            recording = RecordingInfo(
                session_id=session_id,
                out_dir=out_dir,
                command=tuple(command),
                pid=proc.pid,
                started_at=time.monotonic(),
            )
            self._proc = proc
            self._recording = recording
            return recording

    def stop(self, timeout_s: float = 5.0) -> bool:
        with self._lock:
            self._refresh_locked()
            if self._proc is None:
                return False
            proc = self._proc
            recording = self._recording
            self._terminate_locked(proc, timeout_s=timeout_s)
            self._refresh_locked(force=True, stopped=recording)
            return True

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            self._refresh_locked()
            active = None
            if self._recording is not None:
                rec = self._recording
                active = {
                    "name": f"rosbag:{rec.session_id}",
                    "command": list(rec.command),
                    "pid": rec.pid,
                    "dir": rec.out_dir,
                    "uptimeS": round(max(0.0, time.monotonic() - rec.started_at), 3),
                }
            return {
                "state": "running" if active else "idle",
                "activeJob": active,
                "lastExit": self._last_exit,
            }

    def wait_started(self, seconds: float = 0.4) -> bool:
        """True if the recorder process is still alive after a brief delay."""
        deadline = time.monotonic() + max(0.0, seconds)
        while time.monotonic() < deadline:
            with self._lock:
                if self._proc is None:
                    return False
                if self._proc.poll() is not None:
                    self._refresh_locked(force=False)
                    return False
            time.sleep(0.02)
        with self._lock:
            return self._proc is not None and self._proc.poll() is None

    def _refresh_locked(
        self,
        *,
        force: bool = False,
        stopped: RecordingInfo | None = None,
    ) -> None:
        if self._proc is None:
            return
        code = self._proc.poll()
        if code is None and not force:
            return
        recording = stopped or self._recording
        self._last_exit = {
            "name": f"rosbag:{recording.session_id}" if recording else None,
            "code": code,
            "finishedAt": round(time.monotonic(), 3),
        }
        self._proc = None
        self._recording = None

    def _terminate_locked(self, proc: subprocess.Popen[str], timeout_s: float) -> None:
        try:
            os.killpg(proc.pid, signal.SIGINT)
        except OSError:
            try:
                proc.send_signal(signal.SIGINT)
            except OSError:
                return
        deadline = time.monotonic() + timeout_s * 0.6
        while time.monotonic() < deadline:
            if proc.poll() is not None:
                return
            time.sleep(0.05)
        try:
            os.killpg(proc.pid, signal.SIGTERM)
        except OSError:
            try:
                proc.send_signal(signal.SIGTERM)
            except OSError:
                return
        deadline = time.monotonic() + timeout_s * 0.4
        while time.monotonic() < deadline:
            if proc.poll() is not None:
                return
            time.sleep(0.05)
        try:
            os.killpg(proc.pid, signal.SIGKILL)
        except OSError:
            pass
