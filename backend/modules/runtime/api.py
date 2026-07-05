"""Runtime control — P.GEAR exoskeleton commands (device must be launched manually)."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from backend.common.dependencies import get_runtime_service
from backend.modules.runtime.schemas import (
    CalibratePgearBaselineRequest,
    CalibrationStatusResponse,
    LoadPgearProfileRequest,
    PgearCommandResponse,
    PgearRunRequest,
    RuntimeSnapshot,
)
from backend.modules.runtime.service import RuntimeService

router = APIRouter(prefix="/api/runtime", tags=["runtime"])


@router.get("/status", response_model=RuntimeSnapshot)
async def runtime_status(
    service: Annotated[RuntimeService, Depends(get_runtime_service)],
) -> RuntimeSnapshot:
    """Poll ROS runtime health: rosbag job, pgear node, telemetry freshness."""
    return await service.snapshot()


@router.post("/pgear/load-profile", response_model=PgearCommandResponse)
async def pgear_load_profile(
    payload: LoadPgearProfileRequest,
    service: Annotated[RuntimeService, Depends(get_runtime_service)],
) -> PgearCommandResponse:
    """Apply exo profile JSON to the device. Stack with ``pgear_device_node`` must be up."""
    return await service.pgear_load_profile(payload.profileJson)


@router.post("/pgear/arm", response_model=PgearCommandResponse)
async def pgear_arm(
    service: Annotated[RuntimeService, Depends(get_runtime_service)],
) -> PgearCommandResponse:
    """Enable motors, hold position."""
    return await service.pgear_arm()


@router.post("/pgear/disarm", response_model=PgearCommandResponse)
async def pgear_disarm(
    service: Annotated[RuntimeService, Depends(get_runtime_service)],
) -> PgearCommandResponse:
    """Disable motors, safe idle. Closes the open gait session if any."""
    return await service.pgear_disarm()


@router.post("/pgear/run", response_model=PgearCommandResponse)
async def pgear_run(
    payload: PgearRunRequest,
    service: Annotated[RuntimeService, Depends(get_runtime_service)],
) -> PgearCommandResponse:
    """Start assisted gait and open a DB session for ``patientId``.

    Optional ``profileJson`` is recorded on the new session as ``exo_profile``.
    """
    return await service.pgear_run(payload.patientId, payload.profileJson)


@router.post("/pgear/stop-gait", response_model=PgearCommandResponse)
async def pgear_stop_gait(
    service: Annotated[RuntimeService, Depends(get_runtime_service)],
) -> PgearCommandResponse:
    """Stop gait, stay armed. Closes the open gait session if any."""
    return await service.pgear_stop_gait()


@router.post("/pgear/estop", response_model=PgearCommandResponse)
async def pgear_estop(
    service: Annotated[RuntimeService, Depends(get_runtime_service)],
) -> PgearCommandResponse:
    """Emergency stop on the device."""
    return await service.pgear_estop()


@router.post("/pgear/estop-reset", response_model=PgearCommandResponse)
async def pgear_estop_reset(
    service: Annotated[RuntimeService, Depends(get_runtime_service)],
) -> PgearCommandResponse:
    """Clear faults after E-STOP so the device can be re-armed."""
    return await service.pgear_estop_reset()


@router.post("/pgear/full-cal", response_model=PgearCommandResponse)
async def pgear_full_cal(
    service: Annotated[RuntimeService, Depends(get_runtime_service)],
) -> PgearCommandResponse:
    """ODrive motor/encoder FULL CAL. Device must be DISARM; motors will move."""
    return await service.pgear_full_cal()


@router.post("/pgear/calibrate-baseline", response_model=PgearCommandResponse)
async def pgear_calibrate_baseline(
    payload: CalibratePgearBaselineRequest,
    service: Annotated[RuntimeService, Depends(get_runtime_service)],
) -> PgearCommandResponse:
    """Kick off the empty-exo baseline fit (~30 s). Returns immediately (``started``).

    Calibration runs async on the device — poll ``GET /pgear/calibration-status``
    for progress and the final kind-0 coeffs. Call after ``arm`` + ``run`` (gait_phase=2).
    """
    return await service.pgear_calibrate_baseline(payload.durationS)


@router.get("/pgear/calibration-status", response_model=CalibrationStatusResponse)
async def pgear_calibration_status(
    service: Annotated[RuntimeService, Depends(get_runtime_service)],
) -> CalibrationStatusResponse:
    """Poll async baseline calibration (~1 s interval).

    On ``state=="done"`` the kind-0 coeffs are merged into the open gait session
    and ``sessionId`` is returned.
    """
    return await service.calibration_status()


@router.post("/pgear/cancel-calibrate", response_model=PgearCommandResponse)
async def pgear_cancel_calibrate(
    service: Annotated[RuntimeService, Depends(get_runtime_service)],
) -> PgearCommandResponse:
    """Request cancellation of an in-progress baseline calibration."""
    return await service.pgear_cancel_calibrate()
