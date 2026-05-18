from __future__ import annotations

import os
import signal
import subprocess
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class JobInfo:
    name: str
    command: tuple[str, ...]
    pid: int
    started_at: float


class ProcessManager:
    """Single-active-job process manager for local demo runtime."""

    def __init__(self, cwd: Path) -> None:
        self._cwd = cwd
        self._lock = threading.Lock()
        self._proc: subprocess.Popen[str] | None = None
        self._job: JobInfo | None = None
        self._last_exit: dict[str, Any] | None = None

    def start(self, name: str, command: list[str], env: dict[str, str] | None = None) -> JobInfo:
        with self._lock:
            self._refresh_locked()
            if self._proc is not None and self._job is not None:
                raise RuntimeError(f"Job already running: {self._job.name}")

            child_env = os.environ.copy()
            if env:
                child_env.update(env)
            proc = subprocess.Popen(
                command,
                cwd=self._cwd,
                env=child_env,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                text=True,
                start_new_session=True,
            )
            job = JobInfo(name=name, command=tuple(command), pid=proc.pid, started_at=time.monotonic())
            self._proc = proc
            self._job = job
            return job

    def stop(self, timeout_s: float = 3.0) -> bool:
        with self._lock:
            self._refresh_locked()
            if self._proc is None:
                return False
            proc = self._proc
            job = self._job

            self._terminate_tree_locked(proc, timeout_s=timeout_s)
            self._refresh_locked(force=True, stopped_job=job)
            return True

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            self._refresh_locked()
            active = None
            if self._job is not None:
                active = {
                    "name": self._job.name,
                    "command": list(self._job.command),
                    "pid": self._job.pid,
                    "uptimeS": round(max(0.0, time.monotonic() - self._job.started_at), 3),
                }
            return {
                "state": "running" if active else "idle",
                "activeJob": active,
                "lastExit": self._last_exit,
            }

    def shutdown(self) -> None:
        self.stop(timeout_s=2.0)

    def _refresh_locked(self, *, force: bool = False, stopped_job: JobInfo | None = None) -> None:
        if self._proc is None:
            return
        code = self._proc.poll()
        if code is None and not force:
            return
        job = stopped_job or self._job
        self._last_exit = {
            "name": job.name if job else None,
            "code": code,
            "finishedAt": round(time.monotonic(), 3),
        }
        self._proc = None
        self._job = None

    def _terminate_tree_locked(self, proc: subprocess.Popen[str], timeout_s: float) -> None:
        try:
            os.killpg(proc.pid, signal.SIGTERM)
        except OSError:
            return
        deadline = time.monotonic() + timeout_s
        while time.monotonic() < deadline:
            if proc.poll() is not None:
                return
            time.sleep(0.05)
        try:
            os.killpg(proc.pid, signal.SIGKILL)
        except OSError:
            pass
