"""Runtime use cases — orchestrates session_manager and future domain rules."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import TypeVar

from fastapi import HTTPException

from backend.modules.runtime.client import SessionManagerClient, SessionManagerError
from backend.modules.runtime.schemas import (
    PgearCommandResponse,
    RuntimeSnapshot,
    SessionPgearLoadProfilePayload,
    SessionStartPayload,
    SessionStopPayload,
    StackStartResponse,
    StackStopResponse,
    StartStackRequest,
    StopStackRequest,
)

T = TypeVar("T")


class RuntimeService:
    """Backend runtime control.

    - Stack lifecycle: start/stop ``ros2 launch`` jobs (feedback pipeline or legacy game).
    - P.GEAR commands: proxy to ``pgear_device_node`` via session_manager rclpy client.
    """

    def __init__(self, *, session_manager: SessionManagerClient) -> None:
        self._session_manager = session_manager

    async def _call(self, fn: Callable[[], Awaitable[T]]) -> T:
        try:
            return await fn()
        except SessionManagerError as exc:
            raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc

    async def snapshot(self) -> RuntimeSnapshot:
        body = await self._call(self._session_manager.get_status)
        return body.runtime

    async def start_stack(self, cfg: StartStackRequest) -> StackStartResponse:
        payload = SessionStartPayload.from_api(cfg)
        return await self._call(lambda: self._session_manager.start_stack(payload))

    async def stop_stack(self, cfg: StopStackRequest) -> StackStopResponse:
        payload = SessionStopPayload.from_api(cfg)
        return await self._call(lambda: self._session_manager.stop_stack(payload))

    # Aliases kept for existing callers.
    start = start_stack
    stop = stop_stack

    async def pgear_load_profile(self, profile_json: str) -> PgearCommandResponse:
        payload = SessionPgearLoadProfilePayload(profileJson=profile_json)
        return await self._call(lambda: self._session_manager.pgear_load_profile(payload))

    async def pgear_arm(self) -> PgearCommandResponse:
        return await self._call(self._session_manager.pgear_arm)

    async def pgear_disarm(self) -> PgearCommandResponse:
        return await self._call(self._session_manager.pgear_disarm)

    async def pgear_run(self) -> PgearCommandResponse:
        return await self._call(self._session_manager.pgear_run)

    async def pgear_stop_gait(self) -> PgearCommandResponse:
        return await self._call(self._session_manager.pgear_stop_gait)

    async def pgear_estop(self) -> PgearCommandResponse:
        return await self._call(self._session_manager.pgear_estop)
