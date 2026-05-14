from __future__ import annotations

from .models import FallingTile


def screen_lane_of_point(x: float, lane_rects: list[tuple[float, float]]) -> int | None:
    for i, (left, right) in enumerate(lane_rects):
        if left <= x < right:
            return i
    return None


def point_inside_tile_center_radius(
    x: float,
    y: float,
    tile: FallingTile,
    lane_bounds: tuple[float, float],
    radius_frac: float,
) -> bool:
    left, right = lane_bounds
    lane_w = right - left
    pad_x = max(8.0, lane_w / 12.0)
    tile_left = left + pad_x
    tile_right = right - pad_x
    cx = (tile_left + tile_right) * 0.5
    cy = tile.y + tile.h * 0.5
    radius = min(tile_right - tile_left, float(tile.h)) * radius_frac
    return (x - cx) * (x - cx) + (y - cy) * (y - cy) <= radius * radius


def lane_ready_for_tile(
    lane: int,
    tiles: list[FallingTile],
    play_top: int,
    tile_h: int,
    same_lane_gap_px: int,
) -> bool:
    same_lane_tiles = [t for t in tiles if (not t.hit) and t.lane == lane]
    if not same_lane_tiles:
        return True
    highest_existing_top = min(t.y for t in same_lane_tiles)
    return highest_existing_top >= play_top + tile_h + same_lane_gap_px

