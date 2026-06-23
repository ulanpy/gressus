"""HTTP client for gressus_session session_manager (:9090)."""

from __future__ import annotations

from typing import Any

import httpx
from pydantic import BaseModel

from backend.core.configs.config import Config
from backend.modules.runtime.schemas import (
    SessionPgearLoadProfilePayload,
    SessionStartPayload,
    SessionStopPayload,
)


class SessionManagerError(Exception):
    """Transport or protocol error talking to session_manager."""

    def __init__(self, message: str, *, status_code: int, detail: Any = None) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.detail = detail if detail is not None else message


class SessionManagerClient:
    """Low-level async HTTP adapter for session_manager wire protocol."""

    def __init__(self, *, config: Config, client: httpx.AsyncClient) -> None:
        self._config = config
        self._client = client

    def _url(self, path: str) -> str:
        return f"{self._config.SESSION_MANAGER_URL.rstrip('/')}{path}"

    async def aclose(self) -> None:
        await self._client.aclose()

    async def _request(
        self,
        method: str,
        path: str,
        payload: BaseModel | None = None,
    ) -> dict[str, Any]:
        json_body = payload.model_dump(mode="json", exclude_none=True) if payload is not None else None
        try:
            response = await self._client.request(method, self._url(path), json=json_body)
        except httpx.HTTPError as exc:
            raise SessionManagerError(
                f"session manager unavailable at {self._config.SESSION_MANAGER_URL}: {exc}",
                status_code=503,
            ) from exc

        try:
            body = response.json()
        except ValueError as exc:
            raise SessionManagerError(
                "invalid JSON from session manager",
                status_code=502,
                detail={"message": "invalid JSON from session manager", "status": response.status_code},
            ) from exc

        if response.status_code >= 400:
            detail: Any = body.get("error", body)
            raise SessionManagerError(
                f"session manager returned {response.status_code}",
                status_code=response.status_code,
                detail=detail,
            )
        return body

    async def get_status(self) -> dict[str, Any]:
        return await self._request("GET", "/session/status")

    async def start_stack(self, payload: SessionStartPayload) -> dict[str, Any]:
        return await self._request("POST", "/session/start", payload)

    async def stop_stack(self, payload: SessionStopPayload) -> dict[str, Any]:
        return await self._request("POST", "/session/stop", payload)

    async def pgear_load_profile(self, payload: SessionPgearLoadProfilePayload) -> dict[str, Any]:
        return await self._request("POST", "/session/pgear/load-profile", payload)

    async def pgear_arm(self) -> dict[str, Any]:
        return await self._request("POST", "/session/pgear/arm")

    async def pgear_disarm(self) -> dict[str, Any]:
        return await self._request("POST", "/session/pgear/disarm")

    async def pgear_run(self) -> dict[str, Any]:
        return await self._request("POST", "/session/pgear/run")

    async def pgear_stop_gait(self) -> dict[str, Any]:
        return await self._request("POST", "/session/pgear/stop-gait")

    async def pgear_estop(self) -> dict[str, Any]:
        return await self._request("POST", "/session/pgear/estop")
