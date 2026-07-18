from __future__ import annotations

from copy import deepcopy
from math import isclose, pi

from .telemetry_only_calculator import calculate_session_metrics


def _row(
    time_s: float,
    segment: int,
    *,
    phase: str = "GAIT",
    running: int = 1,
) -> dict[str, object]:
    return {
        "session_t_s": time_s,
        "source_segment_idx": segment,
        "phase": phase,
        "running": running,
        "HR_vel": 180.0,
        "HR_patient_nm": 10.0,
        "HR_patient_status": "ok",
    }


def _complete_row(time_s: float, segment: int, index: int) -> dict[str, object]:
    row = _row(time_s, segment)
    row.update(
        {
            "cps": 0.3 + index * 0.01,
            "amp_r": 1.0 + index,
            "amp_l": 2.0 + index,
            "assist_r": 0.5,
            "aan_factor": 1.0,
            "aan_on": index % 2,
            "aan_driving": index % 3,
            "torque_mode": 1,
            "estop": 0,
            "hb_error": 0,
            "cross_check": 0,
            "sensor_online": 1,
            "link_age_ms": 5 + index,
            "ctrl_loop_us": 20 + index,
        }
    )
    for joint_index, joint in enumerate(("HR", "KR", "HL", "KL"), start=1):
        value = float(index + joint_index)
        row.update(
            {
                f"{joint}_deg": value,
                f"{joint}_vel": value * 2.0,
                f"{joint}_meas_nm": value * 3.0,
                f"{joint}_cmd_nm": value * 4.0,
                f"{joint}_grav_nm": value * 0.5,
                f"{joint}_ff_nm": value * 0.25,
                f"{joint}_effort": value * 0.1,
                f"{joint}_patient_nm": value * 1.5,
                f"{joint}_patient_status": "ok",
            }
        )
    return row


def test_split_session_excludes_break_from_active_time_and_work() -> None:
    rows = [
        _row(0.0, 0),
        _row(1.0, 0),
        _row(2.0, 0, phase="IDLE", running=0),
        _row(12.0, 1),
        _row(13.0, 1),
    ]

    metrics = calculate_session_metrics(rows)
    duration = metrics["session"]["duration"]
    patient_power = metrics["session"]["power"]["joints"]["HR"]["patient"]

    assert duration == {
        "wallClockS": 13.0,
        "recordedS": 3.0,
        "gaitActiveS": 2.0,
        "idleRecordedS": 1.0,
        "breakS": 10.0,
    }
    assert isclose(patient_power["workJ"], 20.0 * pi)
    assert metrics["session"]["episodeCount"] == 2
    assert [episode["sampleCount"] for episode in metrics["episodes"]] == [3, 2]


def test_excluded_episode_is_removed_from_session_aggregate() -> None:
    rows = [
        _row(0.0, 0),
        _row(1.0, 0),
        _row(12.0, 1),
        _row(13.0, 1),
        _row(14.0, 1),
    ]

    metrics = calculate_session_metrics(rows, excluded_episode_indices=[0])

    assert metrics["excludedEpisodeIndices"] == [0]
    assert metrics["session"]["episodeCount"] == 1
    assert metrics["session"]["sampleCount"] == 3
    assert [episode["index"] for episode in metrics["episodes"]] == [1]


def test_fatigue_windows_use_active_gait_time() -> None:
    rows = [
        _row(0.0, 0),
        _row(30.0, 0),
        _row(150.0, 1),
        _row(180.0, 1),
    ]

    metrics = calculate_session_metrics(rows)

    assert metrics["session"]["duration"]["breakS"] == 120.0
    assert metrics["session"]["fatigue"]["joints"]["HR"]["windowCount"] == 2


def test_large_timestamp_jump_inside_segment_is_a_break() -> None:
    rows = [
        _row(0.0, 0),
        _row(0.1, 0),
        _row(0.2, 0),
        _row(5.2, 0),
        _row(5.3, 0),
    ]

    metrics = calculate_session_metrics(rows)
    duration = metrics["session"]["duration"]
    patient_power = metrics["session"]["power"]["joints"]["HR"]["patient"]

    assert isclose(duration["recordedS"], 0.3)
    assert isclose(duration["gaitActiveS"], 0.3)
    assert isclose(duration["breakS"], 5.0)
    assert isclose(patient_power["workJ"], 3.0 * pi)


def test_adding_break_changes_no_non_duration_metric() -> None:
    no_break_rows = [
        *[_complete_row(time_s, 0, index) for index, time_s in enumerate((0, 20, 40, 60))],
        *[
            _complete_row(time_s, 1, index)
            for index, time_s in enumerate((60, 80, 100, 120), start=4)
        ],
    ]
    break_rows = deepcopy(no_break_rows)
    for row in break_rows[4:]:
        row["session_t_s"] = float(row["session_t_s"]) + 120.0

    no_break = calculate_session_metrics(no_break_rows)
    with_break = calculate_session_metrics(break_rows)

    assert no_break["session"]["duration"]["recordedS"] == 120.0
    assert with_break["session"]["duration"]["recordedS"] == 120.0
    assert no_break["session"]["duration"]["breakS"] == 0.0
    assert with_break["session"]["duration"]["breakS"] == 120.0

    for result in (no_break, with_break):
        result["session"].pop("startS")
        result["session"].pop("endS")
        result["session"].pop("duration")
    assert with_break == no_break


def test_kinematic_step_length_uses_hip_rom_and_leg_length() -> None:
    rows = [
        {
            **_row(0.0, 0),
            "HR_deg": -30.0,
            "HL_deg": -30.0,
        },
        {
            **_row(0.1, 0),
            "HR_deg": 30.0,
            "HL_deg": 30.0,
        },
    ]

    metrics = calculate_session_metrics(
        rows,
        parameters={
            "leg_length_right_m": 1.0,
            "leg_length_left_m": 0.8,
        },
    )
    step_length = metrics["session"]["kinematics"]["stepLength"]

    assert isclose(step_length["rightM"], 1.0)
    assert isclose(step_length["leftM"], 0.8)
    assert isclose(step_length["meanM"], 0.9)
