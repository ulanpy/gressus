"""Track the single projector ROS launch process."""
from __future__ import annotations

import os
import signal
import subprocess
import threading
import time
from typing import Any


class LaunchProcessManager:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._proc: subprocess.Popen[str] | None = None
        self._name = ""
        self._command: list[str] = []
        self._started = 0.0

    def start(self, name: str, command: list[str], env: dict[str, str] | None = None) -> dict[str, Any]:
        with self._lock:
            self._refresh()
            if self._proc is not None:
                raise RuntimeError(f"Job already running: {self._name}")
            child_env = os.environ.copy()
            child_env.update(env or {})
            self._proc = subprocess.Popen(command, env=child_env, stdin=subprocess.DEVNULL, start_new_session=True)
            self._name, self._command, self._started = name, command, time.monotonic()
            return {"name": name, "command": command, "pid": self._proc.pid}

    def _refresh(self) -> None:
        if self._proc is not None and self._proc.poll() is not None:
            self._proc = None

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            self._refresh()
            active = None if self._proc is None else {
                "name": self._name, "command": self._command, "pid": self._proc.pid,
                "uptimeS": round(time.monotonic() - self._started, 3),
            }
            return {"state": "running" if active else "idle", "activeJob": active}

    def wait_briefly(self, seconds: float) -> bool:
        time.sleep(seconds)
        with self._lock:
            self._refresh()
            return self._proc is not None

    def stop(self, timeout_s: float = 3.0) -> bool:
        with self._lock:
            self._refresh()
            if self._proc is None:
                return False
            proc = self._proc
            try:
                os.killpg(proc.pid, signal.SIGINT)
                proc.wait(timeout=timeout_s)
            except subprocess.TimeoutExpired:
                os.killpg(proc.pid, signal.SIGTERM)
            except OSError:
                pass
            self._proc = None
            return True
