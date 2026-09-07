from __future__ import annotations

from .pressure_phase import pressure_rows


def _frame(value: float) -> list[float]:
    return [value] * 64


def test_pressure_rows_extracts_contact_transitions_from_raw_grids() -> None:
    frames = []
    time_s = 0.0
    # Five 0.2-second stance/swing pairs at 50 Hz. The initial unloaded block
    # ensures the first stance creates a real IC rather than an invented one.
    for _ in range(5):
        for value in (0.0,) * 10 + (10.0,) * 10:
            frames.append((time_s, _frame(value), _frame(value)))
            time_s += 0.02

    rows, quality = pressure_rows(frames)

    assert len(rows) == len(frames)
    assert quality["available"] is True
    assert quality["eventSource"] == "pressure_hysteresis_v1"
    assert quality["heelStrikeCountLeft"] == 5
    assert quality["heelStrikeCountRight"] == 5
    assert quality["toeOffCountLeft"] == 4
    assert quality["toeOffCountRight"] == 4
    assert sum(bool(row.get("HS_L")) for row in rows) == 5
    assert sum(bool(row.get("TO_R")) for row in rows) == 4
