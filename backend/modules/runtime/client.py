"""HTTP client for gressus_session session_manager (:9090)."""

from __future__ import annotations

from typing import Any, TypeVar

import httpx
from pydantic import BaseModel, ValidationError

from backend.core.configs.config import Config
from backend.modules.runtime.schemas import (
    RosbagResponse,
    StackActionResponse,
    StackStartRequest,
    StackStopRequest,
    SessionRosbagStartPayload,
    SessionStatusResponse,
)

T = TypeVar("T", bound=BaseModel)


class SessionManagerError(Exception):
    """Transport or protocol error talking to session_manager."""

    def __init__(self, message: str, *, status_code: int, detail: Any = None) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.detail = detail if detail is not None else message


class SessionManagerClient:
    """Async HTTP adapter for session_manager (status + rosbag)."""

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
        payload: BaseModel | None,
        *,
        response_model: type[T],
    ) -> T:
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

        try:
            return response_model.model_validate(body)
        except ValidationError as exc:
            raise SessionManagerError(
                "session manager response validation failed",
                status_code=502,
                detail={"message": str(exc), "body": body},
            ) from exc

    async def get_status(self) -> SessionStatusResponse:
        return await self._request("GET", "/session/status", None, response_model=SessionStatusResponse)

    async def rosbag_start(self, payload: SessionRosbagStartPayload) -> RosbagResponse:
        return await self._request(
            "POST",
            "/session/rosbag/start",
            payload,
            response_model=RosbagResponse,
        )

    async def rosbag_stop(self) -> RosbagResponse:
        return await self._request(
            "POST",
            "/session/rosbag/stop",
            None,
            response_model=RosbagResponse,
        )

    async def stack_start(self, payload: StackStartRequest) -> StackActionResponse:
        return await self._request("POST", "/session/start", payload, response_model=StackActionResponse)

    async def stack_stop(self, payload: StackStopRequest) -> StackActionResponse:
        return await self._request("POST", "/session/stop", payload, response_model=StackActionResponse)
