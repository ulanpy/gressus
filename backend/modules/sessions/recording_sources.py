"""Discover clinical data sources recorded in a session rosbag.

This module deliberately works from rosbag metadata only.  It does not try to
decode a device payload and therefore remains useful for both research exports
and future product analytics.  ROS infrastructure topics are never listed.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import re
from typing import TYPE_CHECKING

from backend.core.configs.config import config

if TYPE_CHECKING:
    from backend.modules.sessions.models import Session


@dataclass(frozen=True)
class ClinicalSourceSpec:
    id: str
    label: str
    topic: str
    ros_type: str


# This is a registry of *data contracts*, not rehabilitation scenarios.  Adding
# a new device means registering its clinical output here; it does not change
# session workflow or require a therapist to select a configuration.
CLINICAL_SOURCES: tuple[ClinicalSourceSpec, ...] = (
    ClinicalSourceSpec(
        id="pressure_insoles",
        label="Pressure insoles",
        topic="/insole/pressure",
        ros_type="gressus_msgs/msg/InsolePressure",
    ),
    ClinicalSourceSpec(
        id="pgear",
        label="P.GEAR exoskeleton",
        topic="/exoskeleton/telemetry",
        ros_type="gressus_msgs/msg/PgearTelemetry",
    ),
)


_TOPIC_BLOCK_RE = re.compile(
    r"(?ms)^\s*-\s+topic_metadata:\s*\n(?P<block>.*?)(?=^\s*-\s+topic_metadata:|\Z)"
)


def _value(block: str, key: str) -> str | None:
    match = re.search(rf"(?m)^\s*{re.escape(key)}:\s*(\S+)\s*$", block)
    return match.group(1) if match else None


def _message_counts(metadata: str) -> dict[tuple[str, str], int]:
    """Return ROS topic/type counts from rosbag2's YAML metadata.

    We avoid a PyYAML runtime dependency in the backend solely for this small,
    stable rosbag2 structure.
    """

    counts: dict[tuple[str, str], int] = {}
    for match in _TOPIC_BLOCK_RE.finditer(metadata):
        block = match.group("block")
        name = _value(block, "name")
        ros_type = _value(block, "type")
        raw_count = _value(block, "message_count")
        if not name or not ros_type or raw_count is None:
            continue
        try:
            counts[(name, ros_type)] = int(raw_count)
        except ValueError:
            continue
    return counts


def inspect_bag_sources(bag_dir: Path) -> list[dict[str, object]]:
    """Return only clinical sources that have at least one recorded message."""

    metadata_path = bag_dir / "metadata.yaml"
    if not metadata_path.is_file():
        return []
    counts = _message_counts(metadata_path.read_text(encoding="utf-8"))
    return [
        {
            "id": source.id,
            "label": source.label,
            "topic": source.topic,
            "ros_type": source.ros_type,
            "message_count": count,
            "status": "recorded",
        }
        for source in CLINICAL_SOURCES
        if (count := counts.get((source.topic, source.ros_type), 0)) > 0
    ]


def inspect_session_sources(session: "Session") -> list[dict[str, object]]:
    root = Path(config.GRESSUS_SESSION_DATA_ROOT) / str(session.patient_id) / str(session.id)
    preferred = root / "rosbag"
    if preferred.is_dir():
        return inspect_bag_sources(preferred)
    candidates = sorted(
        (path for path in root.glob("rosbag*") if path.is_dir()),
        key=lambda path: path.stat().st_mtime,
        reverse=True,
    )
    return inspect_bag_sources(candidates[0]) if candidates else []
