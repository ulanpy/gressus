"""Local game/calibration subprocess orchestration."""

from __future__ import annotations

import os
import shlex
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

    def _ros2_shell_prefix(self) -> str:
        ros_setup = self._config.ROS_SETUP
        install_setup = self._config.repo_root / "ros2_ws" / "install" / "setup.bash"
        return (
            f"source {shlex.quote(ros_setup)} && "
            f"source {shlex.quote(str(install_setup))} && "
        )

    def _shell_command(self, inner: str) -> list[str]:
        container = self._config.ROS_CONTAINER
        if container:
            return ["docker", "exec", container, "bash", "-lc", inner]
        return ["bash", "-lc", inner]

    def build_command(self, cfg: StartRuntimeRequest) -> list[str]:
        if cfg.job == "game":
            game_args = [
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
                game_args.append("--demo")
            if cfg.noInsole or cfg.demo:
                game_args.append("--no-insole")
            if cfg.display is not None:
                game_args.extend(["-d", str(cfg.display)])
            args_str = " ".join(shlex.quote(arg) for arg in game_args)
            shell = (
                f"{self._ros2_shell_prefix()}"
                f"exec ros2 run gressus_game tile_game_node -- {args_str}"
            )
            return self._shell_command(shell)

        cal_args = [
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
        ]
        args_str = " ".join(shlex.quote(arg) for arg in cal_args)
        shell = (
            f"{self._ros2_shell_prefix()}"
            f"exec ros2 run gressus_calibration calibrate_apriltag -- {args_str}"
        )
        return self._shell_command(shell)

    def start(self, cfg: StartRuntimeRequest) -> dict[str, Any]:
        cmd = self.build_command(cfg)
        try:
            job = self._manager.start(
                name=cfg.job,
                command=cmd,
                env={
                    "QT_QPA_PLATFORM": os.environ.get("QT_QPA_PLATFORM", self._config.QT_QPA_PLATFORM),
                },
            )
        except RuntimeError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc

        if not self._manager.wait_briefly(0.3):
            raise HTTPException(
                status_code=500,
                detail={
                    "message": f"{cfg.job} exited immediately; see backend stdout",
                    "runtime": self.snapshot(),
                },
            )

        return {
            "ok": True,
            "started": {
                "name": job.name,
                "pid": job.pid,
                "command": list(job.command),
            },
            "runtime": self.snapshot(),
        }

    def stop(self, timeout_s: float) -> dict[str, Any]:
        stopped = self._manager.stop(timeout_s=timeout_s)
        return {"ok": True, "stopped": stopped, "runtime": self.snapshot()}
