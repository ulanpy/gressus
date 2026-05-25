"""Local game/calibration subprocess orchestration."""

from __future__ import annotations

import os
import sys
from typing import Any

from fastapi import HTTPException

from backend.core.configs.config import Config
from backend.modules.runtime.schemas import StartRuntimeRequest
from backend.runtime.process_manager import ProcessManager


class RuntimeService:
    def __init__(self, *, process_manager: ProcessManager, config: Config) -> None:
        self._manager = process_manager
        self._config = config

    def snapshot(self) -> dict[str, Any]:
        return self._manager.snapshot()

    def build_command(self, cfg: StartRuntimeRequest) -> list[str]:
        python_bin = sys.executable
        calibration = str(self._config.calibration_path)
        if cfg.job == "game":
            cmd = [
                python_bin,
                "station/runners/tile_game.py",
                "--calibration",
                calibration,
                "--output-rotation",
                str(cfg.outputRotation),
                "--insole-thresh-kpa",
                str(cfg.insoleThresholdKpa),
                "--speed",
                str(cfg.speed),
                "--step-time-s",
                str(cfg.stepTimeS),
            ]
            if cfg.demo:
                cmd.append("--demo")
            if cfg.noInsole or cfg.demo:
                cmd.append("--no-insole")
            if cfg.display is not None:
                cmd.extend(["-d", str(cfg.display)])
            return cmd

        return [
            python_bin,
            "station/runners/calibrate_apriltag.py",
            "-c",
            "realsense",
            "--width",
            "640",
            "--height",
            "480",
            "--fps",
            "30",
            "--display",
            "0",
            "--tag-size",
            "280",
            "--margin",
            "30",
            "-o",
            calibration,
        ]

    def start(self, cfg: StartRuntimeRequest) -> dict[str, Any]:
        cmd = self.build_command(cfg)
        try:
            repo_root = str(self._config.repo_root)
            py_path = repo_root
            if existing := os.environ.get("PYTHONPATH"):
                py_path = f"{repo_root}{os.pathsep}{existing}"
            job = self._manager.start(
                name=cfg.job,
                command=cmd,
                env={
                    "PYTHONPATH": py_path,
                    "QT_QPA_PLATFORM": os.environ.get("QT_QPA_PLATFORM", self._config.QT_QPA_PLATFORM),
                },
            )
        except RuntimeError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc

        if not self._manager.wait_briefly(0.3):
            raise HTTPException(
                status_code=500,
                detail={
                    "message": f"{cfg.job} exited immediately",
                    "logPath": str(job.log_path),
                    "logTail": self._manager.tail_log(max_bytes=4096),
                    "runtime": self.snapshot(),
                },
            )

        return {
            "ok": True,
            "started": {
                "name": job.name,
                "pid": job.pid,
                "command": list(job.command),
                "logPath": str(job.log_path),
            },
            "runtime": self.snapshot(),
        }

    def stop(self, timeout_s: float) -> dict[str, Any]:
        stopped = self._manager.stop(timeout_s=timeout_s)
        return {"ok": True, "stopped": stopped, "runtime": self.snapshot()}

    def log_tail(self, tail: int) -> dict[str, Any]:
        snapshot = self.snapshot()
        active = snapshot.get("activeJob") or {}
        log_path = active.get("logPath")
        if log_path is None:
            last_exit = snapshot.get("lastExit") or {}
            log_path = last_exit.get("logPath")
        return {
            "logPath": log_path,
            "logTail": self._manager.tail_log(max_bytes=tail),
        }
