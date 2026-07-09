from __future__ import annotations

import asyncio
from pathlib import Path
from uuid import uuid4

import pytest

from backend.core.configs.config import config
from backend.modules.analytics.processor import MCAP_MAGIC, process_session
from backend.modules.sessions.models import Session


def _write_bag(bag_dir: Path, *, payload: bytes = b"records") -> None:
    bag_dir.mkdir(parents=True)
    (bag_dir / "metadata.yaml").write_text(
        "\n".join(
            [
                "rosbag2_bagfile_information:",
                "  version: 9",
                "  storage_identifier: mcap",
                "  duration: 123000000",
                "  starting_time: 2026-06-25T10:04:11Z",
                "  message_count: 42",
            ]
        ),
        encoding="utf-8",
    )
    (bag_dir / "recording_0.mcap").write_bytes(MCAP_MAGIC + payload + MCAP_MAGIC)


def _session(patient_id, session_id) -> Session:
    return Session(id=session_id, patient_id=patient_id)


def test_process_session_imports_mcap_from_saved_session_path(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(config, "GRESSUS_SESSION_DATA_ROOT", str(tmp_path))
    patient_id = uuid4()
    session_id = uuid4()
    _write_bag(tmp_path / str(patient_id) / str(session_id) / "rosbag")

    metrics = asyncio.run(process_session(_session(patient_id, session_id)))

    assert metrics is not None
    assert metrics["source"]["type"] == "rosbag_mcap"
    assert metrics["import"]["ok"] is True
    assert metrics["import"]["metadata"]["storageIdentifier"] == "mcap"
    assert metrics["import"]["metadata"]["messageCount"] == 42
    assert metrics["import"]["fileCount"] == 1
    assert metrics["import"]["mcapFiles"][0]["validHeader"] is True
    assert metrics["import"]["mcapFiles"][0]["validFooter"] is True


def test_process_session_uses_timestamped_rosbag_directory(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(config, "GRESSUS_SESSION_DATA_ROOT", str(tmp_path))
    patient_id = uuid4()
    session_id = uuid4()
    root = tmp_path / str(patient_id) / str(session_id)
    _write_bag(root / "rosbag_200")

    metrics = asyncio.run(process_session(_session(patient_id, session_id)))

    assert metrics is not None
    assert metrics["source"]["bagDir"].endswith("rosbag_200")


def test_process_session_rejects_non_mcap_file(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(config, "GRESSUS_SESSION_DATA_ROOT", str(tmp_path))
    patient_id = uuid4()
    session_id = uuid4()
    bag_dir = tmp_path / str(patient_id) / str(session_id) / "rosbag"
    _write_bag(bag_dir)
    (bag_dir / "recording_0.mcap").write_bytes(b"not mcap")

    with pytest.raises(ValueError, match="invalid MCAP header magic"):
        asyncio.run(process_session(_session(patient_id, session_id)))
