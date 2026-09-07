"""Rosbag/MCAP import validation and dashboard metrics extraction."""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
import json
from pathlib import Path
import re
import struct
from typing import Any

from backend.core.configs.config import config
from backend.modules.analytics.telemetry_only_calculator import (
    calculate_session_metrics,
    parameters_from_session,
)
from backend.modules.analytics.pressure_phase import pressure_rows
from backend.modules.sessions.models import Session

MCAP_MAGIC = b"\x89MCAP0\r\n"
OP_MESSAGE = 0x05
OP_CHANNEL = 0x04
OP_CHUNK = 0x06


@dataclass(frozen=True)
class RosbagImport:
    """Resolved recording files for one completed session."""

    bag_dir: Path
    metadata_path: Path
    mcap_paths: tuple[Path, ...]


def _session_recording_root(session: Session) -> Path:
    return (
        Path(config.GRESSUS_SESSION_DATA_ROOT)
        / str(session.patient_id)
        / str(session.id)
    )


def _find_rosbag_dir(session: Session) -> Path:
    root = _session_recording_root(session)
    preferred = root / "rosbag"
    if preferred.exists():
        return preferred

    candidates = sorted(
        (path for path in root.glob("rosbag*") if path.is_dir()),
        key=lambda path: path.stat().st_mtime,
        reverse=True,
    )
    if candidates:
        return candidates[0]

    raise FileNotFoundError(f"rosbag directory not found under {root}")


def _resolve_rosbag_import(session: Session) -> RosbagImport:
    bag_dir = _find_rosbag_dir(session)
    metadata_path = bag_dir / "metadata.yaml"
    if not metadata_path.is_file():
        raise FileNotFoundError(f"rosbag metadata not found: {metadata_path}")

    mcap_paths = tuple(sorted(bag_dir.glob("*.mcap")))
    if not mcap_paths:
        raise FileNotFoundError(f"no .mcap files found in {bag_dir}")

    return RosbagImport(
        bag_dir=bag_dir,
        metadata_path=metadata_path,
        mcap_paths=mcap_paths,
    )


def _validate_mcap_file(path: Path) -> dict[str, Any]:
    size = path.stat().st_size
    if size < len(MCAP_MAGIC):
        raise ValueError(f"MCAP file is too small: {path}")

    with path.open("rb") as file:
        header = file.read(len(MCAP_MAGIC))
        if header != MCAP_MAGIC:
            raise ValueError(f"invalid MCAP header magic: {path}")

        footer = b""
        if size >= len(MCAP_MAGIC) * 2:
            file.seek(-len(MCAP_MAGIC), 2)
            footer = file.read(len(MCAP_MAGIC))

    return {
        "path": str(path),
        "bytes": size,
        "validHeader": True,
        "validFooter": footer == MCAP_MAGIC if footer else None,
    }


def _metadata_scalar(text: str, key: str) -> str | int | None:
    match = re.search(rf"^\s*{re.escape(key)}:\s*(.+?)\s*$", text, re.MULTILINE)
    if not match:
        return None
    value = match.group(1).strip().strip("\"'")
    if value.isdigit():
        return int(value)
    return value


def _metadata_nested_int(text: str, key: str, nested_key: str) -> int | None:
    match = re.search(
        rf"^\s*{re.escape(key)}:\s*\n\s*{re.escape(nested_key)}:\s*(\d+)\s*$",
        text,
        re.MULTILINE,
    )
    if not match:
        return None
    return int(match.group(1))


def _read_metadata(path: Path) -> dict[str, Any]:
    text = path.read_text(encoding="utf-8")
    return {
        "path": str(path),
        "storageIdentifier": _metadata_scalar(text, "storage_identifier"),
        "messageCount": _metadata_scalar(text, "message_count"),
        "durationNanoseconds": _metadata_nested_int(
            text,
            "duration",
            "nanoseconds",
        )
        or _metadata_scalar(text, "duration"),
        "startingTimeNanoseconds": _metadata_nested_int(
            text,
            "starting_time",
            "nanoseconds_since_epoch",
        )
        or _metadata_scalar(text, "starting_time"),
    }


def _read_mcap_string(payload: bytes, offset: int) -> tuple[str, int]:
    if offset + 4 > len(payload):
        raise ValueError("truncated MCAP string")
    length = struct.unpack_from("<I", payload, offset)[0]
    start, end = offset + 4, offset + 4 + length
    if end > len(payload):
        raise ValueError("truncated MCAP string data")
    return payload[start:end].decode("utf-8"), end


def _channel_topic(payload: bytes) -> tuple[int, str] | None:
    if len(payload) < 4:
        return None
    channel_id = struct.unpack_from("<H", payload, 0)[0]
    try:
        topic, _ = _read_mcap_string(payload, 4)
    except (UnicodeDecodeError, ValueError):
        return None
    return channel_id, topic


def _iter_mcap_records(data: bytes):
    offset = 0
    while offset < len(data):
        if data[offset : offset + len(MCAP_MAGIC)] == MCAP_MAGIC:
            return
        if offset + 9 > len(data):
            raise ValueError("truncated MCAP record header")
        opcode = data[offset]
        length = struct.unpack_from("<Q", data, offset + 1)[0]
        start, end = offset + 9, offset + 9 + length
        if end > len(data):
            raise ValueError("truncated MCAP record payload")
        yield opcode, data[start:end]
        offset = end


def _chunk_records(payload: bytes) -> bytes | None:
    # MCAP Chunk: time range (16 B), uncompressed size (8 B), CRC (4 B),
    # compression string, uint64 records length, then inner records. rosbag currently writes
    # uncompressed chunks; fail closed for a future compressed recording.
    if len(payload) < 32:
        return None
    try:
        compression, offset = _read_mcap_string(payload, 28)
    except (UnicodeDecodeError, ValueError):
        return None
    if compression != "" or offset + 8 > len(payload):
        return None
    records_length = struct.unpack_from("<Q", payload, offset)[0]
    start, end = offset + 8, offset + 8 + records_length
    return payload[start:end] if end <= len(payload) else None


def _iter_mcap_messages(path: Path):
    channels: dict[int, str] = {}

    def consume(records: bytes):
        for opcode, payload in _iter_mcap_records(records):
            if opcode == OP_CHANNEL:
                channel = _channel_topic(payload)
                if channel:
                    channels[channel[0]] = channel[1]
                continue
            if opcode == OP_CHUNK:
                nested = _chunk_records(payload)
                if nested is not None:
                    yield from consume(nested)
                continue
            if opcode != OP_MESSAGE or len(payload) < 22:
                continue
            channel_id, sequence = struct.unpack_from("<HI", payload, 0)
            log_time, publish_time = struct.unpack_from("<QQ", payload, 6)
            yield {
                "channelId": channel_id,
                "topic": channels.get(channel_id),
                "sequence": sequence,
                "logTimeNs": log_time,
                "publishTimeNs": publish_time,
                "data": payload[22:],
            }

    with path.open("rb") as file:
        if file.read(len(MCAP_MAGIC)) != MCAP_MAGIC:
            raise ValueError(f"invalid MCAP header magic: {path}")
        data = file.read()
    yield from consume(data)


def _cdr_align(offset: int, alignment: int) -> int:
    return (offset + alignment - 1) & ~(alignment - 1)


def _decode_insole_pressure_cdr(data: bytes) -> tuple[list[float], list[float]] | None:
    """Decode the two fixed-size pressure arrays from ``InsolePressure`` CDR."""

    # ROS 2 CDR encapsulation header is four bytes.  The bridge emits CDR_LE.
    if len(data) < 4 or data[:2] != b"\x00\x01":
        return None
    offset = 4
    try:
        offset = _cdr_align(offset, 4)
        _sec, _nanosec = struct.unpack_from("<iI", data, offset)
        offset += 8
        frame_id_size = struct.unpack_from("<I", data, offset)[0]
        offset += 4 + frame_id_size
        offset = _cdr_align(offset, 4)
        values = struct.unpack_from("<128f", data, offset)
    except struct.error:
        return None
    return list(values[:64]), list(values[64:])


def _decode_insole_frames(paths: tuple[Path, ...]) -> list[tuple[float, list[float], list[float]]]:
    frames: list[tuple[float, list[float], list[float]]] = []
    for path in paths:
        for message in _iter_mcap_messages(path):
            if message.get("topic") != "/insole/pressure":
                continue
            decoded = _decode_insole_pressure_cdr(message["data"])
            if decoded is None:
                continue
            left, right = decoded
            frames.append((int(message["logTimeNs"]) / 1_000_000_000, left, right))
    return sorted(frames, key=lambda frame: frame[0])


def _decode_json_rows(paths: tuple[Path, ...]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for path in paths:
        for message in _iter_mcap_messages(path):
            try:
                row = json.loads(message["data"].decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError):
                continue
            if isinstance(row, dict):
                row["_mcap_log_time_ns"] = message["logTimeNs"]
                row["_mcap_publish_time_ns"] = message["publishTimeNs"]
                rows.append(row)
    rows.sort(key=lambda row: int(row.get("_mcap_log_time_ns") or 0))
    return rows


def _as_float(value: Any) -> float | None:
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value)
        except ValueError:
            return None
    return None


def _is_running_gait(row: dict[str, Any]) -> bool:
    return row.get("phase") == "GAIT" and _as_float(row.get("running")) == 1.0


def _duration_for(rows: list[dict[str, Any]], predicate) -> float:
    total_ns = 0
    for current, next_row in zip(rows, rows[1:]):
        if not predicate(current):
            continue
        current_ns = int(current.get("_mcap_log_time_ns") or 0)
        next_ns = int(next_row.get("_mcap_log_time_ns") or current_ns)
        if next_ns >= current_ns:
            total_ns += next_ns - current_ns
    return total_ns / 1_000_000_000


def _count_step_transitions(rows: list[dict[str, Any]]) -> int:
    previous: int | None = None
    transitions = 0
    for row in rows:
        if not _is_running_gait(row):
            continue
        step_idx = _as_float(row.get("step_idx"))
        if step_idx is None:
            continue
        current = int(step_idx)
        if previous is not None and current != previous:
            transitions += 1
        previous = current
    return transitions


def _numeric_summary(rows: list[dict[str, Any]], key: str) -> dict[str, float | None]:
    values = [_as_float(row.get(key)) for row in rows]
    numeric = [value for value in values if value is not None]
    if not numeric:
        return {"min": None, "max": None, "mean": None}
    return {
        "min": min(numeric),
        "max": max(numeric),
        "mean": sum(numeric) / len(numeric),
    }


def _joint_summaries(rows: list[dict[str, Any]]) -> dict[str, Any]:
    joints = {
        "HR": "right_hip",
        "KR": "right_knee",
        "HL": "left_hip",
        "KL": "left_knee",
    }
    out: dict[str, Any] = {}
    for prefix, label in joints.items():
        angle = _numeric_summary(rows, f"{prefix}_deg")
        out[prefix] = {
            "label": label,
            "angleDeg": angle,
            "romDeg": (
                None
                if angle["min"] is None or angle["max"] is None
                else angle["max"] - angle["min"]
            ),
            "velocityDegS": _numeric_summary(rows, f"{prefix}_vel"),
            "patientTorqueNm": _numeric_summary(rows, f"{prefix}_patient_nm"),
            "measuredTorqueNm": _numeric_summary(rows, f"{prefix}_meas_nm"),
            "effort": _numeric_summary(rows, f"{prefix}_effort"),
        }
    return out


def _compute_analytics(rows: list[dict[str, Any]], metadata: dict[str, Any]) -> dict[str, Any]:
    if not rows:
        return {
            "messageCount": metadata.get("messageCount"),
            "decodedMessageCount": 0,
            "durationS": None,
            "gaitDurationS": 0.0,
            "runningDurationS": 0.0,
            "stepCount": 0,
            "cadenceStepsPerMin": None,
            "phases": {},
            "joints": {},
            "dataQuality": {"decodedJson": False},
        }

    first_ns = int(rows[0].get("_mcap_log_time_ns") or 0)
    last_ns = int(rows[-1].get("_mcap_log_time_ns") or first_ns)
    duration_s = max(0.0, (last_ns - first_ns) / 1_000_000_000)
    gait_duration_s = _duration_for(rows, _is_running_gait)
    running_duration_s = _duration_for(
        rows,
        lambda row: _as_float(row.get("running")) == 1.0,
    )
    step_count = _count_step_transitions(rows)

    return {
        "messageCount": metadata.get("messageCount"),
        "decodedMessageCount": len(rows),
        "durationS": duration_s,
        "gaitDurationS": gait_duration_s,
        "runningDurationS": running_duration_s,
        "stepCount": step_count,
        "cadenceStepsPerMin": (
            None if gait_duration_s <= 0 else step_count / gait_duration_s * 60
        ),
        "phases": dict(Counter(str(row.get("phase", "UNKNOWN")) for row in rows)),
        "assist": {
            "right": _numeric_summary(rows, "assist_r"),
            "left": _numeric_summary(rows, "assist_l"),
        },
        "joints": _joint_summaries(rows),
        "dataQuality": {
            "decodedJson": True,
            "estopSamples": sum(1 for row in rows if _as_float(row.get("estop")) == 1.0),
            "hbErrorSamples": sum(
                1 for row in rows if (_as_float(row.get("hb_error")) or 0.0) != 0.0
            ),
            "crossCheckSamples": sum(
                1 for row in rows if (_as_float(row.get("cross_check")) or 0.0) != 0.0
            ),
        },
    }


def import_rosbag_mcap(
    session: Session,
    excluded_episode_indices: list[int] | None = None,
) -> dict[str, Any]:
    """Load the session rosbag/MCAP files and return metrics for DB storage."""

    recording = _resolve_rosbag_import(session)
    files = [_validate_mcap_file(path) for path in recording.mcap_paths]
    metadata = _read_metadata(recording.metadata_path)
    rows = _decode_json_rows(recording.mcap_paths)
    insole_frames = _decode_insole_frames(recording.mcap_paths)
    insole_rows, pressure_phase = pressure_rows(insole_frames)
    # Raw pressure is the authoritative source when present.  Existing JSON
    # telemetry remains the fallback for historical P.GEAR/CSV imports.
    analytics_rows = insole_rows if insole_rows else rows
    analytics = calculate_session_metrics(
        analytics_rows,
        parameters=parameters_from_session(session),
        excluded_episode_indices=excluded_episode_indices,
    )
    if insole_rows:
        analytics["session"]["insole"] = {
            **analytics["session"]["insole"],
            **pressure_phase,
            "reason": None if pressure_phase["available"] else "insufficient_pressure_events",
        }

    return {
        "source": {
            "type": "rosbag_mcap",
            "patientId": str(session.patient_id),
            "sessionId": str(session.id),
            "bagDir": str(recording.bag_dir),
        },
        "import": {
            "ok": True,
            "metadata": metadata,
            "mcapFiles": files,
            "fileCount": len(files),
            "totalBytes": sum(file["bytes"] for file in files),
        },
        "analytics": analytics,
    }


async def process_session(session: Session) -> dict[str, Any] | None:
    """Compute analytics metrics for one finished session.

    Persistence is owned by ``AnalyticsWorkerService``: it stores this return
    value into ``sessions.analytics_metrics`` and marks analytics as ready.
    """

    return import_rosbag_mcap(session)
