"""Fixed monorepo paths (Docker mounts the repo at /gressus)."""

from __future__ import annotations

from pathlib import Path

_DOCKER_REPO = Path("/gressus")
# .../ros2_ws/src/gressus_game/gressus_game/paths.py → repo root
_SOURCE_REPO = Path(__file__).resolve().parents[4]


def repo_root() -> Path:
    if (_DOCKER_REPO / "config").is_dir():
        return _DOCKER_REPO
    return _SOURCE_REPO


CALIBRATION_JSON = repo_root() / "config" / "calibration.json"
