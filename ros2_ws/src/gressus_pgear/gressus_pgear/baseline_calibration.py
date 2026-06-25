"""Empty-exo baseline calibration via pgear_pi MultiJointCalibrator."""

from __future__ import annotations

import time
from typing import TYPE_CHECKING, Any, Callable, Optional

from pgear_pi import constants as C
from pgear_pi.control.calibrator import (
    DEFAULT_DURATION_S,
    MIN_R2,
    WARMUP_S_AFTER_GAIT,
    MultiJointCalibrator,
)
from pgear_pi.joint import JOINTS
from pgear_pi.transport.esp32_link import COEFF_EMPTY

if TYPE_CHECKING:
    from gressus_pgear.esp32_adapter import Esp32Adapter

_PH_GAIT = 2

# Result type: (ok, message, coeffs_payload). coeffs_payload, when present, is
# ``{"coeffs": [[joint, 0, [a,b,c,d,e]], ...], "meta": {...}}`` ready to merge
# into a session ``exo_profile``.
CalibrationResult = tuple[bool, str, Optional[dict[str, Any]]]


def run_baseline_calibration(
    adapter: "Esp32Adapter",
    *,
    duration_s: float = DEFAULT_DURATION_S,
    stale_after_s: float = 0.5,
    cps: float = C.DEFAULT_GAIT_CPS,
    progress_cb: Optional[Callable[[float, float], None]] = None,
    should_cancel: Optional[Callable[[], bool]] = None,
) -> CalibrationResult:
    """Collect gait telemetry, fit baselines, save JSON, push LOAD_COEFFS.

    ``progress_cb(elapsed_s, remaining_s)`` is called periodically while
    sampling; ``should_cancel()`` is polled to abort early. Returns
    ``(ok, message, coeffs_payload)``.
    """
    duration_s = duration_s if duration_s > 0 else DEFAULT_DURATION_S

    telemetry, _, connected, error = adapter.latest_snapshot(stale_after_s)
    if not connected or telemetry is None:
        return False, error or "device not connected (waiting for UDP telemetry)", None
    if int(telemetry.gait_phase) != _PH_GAIT:
        return (
            False,
            f"device must be ARM+RUN in GAIT (gait_phase=2); got {telemetry.gait_phase}",
            None,
        )

    amp_of = lambda idx: telemetry.amp_l if idx >= 2 else telemetry.amp_r
    joints = [(j.idx, j.short, float(amp_of(j.idx))) for j in JOINTS]
    calibrator = MultiJointCalibrator()
    calibrator.start(cps=cps, joints=joints, duration_s=duration_s, kind="empty")

    t0 = time.monotonic()
    while not calibrator.is_done():
        if should_cancel is not None and should_cancel():
            calibrator.cancel()
            return False, "cancelled", None
        telemetry, _, connected, error = adapter.latest_snapshot(stale_after_s)
        if not connected or telemetry is None:
            calibrator.cancel()
            return False, error or "telemetry lost during calibration", None
        if int(telemetry.gait_phase) != _PH_GAIT:
            calibrator.cancel()
            return False, "left GAIT during calibration (stop/disarm?)", None
        elapsed = time.monotonic() - t0
        if progress_cb is not None:
            progress_cb(elapsed, max(0.0, duration_s - elapsed))
        if elapsed >= WARMUP_S_AFTER_GAIT and telemetry.pos:
            for joint in JOINTS:
                idx = joint.idx
                if idx >= len(telemetry.pos):
                    continue
                deg = joint.default_dir * telemetry.pos[idx] * C.DEG_PER_TURN
                vel = telemetry.vel[idx] if idx < len(telemetry.vel) else 0.0
                iq = telemetry.iq[idx] if idx < len(telemetry.iq) else 0.0
                calibrator.append(idx, deg, vel, iq)
        time.sleep(0.02)

    results, skipped = calibrator.finish()
    saved: list[str] = []
    rejected: list[str] = []
    coeff_rows: list[list[Any]] = []
    r2_by_joint: dict[str, float] = {}
    resid_by_joint: dict[str, float] = {}
    cal_ts = ""
    for idx, cal in results.items():
        if cal.r2 < MIN_R2:
            rejected.append(f"{cal.joint} (R2={cal.r2:.2f})")
            continue
        cal.save()
        coef = [cal.a_sin, cal.b_cos, cal.c_vel, cal.d_signvel, cal.e_bias]
        if not adapter.load_coeffs(
            idx, COEFF_EMPTY, coef, resid_std=cal.resid_std_a, cal_cps=cal.cps, cal_amp=cal.amp
        ):
            rejected.append(f"{cal.joint} (LOAD_COEFFS failed)")
            continue
        coeff_rows.append([idx, COEFF_EMPTY, coef])
        r2_by_joint[str(idx)] = round(float(cal.r2), 4)
        resid_by_joint[str(idx)] = round(float(cal.resid_std_a), 4)
        cal_ts = cal.ts or cal_ts
        saved.append(f"{cal.joint} (R2={cal.r2:.2f}, resid={cal.resid_std_a:.2f}A)")

    if not results and not skipped:
        return False, "no joints calibrated", None
    parts: list[str] = []
    if saved:
        parts.append("saved " + ", ".join(saved))
    if rejected:
        parts.append("rejected " + ", ".join(rejected))
    if skipped:
        parts.append("too few samples: " + ", ".join(skipped))
    ok = bool(saved)
    prefix = "OK" if ok else "FAILED"
    message = f"{prefix}: " + "; ".join(parts)

    payload: Optional[dict[str, Any]] = None
    if coeff_rows:
        payload = {
            "coeffs": coeff_rows,
            "meta": {
                "cps": round(float(cps), 4),
                "r2": r2_by_joint,
                "resid_std": resid_by_joint,
                "ts": cal_ts,
            },
        }
    return ok, message, payload
