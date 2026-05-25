from __future__ import annotations

import os
import signal
import subprocess
import threading
import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import IO, Any


@dataclass(frozen=True)
class JobInfo:
    name: str
    command: tuple[str, ...]
    pid: int
    started_at: float
    log_path: Path


class ProcessManager:
    """Single-active-job process manager for local demo runtime."""

    def __init__(self, cwd: Path, logs_dir: Path | None = None) -> None:
        self._cwd = cwd # current working directory
        self._logs_dir = logs_dir or (cwd / "logs")
        self._logs_dir.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._proc: subprocess.Popen[str] | None = None
        self._job: JobInfo | None = None
        self._last_exit: dict[str, Any] | None = None
        self._log_handle: IO[bytes] | None = None

    def start(self, name: str, command: list[str], env: dict[str, str] | None = None) -> JobInfo:
        with self._lock:
            self._refresh_locked()
            if self._proc is not None and self._job is not None:
                raise RuntimeError(f"Job already running: {self._job.name}")

            child_env = os.environ.copy()
            if env:
                child_env.update(env)

            log_path = self._open_log_locked(name, command, child_env)
            try:
                proc = subprocess.Popen(
                    command,
                    cwd=self._cwd,
                    env=child_env,
                    stdout=self._log_handle,
                    stderr=subprocess.STDOUT,
                    stdin=subprocess.DEVNULL,
                    text=False,
                    start_new_session=True,
                )
            except OSError:
                self._close_log_locked()
                raise
            job = JobInfo(
                name=name,
                command=tuple(command),
                pid=proc.pid,
                started_at=time.monotonic(),
                log_path=log_path,
            )
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
                    "logPath": str(self._job.log_path),
                }
            return {
                "state": "running" if active else "idle",
                "activeJob": active,
                "lastExit": self._last_exit,
            }

    def shutdown(self) -> None:
        self.stop(timeout_s=2.0)

    def wait_briefly(self, seconds: float) -> bool:
        """Return True if the process is still alive after the wait."""
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

    def tail_log(self, max_bytes: int = 4096, path: Path | None = None) -> str:
        target: Path | None = path
        if target is None:
            with self._lock:
                if self._job is not None:
                    target = self._job.log_path
                elif self._last_exit is not None:
                    raw = self._last_exit.get("logPath")
                    target = Path(raw) if raw else None
        if target is None or not target.exists():
            return ""
        try:
            size = target.stat().st_size
            with target.open("rb") as f:
                if size > max_bytes:
                    f.seek(size - max_bytes)
                data = f.read()
        except OSError:
            return ""
        return data.decode("utf-8", errors="replace")

    def _open_log_locked(self, name: str, command: list[str], env: dict[str, str]) -> Path:
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        log_path = self._logs_dir / f"{name}-{stamp}.log"
        handle = log_path.open("wb", buffering=0)
        header = (
            f"# runtime job: {name}\n"
            f"# started: {datetime.now().isoformat(timespec='seconds')}\n"
            f"# cwd: {self._cwd}\n"
            f"# command: {command}\n"
            f"# DISPLAY={env.get('DISPLAY', '')}"
            f" WAYLAND_DISPLAY={env.get('WAYLAND_DISPLAY', '')}"
            f" QT_QPA_PLATFORM={env.get('QT_QPA_PLATFORM', '')}"
            f" XDG_RUNTIME_DIR={env.get('XDG_RUNTIME_DIR', '')}\n"
            f"# ---\n"
        ).encode("utf-8")
        handle.write(header)

        latest = self._logs_dir / "runtime-last.log"
        try:
            if latest.is_symlink() or latest.exists():
                latest.unlink()
            latest.symlink_to(log_path.name)
        except OSError:
            pass

        self._log_handle = handle
        return log_path

    def _close_log_locked(self) -> None:
        if self._log_handle is None:
            return
        try:
            self._log_handle.close()
        except OSError:
            pass
        self._log_handle = None

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
            "logPath": str(job.log_path) if job is not None else None,
        }
        self._proc = None
        self._job = None
        self._close_log_locked()

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
