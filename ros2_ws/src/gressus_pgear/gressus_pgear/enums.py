"""Enumerations shared by LogPacket_v2 schemas."""

from __future__ import annotations

from enum import IntEnum


class JointIndex(IntEnum):
    """Joint order in all four-element arrays."""

    R_HIP = 0
    R_KNEE = 1
    L_HIP = 2
    L_KNEE = 3


class GaitPhase(IntEnum):
    """Top-level gait controller phase (firmware-defined IDs)."""

    IDLE = 0
    # Additional phases (e.g. PH_GAIT, PH_RAMP_DOWN) are defined in pgear_v7_addons.h.
