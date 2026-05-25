from __future__ import annotations

from dataclasses import dataclass


@dataclass
class FallingTile:
    lane: int
    note: str
    y: float
    h: int
    hit: bool = False
    spawn_t: float = 0.0
    hit_t: float = 0.0
