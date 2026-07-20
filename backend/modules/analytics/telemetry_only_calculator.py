"""Calculate analytics from telemetry rows and session parameters."""

from __future__ import annotations

from collections import Counter
from math import isfinite, pi, sin, sqrt
from statistics import mean
from typing import Any, Callable

Number = int | float

CONTINUITY_GAP_THRESHOLD_S = 30.0

FORMULAS: dict[str, str] = {
    "commanded_cycle_period": "T_cycle = 1 / mean(cps)",
    "commanded_cadence": "cadence_cmd = 120 * mean(cps) [steps/min], assuming 2 steps/cycle",
    "joint_rom": "ROM_J = max(J_deg) - min(J_deg)",
    "kinematic_step_length": "L_kin = 2 * L_leg * sin(theta_hip_max / 2), where theta_hip_max is hip ROM in radians",
    "peak_flexion_extension": "PeakFlex_J = max(J_deg); PeakExt_J = min(J_deg)",
    "velocity": "MeanAbsVel_J = mean(abs(J_vel)); PeakAbsVel_J = max(abs(J_vel))",
    "robot_torque": "MeanAbsRobotTorque_J = mean(abs(J_meas_nm)); RMSRobotTorque_J = sqrt(mean(J_meas_nm^2))",
    "commanded_torque": "MeanAbsCmdTorque_J = mean(abs(J_cmd_nm)); RMSErrorCmdVsMeasured_J = sqrt(mean((J_cmd_nm-J_meas_nm)^2))",
    "patient_torque": "MeanAbsPatientTorque_J = mean(abs(J_patient_nm)) where J_patient_status == 'ok'",
    "patient_torque_validity": "ValidPatientTorquePct_J = valid_status_ok_samples / total_samples * 100",
    "participation": "Participation_J = patient_mean_abs / (patient_mean_abs + robot_mean_abs)",
    "mechanical_power": "Power_J(t) = torque_J(t) * J_vel(t) * pi / 180",
    "mechanical_work": "Work_J = sum(Power_J(t_i) * (t_(i+1)-t_i)) over consecutive active rows in one recording segment",
    "normalized_torque": "NormalizedTorque_J = torque_J / body_weight_kg [Nm/kg]",
    "normalized_power": "NormalizedPower_J = power_J / body_weight_kg [W/kg]",
    "normalized_work": "NormalizedWork_J = work_J / body_weight_kg [J/kg]",
    "symmetry_index": "SI = abs(left-right) / ((abs(left)+abs(right))/2) * 100",
    "fatigue_trend": "slope = sum((t-t_mean)(y-y_mean)) / sum((t-t_mean)^2), using 60-s active-gait windows",
    "reliability": "Reliability = valid_running_safe_samples / total_samples",
}

EXO_JOINTS: dict[str, dict[str, str]] = {
    "HR": {"label": "right_hip", "side": "right", "kind": "hip"},
    "KR": {"label": "right_knee", "side": "right", "kind": "knee"},
    "HL": {"label": "left_hip", "side": "left", "kind": "hip"},
    "KL": {"label": "left_knee", "side": "left", "kind": "knee"},
}


def _duration_metrics(rows: list[dict[str, Any]]) -> dict[str, float | None]:
    if not rows:
        return {
            "wallClockS": None,
            "recordedS": None,
            "gaitActiveS": None,
            "idleRecordedS": None,
            "breakS": None,
        }

    ordered = sorted(rows, key=_row_time_s)
    max_gap_s = _continuity_gap_limit_s(ordered)
    wall_clock_s = max(
        0.0,
        _row_time_s(ordered[-1]) - _row_time_s(ordered[0]),
    )

    recorded_s = 0.0
    gait_active_s = 0.0

    for current, next_row in zip(ordered, ordered[1:]):
        if not _rows_are_continuous(current, next_row, max_gap_s=max_gap_s):
            continue

        dt = _row_time_s(next_row) - _row_time_s(current)

        if dt <= 0:
            continue

        recorded_s += dt

        if _is_gait_running(current) and _is_gait_running(next_row):
            gait_active_s += dt

    break_s = max(0.0, wall_clock_s - recorded_s)
    idle_recorded_s = max(0.0, recorded_s - gait_active_s)

    return {
        "wallClockS": wall_clock_s,
        "recordedS": recorded_s,
        "gaitActiveS": gait_active_s,
        "idleRecordedS": idle_recorded_s,
        "breakS": break_s,
    }


def calculate_session_metrics(
    rows: list[dict[str, Any]],
    parameters: dict[str, Any] | None = None,
    excluded_episode_indices: list[int] | None = None,
) -> dict[str, Any]:
    """Calculate whole-session and per-continuous-recording metrics."""

    ordered = sorted(rows, key=_row_time_s)
    episode_rows = _split_episodes(ordered)
    excluded = {
        index for index in (excluded_episode_indices or [])
        if isinstance(index, int) and 0 <= index < len(episode_rows)
    }
    included = [
        row
        for index, episode in enumerate(episode_rows)
        if index not in excluded
        for row in episode
    ]
    result = _calculate_scope_metrics(included, parameters)
    result["session"]["episodeCount"] = len(episode_rows) - len(excluded)
    result["session"]["totalEpisodeCount"] = len(episode_rows)
    result["episodes"] = [
        {
            "index": index,
            **_calculate_scope_metrics(episode, parameters)["session"],
        }
        for index, episode in enumerate(episode_rows)
        if index not in excluded
    ]
    result["excludedEpisodeIndices"] = sorted(excluded)
    return result


def _calculate_scope_metrics(
    rows: list[dict[str, Any]],
    parameters: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Calculate metrics for one supplied scope without splitting it."""

    params = dict(parameters or {})
    missing = _missing_parameters(params)

    ordered = sorted(rows, key=_row_time_s)
    duration = _duration_metrics(ordered)
    gait_rows = [
        row
        for row in ordered
        if _is_gait_running(row)
    ]

    analysis_rows = gait_rows if gait_rows else ordered
    joints = {
        joint: _joint_metrics(
            analysis_rows,
            joint,
            params,
            integration_rows=ordered if gait_rows else None,
        )
        for joint in EXO_JOINTS
    }

    symmetry = _symmetry_metrics(joints)
    kinematic_step_length = _kinematic_step_length(joints, params)
    safety = _safety_metrics(ordered)
    controller = _controller_metrics(analysis_rows)
    fatigue_rows = (
        _gait_rows_on_active_timeline(ordered) if gait_rows else analysis_rows
    )
    fatigue = _fatigue_trends(fatigue_rows, params)

    return {
        "formulas": FORMULAS,
        "parameters": params,
        "missingParameters": missing,
        "dataScope": {
            "usedGaitRunningRows": bool(gait_rows),
            "inputSampleCount": len(rows),
            "analysisSampleCount": len(analysis_rows),
        },
        "session": {
            "startS": _row_time_s(ordered[0]) if ordered else None,
            "endS": _row_time_s(ordered[-1]) if ordered else None,
            "duration": duration,
            "sampleCount": len(ordered),
            "gaitRunningSampleCount": len(gait_rows),
            "phaseCounts": dict(Counter(str(row.get("phase", "UNKNOWN")) for row in ordered)),
            "controller": controller,
            "kinematics": {
                "stepLength": kinematic_step_length,
                "joints": {
                    joint: {
                        "label": EXO_JOINTS[joint]["label"],
                        "romDeg": metrics["romDeg"],
                        "peakFlexionDeg": metrics["peakFlexionDeg"],
                        "peakExtensionDeg": metrics["peakExtensionDeg"],
                        "meanAbsVelocityDegS": metrics["meanAbsVelocityDegS"],
                        "peakAbsVelocityDegS": metrics["peakAbsVelocityDegS"],
                    }
                    for joint, metrics in joints.items()
                }
            },
            "torque": {
                "joints": {
                    joint: {
                        "robot": metrics["robotTorque"],
                        "commanded": metrics["commandedTorque"],
                        "gravity": metrics["gravityTorque"],
                        "feedforward": metrics["feedforwardTorque"],
                        "effort": metrics["effort"],
                        "patient": metrics["patientTorque"],
                    }
                    for joint, metrics in joints.items()
                }
            },
            "participation": {
                "joints": {
                    joint: metrics["participation"]
                    for joint, metrics in joints.items()
                },
                "mean": _mean_present(
                    [metrics["participation"] for metrics in joints.values()]
                ),
            },
            "power": {
                "joints": {
                    joint: {
                        "robot": metrics["robotPower"],
                        "patient": metrics["patientPower"],
                    }
                    for joint, metrics in joints.items()
                }
            },
            "symmetry": symmetry,
            "fatigue": fatigue,
            "safety": safety,
        },
    }


def _split_episodes(rows: list[dict[str, Any]]) -> list[list[dict[str, Any]]]:
    """Split ordered telemetry at the same discontinuities used for break time."""

    if not rows:
        return []
    max_gap_s = _continuity_gap_limit_s(rows)
    episodes: list[list[dict[str, Any]]] = [[rows[0]]]
    for current, next_row in zip(rows, rows[1:]):
        if not _rows_are_continuous(current, next_row, max_gap_s=max_gap_s):
            episodes.append([])
        episodes[-1].append(next_row)
    return episodes


def parameters_from_session(session: Any) -> dict[str, Any]:
    """Extract analytics parameters from the session's database anthropometrics."""

    anthropometrics = getattr(session, "anthropometrics", None) or {}
    if not isinstance(anthropometrics, dict):
        return {}

    params: dict[str, Any] = {}

    _copy_first(
        params,
        "leg_length_left_m",
        anthropometrics,
        ("leg_length_left",),
    )
    _copy_first(
        params,
        "leg_length_right_m",
        anthropometrics,
        ("leg_length_right",),
    )
    _copy_first(
        params,
        "body_weight_kg",
        anthropometrics,
        ("bodyweight",),
    )
    return params


def _joint_metrics(
    rows: list[dict[str, Any]],
    joint: str,
    params: dict[str, Any],
    *,
    integration_rows: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    pos = _values(rows, f"{joint}_deg")
    vel = _values(rows, f"{joint}_vel")
    meas = _values(rows, f"{joint}_meas_nm")
    cmd = _values(rows, f"{joint}_cmd_nm")
    grav = _values(rows, f"{joint}_grav_nm")
    ff = _values(rows, f"{joint}_ff_nm")
    effort = _values(rows, f"{joint}_effort")

    patient_values = [
        value
        for row in rows
        if str(row.get(f"{joint}_patient_status", "")).lower() == "ok"
        for value in [_as_float(row.get(f"{joint}_patient_nm"))]
        if value is not None
    ]

    robot_mean = _mean_abs(meas)
    patient_mean = _mean_abs(patient_values)
    body_weight = _as_float(params.get("body_weight_kg"))

    torque_error = _paired_values(
        rows,
        f"{joint}_cmd_nm",
        f"{joint}_meas_nm",
        lambda commanded, measured: commanded - measured,
    )

    return {
        "romDeg": _range(pos),
        "peakFlexionDeg": max(pos) if pos else None,
        "peakExtensionDeg": min(pos) if pos else None,
        "meanAbsVelocityDegS": _mean_abs(vel),
        "peakAbsVelocityDegS": _max_abs(vel),
        "robotTorque": _torque_summary(meas, body_weight),
        "commandedTorque": {
            **_torque_summary(cmd, body_weight),
            "trackingRmseNm": _rms(torque_error),
        },
        "gravityTorque": _torque_summary(grav, body_weight),
        "feedforwardTorque": _torque_summary(ff, body_weight),
        "effort": _summary(effort),
        "patientTorque": {
            **_torque_summary(patient_values, body_weight),
            "validSampleCount": len(patient_values),
            "validPct": _ratio_pct(len(patient_values), len(rows)) if rows else None,
        },
        "participation": _clamp(
            None
            if patient_mean is None
            or robot_mean is None
            or patient_mean + robot_mean == 0
            else patient_mean / (patient_mean + robot_mean),
            0.0,
            1.0,
        ),
        "robotPower": _power_work(
            integration_rows if integration_rows is not None else rows,
            torque_key=f"{joint}_meas_nm",
            vel_key=f"{joint}_vel",
            body_weight_kg=body_weight,
            status_key=None,
            active_only=integration_rows is not None,
        ),
        "patientPower": _power_work(
            integration_rows if integration_rows is not None else rows,
            torque_key=f"{joint}_patient_nm",
            vel_key=f"{joint}_vel",
            body_weight_kg=body_weight,
            status_key=f"{joint}_patient_status",
            active_only=integration_rows is not None,
        ),
    }


def _controller_metrics(rows: list[dict[str, Any]]) -> dict[str, Any]:
    cps_values = _values(rows, "cps")
    mean_cps = _safe_mean(cps_values)

    return {
        "cps": _summary(cps_values),
        "commandedCyclePeriodS": (
            None if mean_cps in (None, 0.0) else 1.0 / mean_cps
        ),
        "commandedCadenceStepsMin": (
            None if mean_cps is None else 120.0 * mean_cps
        ),
        "ampRight": _summary(_values(rows, "amp_r")),
        "ampLeft": _summary(_values(rows, "amp_l")),
        "assistRight": _summary(_values(rows, "assist_r")),
        "aanFactor": _summary(_values(rows, "aan_factor")),
        "aanEnabledPct": _count_pct(
            rows, lambda row: _as_float(row.get("aan_on")) == 1.0
        ),
        "aanDrivingPct": _count_pct(
            rows, lambda row: (_as_float(row.get("aan_driving")) or 0.0) > 0.0
        ),
        "torqueModePct": _count_pct(
            rows, lambda row: _as_float(row.get("torque_mode")) == 1.0
        ),
    }


def _symmetry_metrics(joints: dict[str, dict[str, Any]]) -> dict[str, Any]:
    return {
        "romSiHipPct": _symmetry_index(
            joints["HL"]["romDeg"], joints["HR"]["romDeg"]
        ),
        "romSiKneePct": _symmetry_index(
            joints["KL"]["romDeg"], joints["KR"]["romDeg"]
        ),
        "patientTorqueSiHipPct": _symmetry_index(
            joints["HL"]["patientTorque"]["meanAbsNm"],
            joints["HR"]["patientTorque"]["meanAbsNm"],
        ),
        "patientTorqueSiKneePct": _symmetry_index(
            joints["KL"]["patientTorque"]["meanAbsNm"],
            joints["KR"]["patientTorque"]["meanAbsNm"],
        ),
        "robotTorqueSiHipPct": _symmetry_index(
            joints["HL"]["robotTorque"]["meanAbsNm"],
            joints["HR"]["robotTorque"]["meanAbsNm"],
        ),
        "robotTorqueSiKneePct": _symmetry_index(
            joints["KL"]["robotTorque"]["meanAbsNm"],
            joints["KR"]["robotTorque"]["meanAbsNm"],
        ),
    }


def _kinematic_step_length(
    joints: dict[str, dict[str, Any]],
    params: dict[str, Any],
) -> dict[str, float | None]:
    right_m = _step_length_from_hip_rom(
        joints["HR"]["romDeg"],
        _as_float(params.get("leg_length_right_m")),
    )
    left_m = _step_length_from_hip_rom(
        joints["HL"]["romDeg"],
        _as_float(params.get("leg_length_left_m")),
    )
    return {
        "rightM": right_m,
        "leftM": left_m,
        "meanM": _mean_present([right_m, left_m]),
    }


def _step_length_from_hip_rom(
    hip_rom_deg: float | None,
    leg_length_m: float | None,
) -> float | None:
    if hip_rom_deg is None or leg_length_m is None or leg_length_m <= 0:
        return None
    hip_rom_rad = hip_rom_deg * pi / 180.0
    return 2.0 * leg_length_m * sin(hip_rom_rad / 2.0)


def _fatigue_trends(
    rows: list[dict[str, Any]],
    params: dict[str, Any],
    *,
    window_s: float = 60.0,
) -> dict[str, Any]:
    if not rows:
        return {"windowS": window_s, "joints": {}}

    start = _analysis_time_s(rows[0])
    windows: dict[int, list[dict[str, Any]]] = {}
    for row in rows:
        index = int((_analysis_time_s(row) - start) // window_s)
        windows.setdefault(index, []).append(row)

    out: dict[str, Any] = {}
    for joint in EXO_JOINTS:
        series: list[tuple[float, dict[str, Any]]] = []
        for index, window_rows in sorted(windows.items()):
            metrics = _joint_metrics(window_rows, joint, params)
            series.append((index * window_s / 60.0, metrics))

        slopes = {
            "romDegPerMin": _slope(
                [(t, metrics["romDeg"]) for t, metrics in series]
            ),
            "meanAbsVelocityDegSPerMin": _slope(
                [(t, metrics["meanAbsVelocityDegS"]) for t, metrics in series]
            ),
            "patientTorqueNmPerMin": _slope(
                [
                    (t, metrics["patientTorque"]["meanAbsNm"])
                    for t, metrics in series
                ]
            ),
            "robotTorqueNmPerMin": _slope(
                [
                    (t, metrics["robotTorque"]["meanAbsNm"])
                    for t, metrics in series
                ]
            ),
            "participationPerMin": _slope(
                [(t, metrics["participation"]) for t, metrics in series]
            ),
        }

        flags: list[str] = []
        if (
            (slopes["romDegPerMin"] or 0.0) < 0
            and (slopes["patientTorqueNmPerMin"] or 0.0) < 0
        ):
            flags.append("possible_fatigue")
        if (
            (slopes["patientTorqueNmPerMin"] or 0.0) > 0
            and (slopes["robotTorqueNmPerMin"] or 0.0) < 0
        ):
            flags.append("improving_patient_contribution")

        out[joint] = {
            "windowCount": len(series),
            "slopes": slopes,
            "interpretation": flags,
        }

    return {"windowS": window_s, "joints": out}


def _safety_metrics(rows: list[dict[str, Any]]) -> dict[str, Any]:
    total = len(rows)
    valid_running_safe = sum(
        1
        for row in rows
        if _as_float(row.get("running")) == 1.0
        and _as_float(row.get("estop")) != 1.0
        and (_as_float(row.get("hb_error")) or 0.0) == 0.0
        and (_as_float(row.get("cross_check")) or 0.0) == 0.0
    )

    return {
        "estopCount": sum(
            1 for row in rows if _as_float(row.get("estop")) == 1.0
        ),
        "runningPct": _count_pct(
            rows, lambda row: _as_float(row.get("running")) == 1.0
        ),
        "sensorOnlinePct": _count_pct(
            rows, lambda row: _as_float(row.get("sensor_online")) == 1.0
        ),
        "heartbeatErrorCount": sum(
            1
            for row in rows
            if (_as_float(row.get("hb_error")) or 0.0) != 0.0
        ),
        "crossCheckErrorCount": sum(
            1
            for row in rows
            if (_as_float(row.get("cross_check")) or 0.0) != 0.0
        ),
        "linkAgeMs": _summary(_values(rows, "link_age_ms")),
        "controlLoopUs": {
            **_summary(_values(rows, "ctrl_loop_us")),
            "jitterStdUs": _sample_std(_values(rows, "ctrl_loop_us")),
        },
        "validRunningSafeSamples": valid_running_safe,
        "totalSamples": total,
        "reliability": (
            _ratio(valid_running_safe, total) if total else None
        ),
        "reliabilityPct": (
            _ratio_pct(valid_running_safe, total) if total else None
        ),
    }


def _torque_summary(
    values: list[float],
    body_weight_kg: float | None,
) -> dict[str, Any]:
    mean_abs = _mean_abs(values)
    peak_abs = _max_abs(values)
    rms = _rms(values)

    return {
        "meanAbsNm": mean_abs,
        "peakAbsNm": peak_abs,
        "rmsNm": rms,
        "meanAbsNmKg": _ratio(mean_abs, body_weight_kg),
        "peakAbsNmKg": _ratio(peak_abs, body_weight_kg),
        "rmsNmKg": _ratio(rms, body_weight_kg),
    }


def _power_work(
    rows: list[dict[str, Any]],
    *,
    torque_key: str,
    vel_key: str,
    body_weight_kg: float | None,
    status_key: str | None,
    active_only: bool,
) -> dict[str, Any]:
    samples: list[tuple[dict[str, Any], float]] = []
    max_gap_s = _continuity_gap_limit_s(rows)

    for row in rows:
        power_w = _row_power(
            row,
            torque_key=torque_key,
            vel_key=vel_key,
            status_key=status_key,
            active_only=active_only,
        )
        if power_w is None:
            continue
        samples.append((row, power_w))

    powers = [power for _, power in samples]
    work_j = 0.0
    positive_work_j = 0.0
    negative_work_j = 0.0

    for current, next_row in zip(rows, rows[1:]):
        if not _rows_are_continuous(current, next_row, max_gap_s=max_gap_s):
            continue

        power = _row_power(
            current,
            torque_key=torque_key,
            vel_key=vel_key,
            status_key=status_key,
            active_only=active_only,
        )
        next_power = _row_power(
            next_row,
            torque_key=torque_key,
            vel_key=vel_key,
            status_key=status_key,
            active_only=active_only,
        )
        if power is None or next_power is None:
            continue

        dt = _row_time_s(next_row) - _row_time_s(current)
        if dt <= 0:
            continue

        energy = power * dt
        work_j += energy
        positive_work_j += max(energy, 0.0)
        negative_work_j += min(energy, 0.0)

    mean_power = _safe_mean(powers)
    peak_power = _max_abs(powers)

    return {
        "meanW": mean_power,
        "peakAbsW": peak_power,
        "workJ": work_j if samples else None,
        "positiveWorkJ": positive_work_j if samples else None,
        "negativeWorkJ": negative_work_j if samples else None,
        "meanWKg": _ratio(mean_power, body_weight_kg),
        "peakAbsWKg": _ratio(peak_power, body_weight_kg),
        "workJKg": _ratio(work_j, body_weight_kg) if samples else None,
        "positiveWorkJKg": (
            _ratio(positive_work_j, body_weight_kg) if samples else None
        ),
        "negativeWorkJKg": (
            _ratio(negative_work_j, body_weight_kg) if samples else None
        ),
        "validSampleCount": len(samples),
    }


def _row_power(
    row: dict[str, Any],
    *,
    torque_key: str,
    vel_key: str,
    status_key: str | None,
    active_only: bool,
) -> float | None:
    if active_only and not _is_gait_running(row):
        return None
    if status_key is not None:
        if str(row.get(status_key, "")).lower() != "ok":
            return None

    torque = _as_float(row.get(torque_key))
    velocity_deg_s = _as_float(row.get(vel_key))
    if torque is None or velocity_deg_s is None:
        return None
    return torque * velocity_deg_s * pi / 180.0


def _summary(values: list[float]) -> dict[str, float | int | None]:
    clean = [value for value in values if isfinite(value)]
    if not clean:
        return {
            "mean": None,
            "min": None,
            "max": None,
            "std": None,
            "count": 0,
        }

    return {
        "mean": mean(clean),
        "min": min(clean),
        "max": max(clean),
        "std": _sample_std(clean),
        "count": len(clean),
    }


def _sample_std(values: list[float]) -> float | None:
    clean = [value for value in values if isfinite(value)]
    if len(clean) < 2:
        return None

    mu = mean(clean)
    return sqrt(
        sum((value - mu) ** 2 for value in clean) / (len(clean) - 1)
    )


def _slope(points: list[tuple[float, Any]]) -> float | None:
    clean = [
        (float(x), float(y))
        for x, y in points
        if isinstance(y, (int, float)) and isfinite(float(y))
    ]
    if len(clean) < 2:
        return None

    xs = [x for x, _ in clean]
    ys = [y for _, y in clean]
    x_mean = mean(xs)
    y_mean = mean(ys)
    denominator = sum((x - x_mean) ** 2 for x in xs)
    if denominator == 0:
        return None

    return (
        sum((x - x_mean) * (y - y_mean) for x, y in clean)
        / denominator
    )


def _symmetry_index(
    left: float | None,
    right: float | None,
) -> float | None:
    if left is None or right is None:
        return None

    denominator = (abs(left) + abs(right)) / 2.0
    if denominator == 0:
        return None

    return abs(left - right) / denominator * 100.0


def _paired_values(
    rows: list[dict[str, Any]],
    left_key: str,
    right_key: str,
    fn: Callable[[float, float], float],
) -> list[float]:
    out: list[float] = []
    for row in rows:
        left = _as_float(row.get(left_key))
        right = _as_float(row.get(right_key))
        if left is not None and right is not None:
            out.append(fn(left, right))
    return out


def _values(rows: list[dict[str, Any]], key: str) -> list[float]:
    out: list[float] = []
    for row in rows:
        value = _as_float(row.get(key))
        if value is not None:
            out.append(value)
    return out


def _is_gait_running(row: dict[str, Any]) -> bool:
    return (
        str(row.get("phase", "")).upper() == "GAIT"
        and _as_float(row.get("running")) == 1.0
    )


def _same_recording_segment(
    current: dict[str, Any],
    next_row: dict[str, Any],
) -> bool:
    """Return whether two rows belong to one continuous recording."""

    for key in ("source_segment_idx", "source_file"):
        current_value = current.get(key)
        next_value = next_row.get(key)
        if current_value is not None or next_value is not None:
            return (
                current_value is not None
                and next_value is not None
                and str(current_value) == str(next_value)
            )
    return True


def _continuity_gap_limit_s(rows: list[dict[str, Any]]) -> float:
    """Return the maximum gap allowed within one continuous episode."""

    return CONTINUITY_GAP_THRESHOLD_S


def _rows_are_continuous(
    current: dict[str, Any],
    next_row: dict[str, Any],
    *,
    max_gap_s: float,
) -> bool:
    if not _same_recording_segment(current, next_row):
        return False
    dt = _row_time_s(next_row) - _row_time_s(current)
    return 0.0 <= dt <= max_gap_s


def _gait_rows_on_active_timeline(
    rows: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Copy gait rows onto a timeline that excludes idle time and breaks."""

    active_time_s = 0.0
    gait_rows: list[dict[str, Any]] = []
    max_gap_s = _continuity_gap_limit_s(rows)
    for index, row in enumerate(rows):
        if _is_gait_running(row):
            gait_rows.append({**row, "_active_gait_t_s": active_time_s})

        if index == len(rows) - 1:
            continue
        next_row = rows[index + 1]
        if (
            _rows_are_continuous(row, next_row, max_gap_s=max_gap_s)
            and _is_gait_running(row)
            and _is_gait_running(next_row)
        ):
            dt = _row_time_s(next_row) - _row_time_s(row)
            active_time_s += dt

    return gait_rows


def _analysis_time_s(row: dict[str, Any]) -> float:
    active_time_s = _as_float(row.get("_active_gait_t_s"))
    return _row_time_s(row) if active_time_s is None else active_time_s


def _row_time_s(row: dict[str, Any]) -> float:
    for key in ("session_t_s", "t_s"):
        value = _as_float(row.get(key))
        if value is not None:
            return value

    time_ms = _as_float(row.get("time_ms"))
    if time_ms is not None:
        return time_ms / 1000.0

    return 0.0


def _as_float(value: Any) -> float | None:
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, (int, float)):
        numeric = float(value)
        return numeric if isfinite(numeric) else None
    if isinstance(value, str):
        try:
            numeric = float(value)
        except ValueError:
            return None
        return numeric if isfinite(numeric) else None
    return None


def _safe_mean(values: list[float]) -> float | None:
    clean = [value for value in values if isfinite(value)]
    return mean(clean) if clean else None


def _mean_abs(values: list[float]) -> float | None:
    clean = [abs(value) for value in values if isfinite(value)]
    return mean(clean) if clean else None


def _max_abs(values: list[float]) -> float | None:
    clean = [abs(value) for value in values if isfinite(value)]
    return max(clean) if clean else None


def _rms(values: list[float]) -> float | None:
    clean = [value for value in values if isfinite(value)]
    if not clean:
        return None
    return sqrt(mean(value * value for value in clean))


def _range(values: list[float]) -> float | None:
    clean = [value for value in values if isfinite(value)]
    return max(clean) - min(clean) if clean else None


def _mean_present(values: list[Any]) -> float | None:
    clean = [
        float(value)
        for value in values
        if isinstance(value, (int, float)) and isfinite(float(value))
    ]
    return mean(clean) if clean else None


def _count_pct(
    rows: list[dict[str, Any]],
    predicate: Callable[[dict[str, Any]], bool],
) -> float | None:
    if not rows:
        return None
    return sum(1 for row in rows if predicate(row)) / len(rows) * 100.0


def _ratio(value: Any, denominator: Any) -> float | None:
    numerator = _as_float(value)
    divisor = _as_float(denominator)
    if numerator is None or divisor in (None, 0.0):
        return None
    return numerator / divisor


def _ratio_pct(
    numerator: float | None,
    denominator: float | None,
) -> float | None:
    if numerator is None or denominator in (None, 0.0):
        return None
    return numerator / denominator * 100.0


def _clamp(
    value: float | None,
    lower: float,
    upper: float,
) -> float | None:
    if value is None:
        return None
    return max(lower, min(upper, value))


def _copy_first(
    out: dict[str, Any],
    target: str,
    source: dict[str, Any],
    keys: tuple[str, ...],
) -> None:
    for key in keys:
        value = _as_float(source.get(key))
        if value is not None:
            out[target] = value
            return


def _missing_parameters(params: dict[str, Any]) -> list[str]:
    missing: list[str] = []
    for key in (
        "leg_length_left_m",
        "leg_length_right_m",
        "body_weight_kg",
    ):
        if _as_float(params.get(key)) is None:
            missing.append(key)
    return missing
