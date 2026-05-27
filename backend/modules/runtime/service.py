"""Runtime control via gressus_session HTTP API."""

from __future__ import annotations

from typing import Any

import httpx
from fastapi import HTTPException

from backend.core.configs.config import Config
from backend.modules.runtime.schemas import StartRuntimeRequest


class RuntimeService:
    def __init__(self, *, config: Config) -> None:
        self._config = config

    def _url(self, path: str) -> str:
        return f"{self._config.SESSION_MANAGER_URL.rstrip('/')}{path}"

    def _request(self, method: str, path: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
        try:
            with httpx.Client(timeout=self._config.SESSION_MANAGER_TIMEOUT_S) as client:
                response = client.request(method, self._url(path), json=payload)
        except httpx.HTTPError as exc:
            raise HTTPException(
                status_code=503,
                detail=f"session manager unavailable at {self._config.SESSION_MANAGER_URL}: {exc}",
            ) from exc

        try:
            body = response.json()
        except ValueError as exc:
            raise HTTPException(
                status_code=502,
                detail={"message": "invalid JSON from session manager", "status": response.status_code},
            ) from exc

        if response.status_code >= 400:
            detail: Any = body.get("error", body)
            raise HTTPException(status_code=response.status_code, detail=detail)
        return body

    def snapshot(self) -> dict[str, Any]:
        body = self._request("GET", "/session/status")
        return body.get("runtime", body)

    def start(self, cfg: StartRuntimeRequest) -> dict[str, Any]:
        payload = {
            "job": cfg.job,
            "display": cfg.display,
            "outputRotation": cfg.outputRotation,
            "insoleThresholdKpa": cfg.insoleThresholdKpa,
            "noInsole": cfg.noInsole,
            "demo": cfg.demo,
            "speed": cfg.speed,
            "stepTimeS": cfg.stepTimeS,
        }
        return self._request("POST", "/session/start", payload)

    def stop(self, timeout_s: float) -> dict[str, Any]:
        return self._request("POST", "/session/stop", {"timeoutS": timeout_s})
