"""Bounded display payloads derived from raw EMG frames."""

from __future__ import annotations

from typing import Any

from gressus_insole.emg_tcp_receiver import EmgFrame


def preview_payload(frame: EmgFrame | None, *, points: int = 32) -> dict[str, Any]:
    """Return a bounded display envelope, never the full 2 kHz acquisition."""
    if frame is None:
        return {"connected": False, "frameSeq": None, "channels": []}

    point_count = max(4, min(points, 64, frame.samples_per_channel))
    stride = frame.samples_per_channel / point_count
    channels = []
    for channel_index, slot in enumerate(frame.sensor_slots):
        values = frame.samples[
            channel_index * frame.samples_per_channel:(channel_index + 1) * frame.samples_per_channel
        ]
        sampled = [values[min(int(index * stride), len(values) - 1)] for index in range(point_count)]
        channels.append({"slot": slot, "samples": sampled})

    return {
        "connected": True,
        "frameSeq": frame.frame_seq,
        "sampleRateHz": frame.sample_rate_hz,
        "samplesPerChannel": frame.samples_per_channel,
        "channels": channels,
    }
