"""Calculate analytics from telemetry rows and session parameters."""

from __future__ import annotations

from collections import Counter
from math import isfinite, pi, sin, sqrt
from statistics import mean
from typing import Any, Callable

Number = int | float

CONTINUITY_GAP_THRESHOLD_S = 30.0
GAIT_CYCLE_PHASE_POINT_COUNT = 101
GAIT_CYCLE_MIN_DURATION_S = 0.4
GAIT_CYCLE_MAX_DURATION_S = 4.0
GAIT_CYCLE_MIN_SAMPLE_COUNT = 10
GAIT_CYCLE_MIN_PHASE_COVERAGE = 0.8
GAIT_CYCLE_MAX_SAMPLE_GAP_S = 0.5

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
    "average_gait_cycle": "Detect complete step_idx cycles, interpolate each to 0..100% gait phase, then average by phase",
    "gait_cycle_tracking_error": "error = actual_deg - ref_deg; RMSE/MAE/max use all valid phase-normalized cycle samples",
    "gait_cycle_compliance": "Compliance = clamp(1 - RMSE / reference_ROM, 0, 1)",
    "stride_time": "stride_side(i) = HS_side(i+1) - HS_side(i)",
    "stance_time": "stance_side(i) = TO_side(i) - HS_side(i)",
    "swing_time": "swing_side(i) = HS_side(i+1) - TO_side(i)",
    "double_support": "double_support(i) = min(TO_L(i), TO_R(i)) - max(HS_L(i), HS_R(i))",
    "insole_cadence": "cadence = 60 / mean(time between consecutive left/right heel strikes)",
    "stride_time_cv": "CV_side = sample_std(stride_side) / mean(stride_side) * 100",
    "double_support_ratio": "DSR = mean(double_support) / mean(left_stride_time) * 100",
    "cemrr_symmetry": "S = clamp(1 - step_length_SI / baseline_step_length_SI, 0, 1)",
    "cemrr_stability": "V = clamp(1 - mean(stride_time_CV_L, stride_time_CV_R) / baseline_stride_time_CV, 0, 1)",
    "cemrr_support": "B = clamp(1 - (DSR - normal_DSR) / (baseline_DSR - normal_DSR), 0, 1)",
    "cemrr_efficiency": "E = mean(belt_speed/normal_speed, cadence/normal_cadence, stride_length/normal_stride_length), clamped to 0..1",
    "patient_torque_fraction": "PTF_J = (passive_force_J - mean_session_force_J) / passive_force_J",
    "cemrr_strength": "STR = mean(PTF_L_hip, PTF_R_hip, PTF_L_knee, PTF_R_knee), clamped to 0..1",
    "gait_recovery_index": "GRI = 0.25*S + 0.15*V + 0.20*B + 0.20*E + 0.20*STR",
}

CEMRR_ASPECT_WEIGHTS: dict[str, float] = {
    "symmetry": 0.25,
    "stability": 0.15,
    "support": 0.20,
    "efficiency": 0.20,
    "strength": 0.20,
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
    average_gait_cycle = _average_gait_cycle_profiles(ordered)
    clinical_gait = _clinical_gait_metrics(ordered, params)

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
            "insole": clinical_gait["insole"],
            "timing": clinical_gait["timing"],
            "spatial": clinical_gait["spatial"],
            "scores": clinical_gait["scores"],
            "cadenceStepsPerMin": clinical_gait["timing"]["cadenceStepsPerMin"],
            "strideTime": clinical_gait["strideTime"],
            "stepLength": clinical_gait["stepLength"],
            "strideLengthMeanM": clinical_gait["strideLengthMeanM"],
            "cemrrScores": clinical_gait["scores"],
            "tracking": {
                "averageGaitCycle": average_gait_cycle,
            },
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

    profile = getattr(session, "exo_profile", None) or {}
    if isinstance(profile, dict):
        analytics = profile.get("analytics")
        if isinstance(analytics, dict):
            for key in (
                "belt_speed_m_s",
                "moment_arm_m",
                "baseline_step_length_si_pct",
                "baseline_stride_time_cv_pct",
                "baseline_dsr_pct",
                "normal_dsr_pct",
                "normal_belt_speed_m_s",
                "normal_cadence_steps_min",
                "normal_stride_length_m",
            ):
                value = _as_float(analytics.get(key))
                if value is not None:
                    params[key] = value
            passive = analytics.get("passive_force_n")
            if isinstance(passive, dict):
                params["passive_force_n"] = dict(passive)
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


def _clinical_gait_metrics(
    rows: list[dict[str, Any]],
    params: dict[str, Any],
) -> dict[str, Any]:
    """Calculate the DOCX CEMRR metrics when real insole events are present."""

    event_sets = _insole_event_sets(rows)
    heel_strikes_left = [
        time_s for events in event_sets for time_s in events["heel_strikes_left"]
    ]
    heel_strikes_right = [
        time_s for events in event_sets for time_s in events["heel_strikes_right"]
    ]
    toe_offs_left = [
        time_s for events in event_sets for time_s in events["toe_offs_left"]
    ]
    toe_offs_right = [
        time_s for events in event_sets for time_s in events["toe_offs_right"]
    ]
    insole_available = (
        len(heel_strikes_left) >= 2
        and len(heel_strikes_right) >= 2
        and bool(toe_offs_left)
        and bool(toe_offs_right)
    )

    stride_left: list[float] = []
    stance_left: list[float] = []
    swing_left: list[float] = []
    stride_right: list[float] = []
    stance_right: list[float] = []
    swing_right: list[float] = []
    double_support: list[float] = []
    step_times: list[float] = []

    if insole_available:
        for events in event_sets:
            left_stride, left_stance, left_swing = _stride_phase_samples(
                events["heel_strikes_left"],
                events["toe_offs_left"],
            )
            right_stride, right_stance, right_swing = _stride_phase_samples(
                events["heel_strikes_right"],
                events["toe_offs_right"],
            )
            stride_left.extend(left_stride)
            stance_left.extend(left_stance)
            swing_left.extend(left_swing)
            stride_right.extend(right_stride)
            stance_right.extend(right_stance)
            swing_right.extend(right_swing)
            double_support.extend(
                _double_support_samples(
                    events["heel_strikes_left"],
                    events["heel_strikes_right"],
                    events["toe_offs_left"],
                    events["toe_offs_right"],
                )
            )
            combined_hs = sorted(
                events["heel_strikes_left"] + events["heel_strikes_right"]
            )
            step_times.extend(
                next_time - current_time
                for current_time, next_time in zip(combined_hs, combined_hs[1:])
                if next_time > current_time
            )

    stride_left_summary = _summary(stride_left)
    stride_right_summary = _summary(stride_right)
    stance_left_summary = _summary(stance_left)
    stance_right_summary = _summary(stance_right)
    swing_left_summary = _summary(swing_left)
    swing_right_summary = _summary(swing_right)
    double_support_summary = _summary(double_support)
    cadence = _ratio(60.0, _safe_mean(step_times))
    cv_left = _coefficient_of_variation_pct(stride_left)
    cv_right = _coefficient_of_variation_pct(stride_right)
    stride_time_si = _symmetry_index(
        _safe_mean(stride_left),
        _safe_mean(stride_right),
    )
    mean_left_stride = _safe_mean(stride_left)
    dsr_pct = _ratio_pct(_safe_mean(double_support), mean_left_stride)

    timing = {
        "available": insole_available,
        "eventSource": "insole_events" if insole_available else None,
        "cadenceStepsPerMin": cadence,
        "left": {
            "strideTime": {**stride_left_summary, "cvPct": cv_left},
            "stanceTime": stance_left_summary,
            "swingTime": swing_left_summary,
            "stancePct": _ratio_pct(
                _safe_mean(stance_left),
                _safe_mean(stride_left),
            ),
            "swingPct": _ratio_pct(
                _safe_mean(swing_left),
                _safe_mean(stride_left),
            ),
        },
        "right": {
            "strideTime": {**stride_right_summary, "cvPct": cv_right},
            "stanceTime": stance_right_summary,
            "swingTime": swing_right_summary,
            "stancePct": _ratio_pct(
                _safe_mean(stance_right),
                _safe_mean(stride_right),
            ),
            "swingPct": _ratio_pct(
                _safe_mean(swing_right),
                _safe_mean(stride_right),
            ),
        },
        "strideTimeSymmetryIndexPct": stride_time_si,
        "doubleSupportTime": double_support_summary,
        "doubleSupportRatioPct": dsr_pct,
    }

    spatial = _cemrr_spatial_metrics(event_sets, params) if insole_available else _empty_spatial_metrics()
    strength = _cemrr_strength_metrics(event_sets, params) if insole_available else _empty_strength_metrics()
    scores = _cemrr_aspect_scores(
        timing=timing,
        spatial=spatial,
        strength=strength,
        params=params,
    )

    return {
        "insole": {
            "available": insole_available,
            "eventSource": "insole_events" if insole_available else None,
            "reason": None if insole_available else "insufficient_insole_events",
            "heelStrikeCountLeft": len(heel_strikes_left),
            "heelStrikeCountRight": len(heel_strikes_right),
            "toeOffCountLeft": len(toe_offs_left),
            "toeOffCountRight": len(toe_offs_right),
        },
        "timing": timing,
        "spatial": spatial,
        "strength": strength,
        "scores": scores,
        "strideTime": {
            "leftMeanS": _safe_mean(stride_left),
            "rightMeanS": _safe_mean(stride_right),
            "symmetryIndexPct": stride_time_si,
        },
        "stepLength": {
            "leftMeanM": spatial["leftStepLengthM"]["mean"],
            "rightMeanM": spatial["rightStepLengthM"]["mean"],
            "symmetryIndexPct": spatial["stepLengthSymmetryIndexPct"],
        },
        "strideLengthMeanM": spatial["strideLengthM"]["mean"],
    }


def _insole_event_sets(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    event_sets: list[dict[str, Any]] = []
    for episode in _split_episodes(rows):
        gait_rows = [row for row in episode if _is_gait_running(row)]
        if not gait_rows:
            continue

        hs_left = _event_times_from_column(gait_rows, "HS_L")
        hs_right = _event_times_from_column(gait_rows, "HS_R")
        to_left = _event_times_from_column(gait_rows, "TO_L")
        to_right = _event_times_from_column(gait_rows, "TO_R")
        source = "explicit_events"

        if not (hs_left or hs_right or to_left or to_right):
            hs_left, to_left = _contact_transition_events(gait_rows, "left_pressed")
            hs_right, to_right = _contact_transition_events(gait_rows, "right_pressed")
            source = "pressed_state_transitions"

        if hs_left or hs_right or to_left or to_right:
            event_sets.append(
                {
                    "rows": gait_rows,
                    "source": source,
                    "heel_strikes_left": hs_left,
                    "heel_strikes_right": hs_right,
                    "toe_offs_left": to_left,
                    "toe_offs_right": to_right,
                }
            )
    return event_sets


def _event_times_from_column(
    rows: list[dict[str, Any]],
    key: str,
) -> list[float]:
    present = [row.get(key) for row in rows if row.get(key) is not None]
    if not present:
        return []

    numeric = [value for raw in present for value in [_as_float(raw)] if value is not None]
    timestamp_values = any(value not in (0.0, 1.0) for value in numeric)
    if timestamp_values:
        return sorted(set(numeric))

    events: list[float] = []
    previous = False
    for row in rows:
        active = _as_bool(row.get(key))
        if active and not previous:
            events.append(_row_time_s(row))
        previous = active
    return events


def _contact_transition_events(
    rows: list[dict[str, Any]],
    key: str,
) -> tuple[list[float], list[float]]:
    heel_strikes: list[float] = []
    toe_offs: list[float] = []
    previous: bool | None = None
    for row in rows:
        if row.get(key) is None:
            continue
        pressed = _as_bool(row.get(key))
        if previous is not None and pressed != previous:
            (heel_strikes if pressed else toe_offs).append(_row_time_s(row))
        previous = pressed
    return heel_strikes, toe_offs


def _as_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    numeric = _as_float(value)
    return numeric == 1.0


def _stride_phase_samples(
    heel_strikes: list[float],
    toe_offs: list[float],
) -> tuple[list[float], list[float], list[float]]:
    stride: list[float] = []
    stance: list[float] = []
    swing: list[float] = []
    for current_hs, next_hs in zip(heel_strikes, heel_strikes[1:]):
        stride_time = next_hs - current_hs
        if stride_time <= 0:
            continue
        toe_off = next(
            (time_s for time_s in toe_offs if current_hs < time_s < next_hs),
            None,
        )
        if toe_off is None:
            continue
        stride.append(stride_time)
        stance.append(toe_off - current_hs)
        swing.append(next_hs - toe_off)
    return stride, stance, swing


def _double_support_samples(
    heel_strikes_left: list[float],
    heel_strikes_right: list[float],
    toe_offs_left: list[float],
    toe_offs_right: list[float],
) -> list[float]:
    samples: list[float] = []
    for hs_left, hs_right, to_left, to_right in zip(
        heel_strikes_left,
        heel_strikes_right,
        toe_offs_left,
        toe_offs_right,
    ):
        duration = min(to_left, to_right) - max(hs_left, hs_right)
        if duration >= 0:
            samples.append(duration)
    return samples


def _coefficient_of_variation_pct(values: list[float]) -> float | None:
    sample_std = _sample_std(values)
    sample_mean = _safe_mean(values)
    return _ratio_pct(sample_std, sample_mean)


def _cemrr_spatial_metrics(
    event_sets: list[dict[str, Any]],
    params: dict[str, Any],
) -> dict[str, Any]:
    leg_left = _as_float(params.get("leg_length_left_m"))
    leg_right = _as_float(params.get("leg_length_right_m"))
    belt_speed = _as_float(params.get("belt_speed_m_s"))
    left_steps: list[float] = []
    right_steps: list[float] = []
    stride_lengths: list[float] = []

    if leg_left is None or leg_right is None or belt_speed is None:
        return _empty_spatial_metrics()

    for events in event_sets:
        rows = events["rows"]
        hs_left = events["heel_strikes_left"]
        hs_right = events["heel_strikes_right"]
        episode_left: list[float] = []
        episode_right: list[float] = []

        for current_hs, next_hs in zip(hs_left, hs_left[1:]):
            opposite_hs = next(
                (time_s for time_s in hs_right if current_hs < time_s < next_hs),
                None,
            )
            hip_peak = _peak_in_interval(rows, "HL_deg", current_hs, next_hs)
            if opposite_hs is None or hip_peak is None:
                continue
            kinematic = _step_length_from_hip_rom(abs(hip_peak), leg_left)
            if kinematic is not None:
                episode_left.append(kinematic + belt_speed * (opposite_hs - current_hs))

        for current_hs, next_hs in zip(hs_right, hs_right[1:]):
            opposite_hs = next(
                (time_s for time_s in hs_left if current_hs < time_s < next_hs),
                None,
            )
            hip_peak = _peak_in_interval(rows, "HR_deg", current_hs, next_hs)
            if opposite_hs is None or hip_peak is None:
                continue
            kinematic = _step_length_from_hip_rom(abs(hip_peak), leg_right)
            if kinematic is not None:
                episode_right.append(kinematic + belt_speed * (opposite_hs - current_hs))

        left_steps.extend(episode_left)
        right_steps.extend(episode_right)
        stride_lengths.extend(
            left + right for left, right in zip(episode_left, episode_right)
        )

    left_summary = _summary(left_steps)
    right_summary = _summary(right_steps)
    return {
        "available": bool(left_steps and right_steps),
        "leftStepLengthM": left_summary,
        "rightStepLengthM": right_summary,
        "strideLengthM": _summary(stride_lengths),
        "stepLengthSymmetryIndexPct": _symmetry_index(
            _safe_mean(left_steps),
            _safe_mean(right_steps),
        ),
    }


def _empty_spatial_metrics() -> dict[str, Any]:
    return {
        "available": False,
        "leftStepLengthM": _summary([]),
        "rightStepLengthM": _summary([]),
        "strideLengthM": _summary([]),
        "stepLengthSymmetryIndexPct": None,
    }


def _peak_in_interval(
    rows: list[dict[str, Any]],
    key: str,
    start_s: float,
    end_s: float,
) -> float | None:
    values = [
        value
        for row in rows
        if start_s <= _row_time_s(row) < end_s
        for value in [_as_float(row.get(key))]
        if value is not None
    ]
    return max(values) if values else None


def _cemrr_strength_metrics(
    event_sets: list[dict[str, Any]],
    params: dict[str, Any],
) -> dict[str, Any]:
    passive = params.get("passive_force_n")
    moment_arm = _as_float(params.get("moment_arm_m"))
    if not isinstance(passive, dict):
        return _empty_strength_metrics()

    joint_config = {
        "HL": ("F_hip_L", "hip_left"),
        "HR": ("F_hip_R", "hip_right"),
        "KL": ("F_knee_L", "knee_left"),
        "KR": ("F_knee_R", "knee_right"),
    }
    joints: dict[str, Any] = {}
    fractions: list[float] = []
    for joint, (force_key, passive_key) in joint_config.items():
        session_forces = [
            peak
            for events in event_sets
            for peak in _cycle_peak_values(
                events["rows"],
                force_key,
                events["heel_strikes_left"] if joint.endswith("L") else events["heel_strikes_right"],
            )
        ]
        passive_force = _as_float(passive.get(passive_key))
        mean_force = _safe_mean(session_forces)
        fraction = (
            (passive_force - mean_force) / passive_force
            if passive_force is not None and passive_force > 0 and mean_force is not None
            else None
        )
        human_torque = (
            (passive_force - mean_force) * moment_arm
            if passive_force is not None and mean_force is not None and moment_arm is not None
            else None
        )
        if fraction is not None:
            fractions.append(fraction)
        joints[joint] = {
            "sessionForceN": _summary(session_forces),
            "passiveForceN": passive_force,
            "humanTorqueNm": human_torque,
            "patientTorqueFraction": fraction,
        }

    strength = _safe_mean(fractions) if len(fractions) == len(joint_config) else None
    return {
        "available": strength is not None,
        "joints": joints,
        "score": _clamp(strength, 0.0, 1.0),
    }


def _empty_strength_metrics() -> dict[str, Any]:
    return {"available": False, "joints": {}, "score": None}


def _cycle_peak_values(
    rows: list[dict[str, Any]],
    key: str,
    heel_strikes: list[float],
) -> list[float]:
    return [
        peak
        for start_s, end_s in zip(heel_strikes, heel_strikes[1:])
        for peak in [_peak_in_interval(rows, key, start_s, end_s)]
        if peak is not None
    ]


def _cemrr_aspect_scores(
    *,
    timing: dict[str, Any],
    spatial: dict[str, Any],
    strength: dict[str, Any],
    params: dict[str, Any],
) -> dict[str, float | None]:
    step_si = _as_float(spatial.get("stepLengthSymmetryIndexPct"))
    baseline_si = _as_float(params.get("baseline_step_length_si_pct"))
    symmetry = (
        _clamp(1.0 - step_si / baseline_si, 0.0, 1.0)
        if step_si is not None and baseline_si is not None and baseline_si > 0
        else None
    )

    left = timing.get("left") if isinstance(timing.get("left"), dict) else {}
    right = timing.get("right") if isinstance(timing.get("right"), dict) else {}
    left_stride = left.get("strideTime") if isinstance(left.get("strideTime"), dict) else {}
    right_stride = right.get("strideTime") if isinstance(right.get("strideTime"), dict) else {}
    mean_cv = _mean_present(
        [
            _as_float(left_stride.get("cvPct")),
            _as_float(right_stride.get("cvPct")),
        ]
    )
    baseline_cv = _as_float(params.get("baseline_stride_time_cv_pct"))
    stability = (
        _clamp(1.0 - mean_cv / baseline_cv, 0.0, 1.0)
        if mean_cv is not None and baseline_cv is not None and baseline_cv > 0
        else None
    )

    dsr = _as_float(timing.get("doubleSupportRatioPct"))
    normal_dsr = _as_float(params.get("normal_dsr_pct"))
    baseline_dsr = _as_float(params.get("baseline_dsr_pct"))
    support_denominator = (
        baseline_dsr - normal_dsr
        if baseline_dsr is not None and normal_dsr is not None
        else None
    )
    support = (
        _clamp(1.0 - (dsr - normal_dsr) / support_denominator, 0.0, 1.0)
        if dsr is not None
        and normal_dsr is not None
        and support_denominator is not None
        and support_denominator != 0
        else None
    )

    efficiency_parts = [
        _ratio(
            _as_float(params.get("belt_speed_m_s")),
            _as_float(params.get("normal_belt_speed_m_s")),
        ),
        _ratio(
            _as_float(timing.get("cadenceStepsPerMin")),
            _as_float(params.get("normal_cadence_steps_min")),
        ),
        _ratio(
            _as_float(spatial.get("strideLengthM", {}).get("mean"))
            if isinstance(spatial.get("strideLengthM"), dict)
            else None,
            _as_float(params.get("normal_stride_length_m")),
        ),
    ]
    efficiency = (
        _clamp(mean([value for value in efficiency_parts if value is not None]), 0.0, 1.0)
        if all(value is not None for value in efficiency_parts)
        else None
    )
    strength_score = _as_float(strength.get("score"))
    aspects = {
        "symmetry": symmetry,
        "stability": stability,
        "support": support,
        "efficiency": efficiency,
        "strength": strength_score,
    }
    gri = (
        sum(CEMRR_ASPECT_WEIGHTS[key] * value for key, value in aspects.items())
        if all(value is not None for value in aspects.values())
        else None
    )
    return {**aspects, "gri": gri}


def _average_gait_cycle_profiles(rows: list[dict[str, Any]]) -> dict[str, Any]:
    """Build phase-normalized ensemble curves from complete step-index cycles."""

    step_values = [
        value
        for row in rows
        if _is_gait_running(row)
        for value in [_as_float(row.get("step_idx"))]
        if value is not None and value >= 0
    ]
    step_max = max(step_values) if step_values else None
    phase_grid = [
        index * 100.0 / (GAIT_CYCLE_PHASE_POINT_COUNT - 1)
        for index in range(GAIT_CYCLE_PHASE_POINT_COUNT)
    ]
    candidates: list[tuple[list[dict[str, Any]], float]] = []

    if step_max is not None and step_max > 0:
        for episode in _split_episodes(rows):
            candidates.extend(_gait_cycle_candidates(episode, step_max))

    rejected = Counter()
    accepted: list[list[dict[str, Any]]] = []
    for cycle_rows, boundary_time_s in candidates:
        reason = _gait_cycle_rejection_reason(
            cycle_rows,
            boundary_time_s=boundary_time_s,
            step_max=step_max,
        )
        if reason is None:
            accepted.append(cycle_rows)
        else:
            rejected[reason] += 1

    joints: dict[str, Any] = {}
    for joint, metadata in EXO_JOINTS.items():
        actual_cycles: list[list[float | None]] = []
        reference_cycles: list[list[float | None]] = []
        paired_errors: list[float] = []

        for cycle_rows in accepted:
            actual = _normalized_cycle_series(
                cycle_rows,
                value_key=f"{joint}_deg",
                step_max=step_max,
                phase_grid=phase_grid,
            )
            if actual is None:
                continue

            reference = _normalized_cycle_series(
                cycle_rows,
                value_key=f"{joint}_ref_deg",
                step_max=step_max,
                phase_grid=phase_grid,
            )
            actual_cycles.append(actual)
            reference_cycles.append(
                reference if reference is not None else [None] * len(phase_grid)
            )
            if reference is not None:
                paired_errors.extend(
                    actual_value - reference_value
                    for actual_value, reference_value in zip(actual, reference)
                    if actual_value is not None and reference_value is not None
                )

        if not actual_cycles:
            continue

        mean_actual = _mean_profile(actual_cycles, len(phase_grid))
        mean_reference = _mean_profile(reference_cycles, len(phase_grid))
        rmse_deg = _rms(paired_errors)
        reference_values = [
            value for value in mean_reference if value is not None
        ]
        reference_rom_deg = _range(reference_values)
        compliance = (
            _clamp(1.0 - rmse_deg / reference_rom_deg, 0.0, 1.0)
            if rmse_deg is not None
            and reference_rom_deg is not None
            and reference_rom_deg > 0
            else None
        )

        joints[joint] = {
            "label": metadata["label"],
            "cycleCount": len(actual_cycles),
            "summary": {
                "rmseDeg": rmse_deg,
                "maeDeg": _mean_abs(paired_errors),
                "maxErrorDeg": _max_abs(paired_errors),
                "compliance": compliance,
            },
            "points": [
                {
                    "phasePct": phase,
                    "refDeg": reference_value,
                    "actualDeg": actual_value,
                    "errorDeg": (
                        actual_value - reference_value
                        if actual_value is not None and reference_value is not None
                        else None
                    ),
                }
                for phase, reference_value, actual_value in zip(
                    phase_grid,
                    mean_reference,
                    mean_actual,
                )
            ],
        }

    return {
        "cycleIntervalCount": len(accepted),
        "eventSource": "step_idx_wraparound" if step_max is not None else None,
        "joints": joints,
        "quality": {
            "detectedCycleCount": len(candidates),
            "acceptedCycleCount": len(accepted),
            "rejectedCycleCount": sum(rejected.values()),
            "rejectionCounts": dict(rejected),
            "phasePointCount": len(phase_grid),
        },
    }


def _gait_cycle_candidates(
    rows: list[dict[str, Any]],
    step_max: float,
) -> list[tuple[list[dict[str, Any]], float]]:
    """Return row intervals bounded by consecutive step-index wraparounds."""

    high_threshold = step_max * 0.8
    low_threshold = step_max * 0.2
    candidates: list[tuple[list[dict[str, Any]], float]] = []
    current_cycle: list[dict[str, Any]] | None = None
    previous_step: float | None = None

    for row in rows:
        if not _is_gait_running(row):
            current_cycle = None
            previous_step = None
            continue

        step = _as_float(row.get("step_idx"))
        if step is None or step < 0 or step > step_max:
            current_cycle = None
            previous_step = None
            continue

        is_wrap = (
            previous_step is not None
            and previous_step >= high_threshold
            and step <= low_threshold
        )
        if is_wrap:
            if current_cycle:
                candidates.append((current_cycle, _row_time_s(row)))
            current_cycle = [row]
        elif current_cycle is not None:
            current_cycle.append(row)
        elif previous_step is None and step <= low_threshold:
            current_cycle = [row]

        previous_step = step

    return candidates


def _gait_cycle_rejection_reason(
    rows: list[dict[str, Any]],
    *,
    boundary_time_s: float,
    step_max: float | None,
) -> str | None:
    if len(rows) < GAIT_CYCLE_MIN_SAMPLE_COUNT:
        return "insufficient_samples"
    if step_max is None or step_max <= 0:
        return "invalid_step_range"

    duration_s = boundary_time_s - _row_time_s(rows[0])
    if not GAIT_CYCLE_MIN_DURATION_S <= duration_s <= GAIT_CYCLE_MAX_DURATION_S:
        return "duration_out_of_range"

    steps = [
        value
        for row in rows
        for value in [_as_float(row.get("step_idx"))]
        if value is not None
    ]
    if not steps or (max(steps) - min(steps)) / step_max < GAIT_CYCLE_MIN_PHASE_COVERAGE:
        return "insufficient_phase_coverage"

    times = [_row_time_s(row) for row in rows]
    times.append(boundary_time_s)
    if any(
        next_time - current_time > GAIT_CYCLE_MAX_SAMPLE_GAP_S
        for current_time, next_time in zip(times, times[1:])
    ):
        return "telemetry_gap"
    return None


def _normalized_cycle_series(
    rows: list[dict[str, Any]],
    *,
    value_key: str,
    step_max: float | None,
    phase_grid: list[float],
) -> list[float | None] | None:
    if step_max is None or step_max <= 0:
        return None

    samples = [
        (step / step_max * 100.0, value)
        for row in rows
        for step in [_as_float(row.get("step_idx"))]
        for value in [_as_float(row.get(value_key))]
        if step is not None and value is not None
    ]
    if len(samples) < GAIT_CYCLE_MIN_SAMPLE_COUNT:
        return None
    phases = [phase for phase, _ in samples]
    if (max(phases) - min(phases)) / 100.0 < GAIT_CYCLE_MIN_PHASE_COVERAGE:
        return None
    return _interpolate_profile(samples, phase_grid)


def _interpolate_profile(
    samples: list[tuple[float, float]],
    phase_grid: list[float],
) -> list[float | None]:
    """Linearly interpolate samples after averaging repeated phase positions."""

    grouped: dict[float, list[float]] = {}
    for phase, value in samples:
        grouped.setdefault(phase, []).append(value)
    points = sorted(
        (phase, mean(values))
        for phase, values in grouped.items()
    )
    if len(points) < 2:
        return [None] * len(phase_grid)

    result: list[float | None] = []
    right_index = 1
    for target in phase_grid:
        if target < points[0][0] or target > points[-1][0]:
            result.append(None)
            continue
        while right_index < len(points) and points[right_index][0] < target:
            right_index += 1
        if right_index == len(points):
            result.append(points[-1][1] if target == points[-1][0] else None)
            continue
        left_phase, left_value = points[right_index - 1]
        right_phase, right_value = points[right_index]
        if target == right_phase:
            result.append(right_value)
        elif right_phase == left_phase:
            result.append(left_value)
        else:
            ratio = (target - left_phase) / (right_phase - left_phase)
            result.append(left_value + ratio * (right_value - left_value))
    return result


def _mean_profile(
    profiles: list[list[float | None]],
    point_count: int,
) -> list[float | None]:
    return [
        _safe_mean(
            [
                value
                for profile in profiles
                for value in [profile[index]]
                if value is not None
            ]
        )
        for index in range(point_count)
    ]


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
