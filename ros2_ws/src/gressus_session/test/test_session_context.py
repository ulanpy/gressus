"""Tests for clinical session context bridging."""

from __future__ import annotations

import os

from gressus_session.session_context import ClinicalSessionContext


def test_clinical_session_context_builds_env_and_data_dir(monkeypatch) -> None:
    monkeypatch.setenv("GRESSUS_SESSION_DATA_ROOT", "/tmp/gressus-sessions")
    ctx = ClinicalSessionContext.from_payload(
        {
            "sessionId": "sess-1",
            "patientId": "patient-2",
        }
    )
    assert ctx.session_id == "sess-1"
    assert ctx.patient_id == "patient-2"
    assert ctx.data_dir == os.path.join("/tmp/gressus-sessions", "patient-2", "sess-1")
    assert ctx.to_env() == {
        "GRESSUS_SESSION_ID": "sess-1",
        "GRESSUS_PATIENT_ID": "patient-2",
        "GRESSUS_SESSION_DATA_DIR": os.path.join("/tmp/gressus-sessions", "patient-2", "sess-1"),
    }


def test_clinical_session_context_empty_when_ids_missing() -> None:
    ctx = ClinicalSessionContext.from_payload({"job": "game"})
    assert ctx.to_snapshot() is None
    assert ctx.to_env() == {}
