"""Clinical session context passed from backend into ROS launch subprocesses."""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any


def _pick_id(payload: dict[str, Any], *keys: str) -> str | None:
    for key in keys:
        value = payload.get(key)
        if value is None:
            continue
        text = str(value).strip()
        if text:
            return text
    return None


@dataclass(frozen=True)
class ClinicalSessionContext:
    session_id: str | None
    patient_id: str | None
    data_dir: str | None

    @classmethod
    def from_payload(cls, payload: dict[str, Any]) -> ClinicalSessionContext:
        session_id = _pick_id(payload, "sessionId", "session_id")
        patient_id = _pick_id(payload, "patientId", "patient_id")
        data_dir = None
        if session_id and patient_id:
            root = os.environ.get("GRESSUS_SESSION_DATA_ROOT", "/data/sessions")
            data_dir = os.path.join(root, patient_id, session_id)
        return cls(session_id=session_id, patient_id=patient_id, data_dir=data_dir)

    def to_env(self) -> dict[str, str]:
        env: dict[str, str] = {}
        if self.session_id:
            env["GRESSUS_SESSION_ID"] = self.session_id
        if self.patient_id:
            env["GRESSUS_PATIENT_ID"] = self.patient_id
        if self.data_dir:
            env["GRESSUS_SESSION_DATA_DIR"] = self.data_dir
        return env

    def to_snapshot(self) -> dict[str, str] | None:
        if not self.session_id and not self.patient_id:
            return None
        out: dict[str, str] = {}
        if self.session_id:
            out["sessionId"] = self.session_id
        if self.patient_id:
            out["patientId"] = self.patient_id
        if self.data_dir:
            out["dataDir"] = self.data_dir
        return out
