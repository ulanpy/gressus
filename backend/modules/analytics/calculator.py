"""CEMRR gait analytics calculator.

The formulas in this file are transcribed from
``CEMRR_GAIT_10Cycle_HandCalc.docx``.  The calculator accepts decoded telemetry
rows from one session, splits them into gait episodes, computes metrics for each
episode, then aggregates those episode metrics for the full session.
"""

from __future__ import annotations

from collections import Counter
from math import isfinite, sin, sqrt
from statistics import mean
from typing import Any

Number = int | float

DEFAULT_PARAMETERS: dict[str, Any] = {
    # Fallback values from CEMRR_GAIT_10Cycle_HandCalc.docx.  Values supplied
    # by Session.exo_profile.analytics override these defaults.
    "leg_length_m": 0.62,
    "belt_speed_m_s": 0.50,
    "moment_arm_m": 0.25,
    "normal": {
        "cadence_steps_min": 110.0,
        "belt_speed_m_s": 0.90,
        "stride_length_m": 1.40,
        "double_support_ratio_pct": 20.0,
    },
    "baseline": {
        "step_length_si_pct": 20.54,
        "stride_time_cv_pct": 4.20,
        "double_support_ratio_pct": 36.0,
    },
    "weights": {
        "symmetry": 0.25,
        "stability": 0.15,
        "support": 0.20,
        "efficiency": 0.20,
        "strength": 0.20,
    },
    "passive_force_n": {
        "left_hip": 5.1,
        "right_hip": 4.6,
        "left_knee": 4.0,
        "right_knee": 3.7,
    },
}

FORMULAS: dict[str, str] = {
    "stride_time": "t_stride_L(i) = HS_L(i+1) - HS_L(i)",
    "stance_time": "t_stance_L(i) = TO_L(i) - HS_L(i)",
    "swing_time": "t_swing_L(i) = HS_L(i+1) - TO_L(i)",
    "double_support": "t_ds(i) = min(TO_L(i), TO_R(i)) - max(HS_L(i), HS_R(i))",
    "cadence": "Cadence = 60 / mean(t_step), where t_step is between consecutive HS events",
    "step_length_kinematic": "L_kin = 2 * L_leg * sin(theta_hip_max / 2)",
    "step_length_belt": "L_belt = v_belt * t_step",
    "step_length": "L_step = L_kin + L_belt",
    "stride_length": "L_stride = L_step_L + L_step_R",
    "symmetry_index": "SI = abs(mu_L - mu_R) / ((mu_L + mu_R) / 2) * 100",
    "coefficient_of_variation": "CV = sample_std(values) / mean(values) * 100",
    "human_torque": "tau_human = (F_passive - F_session) * moment_arm",
    "patient_torque_fraction": "PTF = (F_passive - mean(F_session)) / F_passive",
    "symmetry_score": "S = 1 - (SI_step_length / SI_baseline)",
    "stability_score": "V = 1 - (mean_stride_time_CV / CV_baseline)",
    "support_score": "B = 1 - (DSR - DSR_normal) / (DSR_baseline - DSR_normal)",
    "efficiency_score": "E = mean(v_belt/v_normal, cadence/cad_normal, stride_length/SL_normal)",
    "strength_score": "STR = mean(PTF_left_hip, PTF_right_hip, PTF_left_knee, PTF_right_knee)",
    "gri": "GRI = 0.25*S + 0.15*V + 0.20*B + 0.20*E + 0.20*STR",
}

JOINTS = {
    "left_hip": {"angle": "HL_deg", "patient_torque": "HL_patient_nm", "force": "F_hip_L"},
    "right_hip": {"angle": "HR_deg", "patient_torque": "HR_patient_nm", "force": "F_hip_R"},
    "left_knee": {"angle": "KL_deg", "patient_torque": "KL_patient_nm", "force": "F_knee_L"},
    "right_knee": {"angle": "KR_deg", "patient_torque": "KR_patient_nm", "force": "F_knee_R"},
}


def calculate_session_metrics(
    rows: list[dict[str, Any]],
    parameters: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Calculate episode-level metrics and aggregate them for the whole session."""

    supplied = parameters or {}
    params = _merge_parameters(DEFAULT_PARAMETERS, supplied)
    missing_parameters = _missing_parameters(params)
    defaulted_parameters = _defaulted_parameters(DEFAULT_PARAMETERS, supplied)
    ordered_rows = sorted(rows, key=_row_time_s)
    episodes = find_episodes(ordered_rows)
    episode_metrics = [
        calculate_episode_metrics(episode, index=index, parameters=params)
        for index, episode in enumerate(episodes)
    ]

    return {
        "formulas": FORMULAS,
        "parameters": params,
        "missingParameters": missing_parameters,
        "defaultedParameters": defaulted_parameters,
        "episodeCount": len(episode_metrics),
        "episodes": episode_metrics,
        "session": aggregate_episode_metrics(episode_metrics, ordered_rows, params),
    }


def parameters_from_session(session: Any) -> dict[str, Any]:
    """Extract analytics parameters from a Session-like object.

    Supported ``exo_profile`` shapes:
    - ``{"analytics": {...}}``
    - ``{"leg_length_m": ..., "belt_speed_m_s": ...}``
    - camelCase aliases from frontend/runtime JSON.
    """

    profile = getattr(session, "exo_profile", None) or {}
    if not isinstance(profile, dict):
        return {}

    analytics = profile.get("analytics")
    source = analytics if isinstance(analytics, dict) else profile
    params: dict[str, Any] = {}

    _copy_first(params, "leg_length_m", source, ("leg_length_m", "legLengthM", "leg_m"))
    if "leg_length_m" not in params:
        left = _as_float(source.get("leg_length_left_m") or source.get("legLengthLeftM"))
        right = _as_float(source.get("leg_length_right_m") or source.get("legLengthRightM"))
        if left is not None and right is not None:
            params["leg_length_m"] = (left + right) / 2.0
        elif left is not None:
            params["leg_length_m"] = left
        elif right is not None:
            params["leg_length_m"] = right

    _copy_first(
        params,
        "belt_speed_m_s",
        source,
        ("belt_speed_m_s", "beltSpeedMS", "treadmill_speed_m_s", "v_belt"),
    )
    _copy_first(params, "moment_arm_m", source, ("moment_arm_m", "momentArmM"))

    for key in ("normal", "baseline", "weights", "passive_force_n"):
        value = source.get(key)
        if isinstance(value, dict):
            params[key] = value

    return params


def find_episodes(
    rows: list[dict[str, Any]],
    *,
    max_gap_s: float = 2.0,
    min_duration_s: float = 1.0,
    min_samples: int = 5,
) -> list[list[dict[str, Any]]]:
    """Find contiguous gait episodes inside one session.

    An episode is a contiguous block where ``phase == "GAIT"`` and
    ``running == 1``.  A large timestamp gap starts a new episode.
    """

    episodes: list[list[dict[str, Any]]] = []
    current: list[dict[str, Any]] = []
    previous_time: float | None = None

    for row in sorted(rows, key=_row_time_s):
        time_s = _row_time_s(row)
        is_gait = row.get("phase") == "GAIT" and _as_float(row.get("running")) == 1.0
        gap_break = previous_time is not None and time_s - previous_time > max_gap_s

        if not is_gait or gap_break:
            _append_episode(episodes, current, min_duration_s, min_samples)
            current = []

        if is_gait:
            current.append(row)

        previous_time = time_s

    _append_episode(episodes, current, min_duration_s, min_samples)
    return episodes


def calculate_episode_metrics(
    rows: list[dict[str, Any]],
    *,
    index: int,
    parameters: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Calculate all CEMRR metrics for one gait episode."""

    params = _merge_parameters(DEFAULT_PARAMETERS, parameters or {})
    ordered_rows = sorted(rows, key=_row_time_s)
    timing = _timing_metrics(ordered_rows)
    step_lengths = _step_length_metrics(ordered_rows, timing, params)
    torque = _torque_metrics(ordered_rows, params)
    aspect_scores = _aspect_scores(timing, step_lengths, torque, params)

    start_s = _row_time_s(ordered_rows[0]) if ordered_rows else None
    end_s = _row_time_s(ordered_rows[-1]) if ordered_rows else None
    duration_s = None if start_s is None or end_s is None else max(0.0, end_s - start_s)

    return {
        "index": index,
        "startS": start_s,
        "endS": end_s,
        "durationS": duration_s,
        "sampleCount": len(ordered_rows),
        "phaseCounts": dict(Counter(str(row.get("phase", "UNKNOWN")) for row in ordered_rows)),
        "timing": _compact_timing(timing),
        "spatial": step_lengths,
        "torque": torque,
        "scores": aspect_scores,
    }


def aggregate_episode_metrics(
    episodes: list[dict[str, Any]],
    rows: list[dict[str, Any]],
    parameters: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Aggregate per-episode metrics into a single session-level summary."""

    params = _merge_parameters(DEFAULT_PARAMETERS, parameters or {})
    start_s = _row_time_s(rows[0]) if rows else None
    end_s = _row_time_s(rows[-1]) if rows else None

    def avg(path: tuple[str, ...]) -> float | None:
        values = [_path_value(episode, path) for episode in episodes]
        numeric = [value for value in values if isinstance(value, (int, float)) and isfinite(value)]
        return mean(numeric) if numeric else None

    session_scores = {
        "symmetry": avg(("scores", "symmetry")),
        "stability": avg(("scores", "stability")),
        "support": avg(("scores", "support")),
        "efficiency": avg(("scores", "efficiency")),
        "strength": avg(("scores", "strength")),
    }
    session_scores["gri"] = _weighted_gri(session_scores, params["weights"])

    return {
        "startS": start_s,
        "endS": end_s,
        "durationS": None if start_s is None or end_s is None else max(0.0, end_s - start_s),
        "sampleCount": len(rows),
        "gaitSampleCount": sum(1 for row in rows if row.get("phase") == "GAIT"),
        "episodeCount": len(episodes),
        "cadenceStepsPerMin": avg(("timing", "cadenceStepsPerMin")),
        "strideTime": {
            "leftMeanS": avg(("timing", "left", "strideTime", "mean")),
            "rightMeanS": avg(("timing", "right", "strideTime", "mean")),
            "symmetryIndexPct": avg(("timing", "strideTimeSymmetryIndexPct")),
        },
        "stancePct": {
            "left": avg(("timing", "left", "stancePct", "mean")),
            "right": avg(("timing", "right", "stancePct", "mean")),
        },
        "swingPct": {
            "left": avg(("timing", "left", "swingPct", "mean")),
            "right": avg(("timing", "right", "swingPct", "mean")),
        },
        "doubleSupport": {
            "meanS": avg(("timing", "doubleSupport", "mean")),
            "ratioPct": avg(("timing", "doubleSupportRatioPct")),
        },
        "stepLength": {
            "leftMeanM": avg(("spatial", "leftStepLengthM", "mean")),
            "rightMeanM": avg(("spatial", "rightStepLengthM", "mean")),
            "symmetryIndexPct": avg(("spatial", "stepLengthSymmetryIndexPct")),
        },
        "strideLengthMeanM": avg(("spatial", "strideLengthM", "mean")),
        "torque": {
            "strengthScore": avg(("torque", "strengthScore")),
            "joints": _aggregate_joint_metrics(episodes),
        },
        "scores": session_scores,
    }


def _timing_metrics(rows: list[dict[str, Any]]) -> dict[str, Any]:
    left_hs, right_hs = _heel_strikes(rows)
    left_to, right_to = _toe_offs(rows)
    left_cycles = _side_cycles(left_hs, left_to)
    right_cycles = _side_cycles(right_hs, right_to)
    double_support = _double_support(left_hs, left_to, right_hs, right_to)
    all_hs = sorted(left_hs + right_hs)
    step_times = _positive_diffs(all_hs)

    left_stride = [cycle["strideTimeS"] for cycle in left_cycles]
    right_stride = [cycle["strideTimeS"] for cycle in right_cycles]
    left_stance_pct = [cycle["stancePct"] for cycle in left_cycles]
    right_stance_pct = [cycle["stancePct"] for cycle in right_cycles]
    left_swing_pct = [cycle["swingPct"] for cycle in left_cycles]
    right_swing_pct = [cycle["swingPct"] for cycle in right_cycles]

    return {
        "eventSource": _event_source(rows),
        "eventCounts": {
            "leftHeelStrikes": len(left_hs),
            "rightHeelStrikes": len(right_hs),
            "leftToeOffs": len(left_to),
            "rightToeOffs": len(right_to),
            "stepTimes": len(step_times),
        },
        "_leftHeelStrikesS": left_hs,
        "_rightHeelStrikesS": right_hs,
        "_leftToeOffsS": left_to,
        "_rightToeOffsS": right_to,
        "_stepTimesS": step_times,
        "cadenceStepsPerMin": None if not step_times else 60.0 / mean(step_times),
        "left": {
            "cycleCount": len(left_cycles),
            "_cycles": left_cycles,
            "strideTime": _summary(left_stride),
            "stanceTime": _summary([cycle["stanceTimeS"] for cycle in left_cycles]),
            "swingTime": _summary([cycle["swingTimeS"] for cycle in left_cycles]),
            "stancePct": _summary(left_stance_pct),
            "swingPct": _summary(left_swing_pct),
            "strideTimeCvPct": _cv(left_stride),
        },
        "right": {
            "cycleCount": len(right_cycles),
            "_cycles": right_cycles,
            "strideTime": _summary(right_stride),
            "stanceTime": _summary([cycle["stanceTimeS"] for cycle in right_cycles]),
            "swingTime": _summary([cycle["swingTimeS"] for cycle in right_cycles]),
            "stancePct": _summary(right_stance_pct),
            "swingPct": _summary(right_swing_pct),
            "strideTimeCvPct": _cv(right_stride),
        },
        "doubleSupport": _summary(double_support),
        "doubleSupportRatioPct": _ratio_pct(_safe_mean(double_support), _safe_mean(left_stride)),
        "strideTimeSymmetryIndexPct": _symmetry_index(_safe_mean(left_stride), _safe_mean(right_stride)),
    }


def _step_length_metrics(
    rows: list[dict[str, Any]],
    timing: dict[str, Any],
    params: dict[str, Any],
) -> dict[str, Any]:
    leg_length = _as_float(params.get("leg_length_m"))
    belt_speed = _as_float(params.get("belt_speed_m_s"))
    left_hs = timing["_leftHeelStrikesS"]
    right_hs = timing["_rightHeelStrikesS"]
    left_steps: list[float] = []
    right_steps: list[float] = []
    strides: list[float] = []
    left_intervals: list[tuple[float, float]] = []
    right_intervals: list[tuple[float, float]] = []

    for i, left_start in enumerate(left_hs):
        right_after_left = _first_between(right_hs, left_start, left_hs[i + 1] if i + 1 < len(left_hs) else None)
        if right_after_left is None:
            continue
        left_intervals.append((left_start, right_after_left))

        if i + 1 >= len(left_hs):
            continue
        right_intervals.append((right_after_left, left_hs[i + 1]))

    left_theta = _max_for_intervals(rows, "HL_deg", left_intervals)
    right_theta = _max_for_intervals(rows, "HR_deg", right_intervals)

    for (start, end), theta in zip(left_intervals, left_theta):
        if theta is not None and leg_length is not None and belt_speed is not None:
            left_steps.append(_step_length(theta, end - start, leg_length, belt_speed))

    for (start, end), theta in zip(right_intervals, right_theta):
        if theta is not None and leg_length is not None and belt_speed is not None:
            right_steps.append(_step_length(theta, end - start, leg_length, belt_speed))

    for left, right in zip(left_steps, right_steps):
        strides.append(left + right)

    return {
        "leftKinematicM": _summary([
            2.0 * leg_length * sin(abs(theta) / 2.0 * 3.141592653589793 / 180.0)
            for theta in left_theta
            if theta is not None and leg_length is not None
        ]),
        "rightKinematicM": _summary([
            2.0 * leg_length * sin(abs(theta) / 2.0 * 3.141592653589793 / 180.0)
            for theta in right_theta
            if theta is not None and leg_length is not None
        ]),
        "leftStepLengthM": _summary(left_steps),
        "rightStepLengthM": _summary(right_steps),
        "strideLengthM": _summary(strides),
        "stepLengthSymmetryIndexPct": _symmetry_index(_safe_mean(left_steps), _safe_mean(right_steps)),
    }


def _torque_metrics(rows: list[dict[str, Any]], params: dict[str, Any]) -> dict[str, Any]:
    moment_arm = _as_float(params.get("moment_arm_m"))
    passive_force = params.get("passive_force_n") or {}
    joints: dict[str, Any] = {}

    for joint, fields in JOINTS.items():
        force_values = _values(rows, fields["force"])
        patient_torque_values = _values(rows, fields["patient_torque"])
        passive = _as_float(passive_force.get(joint))
        ptf = None
        tau_human_nm = _summary(patient_torque_values)

        if passive and moment_arm is not None and force_values:
            mean_force = mean(force_values)
            ptf = (passive - mean_force) / passive
            tau_human_nm = _summary([(passive - value) * moment_arm for value in force_values])
        elif passive and moment_arm is not None:
            passive_torque = passive * moment_arm
            mean_patient_torque = _safe_mean(patient_torque_values)
            if mean_patient_torque is not None and passive_torque > 0:
                ptf = mean_patient_torque / passive_torque

        joints[joint] = {
            "patientTorqueNm": tau_human_nm,
            "patientTorqueFraction": _clamp(ptf, -1.0, 1.0) if ptf is not None else None,
        }

    strength_values = [
        joint["patientTorqueFraction"]
        for joint in joints.values()
        if isinstance(joint["patientTorqueFraction"], (int, float))
    ]
    return {
        "joints": joints,
        "strengthScore": _clamp(mean(strength_values), 0.0, 1.0) if strength_values else None,
    }


def _aspect_scores(
    timing: dict[str, Any],
    spatial: dict[str, Any],
    torque: dict[str, Any],
    params: dict[str, Any],
) -> dict[str, float | None]:
    baseline = params["baseline"]
    normal = params["normal"]
    weights = params["weights"]

    si = spatial["stepLengthSymmetryIndexPct"]
    cv_l = timing["left"]["strideTimeCvPct"]
    cv_r = timing["right"]["strideTimeCvPct"]
    cv_values = [value for value in (cv_l, cv_r) if value is not None]
    cv_mean = mean(cv_values) if cv_values else None
    dsr = timing["doubleSupportRatioPct"]
    cadence = timing["cadenceStepsPerMin"]
    stride_length = spatial["strideLengthM"]["mean"]

    si_baseline = _as_float(baseline.get("step_length_si_pct"))
    cv_baseline = _as_float(baseline.get("stride_time_cv_pct"))
    dsr_baseline = _as_float(baseline.get("double_support_ratio_pct"))
    symmetry = (
        None
        if si is None or si_baseline in (None, 0.0)
        else _clamp(1.0 - si / si_baseline, 0.0, 1.0)
    )
    stability = (
        None
        if cv_mean is None or cv_baseline in (None, 0.0)
        else _clamp(1.0 - cv_mean / cv_baseline, 0.0, 1.0)
    )
    support = _support_score(dsr, normal["double_support_ratio_pct"], dsr_baseline)
    efficiency_parts = [
        _ratio(params["belt_speed_m_s"], normal["belt_speed_m_s"]),
        _ratio(cadence, normal["cadence_steps_min"]),
        _ratio(stride_length, normal["stride_length_m"]),
    ]
    efficiency_values = [_clamp(value, 0.0, 1.0) for value in efficiency_parts]
    efficiency = (
        mean([value for value in efficiency_values if value is not None])
        if all(value is not None for value in efficiency_values)
        else None
    )
    strength = torque["strengthScore"]
    scores = {
        "symmetry": symmetry,
        "stability": stability,
        "support": support,
        "efficiency": efficiency,
        "strength": strength,
    }
    scores["gri"] = _weighted_gri(scores, weights)
    return scores


def _heel_strikes(rows: list[dict[str, Any]]) -> tuple[list[float], list[float]]:
    left = _explicit_events(rows, "HS_L")
    right = _explicit_events(rows, "HS_R")
    if left or right:
        return left, right

    times = _step_transition_times(rows)
    left = [time for i, time in enumerate(times) if i % 2 == 0]
    right = [time for i, time in enumerate(times) if i % 2 == 1]
    return left, right


def _toe_offs(rows: list[dict[str, Any]]) -> tuple[list[float], list[float]]:
    left = _explicit_events(rows, "TO_L")
    right = _explicit_events(rows, "TO_R")
    if left or right:
        return left, right

    hs_l, hs_r = _heel_strikes(rows)
    left_to = _synthetic_toe_offs(hs_l, stance_ratio=0.622)
    right_to = _synthetic_toe_offs(hs_r, stance_ratio=0.574)
    return left_to, right_to


def _explicit_events(rows: list[dict[str, Any]], key: str) -> list[float]:
    times = []
    for row in rows:
        value = _as_float(row.get(key))
        if value is not None:
            times.append(value)
    return sorted(set(times))


def _event_source(rows: list[dict[str, Any]]) -> str:
    if any(_as_float(row.get("HS_L")) is not None or _as_float(row.get("HS_R")) is not None for row in rows):
        return "explicit_insole_events"
    return "step_idx_zero_crossings_estimated"


def _step_transition_times(rows: list[dict[str, Any]]) -> list[float]:
    """Infer sparse gait events from cyclic controller phase.

    ``step_idx`` in the current P.GEAR CSV is not a heel-strike stream. It is a
    controller phase index and can change thousands of times. For test data
    without insole events, use only crossings into phase ``0`` and enforce a
    physiologically plausible minimum interval so these remain coarse estimated
    gait events.
    """

    times: list[float] = []
    previous: int | None = None
    last_event_s: float | None = None
    min_event_interval_s = 0.5
    for row in rows:
        step_idx = _as_float(row.get("step_idx"))
        if step_idx is None:
            continue
        current = int(step_idx)
        time_s = _row_time_s(row)
        is_zero_crossing = current == 0 and previous not in (None, 0)
        is_first_zero = previous is None and current == 0
        if is_zero_crossing or is_first_zero:
            if last_event_s is None or time_s - last_event_s >= min_event_interval_s:
                times.append(time_s)
                last_event_s = time_s
        previous = current
    return times


def _side_cycles(hs: list[float], toe_offs: list[float]) -> list[dict[str, float]]:
    cycles = []
    for i, start in enumerate(hs[:-1]):
        end = hs[i + 1]
        toe_off = _first_between(toe_offs, start, end)
        if toe_off is None:
            continue
        stride = end - start
        stance = toe_off - start
        swing = end - toe_off
        if stride <= 0 or stance < 0 or swing < 0:
            continue
        cycles.append(
            {
                "strideTimeS": stride,
                "stanceTimeS": stance,
                "swingTimeS": swing,
                "stancePct": stance / stride * 100.0,
                "swingPct": swing / stride * 100.0,
            }
        )
    return cycles


def _compact_timing(timing: dict[str, Any]) -> dict[str, Any]:
    """Remove internal event/cycle arrays before persisting analytics JSON."""

    compact: dict[str, Any] = {}
    for key, value in timing.items():
        if key.startswith("_"):
            continue
        if key in ("left", "right") and isinstance(value, dict):
            compact[key] = {
                child_key: child_value
                for child_key, child_value in value.items()
                if not child_key.startswith("_")
            }
            continue
        compact[key] = value
    return compact


def _double_support(
    left_hs: list[float],
    left_to: list[float],
    right_hs: list[float],
    right_to: list[float],
) -> list[float]:
    values = []
    for i in range(min(len(left_hs), len(left_to), len(right_hs), len(right_to))):
        both_on = min(left_to[i], right_to[i]) - max(left_hs[i], right_hs[i])
        values.append(max(0.0, both_on))
    return values


def _synthetic_toe_offs(hs: list[float], *, stance_ratio: float) -> list[float]:
    return [start + (end - start) * stance_ratio for start, end in zip(hs, hs[1:])]


def _step_length(theta_deg: float, step_time_s: float, leg_length_m: float, belt_speed_m_s: float) -> float:
    theta_rad = abs(theta_deg) / 2.0 * 3.141592653589793 / 180.0
    l_kin = 2.0 * leg_length_m * sin(theta_rad)
    l_belt = belt_speed_m_s * step_time_s
    return l_kin + l_belt


def _append_episode(
    episodes: list[list[dict[str, Any]]],
    rows: list[dict[str, Any]],
    min_duration_s: float,
    min_samples: int,
) -> None:
    if len(rows) < min_samples:
        return
    duration = _row_time_s(rows[-1]) - _row_time_s(rows[0])
    if duration >= min_duration_s:
        episodes.append(rows[:])


def _summary(values: list[float]) -> dict[str, float | None]:
    clean = [value for value in values if isfinite(value)]
    if not clean:
        return {"mean": None, "min": None, "max": None, "std": None, "count": 0}
    return {
        "mean": mean(clean),
        "min": min(clean),
        "max": max(clean),
        "std": _sample_std(clean),
        "count": len(clean),
    }


def _sample_std(values: list[float]) -> float | None:
    if len(values) < 2:
        return None
    mu = mean(values)
    return sqrt(sum((value - mu) ** 2 for value in values) / (len(values) - 1))


def _cv(values: list[float]) -> float | None:
    mu = _safe_mean(values)
    std = _sample_std(values)
    if mu is None or std is None or mu == 0:
        return None
    return std / mu * 100.0


def _symmetry_index(left: float | None, right: float | None) -> float | None:
    if left is None or right is None:
        return None
    denominator = (left + right) / 2.0
    if denominator == 0:
        return None
    return abs(left - right) / denominator * 100.0


def _support_score(dsr: float | None, normal: float, baseline: float) -> float | None:
    if dsr is None or baseline is None or baseline == normal:
        return None
    return _clamp(1.0 - (dsr - normal) / (baseline - normal), 0.0, 1.0)


def _weighted_gri(scores: dict[str, Any], weights: dict[str, float]) -> float | None:
    total = 0.0
    for key, weight in weights.items():
        value = scores.get(key)
        if not isinstance(value, (int, float)) or not isfinite(value):
            return None
        total += value * weight
    return total


def _aggregate_joint_metrics(episodes: list[dict[str, Any]]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for joint in JOINTS:
        ptf_values = []
        torque_values = []
        for episode in episodes:
            joint_metrics = episode.get("torque", {}).get("joints", {}).get(joint, {})
            ptf = joint_metrics.get("patientTorqueFraction")
            torque_mean = joint_metrics.get("patientTorqueNm", {}).get("mean")
            if isinstance(ptf, (int, float)):
                ptf_values.append(ptf)
            if isinstance(torque_mean, (int, float)):
                torque_values.append(torque_mean)
        out[joint] = {
            "patientTorqueFraction": _safe_mean(ptf_values),
            "patientTorqueNmMean": _safe_mean(torque_values),
        }
    return out


def _merge_parameters(base: dict[str, Any], override: dict[str, Any]) -> dict[str, Any]:
    merged = dict(base)
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = _merge_parameters(merged[key], value)
        else:
            merged[key] = value
    return merged


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
    missing = []
    for key in ("leg_length_m", "belt_speed_m_s", "moment_arm_m"):
        if _as_float(params.get(key)) is None:
            missing.append(key)

    passive = params.get("passive_force_n")
    if not isinstance(passive, dict) or not all(
        _as_float(passive.get(joint)) is not None for joint in JOINTS
    ):
        missing.append("passive_force_n")

    baseline = params.get("baseline")
    if not isinstance(baseline, dict):
        missing.append("baseline")
    else:
        for key in (
            "step_length_si_pct",
            "stride_time_cv_pct",
            "double_support_ratio_pct",
        ):
            if _as_float(baseline.get(key)) is None:
                missing.append(f"baseline.{key}")
    return missing


def _defaulted_parameters(defaults: dict[str, Any], supplied: dict[str, Any]) -> list[str]:
    out: list[str] = []

    def walk(default_value: Any, supplied_value: Any, prefix: str) -> None:
        if isinstance(default_value, dict):
            supplied_dict = supplied_value if isinstance(supplied_value, dict) else {}
            for key, value in default_value.items():
                walk(value, supplied_dict.get(key), f"{prefix}.{key}" if prefix else key)
            return
        if supplied_value is None:
            out.append(prefix)

    walk(defaults, supplied, "")
    return out


def _path_value(data: dict[str, Any], path: tuple[str, ...]) -> Any:
    current: Any = data
    for key in path:
        if not isinstance(current, dict):
            return None
        current = current.get(key)
    return current


def _values(rows: list[dict[str, Any]], key: str) -> list[float]:
    out = []
    for row in rows:
        value = _as_float(row.get(key))
        if value is not None:
            out.append(value)
    return out


def _row_time_s(row: dict[str, Any]) -> float:
    for key in ("session_t_s", "t_s"):
        value = _as_float(row.get(key))
        if value is not None:
            return value
    ns = _as_float(row.get("_mcap_log_time_ns"))
    if ns is not None:
        return ns / 1_000_000_000.0
    return 0.0


def _as_float(value: Any) -> float | None:
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value)
        except ValueError:
            return None
    return None


def _safe_mean(values: list[float]) -> float | None:
    clean = [value for value in values if isfinite(value)]
    return mean(clean) if clean else None


def _positive_diffs(values: list[float]) -> list[float]:
    return [b - a for a, b in zip(values, values[1:]) if b > a]


def _first_between(values: list[float], start: float, end: float | None) -> float | None:
    for value in values:
        if value <= start:
            continue
        if end is not None and value >= end:
            continue
        return value
    return None


def _max_for_intervals(
    rows: list[dict[str, Any]],
    key: str,
    intervals: list[tuple[float, float]],
) -> list[float | None]:
    """Return abs(max) values for sorted, mostly non-overlapping intervals."""

    out: list[float | None] = []
    row_index = 0
    timed_rows = [(_row_time_s(row), row) for row in rows]
    for start, end in intervals:
        while row_index < len(timed_rows) and timed_rows[row_index][0] < start:
            row_index += 1

        scan_index = row_index
        values: list[float] = []
        while scan_index < len(timed_rows) and timed_rows[scan_index][0] <= end:
            value = _as_float(timed_rows[scan_index][1].get(key))
            if value is not None:
                values.append(abs(value))
            scan_index += 1
        out.append(max(values) if values else None)
    return out


def _max_between(rows: list[dict[str, Any]], key: str, start: float, end: float) -> float | None:
    values = [
        abs(value)
        for row in rows
        if start <= _row_time_s(row) <= end
        for value in [_as_float(row.get(key))]
        if value is not None
    ]
    return max(values) if values else None


def _ratio(value: Any, denominator: Any) -> float | None:
    numerator = _as_float(value)
    divisor = _as_float(denominator)
    if numerator is None or divisor in (None, 0.0):
        return None
    return numerator / divisor


def _ratio_pct(numerator: float | None, denominator: float | None) -> float | None:
    if numerator is None or denominator in (None, 0.0):
        return None
    return numerator / denominator * 100.0


def _clamp(value: float | None, lower: float, upper: float) -> float | None:
    if value is None:
        return None
    return max(lower, min(upper, value))
