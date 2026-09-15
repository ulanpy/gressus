"""Tests for the bounded browser-only EMG preview payload."""

from gressus_insole.emg_tcp_receiver import EmgFrame
from gressus_insole.emg_preview import preview_payload


def test_preview_payload_downsamples_each_channel() -> None:
    frame = EmgFrame(
        frame_seq=7,
        sample_rate_hz=2000,
        samples_per_channel=8,
        sensor_slots=(1, 4),
        samples=tuple(float(value) for value in range(16)),
        received_monotonic=1.0,
    )

    payload = preview_payload(frame, points=4)

    assert payload["frameSeq"] == 7
    assert payload["sampleRateHz"] == 2000
    assert payload["channels"] == [
        {"slot": 1, "samples": [0.0, 2.0, 4.0, 6.0]},
        {"slot": 4, "samples": [8.0, 10.0, 12.0, 14.0]},
    ]


def test_preview_payload_is_empty_without_a_received_frame() -> None:
    assert preview_payload(None) == {"connected": False, "frameSeq": None, "channels": []}
