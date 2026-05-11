from __future__ import annotations

from dataclasses import dataclass


@dataclass
class FallingTile:
    lane: int
    note: str
    y: float
    h: int
    hit: bool = False

