"""Pressure-derived contact phases for raw 64-sensor insoles.

The implementation is deliberately small and dependency-free.  It ports the
validated research logic in ``~/emg/src/event_detection.py``: per-foot
adaptive loading thresholds, hysteresis, and short-segment debounce.  IC/TO
remain pressure-derived proxies, not motion-capture ground truth.
"""

from __future__ import annotations

from math import floor
from statistics import median
from typing import Sequence

SENSOR_ACTIVE_THRESHOLD_KPA = 3.125
ON_FRACTION = 0.15
OFF_FRACTION = 0.08
MIN_CONTACT_DURATION_S = 0.10
MIN_SWING_DURATION_S = 0.10
MAX_CONTINUITY_GAP_S = 0.50


def _percentile(values: Sequence[float], percent: float) -> float:
    ordered = sorted(values)
    if not ordered:
        raise ValueError("cannot calculate percentile of an empty signal")
    position = (len(ordered) - 1) * percent / 100.0
    lower = floor(position)
    upper = min(lower + 1, len(ordered) - 1)
    fraction = position - lower
    return ordered[lower] + (ordered[upper] - ordered[lower]) * fraction


def _sample_rate_hz(times: Sequence[float]) -> float:
    deltas = [next_time - current for current, next_time in zip(times, times[1:]) if 0 < next_time - current <= MAX_CONTINUITY_GAP_S]
    return 1.0 / median(deltas) if deltas else 50.0


def _clean_contact_mask(mask: list[bool], sample_rate_hz: float) -> list[bool]:
    """Remove only implausibly brief contact/swing segments."""

    cleaned = mask.copy()
    minimum = {
        True: max(1, round(MIN_CONTACT_DURATION_S * sample_rate_hz)),
        False: max(1, round(MIN_SWING_DURATION_S * sample_rate_hz)),
    }
    for _ in range(2):
        start = 0
        while start < len(cleaned):
            state = cleaned[start]
            end = start + 1
            while end < len(cleaned) and cleaned[end] == state:
                end += 1
            if end - start < minimum[state]:
                cleaned[start:end] = [not state] * (end - start)
            start = end
    return cleaned


def _one_foot_events(times: Sequence[float], frames: Sequence[Sequence[float]]) -> tuple[list[float], list[float]]:
    if len(times) != len(frames) or len(times) < 3:
        return [], []
    totals = [sum(max(0.0, float(value)) for value in frame) for frame in frames]
    low, high = _percentile(totals, 5), _percentile(totals, 95)
    if high <= low:
        return [], []
    on, off = low + ON_FRACTION * (high - low), low + OFF_FRACTION * (high - low)
    state = False
    contact: list[bool] = []
    for total in totals:
        if not state and total >= on:
            state = True
        elif state and total <= off:
            state = False
        contact.append(state)
    contact = _clean_contact_mask(contact, _sample_rate_hz(times))
    initial_contacts: list[float] = []
    toe_offs: list[float] = []
    for index in range(1, len(contact)):
        if not contact[index - 1] and contact[index]:
            initial_contacts.append(times[index])
        elif contact[index - 1] and not contact[index]:
            toe_offs.append(times[index])
    return initial_contacts, toe_offs


def pressure_rows(
    frames: Sequence[tuple[float, Sequence[float], Sequence[float]]],
) -> tuple[list[dict[str, object]], dict[str, object]]:
    """Turn raw pressure frames into rows accepted by the existing gait calculator."""

    if not frames:
        return [], {"available": False, "reason": "no_pressure_frames"}
    ordered = sorted(frames, key=lambda frame: frame[0])
    times = [frame[0] for frame in ordered]
    left_ic, left_to = _one_foot_events(times, [frame[1] for frame in ordered])
    right_ic, right_to = _one_foot_events(times, [frame[2] for frame in ordered])
    events_at: dict[float, dict[str, bool]] = {}
    for key, event_times in (("HS_L", left_ic), ("TO_L", left_to), ("HS_R", right_ic), ("TO_R", right_to)):
        for event_time in event_times:
            events_at.setdefault(event_time, {})[key] = True
    rows: list[dict[str, object]] = []
    for time_s in times:
        row: dict[str, object] = {"session_t_s": time_s, "phase": "GAIT", "running": 1}
        row.update(events_at.get(time_s, {}))
        rows.append(row)
    return rows, {
        "available": len(left_ic) >= 2 and len(right_ic) >= 2 and bool(left_to) and bool(right_to),
        "eventSource": "pressure_hysteresis_v1",
        "heelStrikeCountLeft": len(left_ic),
        "heelStrikeCountRight": len(right_ic),
        "toeOffCountLeft": len(left_to),
        "toeOffCountRight": len(right_to),
        "threshold": {
            "sensorActiveKpa": SENSOR_ACTIVE_THRESHOLD_KPA,
            "onFraction": ON_FRACTION,
            "offFraction": OFF_FRACTION,
        },
    }
